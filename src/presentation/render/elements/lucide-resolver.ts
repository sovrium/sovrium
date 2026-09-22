/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as LucideIcons from 'lucide-react'
import type { LucideIconNode } from '../../design/lucide-icon-node'
import type { ComponentType } from 'react'

/**
 * SERVER-SIDE Lucide icon resolution, by kebab-case name.
 *
 * ⚠️ SERVER ONLY. This module namespace-imports `lucide-react` and reads it
 * through a computed key, which is unshakeable by construction — no bundler can
 * prove which of the ~2,000 icons the index reaches, so it retains all of them.
 * Measured 2026-09-03 against the real `buildRuntimeAssets`: one client island
 * importing this module pulls a **668,323-byte** chunk (174,296 gzip) into the
 * island graph, and `Island Payload Budget` cannot see it because it measures
 * only the EAGER closure while lucide sits one `import()` boundary beyond.
 *
 * On the server that cost is already paid — the icon set is in the binary
 * regardless — so the namespace import stays here and is the right shape for
 * the SSR renderers (`icon-renderer`, `DocsSidebarNav`) that emit `<svg>`
 * directly into the HTML.
 *
 * Client islands must instead render `LucideGlyph` from `./lucide-glyph`, fed by
 * {@link resolveLucideIconNode} geometry serialized into `data-island-props`.
 * Importing THIS module from anything an island reaches restores the 668 KB.
 */

/**
 * Converts a kebab-case icon name to PascalCase for Lucide lookup.
 * Example: 'check-circle' -> 'CheckCircle', 'arrow-right' -> 'ArrowRight'.
 */
export const kebabToPascalCase = (name: string): string =>
  name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')

/**
 * Resolves a Lucide icon component by kebab-case name. Returns undefined when
 * no matching component exists (callers fall back to label-only / a placeholder).
 *
 * Lucide icons use forwardRef, so they are objects (typeof === 'object') in the
 * Bun runtime, not plain functions — both are valid React components.
 */
export const resolveLucideIcon = (
  iconName: string | undefined
): ComponentType<Record<string, unknown>> | undefined => {
  if (!iconName) return undefined
  const component = (LucideIcons as Record<string, unknown>)[kebabToPascalCase(iconName)]
  if (typeof component === 'function') return component as ComponentType<Record<string, unknown>>
  if (typeof component === 'object' && component !== null)
    return component as ComponentType<Record<string, unknown>>
  return undefined
}

/** A `forwardRef` component, as `createLucideIcon` produces. */
interface ForwardRefLike {
  readonly render?: (props: unknown, ref: unknown) => { readonly props?: Record<string, unknown> }
}

/**
 * Resolves a Lucide icon's GEOMETRY by kebab-case name — the serializable half
 * of {@link resolveLucideIcon}, for handing an icon to a client island without
 * handing it the icon set.
 *
 * Every `lucide-react` icon module is `createLucideIcon(name, __iconNode)`, and
 * `createLucideIcon` returns a `forwardRef` whose render passes that
 * `__iconNode` straight to lucide's generic `Icon`. The barrel re-exports only
 * the components, not the `__iconNode` constants (they would all collide on one
 * name), so the geometry is read back by invoking the render — the same call
 * React itself makes — and taking the prop off the element it returns.
 *
 * That reads a documented-but-internal shape, so it is guarded on every branch
 * and degrades to `undefined`, which every call site already handles as
 * "unknown icon". `lucide-resolver.test.ts` pins it against the real package so
 * a lucide upgrade that changes the shape fails a unit test rather than
 * silently blanking every island icon.
 */
export const resolveLucideIconNode = (iconName: string | undefined): LucideIconNode | undefined => {
  const component = resolveLucideIcon(iconName) as ForwardRefLike | undefined
  if (!component || typeof component.render !== 'function') return undefined
  try {
    // eslint-disable-next-line unicorn/no-null -- forwardRef render takes a null ref
    const element = component.render({}, null)
    const node = element?.props?.['iconNode']
    return Array.isArray(node) ? (node as LucideIconNode) : undefined
  } catch {
    return undefined
  }
}
