/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createElement, type ReactNode } from 'react'
import { isImageKey } from '@/domain/kernel/identity/mime-types'
import { toSafeAssetUrl } from '@/domain/kernel/url/asset-url-safety'
import {
  substituteRecordVars,
  withDisplayLabels,
} from '@/domain/models/app/pages/substitute-record-vars'
import { CardQr } from './card-qr'
import type { TableRecord } from '../runtime/types'
import type { EccLevel } from '@/domain/models/app/links/qr-code-service'

/**
 * The HTML elements a card.children entry may render as. Restricting them
 * prevents schema-driven XSS via malicious element names.
 */
const ALLOWED_CARD_ELEMENT = /^(?:h[1-6]|p|span|div|small|strong|em)$/

/**
 * `$record.*` substitution for a card template.
 *
 * This was a local copy, written because the page renderer's helper of the same
 * name rendered an explicit `null` as the literal string `"null"` while a card
 * needs it to be nothing. That divergence is closed: the shared helper now maps
 * `null` and `undefined` alike to the empty string, so the work-around is a
 * re-export and a card also gains the `|` fallback chain for free.
 *
 * This is the ADDRESS-site spelling — `onClick` paths and `coverImage` URLs —
 * so a relationship keeps its stored key here. The card's text goes through
 * {@link renderCardChild}, which substitutes against the labelled record.
 */
export const substitute: (text: string, record: TableRecord) => string = substituteRecordVars

/** One attached file as the records API enriches it. */
interface AttachedFile {
  readonly key?: unknown
  readonly mimeType?: unknown
  readonly signedUrl?: unknown
  readonly url?: unknown
}

/**
 * Is an attached file an image? The type recorded with it decides first (a
 * field storing its metadata keeps `mimeType`, canonical lower case since the
 * upload); with none, the stored key's extension does — an upload's key keeps
 * the uploaded file's name. Neither is not an image: a PDF or a Word document
 * is never drawn as a picture. Anything that is not a file object is none.
 */
function isImageFile(entry: unknown): entry is AttachedFile {
  const file = entry as AttachedFile | null | undefined
  const recorded = file?.mimeType
  return typeof recorded === 'string'
    ? recorded.startsWith('image/')
    : typeof file?.key === 'string' && isImageKey(file.key)
}

/**
 * The reader URL of the first file an attachment value holds that is an
 * image — passing over the documents before it — or `undefined` when none is.
 * The records API has already enriched each file with the URL it is read at.
 */
function attachmentImageUrl(value: unknown): string | undefined {
  const image = [value].flat().find(isImageFile)
  const url = image?.signedUrl ?? image?.url
  return typeof url === 'string' ? toSafeAssetUrl(url) : undefined
}

/**
 * The image a card draws for a source template — a cover or an `image` child.
 *
 * A template naming an attachment field — one enriched file, or a list of them
 * (an object either way) — reads the first image file it holds, and a field
 * whose files are none of them images gives no image at all: it never falls
 * through to the text reading, where the enriched object would print
 * "[object Object]". Any other value is drawn only when it is a web address or
 * a path on this site; an empty value (the field was null), a script or a
 * scheme-less address is no image at all.
 */
export function resolveImageSource(template: string, record: TableRecord): string | undefined {
  const field = /^\$record\.([\w-]+)$/.exec(template.trim())?.[1]
  const value = field === undefined ? undefined : record[field]
  return typeof value === 'object' && value !== null
    ? attachmentImageUrl(value)
    : toSafeAssetUrl(substitute(template, record))
}

/**
 * The classes a card's record components wear, supplied by the island that
 * draws the card — a board and a gallery each keep their own recipe module,
 * and neither pays for the other's.
 */
export interface CardChildClasses {
  readonly avatar: string
  readonly badge: string
}

/** Two letters for a name: the first and last words' initials. Shared with the board's avatar footer. */
export const initialsOf = (name: string): string => {
  const words = name.trim().split(/\s+/)
  return `${words[0]?.[0] ?? ''}${words.length > 1 ? (words.at(-1)?.[0] ?? '') : ''}`.toUpperCase()
}

/** A string field of a card child, `$record.*` resolved against the labelled record. */
const childText = (child: Record<string, unknown>, key: string, record: TableRecord): string => {
  const raw = child[key]
  return typeof raw === 'string' ? substitute(raw, withDisplayLabels(record)) : ''
}

/** The attribute every card child names its type with (written once, read by specs). */
const TYPE_STAMP = 'data-component-type'

type RecordComponentRenderer = (
  child: Record<string, unknown>,
  record: TableRecord,
  key: string,
  classes: CardChildClasses
) => ReactNode

/**
 * The record components a card slot draws besides text, each named by its
 * type. Every one reads the card's own record; a data component never reaches
 * here, because decode refuses one in a card slot.
 */
const RECORD_COMPONENTS: Readonly<Record<string, RecordComponentRenderer>> = {
  avatar: (child, record, key, classes) => {
    const label = childText(child, 'label', record)
    return label === ''
      ? undefined
      : createElement(
          'span',
          { key, [TYPE_STAMP]: 'avatar', className: classes.avatar, title: label },
          initialsOf(label)
        )
  },
  // An address site: the value is the record's stored value, not its label.
  'qr-code': (child, record, key) => {
    const value = substitute(String(child['value'] ?? ''), record)
    const props = (child['props'] ?? {}) as Record<string, unknown>
    return value === ''
      ? undefined
      : createElement(CardQr, {
          // The decoded child carries `size` and `ecc` as the page `qr-code` has them.
          ...(child as { readonly size?: number; readonly ecc?: EccLevel }),
          key,
          value,
          title: childText(props, 'aria-label', record),
          className: props['className'] as string | undefined,
        })
  },
  // An attachment field draws its file; any other value only as a web address
  // or a same-origin path — no other scheme is an image this card will fetch.
  image: (child, record, key) => {
    const src = resolveImageSource(String(child['src'] ?? ''), record)
    return src === undefined
      ? undefined
      : createElement('img', {
          key,
          [TYPE_STAMP]: 'image',
          src,
          alt: childText(child, 'alt', record),
        })
  },
  badge: (child, record, key, classes) => {
    const text = childText(child, 'content', record)
    return text === ''
      ? undefined
      : createElement('span', { key, [TYPE_STAMP]: 'badge', className: classes.badge }, text)
  },
}

/**
 * Render a single card.children entry as a React element.
 *
 * Schema shape (from card-template spec):
 *   { type: '<schema-type>', element: 'h2', props: { className }, content: '$record.title' }
 *
 * A `text` child (or any type not listed below) renders the HTML element from
 * `element`, applies `className` from `props`, and substitutes `$record.X`
 * tokens in `content`. An `avatar`, `image` or `badge` child draws that
 * component for the card's record. When the substituted text is empty (e.g.
 * all referenced fields are null), the element is omitted to avoid empty
 * paragraphs.
 */
export function renderCardChild(
  child: Record<string, unknown>,
  record: TableRecord,
  index: number,
  classes: CardChildClasses
): ReactNode {
  const key = `child-${String(index)}`
  const type = typeof child['type'] === 'string' ? child['type'] : 'text'
  const recordComponent = RECORD_COMPONENTS[type]
  if (recordComponent !== undefined) return recordComponent(child, record, key, classes)
  const elementName = typeof child['element'] === 'string' ? child['element'] : 'span'
  const tag = ALLOWED_CARD_ELEMENT.test(elementName) ? elementName : 'span'
  // A TEXT site: a relationship prints its `displayField` label, not its key.
  const text = childText(child, 'content', record)
  if (text === '') return undefined
  // Only a class reaches the element from `props` — no other attribute can.
  const { className } = (child['props'] ?? {}) as { readonly className?: unknown }
  return createElement(
    tag,
    {
      key,
      [TYPE_STAMP]: type,
      className: typeof className === 'string' ? className : undefined,
    },
    text
  )
}
