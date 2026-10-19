/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where the embedded operator console sits — resolved once per operator app.
 *
 * Three facts have to meet before the mount exists, and each lives in a
 * different layer: the decoded preset (an embedded build artifact —
 * infrastructure), the `admin` key (the operator's config — domain), and
 * `SOVRIUM_ADMIN` (the deployment's kill switch — environment). This module is
 * the one place they are read together.
 *
 * ─── RESOLUTION ONLY; THE ROUTE LIVES IN PRESENTATION ──────────────────────
 *
 * `setupAdminMountRoutes` stood here until W5c and is now
 * `presentation/api/admin/mount-routes.ts`, beside the handlers it chains. What
 * is left reads an embedded artifact and answers a question; it registers
 * nothing and imports no route. That is what closed the last
 * `infrastructure → presentation` import this file held.
 *
 * The two presentation consumers — the mount's registration and the URL
 * canonicalizer — do NOT call {@link adminMountsFor}. The composition root
 * resolves it once at boot and threads the answer on
 * `HonoAppConfig.adminMounts`, so a route never reaches back across the
 * boundary for it. The two remaining callers here are infrastructure's own
 * (`route-setup/static-assets.ts`, `startup-phase-report.ts`) and import it
 * directly.
 *
 * ─── WHY THIS LIVES IN `server/` AND NOT IN `assets/` ──────────────────────
 *
 * In `assets/`, this file would need a path-scoped
 * `infrastructure/assets -> application/use-cases` grant.
 *
 * The fix is a MOVE rather than a parameter thread, because measuring the
 * callers settles where the resolution belongs: all three of them
 * (`compose-hono-app.ts`, `route-setup/static-assets.ts`,
 * `startup-phase-report.ts`) are already in `infrastructure/server/`, which is
 * the boot-time composition area and already carries the use-case allowance
 * that `assets/` had to be granted by hand. Threading `readonly
 * EmbeddedAppMount[]` through three signatures would have moved the same import
 * one file further out and widened two public signatures to reach the same
 * place.
 *
 * What it buys: `infrastructure/assets/` is a leaf again — an embedded-artifact
 * decoder that reaches no use-case — and the path-scoped grant is deleted
 * rather than relocated.
 *
 * ─── WHY THE MOUNT LIST IS MEMOIZED ────────────────────────────────────────
 *
 * TWO routes must agree on the same mount OBJECT, not merely on an equal value:
 * the page routes that serve the mount, and the CSS route that has to recognise
 * the stylesheet hash a mounted document links. `resolveScopedMountApp` memoizes
 * per mount instance, so two independently-built mount lists would produce two
 * scoped apps, two hashes, and a stylesheet the route serves under one identity
 * while the HTML asks for another.
 *
 * Keyed on the operator `App`, which is fixed for the lifetime of a server
 * process — each E2E `startServerWithSchema` spawns a fresh CLI process with its
 * own config and environment, so nothing leaks between them.
 */

import {
  buildEmbeddedAppMounts,
  resolveScopedMountApp,
} from '@/application/use-cases/mount/embedded-app-mount'
import { parseSovriumAdmin } from '@/domain/models/process-env'
import { resolveAdminPresetApp } from '@/infrastructure/assets/admin-preset'
import type { EmbeddedAppMount } from '@/application/ports/contracts/embedded-app-mount'
import type { App } from '@/domain/models/app'

/** Per-operator-`App` memo of the resolved mount list. */
const mountsByApp = new WeakMap<App, readonly EmbeddedAppMount[]>()

/**
 * The console's placement for this operator app — one mount, or none.
 *
 * The mount list is cheap: the preset is handed over as a thunk and decoded on
 * the first request that needs it (`buildMount`), not here — registration and
 * the startup banner read only the base path. That the preset decodes against
 * this release's schema is proved when it is generated
 * (`scripts/build/generate-admin-preset.ts`), so a start does not re-prove it.
 * `SOVRIUM_ADMIN=off` builds no mount at all (`buildEmbeddedAppMounts`).
 */
export const adminMountsFor = (operatorApp: App): readonly EmbeddedAppMount[] => {
  const cached = mountsByApp.get(operatorApp)
  if (cached !== undefined) return cached
  const mounts = buildEmbeddedAppMounts(operatorApp, resolveAdminPresetApp, parseSovriumAdmin())
  mountsByApp.set(operatorApp, mounts)
  return mounts
}

/**
 * The scoped console app for a mount — the object whose stylesheet hash both
 * the rendered document and the CSS route derive.
 */
export const scopedAppForMount = (mount: EmbeddedAppMount, operatorApp: App): App =>
  resolveScopedMountApp(mount, operatorApp)
