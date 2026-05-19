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


function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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

async function resolveCustomHtmlComponent(component: Component): Promise<Component> {
  if (component.type !== 'customHTML') return component

  const { htmlSrc } = component as { htmlSrc?: string }
  if (!htmlSrc) return component

  const fileContent = await readHtmlFile(htmlSrc)

  const escapedSrc = escapeHtml(htmlSrc)
  const nextContent =
    fileContent !== undefined
      ? fileContent
      : `<!-- customHTML: failed to load ${escapedSrc} -->\n<span data-custom-html-error="true">External HTML file not available: ${escapedSrc}</span>`

  const { htmlSrc: _omitTop, ...restComponent } = component as Component & {
    htmlSrc?: string
  }

  return {
    ...restComponent,
    content: nextContent,
  } as Component
}

async function resolveComponentTree(
  item: Component | SimpleComponentReference | ComponentReference
): Promise<Component | SimpleComponentReference | ComponentReference> {
  if ('component' in item || '$ref' in item) return item
  const component = item as Component

  const resolved = await resolveCustomHtmlComponent(component)

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

export async function resolveCustomHtmlSources(page: Page): Promise<Page> {
  if (!page.components || page.components.length === 0) return page

  const resolvedComponents = await Promise.all(page.components.map((c) => resolveComponentTree(c)))

  return {
    ...page,
    components: resolvedComponents,
  }
}
