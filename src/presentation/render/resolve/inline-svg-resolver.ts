/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { objectNodes } from '@/domain/kernel/config-parsing/config-node-walk'
import { isPlainObject } from '@/domain/kernel/config-parsing/plain-object'
import { sanitizeSvgDrawing, type SvgDrawing } from '@/domain/kernel/sanitize/html-sanitization'
import { isLiteralPublicSvgPath } from '@/domain/models/app/pages/components/component-types/content/image'
import type { Page } from '@/domain/models/app/pages'

/**
 * Pre-render pass for an `image` naming a drawing through `inlineSvg`: the file
 * is read and sanitised here, where a render may wait, and handed to the
 * synchronous renderer on the node. A node left without one, because the file is
 * missing, is not a drawing or sits behind a link leaving the public directory,
 * is drawn as the plain `<img>` it would have been, so the page still answers.
 *
 * Only the config chooses a file. The paths read are taken from the page as the
 * config wrote it, before any record or request value was substituted, and held
 * to the schema's literal form; a value that only appears in the resolved page
 * causes no read and no stamp. The pass itself has to run on the resolved page,
 * because a row's nodes do not exist before then and a row clone would not carry
 * the stamp. Decode refuses a token on every `inlineSvg`, so a node that is
 * drawn cannot hold a record's value.
 *
 * The stamp is a module-private symbol: no config, record or request value can
 * spell it, and a JSON payload drops it, so the only way to put markup on a node
 * is the sanitiser's output, here. A clone that loses it draws the plain image.
 */

const INLINE_DRAWING = Symbol('inlineDrawing')

/** The sanitised drawing this pass stamped on a node, and nothing else. */
export const inlineDrawingOf = (node: object): SvgDrawing | undefined =>
  (node as Readonly<Record<symbol, SvgDrawing | undefined>>)[INLINE_DRAWING]

/** The path a node draws, when it is an image naming one in the literal form. */
const drawingPathOf = (node: Readonly<Record<string, unknown>>): string | undefined =>
  node['type'] === 'image' &&
  typeof node['inlineSvg'] === 'string' &&
  isLiteralPublicSvgPath(node['inlineSvg'])
    ? node['inlineSvg']
    : undefined

/** The `id` prefix of one file: the same on every render, and different from any other file's. */
const idPrefixOf = (path: string): string => `svg${Bun.hash(path).toString(36)}-`

/** `value` with every image naming a read drawing stamped with it. */
const stamped = (value: unknown, drawings: ReadonlyMap<string, SvgDrawing>): unknown => {
  if (Array.isArray(value)) return value.map((item) => stamped(item, drawings))
  if (!isPlainObject(value)) return value
  const copy = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, stamped(item, drawings)])
  )
  const path = drawingPathOf(value)
  const drawing = path === undefined ? undefined : drawings.get(path)
  return drawing === undefined ? copy : { ...copy, [INLINE_DRAWING]: drawing }
}

/**
 * Draws every `inlineSvg` of a resolved page. Each distinct file is read once
 * however many rows repeat it, and a page naming none comes back as it arrived.
 *
 * @param written - the same page as the config wrote it, which alone names files
 */
export async function drawInlineSvgs<T extends Page | object | undefined>(
  page: T,
  written: Page,
  readPublicFile: ((path: string) => Promise<string | undefined>) | undefined
): Promise<T> {
  if (page === undefined || 'unauthorized' in page || readPublicFile === undefined) return page
  const paths = new Set(objectNodes(written).flatMap((node) => drawingPathOf(node) ?? []))
  if (paths.size === 0) return page
  const read = await Promise.all(
    [...paths].map(async (path) => {
      const source = await readPublicFile(path)
      const drawing =
        source === undefined ? undefined : sanitizeSvgDrawing(source, idPrefixOf(path))
      return drawing === undefined ? [] : ([[path, drawing]] as const)
    })
  )
  return stamped(page, new Map(read.flat())) as T
}
