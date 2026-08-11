/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Form } from '@/domain/models/app/forms'

/**
 * Effective anti-spam policy resolved against a form's optional `antiSpam`
 * block.
 *
 * [internal ref] locks the default-on policy: when a form omits the `antiSpam`
 * block entirely (or omits an individual sub-key), the renderer and submission
 * pipeline apply these defaults instead of treating "absent" as "disabled".
 *
 * The defaults are deliberately conservative:
 * - **`honeypot: true`** — every form opts in to the hidden `_hp` trap unless
 *   the author explicitly sets `antiSpam.honeypot: false`. A well-behaved
 *   visitor never sees it; a naïve bot fills every input and trips it.
 * - **`perIp: 10`** submissions per **`windowSeconds: 60`** — matches the
 *   share-link historical rate-limit (`10 per minute per IP`) so anti-spam
 *   behaviour is uniform across both form shapes.
 * - **`perForm: 1000`** submissions per **`windowSeconds: 60`** — high enough
 *   that legitimate marketing campaigns are not throttled, low enough that a
 *   single-form DDoS is bounded.
 *
 * Schema authors override any default by supplying the corresponding key in
 * `forms[].antiSpam`. Explicit `false` on `honeypot` wins over the default
 * `true` (this is why the predicate is `!== false`, not just `?? true`).
 */
export interface EffectiveAntiSpam {
  /** Whether the hidden honeypot field should render and be enforced. */
  readonly honeypot: boolean
  /** Resolved sliding-window rate-limit parameters. */
  readonly rateLimit: {
    readonly perIp: number
    readonly perForm: number
    readonly windowSeconds: number
  }
}

/**
 * Default-on anti-spam values. Exposed as a named constant
 * so tests can assert against the locked defaults without re-typing them.
 */
export const DEFAULT_ANTI_SPAM: EffectiveAntiSpam = {
  honeypot: true,
  rateLimit: {
    perIp: 10,
    perForm: 1000,
    windowSeconds: 60,
  },
}

/**
 * Resolve a form's effective anti-spam policy. Merges the form's optional
 * `antiSpam` overrides over {@link DEFAULT_ANTI_SPAM}.
 *
 * Pure function — never reads env vars or runtime state. Safe to call from
 * both the SSR renderer (to decide whether to emit the honeypot input) and
 * the submission pipeline (to decide whether to enforce the honeypot trap
 * and which rate-limit knobs to apply).
 */
export const effectiveAntiSpam = (form: Readonly<Form>): EffectiveAntiSpam => {
  const block = form.antiSpam
  if (block === undefined) return DEFAULT_ANTI_SPAM

  // Explicit `false` wins over default `true` — schema authors can disable
  // the honeypot on a per-form basis.
  const honeypot = block.honeypot === undefined ? DEFAULT_ANTI_SPAM.honeypot : block.honeypot

  const rl = block.rateLimit
  return {
    honeypot,
    rateLimit: {
      perIp: rl?.perIp ?? DEFAULT_ANTI_SPAM.rateLimit.perIp,
      perForm: rl?.perForm ?? DEFAULT_ANTI_SPAM.rateLimit.perForm,
      windowSeconds: rl?.windowSeconds ?? DEFAULT_ANTI_SPAM.rateLimit.windowSeconds,
    },
  }
}
