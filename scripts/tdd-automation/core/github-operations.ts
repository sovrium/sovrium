/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect, Data } from 'effect'
import type { TDDState } from '../types'

/**
 * Tagged error for GitHub API operations
 */
export class GitHubAPIError extends Data.TaggedError('GitHubAPIError')<{
  readonly status: number
  readonly message: string
  readonly cause: unknown
}> {}

/**
 * Constants
 */
const STATE_FILE_PATH = '.github/tdd-state.json'
const STATE_BRANCH = 'tdd-state' // Unprotected branch for state storage

/**
 * Helper: Get repository information from environment
 */
export const getRepoInfo = (): { owner: string; repo: string; token: string } => {
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
export const isCI = (): boolean => {
  return process.env['CI'] === 'true' || process.env['GITHUB_ACTIONS'] === 'true'
}

/**
 * Helper: Ensure the state branch exists
 * Creates the branch if it doesn't exist, using main as the base.
 */
export const ensureStateBranchExists = async (
  owner: string,
  repo: string,
  token: string
): Promise<void> => {
  // Check if branch exists
  const branchUrl = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${STATE_BRANCH}`
  const branchResponse = await fetch(branchUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (branchResponse.status === 200) {
    console.error(`✅ State branch '${STATE_BRANCH}' exists`)
    return
  }

  console.error(`📌 Creating state branch '${STATE_BRANCH}'...`)

  // Get main branch SHA
  const mainUrl = `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/main`
  const mainResponse = await fetch(mainUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!mainResponse.ok) {
    const errorText = await mainResponse.text()
    throw new Error(`Failed to get main branch: ${errorText}`)
  }

  const mainData = (await mainResponse.json()) as { object: { sha: string } }
  const mainSha = mainData.object.sha

  // Create the state branch
  const createUrl = `https://api.github.com/repos/${owner}/${repo}/git/refs`
  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      ref: `refs/heads/${STATE_BRANCH}`,
      sha: mainSha,
    }),
  })

  if (!createResponse.ok) {
    const errorText = await createResponse.text()
    throw new Error(`Failed to create state branch: ${errorText}`)
  }

  console.error(`✅ Created state branch '${STATE_BRANCH}'`)
}

/**
 * Helper: Read state file from GitHub API (for CI/CD)
 * Reads from the dedicated state branch (unprotected) to ensure we can write updates.
 */
export const readStateFileFromGitHub = (
  stateFilePath: string = STATE_FILE_PATH
): Effect.Effect<{ state: TDDState; sha: string }, GitHubAPIError> =>
  Effect.tryPromise({
    try: async () => {
      const { owner, repo, token } = getRepoInfo()

      // Ensure state branch exists before trying to read
      await ensureStateBranchExists(owner, repo, token)

      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${stateFilePath}?ref=${STATE_BRANCH}`

      console.error(`📖 Reading state from branch '${STATE_BRANCH}'`)

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })

      if (response.status === 404) {
        // File doesn't exist yet on state branch, return initial state with empty SHA
        console.error(`📝 State file not found on '${STATE_BRANCH}', will create new`)
        const { INITIAL_STATE } = await import('../types')
        return { state: INITIAL_STATE, sha: '' }
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new GitHubAPIError({
          status: response.status,
          message: `Failed to read state file from ${STATE_BRANCH}: ${errorText}`,
          cause: new Error(errorText),
        })
      }

      const data = (await response.json()) as { content: string; sha: string }
      const content = Buffer.from(data.content, 'base64').toString('utf-8')
      const state = JSON.parse(content) as TDDState

      console.error(`✅ Read state from '${STATE_BRANCH}' (sha: ${data.sha.slice(0, 7)})`)
      return { state, sha: data.sha }
    },
    catch: (error) => {
      if (error instanceof GitHubAPIError) {
        return error
      }
      return new GitHubAPIError({
        status: 0,
        message: `Failed to read state file: ${error}`,
        cause: error,
      })
    },
  })

/**
 * Helper: Write state file via GitHub API
 * Writes to the dedicated state branch (unprotected) to avoid branch protection issues.
 */
export const writeStateFileViaGitHub = (
  state: TDDState,
  sha: string,
  stateFilePath: string = STATE_FILE_PATH
): Effect.Effect<void, GitHubAPIError> =>
  Effect.tryPromise({
    try: async () => {
      const { owner, repo, token } = getRepoInfo()
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${stateFilePath}`

      console.error(`📤 Writing state to branch '${STATE_BRANCH}'`)
      console.error(`📋 SHA for update: ${sha ? sha.slice(0, 7) : '(new file)'}`)

      const updatedState: TDDState = {
        ...state,
        lastUpdated: new Date().toISOString(),
      }

      const content = Buffer.from(JSON.stringify(updatedState, null, 2)).toString('base64')

      const body: Record<string, string> = {
        message: 'chore(tdd): update state [skip ci]',
        content,
        branch: STATE_BRANCH, // Use unprotected state branch instead of main
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

      console.error(`📥 GitHub API response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ GitHub API error response: ${errorText}`)
        throw new GitHubAPIError({
          status: response.status,
          message: `Failed to write state file (HTTP ${response.status}): ${errorText}`,
          cause: new Error(errorText),
        })
      }

      console.error('✅ GitHub API PUT request successful')
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
