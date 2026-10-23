/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveLucideIconNode } from '@/presentation/render/elements/lucide-resolver'
import type { Hono } from 'hono'

/** A kebab-case Lucide icon name. A STATIC literal. */
const ICON_NAME = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*'

/** A day: the geometry of a name never changes within one binary. */
const ICON_CACHE_CONTROL = 'public, max-age=86400'

/**
 * `GET /assets/icons/:name` — the geometry of one Lucide icon, by name.
 *
 * A sidebar entry fetched from records draws the icon its row names, and that
 * name is known only in the browser. The icon set itself stays on the server —
 * bundling it into an island costs every reader ~650 KB (`lucide-glyph.tsx`) —
 * so the island asks here for the one icon it needs and draws it with lucide's
 * generic renderer.
 *
 * Engine data only: the same answer for every caller, nothing read from the
 * app or the session, so it is public and cacheable. A name the icon set does
 * not hold answers 404, and the row draws no icon.
 */
export function setupIconGeometryRoutes(honoApp: Readonly<Hono>): Readonly<Hono> {
  return (honoApp as Hono).get(`/assets/icons/:name{${ICON_NAME}}`, (c) => {
    const iconNode = resolveLucideIconNode(c.req.param('name'))
    if (iconNode === undefined) return c.json({ success: false, message: 'Icon not found' }, 404)
    c.header('Cache-Control', ICON_CACHE_CONTROL)
    return c.json({ iconNode })
  })
}
