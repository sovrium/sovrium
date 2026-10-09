/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A bounded retry around ONE sandboxed render, for a headless Chrome that dies
 * while it starts ("Chrome process closed the pipe") — seen under load and in
 * the instant after a previous session closed. Without it every such death
 * failed the render at once, and the only workaround was a step-level `retry`
 * that retries deterministic failures too.
 *
 * The bounds:
 *
 * - **What is retried.** Only {@link isTransientLaunchFailure}: a pipe that
 *   closed, and nothing that names the sandbox. A sandbox that cannot start
 *   fails identically every time, and the operator needs its hint fast. The
 *   classification reads the RAW error — before the caller appends the
 *   `RENDERER_NO_SANDBOX` hint, which itself names the sandbox.
 * - **How often.** `maxAttempts` attempts in all, two by default: one retry.
 * - **Within what.** ONE render budget, started when the render holds its
 *   permit. Every attempt — finding its backend, then rendering on it — is
 *   handed what is left of `timeoutMs`, and no retry starts unless
 *   {@link MIN_RETRY_BUDGET_MS} remain after the pause, so a render, its first
 *   Chrome connection included, never takes longer than `RENDERER_TIMEOUT_MS`
 *   in all ({@link renderWithinBudget}).
 * - **Under which permit.** The caller already holds one concurrency permit
 *   around the whole call; the retry runs inside it and never takes another.
 */

/**
 * The pause before a retry: the measured time a dying Chrome takes to be
 * forgotten, the same figure `document-renderer-live.ts` waits after a close
 * (`CHROME_SETTLE_MS`).
 */
const LAUNCH_RETRY_PAUSE_MS = 100

/** No retry starts with less than this left of the render budget. */
export const MIN_RETRY_BUDGET_MS = 1000

/** One retry: two attempts in all. */
const DEFAULT_MAX_ATTEMPTS = 2

/** Words that tie a launch failure to Chrome's sandbox, which no retry fixes. */
const SANDBOX_WORDS: readonly string[] = ['sandbox', 'namespace', 'setuid', 'zygote', 'seccomp']

/**
 * The backend could not be found — a DevTools endpoint that did not answer
 * with an address — as opposed to a render that failed on it. Never retried,
 * and never the deadline: an acquire that runs out of budget fails with the
 * deadline instead.
 */
export class BackendUnreachable extends Error {
  override readonly cause: unknown
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.name = 'BackendUnreachable'
    this.cause = cause
  }
}

/**
 * Whether a render failure is a Chrome that died while starting, and so worth
 * one more launch.
 *
 * True only for an `Error` whose message says the pipe closed and names none
 * of the sandbox's moving parts. The deadline, an oversized capture, a missing
 * selector and every other failure are deterministic and are not retried.
 *
 * @param error - the raw failure of one attempt
 * @returns whether a retry may succeed where this attempt failed
 */
export const isTransientLaunchFailure = (error: unknown): boolean => {
  if (!(error instanceof Error) || error instanceof BackendUnreachable) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('closed the pipe') && !SANDBOX_WORDS.some((word) => message.includes(word))
  )
}

/** The options of {@link withLaunchRetry}; the clock and the pause are injectable for tests. */
export interface LaunchRetryOptions {
  /** The whole render budget (`RENDERER_TIMEOUT_MS`), shared by every attempt. */
  readonly timeoutMs: number
  /** Attempts in all, the first included. Defaults to 2. */
  readonly maxAttempts?: number | undefined
  /** The pause before a retry. Defaults to the Chrome settle time, 100 ms. */
  readonly backoffMs?: number | undefined
  /** Called between a transient failure and the retry — to forget a dead endpoint. */
  readonly beforeRetry?: (() => void) | undefined
  readonly now?: (() => number) | undefined
  readonly sleep?: ((ms: number) => Promise<void>) | undefined
}

/**
 * Run `launch` and, when it fails with a transient launch failure, run it
 * again inside the same budget, at most `maxAttempts` times in all.
 *
 * @param launch - one attempt, handed the milliseconds left of the budget and
 *   its index (0 for the first)
 * @param options - the budget and the bounds
 * @returns the first successful attempt's result
 * @throws the last attempt's failure, unchanged, when no attempt succeeds
 */
export const withLaunchRetry = async <T>(
  launch: (budgetMs: number, attempt: number) => Promise<T>,
  options: LaunchRetryOptions
): Promise<T> => {
  const now = options.now ?? Date.now
  const sleep = options.sleep ?? ((ms: number) => Bun.sleep(ms))
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const pauseMs = options.backoffMs ?? LAUNCH_RETRY_PAUSE_MS
  const deadline = now() + options.timeoutMs

  const attempt = async (index: number, budgetMs: number): Promise<T> => {
    try {
      return await launch(budgetMs, index)
    } catch (error) {
      const remainingAfterPause = deadline - now() - pauseMs
      const mayRetry =
        index + 1 < maxAttempts &&
        isTransientLaunchFailure(error) &&
        remainingAfterPause >= MIN_RETRY_BUDGET_MS
      if (!mayRetry) throw error
      options.beforeRetry?.()
      await sleep(pauseMs)
      return attempt(index + 1, deadline - now())
    }
  }

  return attempt(0, options.timeoutMs)
}

/** The options of {@link acquireWithinBudget}; the clock is injectable for tests. */
export interface BudgetedAcquireOptions {
  /** What is left of the render budget when the attempt starts. */
  readonly budgetMs: number
  /** The failure an attempt that ran out of budget throws: the render deadline. */
  readonly exceeded: () => Error
  readonly now?: (() => number) | undefined
}

/**
 * Acquire a retry's backend, then render on it, both charged to the ONE budget
 * the attempt was handed.
 *
 * A retry re-discovers a restarted endpoint before it renders, and that
 * discovery takes time the render would otherwise be handed in full. `acquire`
 * is given the budget so its own network call can abort inside it, and the
 * wait is bounded here too; the render then gets only what the acquire left.
 *
 * @param acquire - finds the backend, within the milliseconds it is handed
 * @param render - renders on that backend, within the milliseconds it is handed
 * @param options - the budget left, and the deadline failure
 * @returns the render's result
 * @throws `options.exceeded()` when the acquire spends the whole budget, and
 *   a {@link BackendUnreachable} when it fails inside it
 */
export const acquireWithinBudget = async <B, T>(
  acquire: (budgetMs: number) => Promise<B>,
  render: (backend: B, budgetMs: number) => Promise<T>,
  options: BudgetedAcquireOptions
): Promise<T> => {
  const now = options.now ?? Date.now
  const started = now()
  const timer: { id?: ReturnType<typeof setTimeout> } = {}
  const deadline = new Promise<never>((_, reject) => {
    timer.id = setTimeout(() => reject(options.exceeded()), Math.max(options.budgetMs, 0))
  })
  const acquired = acquire(options.budgetMs).catch((error: unknown) => {
    throw new BackendUnreachable(error)
  })
  const backend = await Promise.race([acquired, deadline]).finally(() => clearTimeout(timer.id))
  const left = options.budgetMs - (now() - started)
  if (left <= 0) throw options.exceeded()
  return render(backend, left)
}

/** The options of {@link renderWithinBudget}; the clock and the pause are injectable for tests. */
export interface RenderBudgetOptions extends LaunchRetryOptions {
  /** The failure an attempt that ran out of budget throws: the render deadline. */
  readonly exceeded: () => Error
}

/**
 * One render, its backend included, inside ONE budget of `timeoutMs` that
 * starts now: every attempt finds its backend and renders on it through
 * {@link acquireWithinBudget}, the first exactly like a retry, and a Chrome
 * that died while starting is retried by {@link withLaunchRetry} with what is
 * left. A first DevTools discovery that is slow therefore shortens the render
 * rather than adding to it, and one that never answers fails as the deadline.
 *
 * @param acquire - finds the backend, within the milliseconds it is handed
 * @param render - renders on that backend, within the milliseconds it is handed
 * @param options - the budget, the deadline failure and the retry bounds
 * @returns the first successful attempt's result
 */
export const renderWithinBudget = <B, T>(
  acquire: (budgetMs: number) => Promise<B>,
  render: (backend: B, budgetMs: number) => Promise<T>,
  options: RenderBudgetOptions
): Promise<T> =>
  withLaunchRetry(
    (budgetMs) =>
      acquireWithinBudget(acquire, render, {
        budgetMs,
        exceeded: options.exceeded,
        now: options.now,
      }),
    options
  )
