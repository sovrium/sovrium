/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  hasDemoCredentials,
  isDemoNoticeEnabled,
  parseDemoNoticeEnvConfig,
  resolveDemoName,
  type DemoNoticeEnvConfig,
} from '@/domain/models/env/demo-notice'

/**
 * The notice's render-ready shape: only the slots that actually have content.
 * Resolving to this narrow type at the boundary means the component never has
 * to re-derive "is this set?" from raw env strings, and an absent slot is
 * structurally `undefined` rather than an empty string to be re-checked.
 */
export interface DemoNoticeDisplayConfig {
  /** Present only when `SOVRIUM_DEMO_NAME` is set and non-empty after trim. */
  readonly name?: string
  /** Present only when BOTH display credentials are set (`hasDemoCredentials`). */
  readonly credentials?: { readonly email: string; readonly password: string }
  /** Present only when `SOVRIUM_DEMO_URL` is set and non-empty. */
  readonly url?: string
}

/** Trim, then collapse the empty string to `undefined` — env vars set to `''` are absent. */
const presence = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim() ?? ''
  return trimmed === '' ? undefined : trimmed
}

/**
 * Pure resolver — exported so the mapping is directly testable without touching
 * `process.env`. Returns `undefined` when the master switch is off, which is
 * the single gate every injection point renders through.
 */
export const resolveDemoNoticeDisplayConfig = (
  config: DemoNoticeEnvConfig
): DemoNoticeDisplayConfig | undefined => {
  if (!isDemoNoticeEnabled(config)) return undefined
  // Empty/whitespace collapses to `undefined` (the brand-fallback title); the
  // name is never translated, only substituted into the localized title template.
  const name = resolveDemoName(config)
  const url = presence(config.url)
  // `hasDemoCredentials` is the shared partial-configuration guard: an email
  // without a password (or vice versa) counts as absent rather than rendering a
  // half-filled credentials block.
  const credentials = hasDemoCredentials(config)
    ? { email: presence(config.email) ?? '', password: presence(config.password) ?? '' }
    : undefined
  return {
    ...(name ? { name } : {}),
    ...(credentials ? { credentials } : {}),
    ...(url ? { url } : {}),
  }
}

/**
 * Resolved ONCE at module load rather than per render.
 *
 * `process.env` is fixed for the lifetime of a server process, so parsing it on
 * every page render would repeat an Effect Schema decode thousands of times for
 * a value that cannot change. A module-level constant is the memoization — no
 * mutable cache, no invalidation logic, and it is evaluated after the process
 * environment is populated (env exists before any module body runs).
 */
const RESOLVED_DEMO_NOTICE = resolveDemoNoticeDisplayConfig(parseDemoNoticeEnvConfig())

/**
 * The process-wide demo-notice display configuration, or `undefined` when
 * `SOVRIUM_DEMO_NOTICE` is not enabled.
 *
 * Every injection point (dynamic page, default homepage, standalone and closed
 * form documents, static error fallbacks) resolves visibility through this one
 * accessor — mirroring how `isBadgeEnabled` is the badge's single gate — so the
 * opt-in polarity can never drift apart across surfaces.
 */
export const getDemoNoticeDisplayConfig = (): DemoNoticeDisplayConfig | undefined =>
  RESOLVED_DEMO_NOTICE
