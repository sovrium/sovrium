/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { sanitizeRichTextHTML } from '@/domain/utils/html-sanitization'
import { highlightCodeToHtml } from '@/infrastructure/markdown/shiki-highlighter'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'

export interface CodeHighlight {
  readonly preClass: string
  readonly innerHtml: string
}

type TreeNode = unknown

interface HighlightRequest {
  readonly lang: string
  readonly code: string
}

const PRE_FRAGMENT_RE = /^\s*<pre\b([^>]*)>([\s\S]*)<\/pre>\s*$/
const CLASS_ATTR_RE = /\bclass="([^"]*)"/

function getChildren(node: TreeNode): readonly TreeNode[] | undefined {
  const { children } = node as { readonly children?: unknown }
  return Array.isArray(children) ? (children as readonly TreeNode[]) : undefined
}

function isWalkable(node: TreeNode): boolean {
  if (typeof node !== 'object' || node === null) return false
  return !('component' in node) && !('$ref' in node)
}

function highlightRequestFor(node: TreeNode): HighlightRequest | undefined {
  const component = node as {
    readonly type?: unknown
    readonly props?: Record<string, unknown>
    readonly content?: unknown
  }
  if (component.type !== 'code') return undefined
  const lang = component.props?.['language']
  const code = component.content
  if (typeof lang !== 'string' || lang.length === 0) return undefined
  if (typeof code !== 'string') return undefined
  return { lang, code }
}

function hasHighlightableCode(nodes: readonly TreeNode[] | undefined): boolean {
  if (!nodes) return false
  return nodes.some((node) => {
    if (!isWalkable(node)) return false
    if (highlightRequestFor(node) !== undefined) return true
    return hasHighlightableCode(getChildren(node))
  })
}

function collectCodeNodes(nodes: readonly TreeNode[] | undefined): readonly TreeNode[] {
  if (!nodes) return []
  return nodes.flatMap((node) => {
    if (!isWalkable(node)) return []
    if (highlightRequestFor(node) !== undefined) return [node]
    return collectCodeNodes(getChildren(node))
  })
}

type ResolvedHighlight = readonly [TreeNode, CodeHighlight | undefined]

function attachHighlights(
  nodes: readonly TreeNode[] | undefined,
  resolved: readonly ResolvedHighlight[]
): readonly TreeNode[] | undefined {
  if (!nodes) return nodes
  return nodes.map((node) => {
    if (!isWalkable(node)) return node
    const highlight = resolved.find(([candidate]) => candidate === node)?.[1]
    if (highlight !== undefined) return { ...(node as object), codeHighlight: highlight }
    const children = getChildren(node)
    if (children && children.length > 0) {
      return { ...(node as object), children: attachHighlights(children, resolved) }
    }
    return node
  })
}

function extractHighlight(fragment: string): CodeHighlight | undefined {
  const match = PRE_FRAGMENT_RE.exec(fragment)
  if (match === null) return undefined
  const attrs = match[1] ?? ''
  const innerHtml = match[2]
  if (innerHtml === undefined) return undefined
  return { preClass: CLASS_ATTR_RE.exec(attrs)?.[1] ?? '', innerHtml }
}

async function resolveOne(
  node: TreeNode,
  theme: string | undefined
): Promise<readonly [TreeNode, CodeHighlight | undefined]> {
  const request = highlightRequestFor(node)
  if (request === undefined) return [node, undefined]
  const highlighted = await highlightCodeToHtml(request.lang, request.code, theme)
  return [node, extractHighlight(sanitizeRichTextHTML(highlighted))]
}

async function resolveCodeHighlights(
  nodes: readonly TreeNode[] | undefined,
  theme: string | undefined
): Promise<readonly TreeNode[] | undefined> {
  if (!hasHighlightableCode(nodes)) return nodes
  const resolved = await Promise.all(collectCodeNodes(nodes).map((node) => resolveOne(node, theme)))
  return attachHighlights(nodes, resolved)
}

export async function resolvePageCodeHighlights(
  components: Page['components'],
  theme: string | undefined
): Promise<Page['components']> {
  const resolved = await resolveCodeHighlights(components, theme)
  return resolved as Page['components']
}

export async function resolveComponentsCodeHighlights(
  components: App['components'],
  theme: string | undefined
): Promise<App['components']> {
  if (components === undefined) return components
  const resolved = await resolveCodeHighlights(components as readonly TreeNode[], theme)
  return resolved as App['components']
}

export function readCodeHighlight(component: Component | undefined): CodeHighlight | undefined {
  const highlight = (component as { readonly codeHighlight?: unknown } | undefined)?.codeHighlight
  if (typeof highlight !== 'object' || highlight === null) return undefined
  const { preClass, innerHtml } = highlight as Partial<CodeHighlight>
  if (typeof preClass !== 'string' || typeof innerHtml !== 'string') return undefined
  return { preClass, innerHtml }
}
