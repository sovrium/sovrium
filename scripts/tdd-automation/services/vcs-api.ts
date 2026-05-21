/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Context, Effect, Layer } from 'effect'
import { TDD_LABELS } from '../core/config'
import { ForgejoApiError } from '../core/errors'
import { parseTDDPRTitle } from '../core/parse-pr-title'
import { withRetry, DEFAULT_RETRY_CONFIG, type RetryConfig } from '../core/retry'
import { TDD_CONFIG, type TDDPullRequest } from '../core/types'

export interface WorkflowRun {
  readonly id: string
  readonly name: string
  readonly displayTitle: string
  readonly conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly htmlUrl: string
}

export interface PRComment {
  readonly id: number
  readonly body: string
  readonly createdAt: Date
}

export interface PRDetails {
  readonly number: number
  readonly title: string
  readonly branch: string
  readonly state: 'open' | 'closed' | 'merged'
  readonly labels: readonly string[]
}

export interface ForgejoApiService {
  readonly listTDDPRs: (
    state?: 'open' | 'closed'
  ) => Effect.Effect<readonly TDDPullRequest[], ForgejoApiError>

  readonly getPR: (prNumber: number) => Effect.Effect<PRDetails, ForgejoApiError>

  readonly getWorkflowRuns: (params: {
    readonly workflow: string
    readonly createdAfter: Date
    readonly status: 'success' | 'failure' | 'all'
  }) => Effect.Effect<readonly WorkflowRun[], ForgejoApiError>

  readonly getPRComments: (prNumber: number) => Effect.Effect<readonly PRComment[], ForgejoApiError>

  readonly createPR: (params: {
    readonly title: string
    readonly body: string
    readonly branch: string
    readonly base: string
    readonly labels: readonly string[]
  }) => Effect.Effect<{ readonly number: number; readonly url: string }, ForgejoApiError>

  readonly updatePRTitle: (prNumber: number, title: string) => Effect.Effect<void, ForgejoApiError>

  readonly addLabel: (prNumber: number, label: string) => Effect.Effect<void, ForgejoApiError>

  readonly postComment: (prNumber: number, body: string) => Effect.Effect<void, ForgejoApiError>

  readonly closePR: (prNumber: number) => Effect.Effect<void, ForgejoApiError>

  readonly reopenPR: (prNumber: number) => Effect.Effect<void, ForgejoApiError>
}

export class ForgejoApi extends Context.Tag('ForgejoApi')<ForgejoApi, ForgejoApiService>() {}

export function getForgejoConfig() {
  const repository = process.env['FORGEJO_REPOSITORY'] ?? 'sovrium/sovrium'
  const [owner, repo] = repository.split('/')
  const baseUrl = process.env['FORGEJO_URL'] ?? 'https://git.sovrium.com'
  const token = process.env['FORGEJO_TOKEN'] ?? ''

  if (!token) {
    throw new Error('FORGEJO_TOKEN environment variable is required for TDD automation')
  }

  return { owner, repo, baseUrl, token, repository } as const
}

export async function forgejoFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { baseUrl, token } = getForgejoConfig()
  const url = `${baseUrl}/api/v1${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `token ${token}` : '',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Forgejo API ${response.status}: ${response.statusText} — ${body}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

function wrapWithRetry<A>(
  effect: Effect.Effect<A, ForgejoApiError>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Effect.Effect<A, ForgejoApiError> {
  return withRetry(effect, config)
}

export const ForgejoApiLive = Layer.succeed(ForgejoApi, {
  listTDDPRs: (state = 'open') =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          const { owner, repo } = getForgejoConfig()

          const repoLabels = await forgejoFetch<Array<{ id: number; name: string }>>(
            `/repos/${owner}/${repo}/labels?limit=50`
          )
          const tddLabelId = repoLabels.find((l) => l.name === TDD_LABELS.AUTOMATION)?.id

          const labelParam = tddLabelId !== undefined ? `&labels=${tddLabelId}` : ''
          const prs = await forgejoFetch<
            Array<{
              number: number
              title: string
              head: { ref: string }
              labels: Array<{ name: string }>
            }>
          >(`/repos/${owner}/${repo}/pulls?state=${state}${labelParam}&limit=50`)

          const filtered =
            tddLabelId !== undefined
              ? prs
              : prs.filter((pr) => pr.labels.some((l) => l.name === TDD_LABELS.AUTOMATION))

          return filtered.map((pr) => {
            const parsed = parseTDDPRTitle(pr.title)
            return {
              number: pr.number,
              title: pr.title,
              branch: pr.head.ref,
              specId: parsed?.specId ?? '',
              attempt: parsed?.attempt ?? 0,
              maxAttempts: parsed?.maxAttempts ?? TDD_CONFIG.MAX_ATTEMPTS,
              labels: pr.labels.map((l) => l.name),
              hasManualInterventionLabel: pr.labels.some(
                (l) => l.name === TDD_LABELS.MANUAL_INTERVENTION
              ),
            } satisfies TDDPullRequest
          })
        },
        catch: (error) => new ForgejoApiError({ operation: 'listTDDPRs', cause: error }),
      })
    ),

  getPR: (prNumber) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          const { owner, repo } = getForgejoConfig()

          const pr = await forgejoFetch<{
            number: number
            title: string
            head: { ref: string }
            state: string
            merged: boolean
            labels: Array<{ name: string }>
          }>(`/repos/${owner}/${repo}/pulls/${prNumber}`)

          const state: PRDetails['state'] = pr.merged
            ? 'merged'
            : (pr.state.toLowerCase() as 'open' | 'closed')

          return {
            number: pr.number,
            title: pr.title,
            branch: pr.head.ref,
            state,
            labels: pr.labels.map((l) => l.name),
          }
        },
        catch: (error) => new ForgejoApiError({ operation: 'getPR', cause: error }),
      })
    ),

  getWorkflowRuns: ({ workflow, createdAfter, status }) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          const { owner, repo } = getForgejoConfig()

          const params = new URLSearchParams({ limit: '50' })
          if (status !== 'all') {
            params.set('status', status)
          }

          const data = await forgejoFetch<{
            workflow_runs: Array<{
              id: number
              title: string
              status: string
              created: string
              updated: string
              html_url: string
              workflow_id: string
            }>
          }>(`/repos/${owner}/${repo}/actions/runs?${params.toString()}`)

          return (data.workflow_runs ?? [])
            .filter((run) => {
              const matchesWorkflow =
                run.workflow_id === workflow || run.title.includes(workflow.replace('.yml', ''))
              const matchesDate = new Date(run.created) >= createdAfter
              return matchesWorkflow && matchesDate
            })
            .map((run) => ({
              id: String(run.id),
              name: run.title,
              displayTitle: run.title,
              conclusion: (['success', 'failure', 'cancelled', 'skipped'].includes(run.status)
                ? run.status
                : null) as WorkflowRun['conclusion'],
              createdAt: new Date(run.created),
              updatedAt: new Date(run.updated),
              htmlUrl: run.html_url,
            }))
        },
        catch: (error) => new ForgejoApiError({ operation: 'getWorkflowRuns', cause: error }),
      })
    ),

  getPRComments: (prNumber) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          const { owner, repo } = getForgejoConfig()

          const comments = await forgejoFetch<
            Array<{
              id: number
              body: string
              created_at: string
            }>
          >(`/repos/${owner}/${repo}/issues/${prNumber}/comments?limit=50`)

          return comments.map((c) => ({
            id: c.id,
            body: c.body,
            createdAt: new Date(c.created_at),
          }))
        },
        catch: (error) => new ForgejoApiError({ operation: 'getPRComments', cause: error }),
      })
    ),

  createPR: ({ title, body, branch, base, labels }) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          const { owner, repo } = getForgejoConfig()

          const pr = await forgejoFetch<{
            number: number
            html_url: string
          }>(`/repos/${owner}/${repo}/pulls`, {
            method: 'POST',
            body: JSON.stringify({
              title,
              body,
              head: branch,
              base,
            }),
          })

          if (labels.length > 0) {
            const existingLabels = await forgejoFetch<Array<{ id: number; name: string }>>(
              `/repos/${owner}/${repo}/labels?limit=50`
            )

            const labelIds = labels
              .map((name) => existingLabels.find((l) => l.name === name)?.id)
              .filter((id): id is number => id !== undefined)

            if (labelIds.length > 0) {
              await forgejoFetch(`/repos/${owner}/${repo}/issues/${pr.number}/labels`, {
                method: 'POST',
                body: JSON.stringify({ labels: labelIds }),
              })
            }
          }

          return { number: pr.number, url: pr.html_url }
        },
        catch: (error) => new ForgejoApiError({ operation: 'createPR', cause: error }),
      })
    ),

  updatePRTitle: (prNumber, title) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          const { owner, repo } = getForgejoConfig()
          await forgejoFetch(`/repos/${owner}/${repo}/pulls/${prNumber}`, {
            method: 'PATCH',
            body: JSON.stringify({ title }),
          })
        },
        catch: (error) => new ForgejoApiError({ operation: 'updatePRTitle', cause: error }),
      })
    ),

  addLabel: (prNumber, label) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          const { owner, repo } = getForgejoConfig()

          const labels = await forgejoFetch<Array<{ id: number; name: string }>>(
            `/repos/${owner}/${repo}/labels?limit=50`
          )
          const labelId = labels.find((l) => l.name === label)?.id

          if (labelId === undefined) {
            throw new Error(`Label "${label}" not found in repository`)
          }

          await forgejoFetch(`/repos/${owner}/${repo}/issues/${prNumber}/labels`, {
            method: 'POST',
            body: JSON.stringify({ labels: [labelId] }),
          })
        },
        catch: (error) => new ForgejoApiError({ operation: 'addLabel', cause: error }),
      })
    ),

  postComment: (prNumber, body) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          const { owner, repo } = getForgejoConfig()
          await forgejoFetch(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
            method: 'POST',
            body: JSON.stringify({ body }),
          })
        },
        catch: (error) => new ForgejoApiError({ operation: 'postComment', cause: error }),
      })
    ),

  closePR: (prNumber) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          const { owner, repo } = getForgejoConfig()
          await forgejoFetch(`/repos/${owner}/${repo}/pulls/${prNumber}`, {
            method: 'PATCH',
            body: JSON.stringify({ state: 'closed' }),
          })
        },
        catch: (error) => new ForgejoApiError({ operation: 'closePR', cause: error }),
      })
    ),

  reopenPR: (prNumber) =>
    wrapWithRetry(
      Effect.tryPromise({
        try: async () => {
          const { owner, repo } = getForgejoConfig()
          await forgejoFetch(`/repos/${owner}/${repo}/pulls/${prNumber}`, {
            method: 'PATCH',
            body: JSON.stringify({ state: 'open' }),
          })
        },
        catch: (error) => new ForgejoApiError({ operation: 'reopenPR', cause: error }),
      })
    ),
})
