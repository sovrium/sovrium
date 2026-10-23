/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A page's drawing rewritten for a Claude Design board
 * (`claude-design-canvas-export.ts`): every tree node stamped (or mounted from
 * the design system's bundle), nothing Sovrium-specific to edit left on it,
 * and the board's offline policy.
 */

import {
  serializeHtmlNodes,
  type HtmlElementNode,
  type HtmlNode,
} from '@/domain/kernel/sanitize/html-element-tree'
import {
  boardLinkAttributes,
  isNetworkAddress,
  type CanvasLinkContext,
} from '@/domain/models/app/design/adapters/pages/claude-design-canvas-links'
import { layoutClassNameOf } from '@/domain/models/app/pages/page-layout-service'
import { mountedElementOf, type CanvasBundle } from './claude-design-canvas-mount'
import { LITERAL_BRACES_HOLE } from './claude-design-canvas-prototype'
import type { PageDesignTreeNode } from '@/domain/models/api/admin/design-system/page-design-tree'

/** The attributes a board stamps; the parse half reads exactly these. */
export const CANVAS_STAMP = {
  kit: 'data-kit',
  id: 'data-sovrium-id',
  variant: 'data-kit-variant',
  size: 'data-kit-size',
  layout: 'data-kit-layout',
  content: 'data-kit-content',
  locked: 'data-kit-locked',
  page: 'data-sovrium-page',
  state: 'data-sovrium-state',
  stamp: 'data-sovrium-export',
} as const

/** The elements a board never carries: scripts, styles, embeds and document metadata. */
const DROPPED_TAGS: ReadonlySet<string> = new Set([
  'script',
  'style',
  'link',
  'meta',
  'base',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'noscript',
  'template',
])

/** The attributes the renderer writes for Sovrium's own runtime and tests, never drawn. */
const DROPPED_ATTRIBUTES: ReadonlySet<string> = new Set([
  'data-testid',
  'data-translation-key',
  'data-translations',
  'data-component',
  'data-component-type',
  'data-type',
  'srcdoc',
  'formaction',
  'action',
  'method',
])

/** The attributes that name a resource. */
const SOURCE_ATTRIBUTES: ReadonlySet<string> = new Set(['src', 'srcset', 'poster', 'xlink:href'])

/** A binding or an unresolved variable left in drawn text: `$currentUser.name`, `$label`. */
const EXPRESSION = /\$t:([\w.-]+)|\$[A-Za-z_]\w*(?:\.(\w+))*/g

/** Drawn text with every expression replaced by a placeholder naming what it reads. */
export const withPlaceholders = (text: string): string =>
  text.replace(EXPRESSION, (match: string, key?: string, last?: string) => {
    const name = key?.split('.').at(-1) ?? last ?? match.slice(1)
    return `[${name}]`
  })

/** A resource reference a board may keep: relative, never a scheme, never the site root. */
const isLocalReference = (value: string): boolean => !/^\s*(?:[a-z][a-z0-9+.-]*:|\/)/i.test(value)

const ownAttribute = (name: string): boolean =>
  name.startsWith('data-sovrium-') || name === 'data-kit' || name.startsWith('data-kit-')

/** A namespace declaration names a vocabulary, never a resource a board would fetch. */
const isNamespace = (name: string): boolean => name === 'xmlns' || name.startsWith('xmlns:')

/** An attribute a board never carries: a handler, Sovrium's own, or a network address. */
const isDroppedAttribute = (name: string, value: string): boolean =>
  name.startsWith('on') ||
  DROPPED_ATTRIBUTES.has(name) ||
  ownAttribute(name) ||
  (isNetworkAddress(value) && !isNamespace(name) && name !== 'href')

/** A link's attributes: on a clickable canvas, the board its target is drawn on. */
const linkAttributesOf = (value: string, links: CanvasLinkContext) =>
  boardLinkAttributes(value, links, links.hrefOf?.(value))

/**
 * An element's attributes as a board draws them. `remoteImage` keeps the
 * `https://` source of an image a tree node draws: the address is the
 * config's own, and the board shows that image rather than an empty box.
 */
const drawnAttributes = (
  attributes: Readonly<Record<string, string>>,
  links: CanvasLinkContext,
  remoteImage = false
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(attributes).flatMap(([name, value]): readonly (readonly [string, string])[] => {
      if (remoteImage && name === 'src' && /^https:\/\//i.test(value)) return [[name, value]]
      if (isDroppedAttribute(name, value)) return []
      if (name === 'href') return linkAttributesOf(value, links)
      if (SOURCE_ATTRIBUTES.has(name)) return isLocalReference(value) ? [[name, value]] : []
      if (name === 'class') {
        const kept = value
          .split(/\s+/)
          .filter((token) => token !== '' && !token.startsWith('animate-'))
        return kept.length === 0 ? [] : [[name, kept.join(' ')]]
      }
      return [[name, withPlaceholders(value)]]
    })
  )

/** The stamps of one tree node, as a board's attributes. */
const stampsOf = (node: PageDesignTreeNode): Readonly<Record<string, string>> => {
  const layout = layoutClassNameOf(node.layout, node.responsive)
  return {
    [CANVAS_STAMP.kit]: node.type,
    [CANVAS_STAMP.id]: node.id,
    ...(node.variant === undefined ? {} : { [CANVAS_STAMP.variant]: node.variant }),
    ...(node.size === undefined ? {} : { [CANVAS_STAMP.size]: node.size }),
    ...(layout === '' ? {} : { [CANVAS_STAMP.layout]: layout }),
    ...(node.content === undefined ? {} : { [CANVAS_STAMP.content]: '' }),
    ...(node.locked === undefined ? {} : { [CANVAS_STAMP.locked]: node.locked }),
  }
}

/** Every node of a tree, by id. */
export const nodesById = (
  nodes: readonly PageDesignTreeNode[]
): ReadonlyMap<string, PageDesignTreeNode> =>
  new Map(nodes.flatMap((node) => [[node.id, node] as const, ...nodesById(node.children)]))

/**
 * A tree node whose element a board never carries (an `iframe`): an empty box
 * in its place, its size and stamps kept, so the node is still on the board and
 * is not read back as deleted.
 */
const standInOf = (
  node: HtmlElementNode,
  treeNode: PageDesignTreeNode,
  links: CanvasLinkContext
): HtmlElementNode => {
  const { class: className, style } = node.attributes
  return {
    kind: 'element',
    tag: 'div',
    attributes: {
      ...drawnAttributes(
        {
          ...(className === undefined ? {} : { class: className }),
          ...(style === undefined ? {} : { style }),
        },
        links
      ),
      ...stampsOf(treeNode),
    },
    children: [],
  }
}

/** What a board's nodes are drawn against: its page's tree, its links, the bundle it mounts. */
export interface DrawContext {
  readonly byId: ReadonlyMap<string, PageDesignTreeNode>
  /** What each node does, as the attributes its element carries (`claude-design-canvas-rules.ts`). */
  readonly rules?: Readonly<Record<string, Readonly<Record<string, string>>>> | undefined
  readonly links: CanvasLinkContext
  readonly bundle: CanvasBundle | undefined
}

/** One drawn node rewritten for a board, tree nodes stamped (and mounted, where the bundle can). */
export const drawnNode = (context: DrawContext, node: HtmlNode): readonly HtmlNode[] => {
  if (node.kind === 'text') return [{ kind: 'text', text: withPlaceholders(node.text) }]
  const { links } = context
  const treeNode = context.byId.get(node.attributes[CANVAS_STAMP.id] ?? '')
  if (DROPPED_TAGS.has(node.tag)) {
    return treeNode === undefined ? [] : [standInOf(node, treeNode, links)]
  }
  const element: HtmlElementNode = {
    kind: 'element',
    tag: node.tag,
    attributes: drawnAttributes(
      node.attributes,
      links,
      node.tag === 'img' && treeNode !== undefined
    ),
    children: node.children.flatMap((child) => drawnNode(context, child)),
  }
  return [
    treeNode === undefined
      ? element
      : mountedElementOf(context.bundle, treeNode, element, {
          ...stampsOf(treeNode),
          ...context.rules?.[treeNode.id],
        }),
  ]
}

/** A tree whose every attribute value writes each `{{` as the hole the board fills with `{{`. */
const withLiteralAttributeBraces = (nodes: readonly HtmlNode[]): readonly HtmlNode[] =>
  nodes.map((node) =>
    node.kind === 'text'
      ? node
      : {
          ...node,
          attributes: Object.fromEntries(
            Object.entries(node.attributes).map(([name, value]) => [
              name,
              value.replaceAll('{{', () => LITERAL_BRACES_HOLE),
            ])
          ),
          children: withLiteralAttributeBraces(node.children),
        }
  )

/**
 * A drawn tree written as a board's markup, every text and attribute value as
 * written even where it holds `{{`, which the canvas reads as a template hole:
 * in a text an empty comment parts each `{` from the next (the canvas fills
 * each text run alone, and the page import reads the runs as one), and in an
 * attribute each `{{` is the hole every board fills with `{{`.
 */
export const serializeBoardNodes = (nodes: readonly HtmlNode[]): string =>
  serializeHtmlNodes(withLiteralAttributeBraces(nodes), (text) =>
    text.replaceAll(/\{(?=\{)/g, '{<!---->')
  )

export const escapeText = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** The https origins of the images a board draws, which its policy lets it load. */
export const imageOriginsOf = (body: string): readonly string[] => [
  ...new Set(
    [...body.matchAll(/<img\b[^>]*\ssrc="(https:\/\/[^/"]+)/g)].map((match) => match[1] ?? '')
  ),
]

/**
 * The board's policy: nothing leaves the canvas but the `https` images the
 * config names, so no script on the board reaches another site.
 */
export const boardPolicyOf = (images: readonly string[]): string =>
  [
    "default-src 'none'",
    "script-src 'self' file: 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' file: 'unsafe-inline'",
    "font-src 'self' file: data:",
    ['img-src', "'self'", 'file:', 'data:', 'blob:', ...images].join(' '),
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ')

/** An element's own text, as the page import reads it: its runs, not a kit component's inside it. */
const ownTextOf = (nodes: readonly HtmlNode[]): string =>
  nodes
    .map((node) =>
      node.kind === 'text'
        ? node.text
        : node.attributes[CANVAS_STAMP.kit] === undefined
          ? ownTextOf(node.children)
          : ''
    )
    .join('')

/** Whether any element inside is a kit component. */
const holdsKit = (nodes: readonly HtmlNode[]): boolean =>
  nodes.some(
    (node) =>
      node.kind === 'element' &&
      !DROPPED_TAGS.has(node.tag) &&
      (node.attributes[CANVAS_STAMP.kit] !== undefined || holdsKit(node.children))
  )

/**
 * The text each node of a board draws where the config keeps no literal copy
 * (a bound or translated text): what the page import reads off the board, by
 * node id. Recorded with the board's stamp, it tells a value the export drew
 * (a seeded record, a role's name) from one a designer typed.
 */
export const drawnTextsOf = (nodes: readonly HtmlNode[]): Readonly<Record<string, string>> =>
  Object.fromEntries(
    nodes.flatMap((node): readonly (readonly [string, string])[] => {
      if (node.kind !== 'element') return []
      const id = node.attributes[CANVAS_STAMP.id]
      const own =
        id === undefined ||
        node.attributes[CANVAS_STAMP.kit] === undefined ||
        node.attributes[CANVAS_STAMP.content] !== undefined ||
        node.attributes[CANVAS_STAMP.locked] !== undefined ||
        holdsKit(node.children)
          ? ''
          : ownTextOf(node.children).trim()
      return [
        ...(own === '' || id === undefined ? [] : [[id, own] as const]),
        ...Object.entries(drawnTextsOf(node.children)),
      ]
    })
  )
