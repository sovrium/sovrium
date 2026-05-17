/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAbsolute, resolve } from 'node:path'
import type {
  ComponentReference,
  SimpleComponentReference,
} from '@/domain/models/app/components/reference'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Pre-render resolver for `customHTML` components that load HTML from an
 * external file path via the schema's `htmlSrc` field.
 *
 * Why this is a separate resolver (not inlined into `renderCustomHTML`):
 *   - The renderer (`dispatchComponentType` → `renderCustomHTML`) is
 *     synchronous (returns a `ReactElement`, not a `Promise`), but file I/O
 *     under Bun's SSR pipeline is async. Resolving `htmlSrc` upstream — at
 *     the same place we already pre-process `dataSource` bindings — keeps
 *     the renderer pure and synchronous.
 *
 * Behavior (per US-PAGES-INTERACTIVITY-CUSTOM-HTML-002):
 *   - When `htmlSrc` is set on a `customHTML` component, read the file and
 *     write its contents into `content`.
 *   - When BOTH `htmlSrc` and `content` are set, `htmlSrc` takes precedence
 *     (AC `APP-PAGES-CUSTOM-HTML-009`).
 *   - On read failure (missing file, permission denied, etc.) the page must
 *     not crash (AC `APP-PAGES-CUSTOM-HTML-008`); we substitute a small
 *     error placeholder so the wrapper element still renders visibly.
 *   - `htmlSrc` is removed from the top level after resolution so it does
 *     not leak through the prop-builder pipeline as an HTML attribute
 *     (e.g. `htmlsrc="..."`) which React rejects. `htmlSrc` is read from
 *     the top level only — see `resolveCustomHtmlComponent` for why we do
 *     not honour `props.htmlSrc`.
 *
 * Path resolution: paths are resolved against `process.cwd()` (the project
 * root the CLI was invoked from), matching the convention used by the CLI
 * for loading config files.
 */

/**
 * HTML-escape a string for safe inclusion in serialized HTML attribute or
 * text content. Defense-in-depth: `htmlSrc` originates from the trusted
 * app schema, but the placeholder is built into a raw HTML string that
 * later flows through `dangerouslySetInnerHTML`, so we escape the path
 * to keep the boundary tight regardless of upstream trust.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Read a file from disk under the project root.
 *
 * Returns `undefined` on any I/O failure — the caller decides what to render
 * as the fallback. We deliberately do NOT throw: a missing custom-HTML file
 * must not 500 the entire page.
 *
 * Uses `Bun.file().text()` which is the SSR-safe primitive on the Bun
 * runtime Sovrium targets.
 */
async function readHtmlFile(path: string): Promise<string | undefined> {
  try {
    const absolutePath = isAbsolute(path) ? path : resolve(process.cwd(), path)
    const file = Bun.file(absolutePath)
    if (!(await file.exists())) return undefined
    return await file.text()
  } catch {
    return undefined
  }
}

/**
 * Resolve `htmlSrc` for a single `customHTML` component into `content`.
 *
 * Returns the component unchanged when no `htmlSrc` is present.
 *
 * `htmlSrc` is read from the component's TOP LEVEL only — that is where the
 * schema declares it (`customHtmlFields.htmlSrc`). We deliberately do NOT
 * honour `props.htmlSrc`: doing so would mask schema mismatches authored
 * in app configs and tests, where `htmlSrc` accidentally lives under
 * `props`. The schema is the source of truth (CLAUDE.md "Schema Before
 * Specs").
 */
async function resolveCustomHtmlComponent(component: Component): Promise<Component> {
  if (component.type !== 'customHTML') return component

  const { htmlSrc } = component as { htmlSrc?: string }
  if (!htmlSrc) return component

  const fileContent = await readHtmlFile(htmlSrc)

  // Build the next component:
  //   - htmlSrc takes precedence over inline `content` (per AC #009).
  //   - On read failure, render a small visible placeholder so the wrapper
  //     div has dimensions (otherwise `toBeVisible()` fails on an empty div).
  //     The path is HTML-escaped because it is interpolated into a raw HTML
  //     string that later flows through `dangerouslySetInnerHTML`.
  const escapedSrc = escapeHtml(htmlSrc)
  const nextContent =
    fileContent !== undefined
      ? fileContent
      : `<!-- customHTML: failed to load ${escapedSrc} -->\n<span data-custom-html-error="true">External HTML file not available: ${escapedSrc}</span>`

  // Strip htmlSrc from the top level so it does not leak as an unknown
  // HTML attribute via the prop-builder pipeline (React would warn about
  // `htmlsrc="..."` on the wrapper div).
  const { htmlSrc: _omitTop, ...restComponent } = component as Component & {
    htmlSrc?: string
  }

  return {
    ...restComponent,
    content: nextContent,
  } as Component
}

/**
 * Recursively resolves `customHTML` components in a component tree.
 * Component references are returned unchanged (they are not customHTML).
 */
async function resolveComponentTree(
  item: Component | SimpleComponentReference | ComponentReference
): Promise<Component | SimpleComponentReference | ComponentReference> {
  if ('component' in item || '$ref' in item) return item
  const component = item as Component

  // Resolve this node's own htmlSrc first.
  const resolved = await resolveCustomHtmlComponent(component)

  // Then recurse into children if present.
  const { children } = resolved as { children?: ReadonlyArray<unknown> }
  if (!children || children.length === 0) return resolved

  const resolvedChildren = await Promise.all(
    children.map(async (child) => {
      if (typeof child === 'string') return child
      return resolveComponentTree(
        child as Component | SimpleComponentReference | ComponentReference
      )
    })
  )

  return {
    ...resolved,
    children: resolvedChildren,
  } as Component
}

/**
 * Walks a page's components and resolves any `customHTML` `htmlSrc` paths
 * into inline `content`. Safe to call on every page — pages without
 * customHTML components return effectively unchanged (cheap walk).
 *
 * Run AFTER `resolvePageDataSources` so the page already has its data
 * bindings in place; the resolver only touches the component tree shape.
 */
export async function resolveCustomHtmlSources(page: Page): Promise<Page> {
  if (!page.components || page.components.length === 0) return page

  const resolvedComponents = await Promise.all(page.components.map((c) => resolveComponentTree(c)))

  return {
    ...page,
    components: resolvedComponents,
  }
}
