/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import { CommandService, CommandFailedError } from '../../lib/effect'
import {
  GitHubAPIClient,
  GitHubAPIClientLive,
  GitHubAPIError,
  RateLimitExhaustedError,
  escapeForShell,
  buildIssueListCommand,
  parseJSON,
} from './github-api-client'

// =============================================================================
// Pure Function Tests
// =============================================================================

describe('escapeForShell', () => {
  it('should wrap simple strings in single quotes', () => {
    expect(escapeForShell('hello')).toBe("'hello'")
  })

  it('should escape single quotes within strings', () => {
    expect(escapeForShell("it's working")).toBe("'it'\\''s working'")
  })

  it('should handle strings with multiple single quotes', () => {
    expect(escapeForShell("test'one'two")).toBe("'test'\\''one'\\''two'")
  })

  it('should handle empty strings', () => {
    expect(escapeForShell('')).toBe("''")
  })

  it('should handle strings with special characters', () => {
    expect(escapeForShell('hello $world')).toBe("'hello $world'")
    expect(escapeForShell('test & run')).toBe("'test & run'")
  })
})

describe('buildIssueListCommand', () => {
  it('should build basic list command', () => {
    const cmd = buildIssueListCommand({})
    expect(cmd).toContain('gh issue list')
    expect(cmd).toContain('--json number,title,state,body,labels,createdAt,updatedAt,url')
    expect(cmd).toContain('--limit 100')
  })

  it('should include labels when specified', () => {
    const cmd = buildIssueListCommand({ labels: ['tdd-spec:queued'] })
    expect(cmd).toContain('--label "tdd-spec:queued"')
  })

  it('should include multiple labels', () => {
    const cmd = buildIssueListCommand({ labels: ['label1', 'label2'] })
    expect(cmd).toContain('--label "label1,label2"')
  })

  it('should include state when specified', () => {
    const cmd = buildIssueListCommand({ state: 'open' })
    expect(cmd).toContain('--state open')
  })

  it('should include search when specified', () => {
    const cmd = buildIssueListCommand({ search: 'test query' })
    expect(cmd).toContain('--search "test query"')
  })

  it('should include custom limit', () => {
    const cmd = buildIssueListCommand({ limit: 50 })
    expect(cmd).toContain('--limit 50')
  })

  it('should combine all options', () => {
    const cmd = buildIssueListCommand({
      labels: ['label1'],
      state: 'all',
      search: 'test',
      limit: 200,
    })
    expect(cmd).toContain('--label "label1"')
    expect(cmd).toContain('--state all')
    expect(cmd).toContain('--search "test"')
    expect(cmd).toContain('--limit 200')
  })
})

describe('parseJSON', () => {
  it('should parse valid JSON', async () => {
    const result = await Effect.runPromise(parseJSON<{ name: string }>('{"name":"test"}', 'test'))
    expect(result).toEqual({ name: 'test' })
  })

  it('should parse arrays', async () => {
    const result = await Effect.runPromise(parseJSON<number[]>('[1, 2, 3]', 'test'))
    expect(result).toEqual([1, 2, 3])
  })

  it('should fail on invalid JSON', async () => {
    const result = await Effect.runPromise(
      parseJSON<unknown>('not valid json', 'testOperation').pipe(Effect.either)
    )
    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(GitHubAPIError)
      expect((result.left as GitHubAPIError).operation).toBe('testOperation')
    }
  })

  it('should fail on empty string', async () => {
    const result = await Effect.runPromise(parseJSON<unknown>('', 'test').pipe(Effect.either))
    expect(result._tag).toBe('Left')
  })
})

// =============================================================================
// Mock Command Service
// =============================================================================

/**
 * Create a mock CommandService that returns predefined responses
 */
const createMockCommandService = (
  responses: Record<string, string | Error>
): Layer.Layer<CommandService, never, never> => {
  return Layer.succeed(
    CommandService,
    CommandService.of({
      exec: (command: string) => {
        // Find matching response
        for (const [pattern, response] of Object.entries(responses)) {
          if (command.includes(pattern)) {
            if (response instanceof Error) {
              return Effect.fail(
                new CommandFailedError({
                  command,
                  exitCode: 1,
                  stderr: response.message,
                  stdout: '',
                })
              )
            }
            return Effect.succeed(response)
          }
        }
        // Default: return empty string
        return Effect.succeed('')
      },
      spawn: () => Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
      parallel: (commands) => Effect.all(commands, { concurrency: 'unbounded' }),
      withGitHubOutput: () => Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
    })
  )
}

// =============================================================================
// Service Tests
// =============================================================================

describe('GitHubAPIClient Service', () => {
  describe('checkRateLimit', () => {
    it('should parse rate limit response correctly', async () => {
      const mockLayer = createMockCommandService({
        'gh api rate_limit': '4500\n5000\n1706000000',
      })

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.checkRateLimit()
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer))
      )

      expect(result.remaining).toBe(4500)
      expect(result.limit).toBe(5000)
      expect(result.resetTimestamp).toBe(1_706_000_000)
      expect(result.resetDate).toBeInstanceOf(Date)
    })

    it('should fail on invalid response format', async () => {
      const mockLayer = createMockCommandService({
        'gh api rate_limit': 'invalid',
      })

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.checkRateLimit()
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer)).pipe(Effect.either)
      )

      expect(result._tag).toBe('Left')
    })
  })

  describe('ensureRateLimit', () => {
    it('should return true when sufficient capacity', async () => {
      const mockLayer = createMockCommandService({
        'gh api rate_limit': '100\n5000\n1706000000',
      })

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.ensureRateLimit(10)
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer))
      )

      expect(result).toBe(true)
    })

    it('should fail with RateLimitExhaustedError when limit too low', async () => {
      const mockLayer = createMockCommandService({
        'gh api rate_limit': '5\n5000\n1706000000',
      })

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.ensureRateLimit(10)
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer)).pipe(Effect.either)
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(RateLimitExhaustedError)
      }
    })
  })

  describe('listIssues', () => {
    it('should parse issue list correctly', async () => {
      const mockResponse = JSON.stringify([
        {
          number: 123,
          title: '🤖 APP-BLOCKS-001: Test',
          state: 'open',
          body: 'Test body',
          labels: [{ name: 'tdd-spec:queued' }],
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-02T00:00:00Z',
          url: 'https://github.com/test/repo/issues/123',
        },
      ])

      const mockLayer = createMockCommandService({
        'gh issue list': mockResponse,
      })

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.listIssues({ labels: ['tdd-spec:queued'] })
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer))
      )

      expect(result).toHaveLength(1)
      const first = result[0]!
      expect(first.number).toBe(123)
      expect(first.title).toBe('🤖 APP-BLOCKS-001: Test')
      expect(first.state).toBe('open')
      expect(first.labels).toHaveLength(1)
    })

    it('should return empty array for empty response', async () => {
      const mockLayer = createMockCommandService({
        'gh issue list': '',
      })

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.listIssues({})
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer))
      )

      expect(result).toEqual([])
    })
  })

  describe('getIssue', () => {
    it('should fetch single issue by number', async () => {
      const mockResponse = JSON.stringify({
        number: 456,
        title: 'Test Issue',
        state: 'open',
        body: 'Issue body',
        labels: [],
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
        url: 'https://github.com/test/repo/issues/456',
      })

      const mockLayer = createMockCommandService({
        'gh issue view 456': mockResponse,
      })

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.getIssue(456)
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer))
      )

      expect(result.number).toBe(456)
      expect(result.title).toBe('Test Issue')
    })
  })

  describe('getIssueBody', () => {
    it('should fetch issue body', async () => {
      const mockLayer = createMockCommandService({
        'gh issue view 789': 'This is the issue body content',
      })

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.getIssueBody(789)
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer))
      )

      expect(result).toBe('This is the issue body content')
    })
  })

  describe('addLabels', () => {
    it('should add single label', async () => {
      let calledCommand = ''
      const mockLayer = Layer.succeed(
        CommandService,
        CommandService.of({
          exec: (command: string) => {
            calledCommand = command
            return Effect.succeed('')
          },
          spawn: () => Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
          parallel: (commands) => Effect.all(commands, { concurrency: 'unbounded' }),
          withGitHubOutput: () =>
            Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
        })
      )

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.addLabels(123, ['test-label'])
      })

      await Effect.runPromise(Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer)))

      expect(calledCommand).toContain('gh issue edit 123')
      expect(calledCommand).toContain('--add-label "test-label"')
    })
  })

  describe('removeLabels', () => {
    it('should remove single label', async () => {
      let calledCommand = ''
      const mockLayer = Layer.succeed(
        CommandService,
        CommandService.of({
          exec: (command: string) => {
            calledCommand = command
            return Effect.succeed('')
          },
          spawn: () => Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
          parallel: (commands) => Effect.all(commands, { concurrency: 'unbounded' }),
          withGitHubOutput: () =>
            Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
        })
      )

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.removeLabels(123, ['old-label'])
      })

      await Effect.runPromise(Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer)))

      expect(calledCommand).toContain('gh issue edit 123')
      expect(calledCommand).toContain('--remove-label "old-label"')
    })
  })

  describe('addComment', () => {
    it('should add comment with escaped body', async () => {
      let calledCommand = ''
      const mockLayer = Layer.succeed(
        CommandService,
        CommandService.of({
          exec: (command: string) => {
            calledCommand = command
            return Effect.succeed('')
          },
          spawn: () => Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
          parallel: (commands) => Effect.all(commands, { concurrency: 'unbounded' }),
          withGitHubOutput: () =>
            Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
        })
      )

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.addComment(123, 'Test comment')
      })

      await Effect.runPromise(Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer)))

      expect(calledCommand).toContain('gh issue comment 123')
      expect(calledCommand).toContain('--body')
    })
  })

  describe('closeIssue', () => {
    it('should close issue with reason', async () => {
      let calledCommand = ''
      const mockLayer = Layer.succeed(
        CommandService,
        CommandService.of({
          exec: (command: string) => {
            calledCommand = command
            return Effect.succeed('')
          },
          spawn: () => Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
          parallel: (commands) => Effect.all(commands, { concurrency: 'unbounded' }),
          withGitHubOutput: () =>
            Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
        })
      )

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.closeIssue(123, 'completed')
      })

      await Effect.runPromise(Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer)))

      expect(calledCommand).toContain('gh issue close 123')
      expect(calledCommand).toContain('--reason completed')
    })
  })

  describe('listPRs', () => {
    it('should parse PR list correctly', async () => {
      const mockResponse = JSON.stringify([
        {
          number: 100,
          title: 'Test PR',
          state: 'open',
          headRefName: 'feature-branch',
          baseRefName: 'main',
          url: 'https://github.com/test/repo/pull/100',
          isDraft: false,
        },
      ])

      const mockLayer = createMockCommandService({
        'gh pr list': mockResponse,
      })

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.listPRs({})
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer))
      )

      expect(result).toHaveLength(1)
      const firstPR = result[0]!
      expect(firstPR.number).toBe(100)
      expect(firstPR.headRefName).toBe('feature-branch')
      expect(firstPR.isDraft).toBe(false)
    })
  })

  describe('hasPRForBranch', () => {
    it('should return true when PR exists', async () => {
      const mockResponse = JSON.stringify([
        {
          number: 100,
          title: 'Test PR',
          state: 'open',
          headRefName: 'feature-branch',
          baseRefName: 'main',
          url: 'https://github.com/test/repo/pull/100',
          isDraft: false,
        },
      ])

      const mockLayer = createMockCommandService({
        'gh pr list': mockResponse,
      })

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.hasPRForBranch('feature-branch')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer))
      )

      expect(result).toBe(true)
    })

    it('should return false when no PR exists', async () => {
      const mockLayer = createMockCommandService({
        'gh pr list': '[]',
      })

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.hasPRForBranch('nonexistent-branch')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer))
      )

      expect(result).toBe(false)
    })
  })

  describe('branchExists', () => {
    it('should return exists=true when branch found', async () => {
      const mockLayer = createMockCommandService({
        'gh api repos/:owner/:repo/branches/': 'main\nabc123def',
      })

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.branchExists('main')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer))
      )

      expect(result.exists).toBe(true)
      expect(result.name).toBe('main')
      expect(result.sha).toBe('abc123def')
    })

    it('should return exists=false when branch not found', async () => {
      const mockLayer = createMockCommandService({
        'gh api repos/:owner/:repo/branches/': '',
      })

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.branchExists('nonexistent')
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer))
      )

      expect(result.exists).toBe(false)
      expect(result.name).toBe('nonexistent')
    })
  })

  describe('listWorkflowRuns', () => {
    it('should parse workflow runs correctly', async () => {
      const mockResponse = JSON.stringify([
        {
          databaseId: 12_345,
          name: 'CI',
          status: 'completed',
          conclusion: 'success',
          headBranch: 'main',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:10:00Z',
          url: 'https://github.com/test/repo/actions/runs/12345',
        },
      ])

      const mockLayer = createMockCommandService({
        'gh run list': mockResponse,
      })

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.listWorkflowRuns({})
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer))
      )

      expect(result).toHaveLength(1)
      const first = result[0]!
      expect(first.id).toBe(12_345)
      expect(first.name).toBe('CI')
      expect(first.status).toBe('completed')
      expect(first.conclusion).toBe('success')
    })
  })

  describe('getWorkflowRunLogs', () => {
    it('should fetch workflow logs', async () => {
      const mockLogs = `
2025-01-01T00:00:00Z  Run bun test
2025-01-01T00:00:01Z  All tests passed
      `

      const mockLayer = createMockCommandService({
        'gh run view 12345': mockLogs,
      })

      const program = Effect.gen(function* () {
        const client = yield* GitHubAPIClient
        return yield* client.getWorkflowRunLogs(12_345)
      })

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer))
      )

      expect(result).toContain('bun test')
      expect(result).toContain('All tests passed')
    })
  })
})

// =============================================================================
// Integration Scenarios
// =============================================================================

describe('GitHubAPIClient Integration Scenarios', () => {
  it('should handle complete issue workflow', async () => {
    const commands: string[] = []

    const mockLayer = Layer.succeed(
      CommandService,
      CommandService.of({
        exec: (command: string) => {
          commands.push(command)

          if (command.includes('gh issue view 999')) {
            return Effect.succeed(
              JSON.stringify({
                number: 999,
                title: '🤖 APP-BLOCKS-001: Test spec',
                state: 'open',
                body: '**File**: `specs/app.spec.ts:10`',
                labels: [{ name: 'tdd-spec:queued' }],
                createdAt: '2025-01-01T00:00:00Z',
                updatedAt: '2025-01-02T00:00:00Z',
                url: 'https://github.com/test/repo/issues/999',
              })
            )
          }

          return Effect.succeed('')
        },
        spawn: () => Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
        parallel: (cmds) => Effect.all(cmds, { concurrency: 'unbounded' }),
        withGitHubOutput: () =>
          Effect.succeed({ exitCode: 0, stdout: '', stderr: '', duration: 0 }),
      })
    )

    const program = Effect.gen(function* () {
      const client = yield* GitHubAPIClient

      // 1. Get issue
      const issue = yield* client.getIssue(999)
      expect(issue.number).toBe(999)

      // 2. Remove old label
      yield* client.removeLabels(999, ['tdd-spec:queued'])

      // 3. Add new label
      yield* client.addLabels(999, ['tdd-spec:in-progress'])

      // 4. Add comment
      yield* client.addComment(999, 'Starting implementation...')

      return { success: true, commandsRun: commands.length }
    })

    const result = await Effect.runPromise(
      Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer))
    )

    expect(result.success).toBe(true)
    expect(result.commandsRun).toBe(4) // view, remove-label, add-label, comment
  })

  it('should check for stuck specs with rate limit awareness', async () => {
    const mockLayer = createMockCommandService({
      'gh api rate_limit': '100\n5000\n1706000000',
      'gh issue list': JSON.stringify([
        {
          number: 1,
          title: '🤖 APP-001: Stuck spec',
          state: 'open',
          body: null,
          labels: [{ name: 'tdd-spec:in-progress' }],
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          url: 'https://github.com/test/repo/issues/1',
        },
      ]),
    })

    const program = Effect.gen(function* () {
      const client = yield* GitHubAPIClient

      // Check rate limit first
      const hasCapacity = yield* client.ensureRateLimit(10)
      expect(hasCapacity).toBe(true)

      // List in-progress issues
      const inProgress = yield* client.listIssues({
        labels: ['tdd-spec:in-progress'],
        state: 'open',
      })

      return { inProgressCount: inProgress.length }
    })

    const result = await Effect.runPromise(
      Effect.provide(program, Layer.merge(GitHubAPIClientLive, mockLayer))
    )

    expect(result.inProgressCount).toBe(1)
  })
})
