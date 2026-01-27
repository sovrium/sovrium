/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Find Ready Spec
 *
 * Finds the next highest-priority spec ready for TDD automation.
 * Checks for:
 *   1. Specs with .fixme() marker
 *   2. No existing TDD PR for the spec
 *   3. No other active TDD PR (serial processing)
 *
 * Usage:
 *   bun run scripts/tdd-automation/core/find-ready-spec.ts
 *
 * Environment:
 *   - GITHUB_REPOSITORY: owner/repo
 *   - GH_TOKEN or GITHUB_TOKEN: GitHub API token
 *
 * Output (JSON):
 *   {
 *     "specId": "APP-VERSION-001",
 *     "file": "specs/app/version/version.spec.ts",
 *     "line": 42,
 *     "description": "App version displays correctly",
 *     "priority": 1
 *   }
 *
 * Exit codes:
 *   0: Spec found (JSON output)
 *   1: No spec available (active PR exists or no .fixme() specs)
 *   2: Error occurred
 */

import { Effect, Layer } from 'effect'
import { FileSystemServiceLive, LoggerServiceLive } from '../../lib/effect'
import { scanForFixmeSpecs } from './spec-scanner'
import { parseTDDPRTitle, extractSpecIdFromBranch } from './parse-pr-title'
import { TDD_LABELS, type ReadySpec, type TDDPullRequest } from './types'

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
 * Fetch all open TDD PRs from GitHub
 */
async function fetchOpenTDDPRs(
  owner: string,
  repo: string,
  token: string
): Promise<TDDPullRequest[]> {
  // Use GraphQL for efficient batch fetching
  const query = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        pullRequests(states: OPEN, labels: ["${TDD_LABELS.AUTOMATION}"], first: 100) {
          nodes {
            number
            title
            headRefName
            labels(first: 10) {
              nodes {
                name
              }
            }
          }
        }
      }
    }
  `

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { owner, repo },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`GraphQL request failed: ${response.status} ${errorText}`)
  }

  const data = (await response.json()) as {
    data?: {
      repository: {
        pullRequests: {
          nodes: Array<{
            number: number
            title: string
            headRefName: string
            labels: { nodes: Array<{ name: string }> }
          }>
        }
      }
    }
    errors?: Array<{ message: string }>
  }

  if (data.errors) {
    throw new Error(`GraphQL errors: ${data.errors.map((e) => e.message).join(', ')}`)
  }

  if (!data.data) {
    return []
  }

  const prs = data.data.repository.pullRequests.nodes

  return prs.map((pr) => {
    const labels = pr.labels.nodes.map((l) => l.name)
    const parsed = parseTDDPRTitle(pr.title)

    // Try to get spec ID from title or branch
    const specIdFromTitle = parsed?.specId
    const specIdFromBranch = extractSpecIdFromBranch(pr.headRefName)
    const specId = specIdFromTitle || specIdFromBranch || 'UNKNOWN'

    return {
      number: pr.number,
      title: pr.title,
      branch: pr.headRefName,
      specId,
      attempt: parsed?.attempt ?? 1,
      maxAttempts: parsed?.maxAttempts ?? 5,
      labels,
      hasManualInterventionLabel: labels.includes(TDD_LABELS.MANUAL_INTERVENTION),
      hasConflictLabel: labels.includes(TDD_LABELS.HAD_CONFLICT),
    }
  })
}

/**
 * Find the next spec ready for TDD automation
 *
 * @returns ReadySpec or null if no spec available
 */
export async function findReadySpec(): Promise<ReadySpec | null> {
  const { owner, repo, token } = getRepoInfo()

  console.error('🔍 Finding next ready spec for TDD automation...')
  console.error('')

  // Step 1: Check for active TDD PRs (serial processing)
  const openPRs = await fetchOpenTDDPRs(owner, repo, token)

  // Filter to active PRs (not in manual intervention)
  const activePRs = openPRs.filter((pr) => !pr.hasManualInterventionLabel)

  if (activePRs.length > 0) {
    console.error(`⏳ Active TDD PR found: #${activePRs[0]!.number} (${activePRs[0]!.specId})`)
    console.error('   Serial processing: waiting for current PR to complete')
    return null
  }

  // Step 2: Scan for .fixme() specs
  console.error('📂 Scanning for .fixme() specs...')

  const program = scanForFixmeSpecs.pipe(
    Effect.provide(Layer.mergeAll(FileSystemServiceLive, LoggerServiceLive()))
  )

  const result = await Effect.runPromise(program)

  if (result.specs.length === 0) {
    console.error('✅ No .fixme() specs found - all tests are passing!')
    return null
  }

  console.error(`   Found ${result.specs.length} .fixme() specs`)

  // Step 3: Filter out specs that already have PRs (including manual intervention)
  const specIdsWithPRs = new Set(openPRs.map((pr) => pr.specId))
  const availableSpecs = result.specs.filter((spec) => !specIdsWithPRs.has(spec.specId))

  if (availableSpecs.length === 0) {
    console.error('⏳ All .fixme() specs have open PRs (pending or manual intervention)')
    return null
  }

  console.error(`   ${availableSpecs.length} specs available (no existing PR)`)

  // Step 4: Return highest priority spec (already sorted by priority)
  const nextSpec = availableSpecs[0]!

  console.error('')
  console.error('✅ Next spec to process:')
  console.error(`   Spec ID: ${nextSpec.specId}`)
  console.error(`   File: ${nextSpec.file}:${nextSpec.line}`)
  console.error(`   Description: ${nextSpec.description}`)
  console.error(`   Priority: ${nextSpec.priority}`)

  return {
    specId: nextSpec.specId,
    file: nextSpec.file,
    line: nextSpec.line,
    description: nextSpec.description,
    priority: nextSpec.priority,
  }
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  try {
    const spec = await findReadySpec()

    if (!spec) {
      // No spec available (either active PR or no .fixme() specs)
      console.error('')
      console.error('No spec ready for processing')
      process.exit(1)
    }

    // Output JSON for workflow parsing
    console.log(JSON.stringify(spec))
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error)
    process.exit(2)
  }
}

// Run CLI if executed directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('Error:', error)
    process.exit(2)
  })
}
