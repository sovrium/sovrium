/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { slugifyTitle } from '@/domain/utils/slug'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

export interface TocHeading {
  readonly level: 1 | 2 | 3 | 4 | 5 | 6
  readonly text: string
  readonly id: string
}

const HEADING_LEVEL_MAP: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
}

function getElement(component: Component): string | undefined {
  const { element } = component as { readonly element?: unknown }
  return typeof element === 'string' ? element : undefined
}

function getPropsId(component: Component): string | undefined {
  const { props } = component as { readonly props?: Record<string, unknown> }
  const id = props?.['id']
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

function getContent(component: Component): string | undefined {
  const { content } = component as { readonly content?: unknown }
  return typeof content === 'string' ? content : undefined
}

function getChildren(
  component: Component
):
  | ReadonlyArray<Component | { readonly $ref: string } | { readonly component: unknown }>
  | undefined {
  const { children } = component as { readonly children?: unknown }
  if (!Array.isArray(children)) return undefined
  return children as ReadonlyArray<
    Component | { readonly $ref: string } | { readonly component: unknown }
  >
}

function withId(component: Component, id: string): Component {
  const props = (component as { readonly props?: Record<string, unknown> }).props ?? {}
  return {
    ...component,
    props: { ...props, id },
  } as Component
}

function uniqueSlug(base: string, seen: Map<string, number>): string {
  const count = seen.get(base) ?? 0
  seen.set(base, count + 1)
  return count === 0 ? base : `${base}-${count + 1}`
}

function walkAndAssignIds(
  components: Page['components'],
  seen: Map<string, number>,
  collected: TocHeading[]
): Page['components'] {
  if (!components) return components
  return components.map((item) => {
    if (typeof item !== 'object' || item === null) return item
    if ('component' in item || '$ref' in item) return item
    const component = item as Component
    const element = getElement(component)
    const level = element ? HEADING_LEVEL_MAP[element] : undefined

    if (component.type === 'text' && level !== undefined) {
      const text = getContent(component) ?? ''
      if (text.length === 0) return component
      const existing = getPropsId(component)
      const base = slugifyTitle(text)
      if (!existing && base.length === 0) return component
      const id = existing ?? uniqueSlug(base, seen)
      collected.push({ level, text, id })
      return existing ? component : withId(component, id)
    }

    const children = getChildren(component)
    if (children && children.length > 0) {
      const newChildren = walkAndAssignIds(children as Page['components'], seen, collected)
      return { ...component, children: newChildren } as Component
    }
    return component
  })
}

function walkAndAttachHeadings(
  components: Page['components'],
  headings: readonly TocHeading[]
): Page['components'] {
  if (!components) return components
  return components.map((item) => {
    if (typeof item !== 'object' || item === null) return item
    if ('component' in item || '$ref' in item) return item
    const component = item as Component
    if (component.type === 'toc') {
      return { ...component, tocHeadings: headings } as Component
    }
    const children = getChildren(component)
    if (children && children.length > 0) {
      const newChildren = walkAndAttachHeadings(children as Page['components'], headings)
      return { ...component, children: newChildren } as Component
    }
    return component
  })
}

export function resolvePageToc(components: Page['components']): Page['components'] {
  if (!components) return components
  if (!hasToc(components)) return components
  const seen = new Map<string, number>()
  const collected: TocHeading[] = []
  const withIds = walkAndAssignIds(components, seen, collected)
  return walkAndAttachHeadings(withIds, collected)
}

function hasToc(
  components:
    | ReadonlyArray<Component | { readonly $ref: string } | { readonly component: unknown }>
    | undefined
): boolean {
  if (!components) return false
  return components.some((item) => {
    if (typeof item !== 'object' || item === null) return false
    if ('component' in item || '$ref' in item) return false
    const component = item as Component
    if (component.type === 'toc') return true
    const children = getChildren(component)
    return children ? hasToc(children) : false
  })
}
