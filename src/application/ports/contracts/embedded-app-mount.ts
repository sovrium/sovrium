/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where the embedded operator console is mounted — the data contract, alone.
 *
 * Split out of `application/use-cases/mount/embedded-app-mount.ts` in W5c, and
 * the reason is a layer boundary rather than file size. Three layers read this
 * shape: the infrastructure resolver that builds it from the embedded preset,
 * the presentation routes that serve the mount, and {@link
 * ../contracts/hono-app-config.HonoAppConfig} — a PORT, which
 * `[internal ref]` forbids from importing a use-case ("Port
 * violation: Can only import domain models and other ports"). Leaving the
 * interface beside the builder would therefore have forced the config contract
 * to either restate the shape structurally — two declarations of one contract,
 * free to drift — or to reach across a closed edge.
 *
 * The BUILDER stays in the use-case: deriving a mount from a preset, an
 * operator app and the `SOVRIUM_ADMIN` mode is orchestration. Only the shape
 * crosses, which is what a contract is for.
 */

import type { App } from '@/domain/models/app'

/** One registered placement of the embedded app. */
export interface EmbeddedAppMount {
  /** Absolute base path this mount answers at, with no trailing slash. */
  readonly basePath: string

  /**
   * The preset, with its mount-relative links moved onto {@link basePath} and
   * its mount identity recorded for the stylesheet hash.
   */
  readonly presetApp: App

  /**
   * Paths reachable WITHOUT a session, as an exact-match set.
   *
   * Exact match, never a prefix: a `startsWith(`${basePath}/`)` carve-out would
   * silently expose the entire console, and would let
   * `${basePath}/reset-password/../{surface}`-shaped paths slip past the guard.
   * Trailing-slash and case variants are not members and therefore 404 — the
   * same failure mode as any unknown path.
   */
  readonly publicPaths: ReadonlySet<string>

  /**
   * The subset of {@link publicPaths} that is public only while outgoing mail
   * is configured.
   *
   * A recovery form that can never mail anything is worse than no form at all,
   * so without mail these are absent rather than broken. "Is SMTP configured"
   * is a deployment fact identical for every caller, so gating on it leaks
   * nothing about any user and the anti-enumeration posture is untouched.
   */
  readonly mailGatedPublicPaths: ReadonlySet<string>

  /**
   * Public paths an ALREADY-SIGNED-IN admin is bounced off, because there is
   * nothing there for them.
   *
   * `${basePath}/reset-password` is DELIBERATELY ABSENT. An operator who
   * requested a link and then remembered their password is a mundane,
   * reachable state; the redirect would swallow the `?token=` and leave them
   * holding a link that silently does nothing.
   */
  readonly signedInRedirectPaths: ReadonlySet<string>

  /** The mount is never advertised to crawlers. */
  readonly indexable: false
}
