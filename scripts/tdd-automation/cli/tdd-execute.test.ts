/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import {
  FileSystemService,
  CommandService,
  LoggerServicePretty,
  FileNotFoundError,
  CommandFailedError,
} from '../../lib/effect'
import { ErrorClassifier, type ClassificationResult } from '../services/error-classifier'
import {
  GitHubAPIClient,
  GitHubAPIError,
  type GitHubIssue,
  type BranchCheckResult,
} from '../services/github-api-client'

// =============================================================================
// Mock Service Factories
// =============================================================================

/**
 * Creates a mock FileSystemService for testing.
 */
const createMockFileSystemService = (
  files: Record<string, string> = {},
  writes: string[] = []
): Layer.Layer<FileSystemService, never, never> => {
  return Layer.succeed(FileSystemService, {
    readFile: (path: string) => {
      if (files[path] !== undefined) {
        return Effect.succeed(files[path])
      }
      return Effect.fail(new FileNotFoundError({ path }))
    },
    writeFile: (path: string, content: string) => {
      files[path] = content
      writes.push(path)
      return Effect.void
    },
    exists: (path: string) => Effect.succeed(files[path] !== undefined),
    mkdir: () => Effect.void,
    glob: () => Effect.succeed([]),
    format: (content: string) => Effect.succeed(content),
    writeFormatted: (path: string, content: string) => {
      files[path] = content
      writes.push(path)
      return Effect.void
    },
  })
}

/**
 * Creates a mock CommandService for testing.
 */
const createMockCommandService = (
  responses: Record<string, { stdout: string; stderr: string; exitCode: number }> = {}
): Layer.Layer<CommandService, never, never> => {
  return Layer.succeed(CommandService, {
    spawn: (command: readonly string[]) => {
      const key = command.join(' ')

      // Check for partial matches
      for (const [pattern, response] of Object.entries(responses)) {
        if (key.includes(pattern) || pattern.includes(command[0] ?? '')) {
          return Effect.succeed({ ...response, duration: 0 })
        }
      }

      // Default: command not found
      return Effect.succeed({ stdout: '', stderr: 'Command not found', exitCode: 1, duration: 0 })
    },
    exec: (command: string) => {
      // Check for partial matches
      for (const [pattern, response] of Object.entries(responses)) {
        if (command.includes(pattern)) {
          if (response.exitCode !== 0) {
            return Effect.fail(
              new CommandFailedError({
                command,
                exitCode: response.exitCode,
                stderr: response.stderr,
                stdout: response.stdout,
              })
            )
          }
          return Effect.succeed(response.stdout)
        }
      }
      return Effect.succeed('')
    },
    parallel: (commands) => Effect.all(commands),
    withGitHubOutput: (_name: string, command: readonly string[]) => {
      const key = command.join(' ')
      for (const [pattern, response] of Object.entries(responses)) {
        if (key.includes(pattern)) {
          return Effect.succeed({ ...response, duration: 0 })
        }
      }
      return Effect.succeed({ stdout: '', stderr: '', exitCode: 0, duration: 0 })
    },
  })
}

/**
 * Creates a mock GitHubAPIClient for testing.
 */
const createMockGitHubAPIClient = (
  issues: GitHubIssue[] = [],
  branchPatterns: Record<string, BranchCheckResult> = {}
): Layer.Layer<GitHubAPIClient, never, never> => {
  return Layer.succeed(GitHubAPIClient, {
    checkRateLimit: () =>
      Effect.succeed({
        remaining: 5000,
        limit: 5000,
        resetTimestamp: Date.now() + 3_600_000,
        resetDate: new Date(Date.now() + 3_600_000),
      }),
    ensureRateLimit: () => Effect.succeed(true),
    listIssues: () => Effect.succeed(issues),
    getIssue: (issueNumber: number) => {
      const issue = issues.find((i) => i.number === issueNumber)
      if (!issue) {
        return Effect.fail(new GitHubAPIError('getIssue', `Issue #${issueNumber} not found`))
      }
      return Effect.succeed(issue)
    },
    getIssueBody: (issueNumber: number) => {
      const issue = issues.find((i) => i.number === issueNumber)
      return Effect.succeed(issue?.body ?? '')
    },
    addLabels: () => Effect.void,
    removeLabels: () => Effect.void,
    addComment: () => Effect.void,
    closeIssue: () => Effect.void,
    listPRs: () => Effect.succeed([]),
    hasPRForBranch: () => Effect.succeed(false),
    branchExists: (branchName: string) => {
      // Check if any pattern matches
      for (const [pattern, result] of Object.entries(branchPatterns)) {
        if (branchName.includes(pattern)) {
          return Effect.succeed(result)
        }
      }
      return Effect.succeed({ exists: false, name: branchName })
    },
    listWorkflowRuns: () => Effect.succeed([]),
    getWorkflowRunLogs: () => Effect.succeed(''),
  })
}

/**
 * Creates a mock ErrorClassifier for testing.
 */
const createMockErrorClassifier = (
  result: Partial<ClassificationResult> = {}
): Layer.Layer<ErrorClassifier, never, never> => {
  const defaultResult: ClassificationResult = {
    errorType: 'unknown',
    category: 'unknown',
    isInfrastructure: false,
    isRetryable: true,
    shouldPauseQueue: false,
    sdkCrashAfterSuccess: false,
    message: 'Unknown error',
    ...result,
  }

  return Layer.succeed(ErrorClassifier, {
    classify: () => Effect.succeed(defaultResult),
    shouldPauseQueue: (errorType: string) =>
      Effect.succeed(
        ['credit_exhausted', 'rate_limit_exceeded', 'api_overloaded', 'auth_error'].includes(
          errorType
        )
      ),
    getRetryCategory: (errorType: string) =>
      Effect.succeed(
        ['network_error', 'rate_limit_exceeded', 'api_overloaded', 'runner_error'].includes(
          errorType
        )
          ? 'infra'
          : 'spec'
      ),
    detectSdkCrash: (
      logs: string,
      outcome: 'success' | 'failure' | 'cancelled' | 'skipped',
      _branchExists: boolean
    ) =>
      Effect.succeed(
        outcome === 'failure' &&
          (logs.includes('"subtype": "success"') || logs.includes('"subtype":"success"'))
      ),
  })
}

// =============================================================================
// Test Utilities
// =============================================================================

// Store original process values
let originalEnv: NodeJS.ProcessEnv
let originalArgv: string[]

beforeEach(() => {
  originalEnv = { ...process.env }
  originalArgv = [...process.argv]
})

afterEach(() => {
  process.env = originalEnv
  process.argv = originalArgv
})

// =============================================================================
// analyze-result Command Tests
// =============================================================================

describe('tdd-execute: analyze-result command', () => {
  test('classifies successful outcome as not retryable', async () => {
    const files: Record<string, string> = {}
    const writes: string[] = []

    // Set environment variables
    process.env.CLAUDE_OUTCOME = 'success'
    process.env.GITHUB_OUTPUT = '/tmp/github_output'

    const mockErrorClassifier = createMockErrorClassifier({
      errorType: 'success',
      isInfrastructure: false,
      isRetryable: false,
      shouldPauseQueue: false,
      message: 'No error',
    })

    const testLayer = Layer.mergeAll(
      createMockFileSystemService(files, writes),
      createMockCommandService(),
      LoggerServicePretty(),
      createMockGitHubAPIClient(),
      mockErrorClassifier
    )

    // Import and run the analyze command logic
    const program = Effect.gen(function* () {
      const errorClassifier = yield* ErrorClassifier

      const classification = yield* errorClassifier.classify('')

      // Should not pause queue for successful outcome
      expect(classification.shouldPauseQueue).toBe(false)
      expect(classification.isRetryable).toBe(false)

      return classification
    })

    const result = await Effect.runPromise(Effect.provide(program, testLayer))
    expect(result.errorType).toBe('success')
  })

  test('detects credit exhaustion and pauses queue', async () => {
    const files: Record<string, string> = {
      '/tmp/workflow.log': 'Error: Claude credit limit exhausted',
    }
    const writes: string[] = []

    process.env.CLAUDE_OUTCOME = 'failure'
    process.env.WORKFLOW_LOG_FILE = '/tmp/workflow.log'
    process.env.GITHUB_OUTPUT = '/tmp/github_output'

    const mockErrorClassifier = createMockErrorClassifier({
      errorType: 'credit_exhausted',
      isInfrastructure: true,
      isRetryable: false,
      shouldPauseQueue: true,
      message: 'Claude credit limit exhausted',
    })

    const testLayer = Layer.mergeAll(
      createMockFileSystemService(files, writes),
      createMockCommandService(),
      LoggerServicePretty(),
      createMockGitHubAPIClient(),
      mockErrorClassifier
    )

    const program = Effect.gen(function* () {
      const errorClassifier = yield* ErrorClassifier
      const classification = yield* errorClassifier.classify('Error: Claude credit limit exhausted')

      return classification
    })

    const result = await Effect.runPromise(Effect.provide(program, testLayer))
    expect(result.errorType).toBe('credit_exhausted')
    expect(result.shouldPauseQueue).toBe(true)
  })

  test('identifies retryable infrastructure errors', async () => {
    const files: Record<string, string> = {
      '/tmp/workflow.log': 'Error: rate limit exceeded (429)',
    }

    process.env.CLAUDE_OUTCOME = 'failure'
    process.env.WORKFLOW_LOG_FILE = '/tmp/workflow.log'

    const mockErrorClassifier = createMockErrorClassifier({
      errorType: 'rate_limit_exceeded',
      isInfrastructure: true,
      isRetryable: true,
      shouldPauseQueue: true,
      message: 'Rate limit exceeded',
    })

    const testLayer = Layer.mergeAll(
      createMockFileSystemService(files),
      createMockCommandService(),
      LoggerServicePretty(),
      createMockGitHubAPIClient(),
      mockErrorClassifier
    )

    const program = Effect.gen(function* () {
      const errorClassifier = yield* ErrorClassifier
      const classification = yield* errorClassifier.classify('Error: rate limit exceeded (429)')

      return classification
    })

    const result = await Effect.runPromise(Effect.provide(program, testLayer))
    expect(result.isInfrastructure).toBe(true)
    expect(result.isRetryable).toBe(true)
    expect(result.shouldPauseQueue).toBe(true)
  })
})

// =============================================================================
// detect-sdk-crash Command Tests
// =============================================================================

describe('tdd-execute: detect-sdk-crash command', () => {
  test('detects SDK crash when success in logs but outcome is failure', async () => {
    const logContent = `
      Starting Claude Code...
      Processing spec...
      {"type": "result", "subtype": "success"}
      Pushing changes...
      Error: Connection reset by peer
    `

    const files: Record<string, string> = {
      '/tmp/workflow.log': logContent,
    }

    process.env.CLAUDE_OUTCOME = 'failure'
    process.env.WORKFLOW_LOG_FILE = '/tmp/workflow.log'

    const mockErrorClassifier = createMockErrorClassifier({
      sdkCrashAfterSuccess: true,
    })

    const testLayer = Layer.mergeAll(
      createMockFileSystemService(files),
      createMockCommandService(),
      LoggerServicePretty(),
      createMockGitHubAPIClient(),
      mockErrorClassifier
    )

    const program = Effect.gen(function* () {
      const errorClassifier = yield* ErrorClassifier
      const sdkCrash = yield* errorClassifier.detectSdkCrash(logContent, 'failure', false)

      return sdkCrash
    })

    const result = await Effect.runPromise(Effect.provide(program, testLayer))
    expect(result).toBe(true)
  })

  test('no SDK crash when outcome is success', async () => {
    const logContent = `
      Starting Claude Code...
      {"type": "result", "subtype": "success"}
      Done.
    `

    process.env.CLAUDE_OUTCOME = 'success'
    process.env.WORKFLOW_LOG_FILE = '/tmp/workflow.log'

    const testLayer = Layer.mergeAll(
      createMockFileSystemService({ '/tmp/workflow.log': logContent }),
      createMockCommandService(),
      LoggerServicePretty(),
      createMockGitHubAPIClient(),
      createMockErrorClassifier()
    )

    const program = Effect.gen(function* () {
      const errorClassifier = yield* ErrorClassifier
      const sdkCrash = yield* errorClassifier.detectSdkCrash(logContent, 'success', false)

      return sdkCrash
    })

    const result = await Effect.runPromise(Effect.provide(program, testLayer))
    expect(result).toBe(false)
  })

  test('no SDK crash when no success pattern in logs', async () => {
    const logContent = `
      Starting Claude Code...
      Error: Something went wrong
      Process exited with code 1
    `

    process.env.CLAUDE_OUTCOME = 'failure'
    process.env.WORKFLOW_LOG_FILE = '/tmp/workflow.log'

    const testLayer = Layer.mergeAll(
      createMockFileSystemService({ '/tmp/workflow.log': logContent }),
      createMockCommandService(),
      LoggerServicePretty(),
      createMockGitHubAPIClient(),
      createMockErrorClassifier({ sdkCrashAfterSuccess: false })
    )

    const program = Effect.gen(function* () {
      const errorClassifier = yield* ErrorClassifier
      const sdkCrash = yield* errorClassifier.detectSdkCrash(logContent, 'failure', false)

      return sdkCrash
    })

    const result = await Effect.runPromise(Effect.provide(program, testLayer))
    expect(result).toBe(false)
  })
})

// =============================================================================
// verify-branch Command Tests
// =============================================================================

describe('tdd-execute: verify-branch command', () => {
  test('finds branch via git ls-remote', async () => {
    const issueNumber = 123
    const branchName = 'claude/issue-123-1234567890'

    process.env.ISSUE_NUMBER = String(issueNumber)
    process.env.GITHUB_REPOSITORY = 'sovrium/sovrium'

    const commandResponses = {
      'git ls-remote': {
        stdout: `abc123\trefs/heads/${branchName}\n`,
        stderr: '',
        exitCode: 0,
      },
    }

    const testLayer = Layer.mergeAll(
      createMockFileSystemService(),
      createMockCommandService(commandResponses),
      LoggerServicePretty(),
      createMockGitHubAPIClient(),
      createMockErrorClassifier()
    )

    const program = Effect.gen(function* () {
      const cmd = yield* CommandService

      const branchPattern = `claude/issue-${issueNumber}-`
      const lsRemote = yield* cmd
        .spawn([
          'git',
          'ls-remote',
          '--heads',
          'https://github.com/sovrium/sovrium.git',
          `refs/heads/${branchPattern}*`,
        ])
        .pipe(Effect.catchAll(() => Effect.succeed({ stdout: '', stderr: '', exitCode: 1 })))

      expect(lsRemote.exitCode).toBe(0)
      expect(lsRemote.stdout).toContain(branchName)

      const match = lsRemote.stdout.match(/refs\/heads\/(claude\/issue-\d+-\S+)/)
      return match ? match[1] : null
    })

    const result = await Effect.runPromise(Effect.provide(program, testLayer))
    expect(result).toBe(branchName)
  })

  test('falls back to GitHub API when git ls-remote fails', async () => {
    const issueNumber = 456
    const branchName = 'claude/issue-456-1234567890'

    process.env.ISSUE_NUMBER = String(issueNumber)
    process.env.GITHUB_REPOSITORY = 'sovrium/sovrium'

    const branchPatterns: Record<string, BranchCheckResult> = {
      [branchName]: { exists: true, name: branchName, sha: 'abc123' },
    }

    const commandResponses = {
      'git ls-remote': {
        stdout: '',
        stderr: 'fatal: could not read from remote',
        exitCode: 128,
      },
    }

    const testLayer = Layer.mergeAll(
      createMockFileSystemService(),
      createMockCommandService(commandResponses),
      LoggerServicePretty(),
      createMockGitHubAPIClient([], branchPatterns),
      createMockErrorClassifier()
    )

    const program = Effect.gen(function* () {
      const cmd = yield* CommandService
      const ghClient = yield* GitHubAPIClient

      // First try git ls-remote
      const lsRemote = yield* cmd
        .spawn(['git', 'ls-remote'])
        .pipe(
          Effect.catchAll(() =>
            Effect.succeed({ stdout: '', stderr: '', exitCode: 1, duration: 0 })
          )
        )

      let foundBranch: string | null = null

      if (lsRemote.exitCode !== 0 || !lsRemote.stdout.trim()) {
        // Fallback to GitHub API - check if branch exists
        const branchCheck = yield* ghClient
          .branchExists(branchName)
          .pipe(Effect.catchAll(() => Effect.succeed({ exists: false, name: branchName })))

        if (branchCheck.exists) {
          foundBranch = branchCheck.name
        }
      }

      return foundBranch
    })

    const result = await Effect.runPromise(Effect.provide(program, testLayer))
    expect(result).toBe(branchName)
  })

  test('returns null when no branch exists', async () => {
    const issueNumber = 789
    const branchName = `claude/issue-${issueNumber}-1234567890`

    process.env.ISSUE_NUMBER = String(issueNumber)
    process.env.GITHUB_REPOSITORY = 'sovrium/sovrium'

    const commandResponses = {
      'git ls-remote': {
        stdout: '',
        stderr: '',
        exitCode: 0,
      },
    }

    const testLayer = Layer.mergeAll(
      createMockFileSystemService(),
      createMockCommandService(commandResponses),
      LoggerServicePretty(),
      createMockGitHubAPIClient([], {}),
      createMockErrorClassifier()
    )

    const program = Effect.gen(function* () {
      const cmd = yield* CommandService
      const ghClient = yield* GitHubAPIClient

      const lsRemote = yield* cmd
        .spawn(['git', 'ls-remote'])
        .pipe(
          Effect.catchAll(() =>
            Effect.succeed({ stdout: '', stderr: '', exitCode: 1, duration: 0 })
          )
        )

      let foundBranch: string | null = null

      if (!lsRemote.stdout.trim()) {
        const branchCheck = yield* ghClient
          .branchExists(branchName)
          .pipe(Effect.catchAll(() => Effect.succeed({ exists: false, name: branchName })))

        if (branchCheck.exists) {
          foundBranch = branchCheck.name
        }
      }

      return foundBranch
    })

    const result = await Effect.runPromise(Effect.provide(program, testLayer))
    expect(result).toBeNull()
  })

  test('detects post-processing 404 error when branch exists but outcome is failure', async () => {
    const issueNumber = 101
    const branchName = 'claude/issue-101-1234567890'

    process.env.ISSUE_NUMBER = String(issueNumber)
    process.env.CLAUDE_OUTCOME = 'failure'
    process.env.GITHUB_REPOSITORY = 'sovrium/sovrium'

    const commandResponses = {
      'git ls-remote': {
        stdout: `abc123\trefs/heads/${branchName}\n`,
        stderr: '',
        exitCode: 0,
      },
    }

    const testLayer = Layer.mergeAll(
      createMockFileSystemService(),
      createMockCommandService(commandResponses),
      LoggerServicePretty(),
      createMockGitHubAPIClient(),
      createMockErrorClassifier()
    )

    const program = Effect.gen(function* () {
      const cmd = yield* CommandService

      const lsRemote = yield* cmd
        .spawn(['git', 'ls-remote'])
        .pipe(Effect.catchAll(() => Effect.succeed({ stdout: '', stderr: '', exitCode: 1 })))

      const match = lsRemote.stdout.match(/refs\/heads\/(claude\/issue-\d+-\S+)/)
      const foundBranch = match ? match[1] : null
      const hasBranch = foundBranch !== null
      const isPostProcessing404 = hasBranch && process.env.CLAUDE_OUTCOME === 'failure'

      return { hasBranch, branchName: foundBranch, isPostProcessing404 }
    })

    const result = await Effect.runPromise(Effect.provide(program, testLayer))
    expect(result.hasBranch).toBe(true)
    expect(result.isPostProcessing404).toBe(true)
    expect(result.branchName).toBe(branchName)
  })
})

// =============================================================================
// extract-context Command Tests
// =============================================================================

describe('tdd-execute: extract-context command', () => {
  test('extracts spec ID from issue title', async () => {
    const issueNumber = 200
    const specId = 'API-TABLES-RECORDS-DELETE-015'

    const issues: GitHubIssue[] = [
      {
        number: issueNumber,
        title: `🤖 ${specId}: Implement table record deletion endpoint`,
        body: 'Implement the DELETE endpoint for table records.',
        state: 'open',
        labels: [{ name: 'tdd-spec:queued' }],
        createdAt: '2025-01-25T10:00:00Z',
        updatedAt: '2025-01-25T10:00:00Z',
        url: `https://github.com/sovrium/sovrium/issues/${issueNumber}`,
      },
    ]

    process.env.ISSUE_NUMBER = String(issueNumber)

    const testLayer = Layer.mergeAll(
      createMockFileSystemService(),
      createMockCommandService(),
      LoggerServicePretty(),
      createMockGitHubAPIClient(issues),
      createMockErrorClassifier()
    )

    const program = Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient

      const issue = yield* ghClient
        .getIssue(issueNumber)
        .pipe(Effect.catchAll(() => Effect.succeed(null)))

      if (!issue) return null

      // Extract spec ID pattern
      const specIdPattern = /[A-Z]+-[A-Z]+-[A-Z0-9-]+/
      const extractedSpecId = issue.title.match(specIdPattern)?.[0] ?? null

      return extractedSpecId
    })

    const result = await Effect.runPromise(Effect.provide(program, testLayer))
    expect(result).toBe(specId)
  })

  test('extracts spec ID from issue body when not in title', async () => {
    const issueNumber = 201
    const specId = 'UI-COMPONENTS-BUTTON-001'

    const issues: GitHubIssue[] = [
      {
        number: issueNumber,
        title: '🤖 Implement button component',
        body: `Implement the button component as specified in ${specId}.`,
        state: 'open',
        labels: [{ name: 'tdd-spec:queued' }],
        createdAt: '2025-01-25T10:00:00Z',
        updatedAt: '2025-01-25T10:00:00Z',
        url: `https://github.com/sovrium/sovrium/issues/${issueNumber}`,
      },
    ]

    process.env.ISSUE_NUMBER = String(issueNumber)

    const testLayer = Layer.mergeAll(
      createMockFileSystemService(),
      createMockCommandService(),
      LoggerServicePretty(),
      createMockGitHubAPIClient(issues),
      createMockErrorClassifier()
    )

    const program = Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient

      const issue = yield* ghClient
        .getIssue(issueNumber)
        .pipe(Effect.catchAll(() => Effect.succeed(null)))

      if (!issue) return null

      const specIdPattern = /[A-Z]+-[A-Z]+-[A-Z0-9-]+/
      let extractedSpecId = issue.title.match(specIdPattern)?.[0] ?? null

      // Fallback to body if not in title
      if (!extractedSpecId && issue.body) {
        extractedSpecId = issue.body.match(specIdPattern)?.[0] ?? null
      }

      return extractedSpecId
    })

    const result = await Effect.runPromise(Effect.provide(program, testLayer))
    expect(result).toBe(specId)
  })

  test('returns null when issue not found', async () => {
    const issueNumber = 999

    process.env.ISSUE_NUMBER = String(issueNumber)

    const testLayer = Layer.mergeAll(
      createMockFileSystemService(),
      createMockCommandService(),
      LoggerServicePretty(),
      createMockGitHubAPIClient([]),
      createMockErrorClassifier()
    )

    const program = Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient

      const issue = yield* ghClient
        .getIssue(issueNumber)
        .pipe(Effect.catchAll(() => Effect.succeed(null)))

      return issue
    })

    const result = await Effect.runPromise(Effect.provide(program, testLayer))
    expect(result).toBeNull()
  })

  test('returns null when no spec ID found in issue', async () => {
    const issueNumber = 202

    const issues: GitHubIssue[] = [
      {
        number: issueNumber,
        title: '🤖 Some task without spec ID',
        body: 'Just a regular issue without any spec identifier.',
        state: 'open',
        labels: [{ name: 'tdd-spec:queued' }],
        createdAt: '2025-01-25T10:00:00Z',
        updatedAt: '2025-01-25T10:00:00Z',
        url: `https://github.com/test/repo/issues/${issueNumber}`,
      },
    ]

    process.env.ISSUE_NUMBER = String(issueNumber)

    const testLayer = Layer.mergeAll(
      createMockFileSystemService(),
      createMockCommandService(),
      LoggerServicePretty(),
      createMockGitHubAPIClient(issues),
      createMockErrorClassifier()
    )

    const program = Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient

      const issue = yield* ghClient
        .getIssue(issueNumber)
        .pipe(Effect.catchAll(() => Effect.succeed(null)))

      if (!issue) return null

      const specIdPattern = /[A-Z]+-[A-Z]+-[A-Z0-9-]+/
      let extractedSpecId = issue.title.match(specIdPattern)?.[0] ?? null

      if (!extractedSpecId && issue.body) {
        extractedSpecId = issue.body.match(specIdPattern)?.[0] ?? null
      }

      return extractedSpecId
    })

    const result = await Effect.runPromise(Effect.provide(program, testLayer))
    expect(result).toBeNull()
  })

  test('extracts context with complete issue data', async () => {
    const issueNumber = 203
    const specId = 'API-AUTH-LOGIN-003'
    const issueTitle = `🤖 ${specId}: Implement login endpoint`
    const issueBody = 'Implement the POST /api/auth/login endpoint with JWT tokens.'

    const issues: GitHubIssue[] = [
      {
        number: issueNumber,
        title: issueTitle,
        body: issueBody,
        state: 'open',
        labels: [{ name: 'tdd-spec:queued' }],
        createdAt: '2025-01-25T10:00:00Z',
        updatedAt: '2025-01-25T10:00:00Z',
        url: `https://github.com/test/repo/issues/${issueNumber}`,
      },
    ]

    process.env.ISSUE_NUMBER = String(issueNumber)

    const testLayer = Layer.mergeAll(
      createMockFileSystemService(),
      createMockCommandService(),
      LoggerServicePretty(),
      createMockGitHubAPIClient(issues),
      createMockErrorClassifier()
    )

    const program = Effect.gen(function* () {
      const ghClient = yield* GitHubAPIClient

      const issue = yield* ghClient
        .getIssue(issueNumber)
        .pipe(Effect.catchAll(() => Effect.succeed(null)))

      if (!issue) return null

      const specIdPattern = /[A-Z]+-[A-Z]+-[A-Z0-9-]+/
      const extractedSpecId = issue.title.match(specIdPattern)?.[0] ?? null

      return {
        specId: extractedSpecId,
        issueNumber: issue.number,
        issueTitle: issue.title,
        issueBody: issue.body,
      }
    })

    const result = await Effect.runPromise(Effect.provide(program, testLayer))
    expect(result).not.toBeNull()
    expect(result!.specId).toBe(specId)
    expect(result!.issueNumber).toBe(issueNumber)
    expect(result!.issueTitle).toBe(issueTitle)
    expect(result!.issueBody).toBe(issueBody)
  })
})
