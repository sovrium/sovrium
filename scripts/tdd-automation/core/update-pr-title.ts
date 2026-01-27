/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Update TDD PR Title
 *
 * Increments the attempt counter in a TDD PR title.
 *
 * Usage:
 *   bun run scripts/tdd-automation/core/update-pr-title.ts <pr-number>
 *
 * Environment:
 *   - GITHUB_REPOSITORY: owner/repo (e.g., "owner/sovrium")
 *   - GH_TOKEN or GITHUB_TOKEN: GitHub API token
 *
 * Output:
 *   New PR title and attempt count
 */

import { parseTDDPRTitle } from './parse-pr-title'
import { formatTDDPRTitle } from './types'

/**
 * Get repository info from environment
 */
function getRepoInfo(): { owner: string; repo: string; token: string } {
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
 * Fetch PR details from GitHub API
 */
async function fetchPR(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): Promise<{ title: string; number: number }> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch PR #${prNumber}: ${response.status} ${errorText}`)
  }

  const data = (await response.json()) as { title: string; number: number }
  return data
}

/**
 * Update PR title via GitHub API
 */
async function updatePRTitle(
  owner: string,
  repo: string,
  prNumber: number,
  newTitle: string,
  token: string
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ title: newTitle }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to update PR #${prNumber} title: ${response.status} ${errorText}`)
  }
}

/**
 * Increment attempt count in PR title
 *
 * @param prNumber PR number to update
 * @returns Object with new title and attempt count
 */
export async function incrementAttempt(
  prNumber: number
): Promise<{ newTitle: string; newAttempt: number; specId: string }> {
  const { owner, repo, token } = getRepoInfo()

  // Fetch current PR
  const pr = await fetchPR(owner, repo, prNumber, token)

  // Parse current title
  const parsed = parseTDDPRTitle(pr.title)

  if (!parsed) {
    throw new Error(`PR #${prNumber} does not have a valid TDD title format: "${pr.title}"`)
  }

  // Increment attempt
  const newAttempt = parsed.attempt + 1

  // Create new title
  const newTitle = formatTDDPRTitle(parsed.specId, newAttempt, parsed.maxAttempts)

  // Update PR
  await updatePRTitle(owner, repo, prNumber, newTitle, token)

  console.error(`✅ Updated PR #${prNumber} title:`)
  console.error(`   Old: ${pr.title}`)
  console.error(`   New: ${newTitle}`)

  return {
    newTitle,
    newAttempt,
    specId: parsed.specId,
  }
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('Usage: bun run update-pr-title.ts <pr-number>')
    console.error('Example: bun run update-pr-title.ts 123')
    console.error('')
    console.error('Environment variables required:')
    console.error('  GITHUB_REPOSITORY: owner/repo')
    console.error('  GH_TOKEN or GITHUB_TOKEN: GitHub API token')
    process.exit(1)
  }

  const prNumber = parseInt(args[0]!, 10)

  if (isNaN(prNumber) || prNumber <= 0) {
    console.error(`Error: Invalid PR number: ${args[0]}`)
    process.exit(1)
  }

  try {
    const result = await incrementAttempt(prNumber)

    // Output JSON for workflow parsing
    console.log(
      JSON.stringify({
        prNumber,
        specId: result.specId,
        newAttempt: result.newAttempt,
        newTitle: result.newTitle,
      })
    )
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

// Run CLI if executed directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
}
