/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Claude Code Probe Service
 *
 * Probes Claude Code API with minimal request to detect credit exhaustion.
 * Uses Anthropic API with CLAUDE_CODE_OAUTH_TOKEN from environment.
 * Sends minimal message (1-2 tokens) to check credit availability.
 *
 * Exhaustion detection pattern:
 * - HTTP 429 (Rate Limit) with "credit" in error message
 * - HTTP 402 (Payment Required)
 * - Error response with "credit" or "exhausted" keywords
 */

import { Context, Effect, Layer, Data } from 'effect'

/**
 * Probe result from Claude Code CLI
 */
export interface ProbeResult {
  readonly isExhausted: boolean
  readonly rawJson: string
  readonly errorMessage?: string
  readonly totalCostUsd: number
}

/**
 * Claude Code probe execution error
 */
export class ClaudeCodeProbeError extends Data.TaggedError('ClaudeCodeProbeError')<{
  readonly operation: 'execute' | 'parse'
  readonly cause: unknown
}> {}

/**
 * Claude Code probe service interface
 */
export interface ClaudeCodeProbeService {
  /**
   * Probe Claude Code API to detect credit exhaustion
   *
   * Makes minimal API request to Anthropic API using CLAUDE_CODE_OAUTH_TOKEN.
   * Request: Single message "hi" (1-2 tokens, ~$0.00002 cost)
   *
   * Exhaustion pattern:
   * - HTTP 429 (Rate Limit) with "credit" in error
   * - HTTP 402 (Payment Required)
   * - Error response containing "credit" or "exhausted"
   *
   * @returns ProbeResult with exhaustion status
   * @throws ClaudeCodeProbeError if API request fails
   */
  readonly probe: () => Effect.Effect<ProbeResult, ClaudeCodeProbeError>
}

/**
 * Claude Code probe service Context.Tag for dependency injection
 */
export class ClaudeCodeProbe extends Context.Tag('ClaudeCodeProbe')<
  ClaudeCodeProbe,
  ClaudeCodeProbeService
>() {}

/**
 * Live implementation using Anthropic API via fetch
 */
export const ClaudeCodeProbeLive = Layer.succeed(ClaudeCodeProbe, {
  probe: () =>
    Effect.gen(function* () {
      // Get OAuth token from environment
      const token = process.env['CLAUDE_CODE_OAUTH_TOKEN']
      if (!token) {
        return yield* Effect.fail(
          new ClaudeCodeProbeError({
            operation: 'execute',
            cause: new Error('CLAUDE_CODE_OAUTH_TOKEN not found in environment'),
          })
        )
      }

      // Make minimal API request (1-2 tokens)
      const response = yield* Effect.tryPromise({
        try: async () => {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': token,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 10,
              messages: [{ role: 'user', content: 'hi' }],
            }),
          })

          const body = await res.text()

          return {
            status: res.status,
            statusText: res.statusText,
            body,
          }
        },
        catch: (error) => new ClaudeCodeProbeError({ operation: 'execute', cause: error }),
      })

      // Parse response body
      const parsed = yield* Effect.try({
        try: () => JSON.parse(response.body) as Record<string, unknown>,
        catch: (error) => new ClaudeCodeProbeError({ operation: 'parse', cause: error }),
      })

      // Detect exhaustion patterns
      let isExhausted = false
      let errorMessage: string | undefined
      let totalCostUsd = 0

      if (response.status === 429 || response.status === 402) {
        // Rate limit or payment required
        isExhausted = true
        errorMessage = parsed['error']?.['message'] as string | undefined
      } else if (parsed['error']) {
        // Error response
        errorMessage = parsed['error']?.['message'] as string | undefined
        isExhausted =
          errorMessage?.toLowerCase().includes('credit') ||
          errorMessage?.toLowerCase().includes('exhausted') ||
          false
      } else {
        // Success response - extract usage
        const usage = parsed['usage'] as Record<string, unknown> | undefined
        if (usage && typeof usage['input_tokens'] === 'number') {
          // Rough estimate: $3 per million input tokens for Sonnet
          totalCostUsd = (usage['input_tokens'] * 3) / 1_000_000
        }
      }

      return {
        isExhausted,
        rawJson: response.body,
        errorMessage,
        totalCostUsd,
      } satisfies ProbeResult
    }),
})

/**
 * Test implementation with configurable exhaustion status
 */
export const ClaudeCodeProbeTest = (isExhausted: boolean) =>
  Layer.succeed(ClaudeCodeProbe, {
    probe: () =>
      Effect.succeed({
        isExhausted,
        rawJson: JSON.stringify({
          is_error: isExhausted,
          total_cost_usd: 0,
          error_message: isExhausted ? 'Credits exhausted' : '',
        }),
        errorMessage: isExhausted ? 'Credits exhausted' : undefined,
        totalCostUsd: 0,
      }),
  })
