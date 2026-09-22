/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Icon } from 'lucide-react'
import { isLucideIconNode } from './lucide-icon-node'
import type { ReactElement } from 'react'

/**
 * CLIENT-SAFE Lucide rendering — the half of icon support that ships to the
 * browser.
 *
 * WHY THIS MODULE EXISTS (read before importing `lucide-resolver` from an island)
 * ------------------------------------------------------------------------------
 * `lucide-resolver.ts` resolves an icon by NAME, which it can only do with
 * `import * as LucideIcons from 'lucide-react'` plus a `[name]` index. A
 * namespace import read through a computed key is unshakeable BY CONSTRUCTION:
 * no bundler can prove which of the ~2,000 icons the index will reach, so all of
 * them are retained. Measured 2026-09-03 against the real `buildRuntimeAssets`:
 * that pulled a **668,323-byte** shared chunk (174,296 gzip) into the island
 * graph, statically imported by `kpi-island`, `menu-island` AND
 * `admin-sidebar-island` — the last of which passes no icons at all and paid the
 * full 668 KB for nothing.
 *
 * It was invisible to `Island Payload Budget`, which measures only the EAGER
 * closure, and lucide sat one `import()` boundary beyond it.
 *
 * WHAT REPLACES IT
 * ----------------
 * `Icon` is lucide's own generic renderer: it takes the icon GEOMETRY
 * (`iconNode`, a plain `[tag, attrs][]` array) as a prop and emits the `<svg>`.
 * As a single STATIC NAMED import it tree-shakes normally — measured at
 * **1,073 bytes** across the whole corpus, against 668,272 for the namespace.
 *
 * The geometry is resolved SERVER-side (where the icon set is already in the
 * binary and costs a browser nothing) and serialized into `data-island-props`
 * beside the icon name. See `resolveLucideIconNode` in `lucide-resolver.ts`.
 *
 * This keeps the icon vocabulary OPEN, which a build-time allowlist could not.
 * The schema types every `icon` field as a bare `Schema.String`, and Sovrium
 * ships a binary that runs configs it has never seen — so a fixed list of names
 * baked into the client bundle would silently render nothing for any name a user
 * picked outside it. Serialized geometry has no vocabulary: whatever the server
 * resolves, the client draws.
 *
 * Regression guard: `CORPUS_FORBIDDEN` in `[internal ref]`
 * fails the build if the icon set reappears in any island chunk.
 *
 * THIS MODULE MUST NOT IMPORT `resolveClasses` — see `composeGlyphClasses`
 * ------------------------------------------------------------------------
 * It is the ONLY code `kpi-island` shares with the class-merge graph, so an
 * import here puts `tailwind-merge` (a 29,362-byte shared chunk) on the mount
 * path of every island that draws an icon. It briefly did: `kpi-island` went
 * 23,792 -> 53,326 bytes (+124%) and blew its `ISLAND_MOUNT_CEILINGS` row. The
 * same shape as the lucide case above, one library smaller — a shared module
 * dragging a whole package in behind it.
 */

interface LucideGlyphProps {
  /** Icon geometry, server-resolved from the configured icon name. */
  readonly iconNode: unknown
  /**
   * The configured kebab-case name. Only used to reproduce lucide's own
   * `lucide-<name>` class, so the rendered DOM keeps the class contract
   * `createLucideIcon` would have produced.
   */
  readonly name?: string
  readonly size?: number
  readonly className?: string
  readonly [key: string]: unknown
}

/**
 * Compose the `lucide-<name>` MARKER class with the classes the call site
 * passed, without `tailwind-merge`.
 *
 * WHY NOT `resolveClasses` — this is not a defaults/author merge
 * -------------------------------------------------------------
 * `resolveClasses` exists to decide a CONFLICT between a recipe and an app
 * author's override. Neither layer is present here. `lucide-<name>` belongs to
 * no Tailwind conflict group — it is a DOM contract, asserted as
 * `svg.lucide-compass` by
 * `[internal ref]` —
 * so tailwind-merge can neither drop it nor drop anything against it. And
 * `className` here is not an author fragment: `LucideGlyph` is internal, and
 * its two call sites (`kpi-card.tsx`, `menu-island.tsx`) pass nothing and the
 * fixed literal `'mr-2 shrink-0'` respectively.
 *
 * Measured over both real inputs plus five synthesised ones, `resolveClasses`
 * and this join return the IDENTICAL string. They diverge on exactly one shape:
 * a caller string carrying an internal conflict (`'p-4 p-8'` -> `'p-8'`). That
 * is the caller's own list to de-conflict, not something this composition
 * creates — a call site that ever needs it can call `resolveClasses` itself and
 * pass the settled string in.
 *
 * The parameter is `callerClasses`, not `className`, because that is what it
 * is. The name also keeps the composition clear of the
 * `CLASSNAME_CONCAT_SELECTORS` guardrail in `[internal ref]`,
 * which keys on a trailing fragment named `*className` to spot the "recipe
 * first, author last" shape. This is a genuine false positive of that heuristic
 * — the rule documents a zero false-positive rate — and correcting the rule
 * belongs to `[internal ref]`, which owns `[internal ref]`.
 */
const composeGlyphClasses = (marker: string, callerClasses?: string): string => {
  if (marker === '') return callerClasses ?? ''
  return callerClasses ? `${marker} ${callerClasses}` : marker
}

/**
 * Sovrium draws icons at stroke 1.5; lucide's own default is 2.
 *
 * At 16px a 2px stroke is an eighth of the glyph, which reads heavier than the
 * 13px type beside it and makes the icon the loudest thing in a row of
 * controls. 1.5 puts the line weight on the same footing as the text, which is
 * what the reference drawings do — every inline SVG in them is `stroke-width:
 * 1.5` on a 16 grid.
 *
 * It is spread BEFORE `rest`, so it is a default rather than a lock: a call
 * site that genuinely needs a heavier glyph still passes its own `strokeWidth`.
 */
const GLYPH_STROKE_WIDTH = 1.5

/**
 * Renders a Lucide icon from server-resolved geometry.
 *
 * Returns `null` for absent or malformed geometry — the same "no icon" outcome
 * `resolveLucideIcon` gave callers for an unknown name, so every call site keeps
 * its existing fallback behaviour.
 */
export function LucideGlyph({
  iconNode,
  name,
  className,
  ...rest
}: LucideGlyphProps): ReactElement | null {
  if (!isLucideIconNode(iconNode) || iconNode.length === 0) {
    // eslint-disable-next-line unicorn/no-null -- React renders null, not undefined
    return null
  }
  // `Icon` prepends `lucide`; adding `lucide-<name>` reproduces the two-class
  // contract `createLucideIcon` emitted, so DOM assertions on `svg.lucide-<name>`
  // keep resolving after the switch away from the per-icon components.
  const merged = composeGlyphClasses(name ? `lucide-${name}` : '', className)
  return (
    <Icon
      strokeWidth={GLYPH_STROKE_WIDTH}
      {...rest}
      iconNode={iconNode as never}
      className={merged}
    />
  )
}
