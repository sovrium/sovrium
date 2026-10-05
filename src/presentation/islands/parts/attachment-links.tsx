/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * An attached file drawn as a link named after it — shared by the grid's
 * attachment cells and the record drawer, so a receipt reads the same in the
 * cell and in the drawer: its file name, following the address the records
 * API already signed, never a stringified object and never the address itself.
 */

import {
  computeAttachmentEntryClasses,
  computeAttachmentGlyphClasses,
  computeAttachmentLinkClasses,
  computeAttachmentListClasses,
} from '../../design/cell-affordances-default-classes'
import { toAttachmentArray, toAttachmentEntry, type AttachmentEntry } from './attachment-entries'

/**
 * The page glyph that precedes a file's name.
 *
 * `aria-hidden` and empty: it carries no information a screen reader needs —
 * the link's accessible name is already the file name — and duplicating "file"
 * into the announcement would make every attachment read twice.
 */
const ATTACHMENT_GLYPH = (
  <span
    aria-hidden="true"
    className={computeAttachmentGlyphClasses()}
  />
)

export function AttachmentLink({ entry }: { entry: AttachmentEntry }): React.ReactNode {
  if (entry.href === undefined) {
    return (
      <span className={computeAttachmentEntryClasses()}>
        {ATTACHMENT_GLYPH}
        <span className={computeAttachmentLinkClasses()}>{entry.name}</span>
      </span>
    )
  }
  return (
    <span className={computeAttachmentEntryClasses()}>
      {ATTACHMENT_GLYPH}
      <a
        href={entry.href}
        target="_blank"
        rel="noopener noreferrer"
        className={computeAttachmentLinkClasses()}
      >
        {entry.name}
      </a>
    </span>
  )
}

/**
 * Every file of an attachment value — one, or a list — as named links in
 * stored order, or `undefined` when the value holds none. The drawer's
 * read-only entry draws this; the grid keeps its own empty-cell glyph.
 */
export function AttachmentLinks({ value }: { readonly value: unknown }): React.ReactNode {
  const entries = (toAttachmentArray(value) ?? [value])
    .map(toAttachmentEntry)
    .filter((entry): entry is AttachmentEntry => entry !== undefined)
  if (entries.length === 0) return undefined
  return (
    <span className={computeAttachmentListClasses()}>
      {entries.map((entry, index) => (
        <AttachmentLink
          key={`attachment-${String(index)}`}
          entry={entry}
        />
      ))}
    </span>
  )
}
