/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The typed rewrite seam every page-tree pass goes through.
 *
 * A pass that rewrites a component without caring which type it is — fill a
 * record into it, expand a reference, drop a gated child — builds a copy of a
 * member of the closed component union with one key replaced. TypeScript cannot
 * prove that `{ ...component, children }` is still the SAME member of the union
 * (microsoft/TypeScript#30581: a discriminated union is not re-assignable from a
 * spread of itself), so that copy needs one assertion. It lives here, once,
 * instead of once per pass, and every walker reads and writes the tree through
 * {@link Component} rather than through an open type.
 *
 * The other unavoidable assertion is {@link entryAsComponent}: a reference the
 * expansion pass could not resolve stays in the tree, and every pass has always
 * walked it as a component with no `type` (its `children` are the page's own
 * components, so a pass that skipped it would fail open on them). Naming that
 * here keeps the behaviour and makes the one place it happens greppable.
 */

import type { Component } from '@/domain/models/app/pages/components'
import type { DataSource } from '@/domain/models/app/pages/components/data-source'

/** One entry of a page component list: a component, an unexpanded reference, or text. */
export type ComponentEntry = NonNullable<Component['children']>[number]

/** One non-text entry of a page component list. */
export type ComponentNode = Exclude<ComponentEntry, string>

/** Every key some branch of the component union declares. */
export type ComponentKey = Component extends infer C ? (C extends unknown ? keyof C : never) : never

/**
 * What key `K` holds across the branches that declare it — `content` is the
 * union of every branch's `content`, a branch without one contributing nothing.
 */
export type ComponentField<K extends ComponentKey> = Component extends infer C
  ? C extends unknown
    ? K extends keyof C
      ? C[K]
      : never
    : never
  : never

/** A component's `content`, whichever type draws it. */
export type ComponentContent = ComponentField<'content'> | undefined

/** A component's binding, whichever type declares one. */
export type ComponentBinding = NonNullable<ComponentField<'dataSource'>>

/** A component's breakpoint overrides, whichever type declares them. */
export type ComponentResponsive = ComponentField<'responsive'> | undefined

/** A component's props as the render passes carry them: the authored keys plus render-time stamps. */
export type RenderProps = Readonly<Record<string, unknown>>

/**
 * A copy of `component` with the keys of `patch` written over it, in the order
 * `patch` lists them (a key the component already holds keeps its position, so
 * the rendered attribute order is the one the spread always produced).
 *
 * The patch is open on purpose: the passes also stamp render-time keys no
 * schema declares (`_expandedReference`, `tocHeadings`, a row's `_record`).
 */
export const rewriteComponent = (
  component: Component,
  patch: Readonly<Record<string, unknown>>
): Component => ({ ...component, ...patch }) as Component

/**
 * A copy of `component` whose `children` are `map` applied to its own (an
 * absent list is read as empty, and the copy then carries the mapped list).
 */
export const mapComponentChildren = (
  component: Component,
  map: (children: readonly ComponentEntry[]) => readonly ComponentEntry[]
): Component => rewriteComponent(component, { children: map(component.children ?? []) })

/**
 * A non-text entry walked as a component: a component, or a reference left
 * unexpanded, which every pass walks as a component with no `type` — see the
 * module note.
 */
export const entryAsComponent = (entry: ComponentNode): Component => entry as Component

/**
 * A node's own keys, read by NAME — for the passes that read a key generically
 * (a slot named by the type's slot list, a render-time stamp) rather than off
 * one branch of the union. Typed reads narrow on `type` or on `in` instead.
 */
export const componentFields = (node: object): Readonly<Record<string, unknown>> =>
  node as Readonly<Record<string, unknown>>

/**
 * Key `key` of a value read by name, as the passes have always read a binding
 * or an action: `undefined` on a nullish value and on a key it does not hold.
 * Never `in`: a template's binding can still be a `$variable` string at render
 * time, before the placement's values are filled in, and `in` throws on one.
 */
export const keyOf = (value: unknown, key: string): unknown =>
  value === null || value === undefined
    ? undefined
    : (value as Readonly<Record<string, unknown>>)[key]

/**
 * Key `key` of a component, whichever branch it is — `undefined` on a branch
 * that does not declare it. The typed read a pass uses when it treats every
 * type alike (fill a record into `content`, whatever draws it).
 */
export const componentField = <K extends ComponentKey>(
  component: Component,
  key: K
): ComponentField<K> | undefined => componentFields(component)[key] as ComponentField<K> | undefined

/**
 * A component's binding read as a RECORD binding — the `table` / `view` /
 * `filter` / `sort` / `pagination` struct the data-source modes query — or
 * `undefined` when the binding is absent or not an object (a template's
 * `$variable` before its values are filled in).
 *
 * Read by name, exactly as the passes always read it: another binding (a system
 * endpoint, a chart's) answers `undefined` for every key it does not hold, so
 * test presence with {@link componentField}, not with this. Every table-naming
 * branch of the binding union is assignable to the record struct, which is why
 * this one assertion stands in for one per read.
 */
export const tableBindingOf = (component: Component): DataSource | undefined => {
  const binding = componentField(component, 'dataSource')
  return typeof binding === 'object' && binding !== null ? (binding as DataSource) : undefined
}

/** A copy of `component` without key `key`, every other key in its place. */
export const withoutComponentKey = (component: Component, key: string): Component =>
  Object.fromEntries(Object.entries(component).filter(([name]) => name !== key)) as Component

/**
 * A node built at render time rather than read off the decoded tree: a
 * template instantiated for one placement, a combobox drawn as a `select` with
 * type-ahead on, seeded specimen rows drawn as a written table. No decode vouches
 * for the copy itself; the code that builds it answers for its shape.
 */
export const synthesizedComponent = (node: object): Component => node as Component
