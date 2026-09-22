/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * WHICH DECLARED FIELD PROPERTIES REACH A GRID CELL, AND IN WHICH BAG.
 *
 * Two allowlists, read off `app.tables` by `type-specific-props-builder.ts` and
 * serialised into the data-table island's `data-island-props` attribute. They
 * are the whole vocabulary a cell has: a property that is not named here does
 * not exist as far as the browser is concerned, however carefully its author
 * declared it.
 *
 * Its own module rather than a section of the builder, and the reason is not
 * only length. The builder decides WHICH COMPONENT gets which props; these two
 * lists decide WHICH FIELD PROPERTY crosses a process boundary, which is a
 * different question with a different reason to change — and the builder sits
 * exactly on its 400-line `max-lines` ceiling, so while they shared a file each
 * new key had to displace something unrelated to earn its line. It already had:
 * a `code` field's `lineNumbers`, `tabSize`, `minLines` and `maxLines` were
 * left behind on the commit that gave the grid a CodeMirror cell, because there
 * was no room for four more entries.
 *
 * @see ../../islands/hooks/use-inline-editing.ts — `FieldMeta` / `FieldEditMeta`, the reading end
 * @see ./related-create-gates.ts — the one `edit` entry that is NOT a declared field property
 */

/**
 * The declared field properties a read-only grid cell needs in the browser.
 *
 * `dataTableFieldMeta` used to be built as exactly `{ type, options?, required? }`,
 * so every other declared property was dropped at this boundary: a rating knew
 * neither its `max` nor its `style`, a progress bar never saw the `color` its
 * author chose, a barcode lost its symbology, a duration lost its
 * `displayFormat` and a currency lost its code — which is why every currency
 * column rendered `$` whatever the field declared. One allowlist carries all of
 * them across.
 *
 * An allowlist rather than a spread: `dataTableFieldMeta` is serialised into
 * the island's `data-island-props` attribute on every page that draws a grid,
 * so forwarding the whole field (descriptions, permissions, validation rules)
 * would put bytes on the wire that no renderer reads.
 */
const DISPLAY_META_KEYS = [
  // rating
  'max',
  'style',
  // progress
  'color',
  // barcode (also the legacy `duration.format`)
  'format',
  // duration
  'displayFormat',
  // currency
  'currency',
  'precision',
  'symbolPosition',
  'negativeFormat',
  'thousandsSeparator',
] as const

/**
 * The declared field properties an EDITABLE grid cell needs in the browser.
 *
 * A sibling allowlist to {@link DISPLAY_META_KEYS} rather than an extension of
 * it, because none of these change how a cell READS. Folding a bucket name or a
 * Tiptap toolbar into a struct called `display` would make both halves harder
 * to reason about, so they travel in their own `edit` bag.
 *
 * Every key gates an editor that cannot function without it: a record picker
 * with no `relatedTable` has nothing to search, an attachment cell with no
 * `storeMetadata` cannot know whether its column is `VARCHAR(255)` or `JSONB`,
 * and a datetime cell with no `timeZone` shows a different instant from the
 * read-only renderer beside it.
 *
 * `timezone` (lowercase) is deliberately absent: `DateTimeFieldSchema` declares
 * it, nothing reads it, and forwarding it would make the inert twin look wired.
 */
const EDIT_META_KEYS = [
  // relationship — which table to search, and the column to search it on
  'relatedTable',
  'displayField',
  'relationType',
  // relationship + user — whether the column holds one key or a list of them
  'allowMultiple',
  // relationship — inline create, and the ceiling on how many links are allowed
  //. `canCreateRelated` is deliberately NOT here: it is a per-session
  // permission answer rather than a declared field property, so it is merged in
  // by `withRelatedCreateGates` (its own module) from what the data-source resolver
  // stamped, where the session role was known.
  'allowCreate',
  'maxLinked',
  // attachments — the upload target and the shape its column accepts
  'bucket',
  'storeMetadata',
  'allowedFileTypes',
  'maxFileSize',
  'maxFiles',
  // rich-text — the declared editor surface
  'toolbar',
  'placeholder',
  'maxLength',
  // code — the five properties `CodeEditorField` reads, so the CodeMirror
  // surface a double-click opens in a grid cell is configured exactly as the
  // one the CRUD form gives the same field. `language` is the grammar, without
  // which the editor is a monospace text box wearing a code editor's frame;
  // the other four are the shape of the box it draws, and each has a default
  // the cell would otherwise silently keep.
  //
  // `readOnly` is NOT among them, and that is not an omission: a cell opens an
  // editor only once the grid has decided the field is editable, so the answer
  // is already known by the time this bag is read.
  'language',
  'lineNumbers',
  'tabSize',
  'minLines',
  'maxLines',
  // datetime — the zone the instant is resolved into (capital Z; see above)
  'timeZone',
] as const

function pickDeclaredKeys(
  field: Readonly<Record<string, unknown>>,
  keys: readonly string[]
): Record<string, unknown> | undefined {
  const entries = keys
    .filter((key) => field[key] !== undefined)
    .map((key) => [key, field[key]] as const)
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

/** Pick the declared display properties a field carries, or `undefined` when it carries none. */
export function resolveFieldDisplayMeta(
  field: Readonly<Record<string, unknown>>
): Record<string, unknown> | undefined {
  return pickDeclaredKeys(field, DISPLAY_META_KEYS)
}

/** Pick the declared editor properties a field carries, or `undefined` when it carries none. */
export function resolveFieldEditMeta(
  field: Readonly<Record<string, unknown>>
): Record<string, unknown> | undefined {
  return pickDeclaredKeys(field, EDIT_META_KEYS)
}
