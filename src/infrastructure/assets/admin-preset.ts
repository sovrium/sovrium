/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The embedded admin console, decoded once per process.
 *
 * The console is authored as `apps/admin/` and frozen into
 * `embedded-admin-preset.generated.ts` at build time
 * (`scripts/build/generate-admin-preset.ts`). This module turns that value into
 * a decoded {@link App} and applies the two platform stamps that are NOT part
 * of the authored config.
 *
 * ─── WHY A DECODE FAILURE IS A BOOT ERROR ───────────────────────────────────
 *
 * The predecessor read a YAML file at request time and returned `undefined` on
 * failure, which the route turned into a 404. That made a corrupt console
 * indistinguishable from an unrouted path: the operator saw the same answer
 * they would see if the console had simply been switched off, and the only
 * evidence was one log line on a server they may not be reading.
 *
 * The preset is version-locked to the binary and validated at BUILD time, so a
 * decode failure here is not a runtime condition to degrade around — it means
 * the artifact and the schema disagree, which is a defect in the release. It
 * throws, at boot, naming itself. A binary that cannot serve its own console
 * should refuse to start rather than pretend the console was never asked for.
 *
 * ─── LAYER ─────────────────────────────────────────────────────────────────
 *
 * Infrastructure, beside the generated artifact it reads — the same position
 * `readEmbeddedDashboardConfig` held. The application layer's mount model
 * (`application/use-cases/mount/embedded-app-mount.ts`) is a pure function of
 * an already-decoded preset and receives it as an argument, so it needs no view
 * of how the preset is stored.
 */

import { Schema } from 'effect'
import { AppSchema } from '@/domain/models/app'
import { isEmailConfigured } from '@/infrastructure/process/env'
import { EMBEDDED_ADMIN_PRESET } from './embedded-admin-preset.generated'
import type { App } from '@/domain/models/app'

/** The password-recovery request form, as the preset's own pages address it. */
const PRESET_FORGOT_PASSWORD_PATH = '/forgot-password'

/** Minimal structural view of a component node, for the recovery-link prune. */
interface PrunableNode {
  readonly type?: string
  readonly props?: Readonly<Record<string, unknown>>
  readonly children?: readonly unknown[]
}

const asNode = (value: unknown): PrunableNode | undefined =>
  typeof value === 'object' && value !== null ? (value as PrunableNode) : undefined

/**
 * The sign-in card's recovery entry point.
 *
 * Matched on the preset's own MOUNT-RELATIVE href (`/forgot-password`), not on
 * a `/_admin`-prefixed one: the prune runs on the preset before any mount
 * prefixes its hrefs, so at this point the console's links are still relative
 * to whichever base will serve them.
 */
const isRecoveryLink = (value: unknown): boolean => {
  const node = asNode(value)
  return node?.type === 'link' && node.props?.['href'] === PRESET_FORGOT_PASSWORD_PATH
}

/** Drop every recovery link in a component subtree, at any depth. */
const pruneRecoveryLinks = (value: unknown): unknown => {
  const node = asNode(value)
  if (node === undefined || !Array.isArray(node.children)) return value
  return {
    ...node,
    children: node.children.filter((child) => !isRecoveryLink(child)).map(pruneRecoveryLinks),
  }
}

/**
 * Remove the sign-in card's recovery link when outgoing mail is unconfigured.
 *
 * A link that opens a form that can never mail anything costs the operator a
 * round trip and their confidence in the console — a dead link is worse than no
 * link. The route layer already omits the recovery PATHS from the public
 * carve-out on a mail-less instance; this is the visible half of the same rule.
 *
 * Safe to bake into the memoized preset: `SMTP_HOST` is fixed for the lifetime
 * of the server process, so a pruned console can never leak into a
 * mail-configured process or vice versa.
 */
export const pruneRecoveryEntryPoints = (app: App): App => {
  if (isEmailConfigured() || app.pages === undefined) return app
  const pages = app.pages.map((page) =>
    page.components === undefined
      ? page
      : {
          ...page,
          components: page.components
            .filter((component) => !isRecoveryLink(component))
            .map(pruneRecoveryLinks),
        }
  )
  return { ...app, pages } as App
}

/** Process-lifetime memo — the preset is version-locked to the binary. */
// eslint-disable-next-line functional/no-let -- module-level memo, set once on first call
let presetCache: App | undefined

/**
 * The decoded admin console preset.
 *
 * @throws if the embedded preset does not decode against the current
 *   `AppSchema` — a release defect, surfaced at boot rather than as a 404.
 */
export const resolveAdminPresetApp = (): App => {
  if (presetCache !== undefined) return presetCache
  try {
    // `decodeSync`, not `decodeUnknownSync`: the generated preset is annotated
    // `: AppEncoded`, so the encoded shape is checked at COMPILE time and a
    // drift between the console and the schema becomes a build error rather
    // than a throw on the first boot that happens to reach it. The annotation
    // was `as const satisfies AppEncoded` until the inferred literal grew too
    // large for the declaration emitter (TS7056) — same guarantee, but the
    // emitted `.d.ts` is now one type reference instead of the whole literal.
    const decoded = Schema.decodeSync(AppSchema)(EMBEDDED_ADMIN_PRESET)
    // `badge: false` is stamped here rather than trusted from the authored
    // config: the console is Sovrium's own product UI, and a "Built with
    // Sovrium" badge on it would credit the operator's product to its vendor on
    // the one surface where the operator is unambiguously not the audience.
    const app = pruneRecoveryEntryPoints({ ...decoded, badge: false } as App)
    // eslint-disable-next-line functional/no-expression-statements -- module-level memo write
    presetCache = app
    return app
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements -- boot refusal: a console that cannot decode must stop the process, not degrade to a 404
    throw new Error(
      'Sovrium failed to start: the embedded admin console preset does not decode against this ' +
        'release’s AppSchema. This is a defect in the build, not in your configuration. ' +
        `Cause: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
