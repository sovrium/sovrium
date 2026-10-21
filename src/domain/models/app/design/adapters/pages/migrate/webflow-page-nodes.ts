/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Chunk } from 'effect'
import { pageNodeIdOf } from '@/domain/models/app/pages/node-identity'
import { migratedLiteral } from './migrated-literal-tokens-service'
import { webflowAssetPlaceOf } from './webflow-asset-path'
import { classesOf, isTextOnly, webflowElementOf } from './webflow-page-elements'
import { layoutOf, type LayoutTarget, type SpacingScale } from './webflow-page-layout'
import { WEBFLOW_PAGE_MAPPINGS } from './webflow-page-mappings'
import {
  elementsUnder,
  extractWebflowForm,
  foldedText,
  hasClass,
  type WebflowExtractedForm,
} from './webflow-site-forms'
import { declarationsForClasses, type ClassRule } from './webflow-site-stylesheet'
import type { MappedNode, MigratedComponentMapping } from './migrated-page-mapping'
import type { MigratedPagesReport } from './migrated-pages-report'
import type { HtmlElementNode, HtmlNode } from '@/domain/kernel/sanitize/html-element-tree'

/**
 * The elements of one exported Webflow page, as kit nodes — through
 * `WEBFLOW_PAGE_MAPPINGS` and nothing else.
 *
 * - An element the table has no row for is reported where it sat, and
 *   nothing is drawn for it or for anything inside it.
 * - A Div Block is a `flex` or a `grid` when its classes set that display, a
 *   `text` paragraph when it holds text only (a Text Block: the real export's
 *   headings are `<div class="h3">`, and no heading level is read off a class
 *   name), and a `container` otherwise.
 * - A Webflow Button is a `Link` element drawn as a button (`a.w-button`), so
 *   it is a `button` node; any other link is a `link`.
 * - A form becomes one `form` node naming the extracted form read from it.
 * - A Collection list is an unbound container; the export holds no CMS
 *   content (fact c3), so the list is named and nothing is invented for it.
 * - An image's path is resolved against its page's place in the export
 *   (`webflow-asset-path.ts`) and written from the site's root, its file named
 *   for the operator to carry, never copied. An image served from a URL keeps
 *   its address, since a migration fetches nothing; one outside the export, or
 *   written into the page as a `data:` URL, keeps no `src` and is reported.
 */

/** One kit node a Webflow migration writes. */
export interface WebflowNode {
  readonly type: string
  readonly key?: string
  readonly element?: string
  readonly content?: string
  readonly formRef?: string
  readonly panels?: readonly { readonly label: string }[]
  readonly props?: Readonly<Record<string, string>>
  readonly children?: readonly WebflowNode[]
}

type Report = MigratedPagesReport

/** What converting some elements produced. */
export interface ConvertedNodes {
  readonly nodes: readonly WebflowNode[]
  readonly unbound: Report['unbound']
  readonly unmapped: Report['unmapped']
  readonly offScale: Report['offScale']
  readonly leftBehind: Report['leftBehind']
  readonly forms: readonly { readonly pointer: string; readonly form: WebflowExtractedForm }[]
}

/** What converting a page's elements reads. */
export interface NodeContext {
  readonly page: string
  readonly path: string
  /** The page's HTML file, by its path inside the export: where its relative assets are resolved. */
  readonly file: string
  readonly spacing: SpacingScale
  readonly rules: readonly ClassRule[]
  /** The migrated path of an exported page, by an `href` as the page wrote it. */
  readonly hrefOf: (href: string) => string | undefined
  /** Every form name the site already uses. */
  readonly formNames: ReadonlySet<string>
  /** The forms met on the page before this point, so the next one's position follows them. */
  readonly formsBefore: number
}

const NONE: ConvertedNodes = {
  nodes: [],
  unbound: [],
  unmapped: [],
  offScale: [],
  leftBehind: [],
  forms: [],
}

/** Sibling conversions joined, in order, in one pass over each list. */
const joinAll = (parts: readonly ConvertedNodes[]): ConvertedNodes => ({
  nodes: parts.flatMap((part) => part.nodes),
  unbound: parts.flatMap((part) => part.unbound),
  unmapped: parts.flatMap((part) => part.unmapped),
  offScale: parts.flatMap((part) => part.offScale),
  leftBehind: parts.flatMap((part) => part.leftBehind),
  forms: parts.flatMap((part) => part.forms),
})

const rowOf = (name: string): MigratedComponentMapping | undefined =>
  Object.hasOwn(WEBFLOW_PAGE_MAPPINGS.components, name)
    ? WEBFLOW_PAGE_MAPPINGS.components[name]
    : undefined

const unmapped = (
  context: NodeContext,
  pointer: string,
  component: string,
  missing?: string
): ConvertedNodes => ({
  ...NONE,
  unmapped: [
    {
      page: context.page,
      at: pageNodeIdOf(context.page, pointer),
      component,
      ...(missing === undefined
        ? { reason: 'not-in-table' as const }
        : { reason: 'required-value-missing' as const, missing }),
    },
  ],
})

/** An element, the Webflow element it is, and the table row that maps it. */
interface Recognised {
  readonly element: HtmlElementNode
  readonly name: string
  readonly row: MappedNode
}

const one = (node: WebflowNode, extra: Partial<ConvertedNodes> = {}): ConvertedNodes => ({
  ...NONE,
  ...extra,
  nodes: [node],
})

/** The kit type a holding element becomes: its row's, or a Div Block's by its display. */
const targetOf = (
  name: string,
  row: MappedNode,
  declarations: ReadonlyMap<string, string>
): string => {
  if (name !== 'Block') return row.type
  const display = declarations.get('display')
  if (display === 'flex' || display === 'inline-flex') return 'flex'
  return display === 'grid' || display === 'inline-grid' ? 'grid' : row.type
}

const holdingNodeOf = (
  { element, name, row }: Recognised,
  pointer: string,
  context: NodeContext
): ConvertedNodes => {
  if (name === 'Block' && element.children.length > 0 && isTextOnly(element.children)) {
    const content = foldedText(element.children)
    if (content !== '')
      return one({ type: 'text', element: 'p', content: migratedLiteral(content) })
  }
  const declarations = declarationsForClasses(context.rules, classesOf(element))
  const type = targetOf(name, row, declarations)
  const target: LayoutTarget = type === 'flex' || type === 'grid' ? type : 'container'
  const layout = layoutOf(
    target,
    declarations,
    context.spacing,
    name === 'VFlex' ? 'column' : 'row'
  )
  const inner = convertNodes(element.children, `${pointer}/children`, context)
  const className = layout.classes.join(' ')
  const node: WebflowNode = {
    type,
    ...(className === '' ? {} : { props: { className } }),
    ...(inner.nodes.length === 0 ? {} : { children: inner.nodes }),
  }
  const offScale = layout.offScale.map((finding) => ({
    page: context.page,
    node: pageNodeIdOf(context.page, pointer),
    ...finding,
  }))
  return { ...inner, nodes: [node], offScale: [...offScale, ...inner.offScale] }
}

/** A link target the config may hold: a site page's migrated path, an anchor, or a web, mail or phone address. */
const linkTargetOf = (href: string | undefined, context: NodeContext): string | undefined => {
  if (href === undefined || href === '') return undefined
  if (/^(?:https?:|mailto:|tel:)/i.test(href) || href.startsWith('#')) return href
  return context.hrefOf(href)
}

const contentNodeOf = (
  { element, name, row }: Recognised,
  pointer: string,
  context: NodeContext
): ConvertedNodes => {
  const text = name === 'CodeBlock' ? elementsText(element) : foldedText(element.children)
  if (text === '') return unmapped(context, pointer, name, 'content')
  const content = migratedLiteral(text)
  if (name !== 'Link') {
    const level = row.element === 'source-tag' ? element.tag : row.element
    return one({ type: row.type, ...(level === undefined ? {} : { element: level }), content })
  }
  const href = linkTargetOf(element.attributes['href'], context)
  if (hasClass(element, 'w-button')) {
    return one({ type: 'button', content, ...(href === undefined ? {} : { props: { href } }) })
  }
  return href === undefined
    ? unmapped(context, pointer, name, 'href')
    : one({ type: row.type, content, props: { href } })
}

/** A code block's text as written: its lines kept, never folded. */
const elementsText = (element: HtmlElementNode): string =>
  element.children
    .map((node) => (node.kind === 'text' ? node.text : elementsText(node)))
    .join('')
    .replace(/^\n+|\s+$/g, '')

const imageNodeOf = (
  element: HtmlElementNode,
  pointer: string,
  context: NodeContext
): ConvertedNodes => {
  const src = element.attributes['src'] ?? ''
  if (src.trim() === '') return unmapped(context, pointer, 'Image', 'src')
  const alt = migratedLiteral(element.attributes['alt'] ?? '')
  const image = (props: Readonly<Record<string, string>>): WebflowNode => ({
    type: 'image',
    ...(alt === '' && Object.keys(props).length === 0
      ? {}
      : { props: alt === '' ? props : { ...props, alt } }),
  })
  const place = webflowAssetPlaceOf(context.file, src)
  if (place.kind === 'network') return one(image({ src: place.url }))
  if (place.kind === 'archive') {
    const name = place.path.slice(place.path.lastIndexOf('/') + 1)
    return one(image({ src: `/${place.path}` }), {
      leftBehind: [{ page: context.page, what: `Image file: ${name}`, file: place.path }],
    })
  }
  const what =
    place.kind === 'inline'
      ? 'Image written into the page as a data: URL, not carried'
      : `Image outside the export: ${place.reference}`
  return one(image({}), { leftBehind: [{ page: context.page, what }] })
}

const formNodeOf = (element: HtmlElementNode, pointer: string, context: NodeContext) => {
  const form = extractWebflowForm(element, context.path, context.formsBefore, context.formNames)
  return one({ type: 'form', formRef: form.name }, { forms: [{ pointer, form }] })
}

const tabsNodeOf = (
  element: HtmlElementNode,
  pointer: string,
  context: NodeContext
): ConvertedNodes => {
  const all = elementsUnder(element.children)
  const labels = all
    .filter((child) => hasClass(child, 'w-tab-link'))
    .map((link) => foldedText(link.children))
  const panes = all.filter((child) => hasClass(child, 'w-tab-pane'))
  if (labels.length === 0 || labels.length !== panes.length || labels.includes('')) {
    return unmapped(context, pointer, 'TabsWrapper', 'panels')
  }
  const inner = joinAll(
    panes.map((pane, index): ConvertedNodes => {
      const at = `${pointer}/children/${index}`
      const converted = convertNodes(pane.children, `${at}/children`, context)
      const children = converted.nodes.length === 0 ? {} : { children: converted.nodes }
      return { ...converted, nodes: [{ type: 'container', ...children }] }
    })
  )
  return {
    ...inner,
    nodes: [
      {
        type: 'tabs',
        panels: labels.map((label) => ({ label: migratedLiteral(label) })),
        children: inner.nodes,
      },
    ],
  }
}

const dynamoNodeOf = (
  element: HtmlElementNode,
  pointer: string,
  context: NodeContext
): ConvertedNodes =>
  one(
    { type: 'container' },
    {
      unbound: [
        {
          page: context.page,
          node: pageNodeIdOf(context.page, pointer),
          component: 'DynamoWrapper',
          expression: `Collection list: ${classesOf(element).join(' ')}`,
        },
      ],
    }
  )

/** One element whose row maps it to a node. */
const nodeOf = (seen: Recognised, pointer: string, context: NodeContext): ConvertedNodes => {
  const { element, name, row } = seen
  if (name === 'FormWrapper') return formNodeOf(element, pointer, context)
  if (name === 'TabsWrapper') return tabsNodeOf(element, pointer, context)
  if (name === 'DynamoWrapper') return dynamoNodeOf(element, pointer, context)
  if (name === 'Image') return imageNodeOf(element, pointer, context)
  return row.holds === 'children'
    ? holdingNodeOf(seen, pointer, context)
    : contentNodeOf(seen, pointer, context)
}

/** One element, at `pointer` (where its node would be). */
const elementOf = (
  element: HtmlElementNode,
  pointer: string,
  context: NodeContext
): ConvertedNodes => {
  const kind = webflowElementOf(element)
  if (kind.kind === 'skip') return NONE
  const row = rowOf(kind.name)
  if (row?.outcome !== 'node') return unmapped(context, pointer, kind.name)
  return nodeOf({ element, name: kind.name, row }, pointer, context)
}

/** Whether an element is a wrapper whose children are mapped in its place (a rich-text block). */
const isTransparent = (node: HtmlNode): node is HtmlElementNode => {
  if (node.kind !== 'element') return false
  const kind = webflowElementOf(node)
  return kind.kind === 'element' && rowOf(kind.name)?.outcome === 'transparent'
}

/** Some nodes with every transparent wrapper replaced by its children. */
const unwrapped = (nodes: readonly HtmlNode[]): readonly HtmlNode[] =>
  nodes.flatMap((node) => (isTransparent(node) ? unwrapped(node.children) : [node]))

/** Sibling nodes converted so far, with the form names and count they add. */
interface SiblingsRead {
  readonly parts: Chunk.Chunk<ConvertedNodes>
  readonly count: number
  readonly formNames: ReadonlySet<string>
  readonly formsBefore: number
}

/**
 * Convert sibling nodes into the array at `parent` (a JSON pointer). A run of
 * text loose among elements is Webflow's `String`, which the table does not
 * hold, so it is reported rather than turned into a paragraph.
 */
export const convertNodes = (
  nodes: readonly HtmlNode[],
  parent: string,
  context: NodeContext
): ConvertedNodes => {
  // Each sibling's conversion is appended to a chunk and the lists are joined
  // once: joining them per sibling made a long page quadratic.
  const read = unwrapped(nodes).reduce<SiblingsRead>(
    (acc, node) => {
      const pointer = `${parent}/${acc.count}`
      const part =
        node.kind === 'text'
          ? node.text.trim() === ''
            ? NONE
            : unmapped(context, pointer, 'String')
          : elementOf(node, pointer, {
              ...context,
              formNames: acc.formNames,
              formsBefore: acc.formsBefore,
            })
      return {
        parts: Chunk.append(acc.parts, part),
        count: acc.count + part.nodes.length,
        formNames:
          part.forms.length === 0
            ? acc.formNames
            : new Set([...acc.formNames, ...part.forms.map((entry) => entry.form.name)]),
        formsBefore: acc.formsBefore + part.forms.length,
      }
    },
    {
      parts: Chunk.empty(),
      count: 0,
      formNames: context.formNames,
      formsBefore: context.formsBefore,
    }
  )
  return joinAll(Chunk.toReadonlyArray(read.parts))
}
