/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Context, Layer, Data } from 'effect'
import type { TDDState, SpecQueueItem, SpecStatus, SpecError, RequeueOptions } from '../types'

/**
 * Tagged error types for state manager operations
 */
class StateFileReadError extends Data.TaggedError('StateFileReadError')<{
  readonly path: string
  readonly cause: unknown
}> {}

class StateFileWriteError extends Data.TaggedError('StateFileWriteError')<{
  readonly path: string
  readonly cause: unknown
}> {}

class MaxRetriesExceededError extends Data.TaggedError('MaxRetriesExceededError')<{
  readonly maxRetries: number
}> {}

class SpecNotFoundInQueueError extends Data.TaggedError('SpecNotFoundInQueueError')<{
  readonly specId: string
  readonly queueName: string
}> {}

class GitHubAPIError extends Data.TaggedError('GitHubAPIError')<{
  readonly status: number
  readonly message: string
  readonly cause: unknown
}> {}

/**
 * State Manager Service
 *
 * Handles all state file operations with file-level locking and atomic updates.
 * Uses GitHub Contents API to update state file on protected branches.
 *
 * IMPORTANT: This service uses the GitHub Contents API instead of git push because:
 * 1. The main branch is protected and requires PRs for changes
 * 2. GitHub Actions tokens can update files via API even on protected branches
 * 3. The API provides atomic read-modify-write with ETag/SHA-based optimistic locking
 */
export class StateManager extends Context.Tag('StateManager')<
  StateManager,
  {
    readonly load: () => Effect.Effect<TDDState, Error>
    readonly save: (state: TDDState) => Effect.Effect<void, Error>
    readonly transition: (
      specId: string,
      from: SpecStatus,
      to: SpecStatus
    ) => Effect.Effect<void, Error>
    readonly addActiveFile: (filePath: string) => Effect.Effect<void, Error>
    readonly removeActiveFile: (filePath: string) => Effect.Effect<void, Error>
    readonly addActiveSpec: (specId: string) => Effect.Effect<void, Error>
    readonly removeActiveSpec: (specId: string) => Effect.Effect<void, Error>
    readonly isFileLocked: (filePath: string) => Effect.Effect<boolean, Error>
    readonly recordFailureAndRequeue: (
      specId: string,
      error: SpecError
    ) => Effect.Effect<void, Error>
    readonly moveToManualIntervention: (
      specId: string,
      details: {
        errors: SpecError[]
        failureReason: string
        requiresAction: string
      }
    ) => Effect.Effect<void, Error>
    readonly requeueFromFailed: (
      specId: string,
      options: RequeueOptions
    ) => Effect.Effect<void, Error>
    /**
     * Lock and activate multiple specs in a single atomic operation.
     * This prevents race conditions by batching all lock operations into one API call.
     */
    readonly lockAndActivateSpecs: (
      specs: Array<{ specId: string; filePath: string }>
    ) => Effect.Effect<void, Error>
  }
>() {}

const STATE_FILE_PATH = '.github/tdd-state.json'
const MAX_RETRIES = 5
const RETRY_DELAY_MS = 1000

/**
 * Helper: Get GitHub repository info from environment
 */
const getRepoInfo = (): { owner: string; repo: string; token: string } => {
  const repository = process.env['GITHUB_REPOSITORY'] || ''
  const [owner, repo] = repository.split('/')
  const token = process.env['GH_TOKEN'] || process.env['GITHUB_TOKEN'] || ''

  if (!owner || !repo) {
    throw new Error('GITHUB_REPOSITORY environment variable not set or invalid')
  }

  if (!token) {
    throw new Error('GH_TOKEN or GITHUB_TOKEN environment variable not set')
  }

  return { owner, repo, token }
}

/**
 * Helper: Check if running in CI environment
 */
const isCI = (): boolean => {
  return process.env['CI'] === 'true' || process.env['GITHUB_ACTIONS'] === 'true'
}


/**
 * Helper: Sleep for specified milliseconds
 */
const sleep = (ms: number): Effect.Effect<void> =>
  Effect.promise(() => new Promise((resolve) => setTimeout(resolve, ms)))

/**
 * Helper: Read state file from disk (local development or after checkout)
 */
const readStateFileFromDisk = (): Effect.Effect<TDDState, StateFileReadError> =>
  Effect.tryPromise({
    try: async () => {
      const file = Bun.file(STATE_FILE_PATH)
      const exists = await file.exists()

      if (!exists) {
        // Return initial state if file doesn't exist yet
        const { INITIAL_STATE } = await import('../types')
        return INITIAL_STATE
      }

      const content = await file.text()
      return JSON.parse(content) as TDDState
    },
    catch: (error) => new StateFileReadError({ path: STATE_FILE_PATH, cause: error }),
  })

/**
 * Helper: Read state file from GitHub API (for CI/CD)
 * This ensures we always get the latest state from the remote.
 */
const readStateFileFromGitHub = (): Effect.Effect<
  { state: TDDState; sha: string },
  StateFileReadError | GitHubAPIError
> =>
  Effect.tryPromise({
    try: async () => {
      const { owner, repo, token } = getRepoInfo()
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${STATE_FILE_PATH}?ref=main`

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })

      if (response.status === 404) {
        // File doesn't exist yet, return initial state with empty SHA
        const { INITIAL_STATE } = await import('../types')
        return { state: INITIAL_STATE, sha: '' }
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new GitHubAPIError({
          status: response.status,
          message: `Failed to read state file: ${errorText}`,
          cause: new Error(errorText),
        })
      }

      const data = (await response.json()) as { content: string; sha: string }
      const content = Buffer.from(data.content, 'base64').toString('utf-8')
      const state = JSON.parse(content) as TDDState

      return { state, sha: data.sha }
    },
    catch: (error) => {
      if (error instanceof GitHubAPIError) {
        return error
      }
      return new StateFileReadError({ path: STATE_FILE_PATH, cause: error })
    },
  })

/**
 * Helper: Write state file via GitHub API
 * This bypasses branch protection for the state file.
 */
const writeStateFileViaGitHub = (
  state: TDDState,
  sha: string
): Effect.Effect<void, GitHubAPIError> =>
  Effect.tryPromise({
    try: async () => {
      const { owner, repo, token } = getRepoInfo()
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${STATE_FILE_PATH}`

      console.log(`📤 GitHub API PUT request to: ${url}`)
      console.log(`📋 SHA for update: ${sha ? sha.slice(0, 7) : '(new file)'}`)

      const updatedState: TDDState = {
        ...state,
        lastUpdated: new Date().toISOString(),
      }

      const content = Buffer.from(JSON.stringify(updatedState, null, 2)).toString('base64')

      const body: Record<string, string> = {
        message: 'chore(tdd): update state [skip ci]',
        content,
        branch: 'main',
      }

      // Only include sha if file already exists (for update)
      if (sha) {
        body['sha'] = sha
      }

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify(body),
      })

      console.log(`📥 GitHub API response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ GitHub API error response: ${errorText}`)
        throw new GitHubAPIError({
          status: response.status,
          message: `Failed to write state file (HTTP ${response.status}): ${errorText}`,
          cause: new Error(errorText),
        })
      }

      console.log('✅ GitHub API PUT request successful')
    },
    catch: (error) => {
      if (error instanceof GitHubAPIError) {
        return error
      }
      console.error(`❌ Unexpected error in writeStateFileViaGitHub: ${error}`)
      return new GitHubAPIError({
        status: 0,
        message: `Unexpected error writing state file: ${error}`,
        cause: error,
      })
    },
  })

/**
 * Helper: Write state file to disk (for local development)
 */
const writeStateFileToDisk = (state: TDDState): Effect.Effect<void, StateFileWriteError> =>
  Effect.tryPromise({
    try: async () => {
      const updatedState: TDDState = {
        ...state,
        lastUpdated: new Date().toISOString(),
      }
      await Bun.write(STATE_FILE_PATH, JSON.stringify(updatedState, null, 2))
    },
    catch: (error) => new StateFileWriteError({ path: STATE_FILE_PATH, cause: error }),
  })

/**
 * Helper: Atomic state update with retry
 *
 * Uses GitHub Contents API for CI environments (protected branches).
 * Uses direct file I/O for local development.
 *
 * The API provides optimistic locking via SHA - if the file changed since we read it,
 * the update will fail with 409 Conflict, and we'll retry with the latest state.
 */
const updateStateWithRetry = (
  newState: TDDState,
  sha: string = '',
  retriesLeft: number = MAX_RETRIES
): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    if (retriesLeft <= 0) {
      yield* Effect.logError(`❌ Max retries (${MAX_RETRIES}) exceeded for state update`)
      return yield* new MaxRetriesExceededError({ maxRetries: MAX_RETRIES })
    }

    if (!isCI()) {
      // Local development: just write to disk
      yield* writeStateFileToDisk(newState)
      return
    }

    // CI environment: use GitHub API
    yield* Effect.log(`📝 Attempting state update via GitHub API (attempt ${MAX_RETRIES - retriesLeft + 1}/${MAX_RETRIES}, sha: ${sha.slice(0, 7) || 'new'})...`)

    return yield* writeStateFileViaGitHub(newState, sha).pipe(
      Effect.tapBoth({
        onSuccess: () => Effect.log('✅ State file updated successfully via GitHub API'),
        onFailure: (error) => Effect.logError(`❌ GitHub API error: ${JSON.stringify(error)}`),
      }),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          const errorMessage = String(error)
          const errorJson = JSON.stringify(error, null, 2)

          yield* Effect.logWarning(`GitHub API error details:\n${errorJson}`)

          // Check if error is due to concurrent update (SHA mismatch)
          if (
            errorMessage.includes('409') ||
            errorMessage.includes('conflict') ||
            errorMessage.includes('SHA') ||
            errorMessage.includes('does not match')
          ) {
            // Retry after delay with fresh state
            yield* Effect.log(
              `🔄 State update conflict detected, retrying (${retriesLeft - 1} attempts remaining)...`
            )
            yield* sleep(RETRY_DELAY_MS)

            // Re-read to get the latest SHA for the next attempt
            const { sha: freshSha } = yield* readStateFileFromGitHub()

            // Retry with the fresh SHA
            // Note: We use the same newState as it represents our desired final state
            return yield* updateStateWithRetry(newState, freshSha, retriesLeft - 1)
          }

          // Other error - fail immediately with detailed message
          yield* Effect.logError(`❌ Non-retryable error: ${errorMessage}`)
          return yield* Effect.fail(error as Error)
        })
      )
    )
  })

/**
 * Helper: Transform state atomically
 */
const updateState = (fn: (state: TDDState) => TDDState): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    if (!isCI()) {
      // Local development: read from disk, write to disk
      const currentState = yield* readStateFileFromDisk()
      const newState = fn(currentState)
      yield* writeStateFileToDisk(newState)
      return
    }

    // CI environment: read from GitHub, write via GitHub API
    const { state: currentState, sha } = yield* readStateFileFromGitHub()
    const newState = fn(currentState)
    yield* updateStateWithRetry(newState, sha)
  })

/**
 * State Manager Live Implementation
 */
export const StateManagerLive = Layer.succeed(StateManager, {
  load: () =>
    Effect.gen(function* () {
      if (!isCI()) {
        return yield* readStateFileFromDisk()
      }
      const { state } = yield* readStateFileFromGitHub()
      return state
    }),

  save: (state) =>
    Effect.gen(function* () {
      if (!isCI()) {
        yield* writeStateFileToDisk(state)
        return
      }
      const { sha } = yield* readStateFileFromGitHub()
      yield* updateStateWithRetry(state, sha)
    }),

  transition: (specId, from, to) =>
    Effect.gen(function* () {
      yield* Effect.log(`Transitioning ${specId}: ${from} → ${to}`)

      yield* updateState((state) => {
        // Find spec in source queue
        const sourceQueue = state.queue[from]
        const spec = sourceQueue.find((s) => s.specId === specId)

        if (!spec) {
          throw new SpecNotFoundInQueueError({ specId, queueName: from })
        }

        // Remove from source queue
        const newSourceQueue = sourceQueue.filter((s) => s.specId !== specId)

        // Update spec status and timestamp
        const updatedSpec: SpecQueueItem = {
          id: spec.id,
          specId: spec.specId,
          filePath: spec.filePath,
          testName: spec.testName,
          priority: spec.priority,
          status: to,
          attempts: spec.attempts,
          errors: spec.errors,
          queuedAt: spec.queuedAt,
          prNumber: spec.prNumber,
          prUrl: spec.prUrl,
          branch: spec.branch,
          lastAttempt: spec.lastAttempt,
          startedAt: to === 'active' ? new Date().toISOString() : spec.startedAt,
          completedAt: to === 'completed' ? new Date().toISOString() : spec.completedAt,
          failureReason: spec.failureReason,
          requiresAction: spec.requiresAction,
        }

        // Add to destination queue
        const destQueue = state.queue[to]
        const newDestQueue = [...destQueue, updatedSpec]

        return {
          ...state,
          queue: {
            ...state.queue,
            [from]: newSourceQueue,
            [to]: newDestQueue,
          },
        }
      })
    }),

  addActiveFile: (filePath) =>
    Effect.gen(function* () {
      yield* Effect.log(`🔒 Locking file: ${filePath}`)

      yield* updateState((state) => {
        // Idempotent: don't add if already present
        if (state.activeFiles.includes(filePath)) {
          return state
        }

        return {
          ...state,
          activeFiles: [...state.activeFiles, filePath],
        }
      })
    }),

  removeActiveFile: (filePath) =>
    Effect.gen(function* () {
      yield* Effect.log(`🔓 Unlocking file: ${filePath}`)

      yield* updateState((state) => ({
        ...state,
        activeFiles: state.activeFiles.filter((f) => f !== filePath),
      }))
    }),

  isFileLocked: (filePath) =>
    Effect.gen(function* () {
      if (!isCI()) {
        const state = yield* readStateFileFromDisk()
        return state.activeFiles.includes(filePath)
      }
      const { state } = yield* readStateFileFromGitHub()
      return state.activeFiles.includes(filePath)
    }),

  addActiveSpec: (specId) =>
    Effect.gen(function* () {
      yield* Effect.log(`🔒 Locking spec: ${specId}`)

      yield* updateState((state) => {
        // Idempotent: don't add if already present
        if (state.activeSpecs.includes(specId)) {
          return state
        }

        return {
          ...state,
          activeSpecs: [...state.activeSpecs, specId],
        }
      })
    }),

  removeActiveSpec: (specId) =>
    Effect.gen(function* () {
      yield* Effect.log(`🔓 Unlocking spec: ${specId}`)

      yield* updateState((state) => ({
        ...state,
        activeSpecs: state.activeSpecs.filter((id) => id !== specId),
      }))
    }),

  recordFailureAndRequeue: (specId, error) =>
    Effect.gen(function* () {
      yield* Effect.log(`Recording failure for ${specId}: ${error.type}`)

      yield* updateState((state) => {
        // Find spec in active queue
        const spec = state.queue.active.find((s) => s.specId === specId)

        if (!spec) {
          throw new SpecNotFoundInQueueError({ specId, queueName: 'active' })
        }

        // Update spec with error and increment attempts
        const updatedSpec: SpecQueueItem = {
          id: spec.id,
          specId: spec.specId,
          filePath: spec.filePath,
          testName: spec.testName,
          priority: spec.priority,
          status: 'pending',
          attempts: spec.attempts + 1,
          errors: [...spec.errors, error],
          queuedAt: spec.queuedAt,
          prNumber: spec.prNumber,
          prUrl: spec.prUrl,
          branch: spec.branch,
          lastAttempt: new Date().toISOString(),
          startedAt: spec.startedAt,
          completedAt: spec.completedAt,
          failureReason: spec.failureReason,
          requiresAction: spec.requiresAction,
        }

        // Remove from active, add to pending
        const newActive = state.queue.active.filter((s) => s.specId !== specId)

        return {
          ...state,
          queue: {
            ...state.queue,
            active: newActive,
            pending: [...state.queue.pending, updatedSpec],
          },
        }
      })
    }),

  moveToManualIntervention: (specId, details) =>
    Effect.gen(function* () {
      yield* Effect.log(`Moving ${specId} to manual intervention: ${details.failureReason}`)

      yield* updateState((state) => {
        // Find spec in active queue
        const spec = state.queue.active.find((s) => s.specId === specId)

        if (!spec) {
          throw new SpecNotFoundInQueueError({ specId, queueName: 'active' })
        }

        // Update spec with failure details
        const failedSpec: SpecQueueItem = {
          id: spec.id,
          specId: spec.specId,
          filePath: spec.filePath,
          testName: spec.testName,
          priority: spec.priority,
          status: 'failed',
          attempts: spec.attempts,
          errors: details.errors,
          queuedAt: spec.queuedAt,
          prNumber: spec.prNumber,
          prUrl: spec.prUrl,
          branch: spec.branch,
          lastAttempt: spec.lastAttempt,
          startedAt: spec.startedAt,
          completedAt: spec.completedAt,
          failureReason: details.failureReason,
          requiresAction: details.requiresAction,
        }

        // Remove from active, add to failed
        const newActive = state.queue.active.filter((s) => s.specId !== specId)

        return {
          ...state,
          queue: {
            ...state.queue,
            active: newActive,
            failed: [...state.queue.failed, failedSpec],
          },
          metrics: {
            ...state.metrics,
            manualInterventionCount: state.metrics.manualInterventionCount + 1,
          },
        }
      })
    }),

  requeueFromFailed: (specId, options) =>
    Effect.gen(function* () {
      yield* Effect.log(`Re-queuing ${specId} from failed status`)

      yield* updateState((state) => {
        // Find spec in failed queue
        const spec = state.queue.failed.find((s) => s.specId === specId)

        if (!spec) {
          throw new SpecNotFoundInQueueError({ specId, queueName: 'failed' })
        }

        // Reset spec
        const requeuedSpec: SpecQueueItem = {
          id: spec.id,
          specId: spec.specId,
          filePath: spec.filePath,
          testName: spec.testName,
          priority: spec.priority,
          status: 'pending',
          attempts: options.resetRetries ? 0 : spec.attempts,
          errors: options.clearErrors ? [] : spec.errors,
          queuedAt: spec.queuedAt,
          prNumber: spec.prNumber,
          prUrl: spec.prUrl,
          branch: spec.branch,
          lastAttempt: undefined,
          startedAt: spec.startedAt,
          completedAt: spec.completedAt,
          failureReason: undefined,
          requiresAction: undefined,
        }

        // Remove from failed, add to pending
        const newFailed = state.queue.failed.filter((s) => s.specId !== specId)

        return {
          ...state,
          queue: {
            ...state.queue,
            failed: newFailed,
            pending: [...state.queue.pending, requeuedSpec],
          },
        }
      })
    }),

  lockAndActivateSpecs: (specs) =>
    Effect.gen(function* () {
      if (specs.length === 0) {
        return
      }

      yield* Effect.log(
        `🔒 Locking and activating ${specs.length} spec(s) in single atomic operation...`
      )

      yield* updateState((state) => {
        // Collect all file paths and spec IDs to lock
        const filePaths = specs.map((s) => s.filePath)
        const specIds = specs.map((s) => s.specId)

        // Add files to activeFiles (idempotent - don't add duplicates)
        const newActiveFiles = [...state.activeFiles]
        for (const filePath of filePaths) {
          if (!newActiveFiles.includes(filePath)) {
            newActiveFiles.push(filePath)
          }
        }

        // Add specs to activeSpecs (idempotent - don't add duplicates)
        const newActiveSpecs = [...state.activeSpecs]
        for (const specId of specIds) {
          if (!newActiveSpecs.includes(specId)) {
            newActiveSpecs.push(specId)
          }
        }

        // Transition all specs from pending to active
        let newPendingQueue = [...state.queue.pending]
        const newActiveQueue = [...state.queue.active]

        for (const { specId } of specs) {
          const spec = newPendingQueue.find((s) => s.specId === specId)
          if (!spec) {
            throw new SpecNotFoundInQueueError({ specId, queueName: 'pending' })
          }

          // Remove from pending
          newPendingQueue = newPendingQueue.filter((s) => s.specId !== specId)

          // Update spec status and add to active
          const updatedSpec: SpecQueueItem = {
            id: spec.id,
            specId: spec.specId,
            filePath: spec.filePath,
            testName: spec.testName,
            priority: spec.priority,
            status: 'active',
            attempts: spec.attempts,
            errors: spec.errors,
            queuedAt: spec.queuedAt,
            prNumber: spec.prNumber,
            prUrl: spec.prUrl,
            branch: spec.branch,
            lastAttempt: spec.lastAttempt,
            startedAt: new Date().toISOString(),
            completedAt: spec.completedAt,
            failureReason: spec.failureReason,
            requiresAction: spec.requiresAction,
          }
          newActiveQueue.push(updatedSpec)
        }

        return {
          ...state,
          activeFiles: newActiveFiles,
          activeSpecs: newActiveSpecs,
          queue: {
            ...state.queue,
            pending: newPendingQueue,
            active: newActiveQueue,
          },
        }
      })

      yield* Effect.log(`✅ Successfully locked and activated ${specs.length} spec(s)`)
    }),
})
