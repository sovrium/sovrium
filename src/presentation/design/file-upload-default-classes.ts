/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui empty and item (https://ui.shadcn.com), registry commit 3464245c4513b7998b1d11fa9c67b71cc1534dc7.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `file-upload` drop zone and its picked files, drawn on shadcn/ui's
 * anatomy (base-nova). The server-rendered placeholder and the hydrated island
 * both read this module, so the zone does not move or change its words on
 * mount.
 *
 * - The drop zone is an `empty` with a dashed edge: an `empty-icon` holding
 *   the upload glyph, an `empty-title`, an `empty-description` naming the
 *   accepted types and the limits, and an `empty-content` holding an outline
 *   "Browse files" button. While a file is dragged over it, it is edged in
 *   the ring colour on the half-strength muted surface.
 * - Each picked file is an outlined small `item`: the file glyph its media,
 *   the name its title.
 *
 * The header, title, description and content strings are the merged `empty`
 * recipe's (`display-default-classes.ts`), spelled here because the island
 * cannot pay for that module's other surfaces; the item strings are
 * base-nova's `outline` variant, which the merged item recipe does not carry.
 */

import { computePartButtonClasses } from './button-variant-classes'

/** Which of the drop zone's states to paint; `hover` is a file held over it. */
type FileUploadDropzoneState = 'default' | 'hover' | 'invalid' | 'disabled'

const EDGE: Readonly<Record<FileUploadDropzoneState, string>> = {
  default: 'border-border',
  hover: 'border-ring bg-muted/50',
  invalid: 'border-destructive',
  disabled: 'border-border cursor-not-allowed opacity-50',
}

/** base-nova's `Empty`, with the dashed edge drawn. */
export const computeFileUploadDropzoneClasses = ({
  state = 'default',
}: { readonly state?: FileUploadDropzoneState } = {}): string =>
  `flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-6 text-center text-balance transition-colors ${EDGE[state]}`

/** base-nova's `EmptyHeader`. */
export const computeFileUploadHeaderClasses = (): string =>
  'flex max-w-sm flex-col items-center gap-2'

/** base-nova's `EmptyMedia`, `icon` variant. */
export const computeFileUploadDropzoneIconClasses = (): string =>
  "mb-2 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

/** base-nova's `EmptyTitle`. */
export const computeFileUploadDropzoneTextClasses = (): string =>
  'text-sm font-medium tracking-tight'

/** base-nova's `EmptyDescription`: the accepted types and the limits. */
export const computeFileUploadDropzoneHintClasses = (): string =>
  'text-sm/relaxed text-muted-foreground'

/** base-nova's `EmptyContent`, holding the Browse files button. */
export const computeFileUploadContentClasses = (): string =>
  'flex w-full max-w-sm min-w-0 flex-col items-center gap-2.5 text-sm text-balance'

/** The list of picked files: base-nova's `ItemGroup` at its small size. */
export const computeFileUploadListClasses = (): string => 'flex w-full flex-col gap-2.5'

/** One picked file: base-nova's `Item`, `outline` variant, `sm` size. */
export const computeFileUploadFileRowClasses = (): string =>
  'group/item flex w-full flex-wrap items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm'

/** base-nova's `ItemMedia`, `icon` variant: the file glyph. */
export const computeFileUploadFileMarkClasses = (): string =>
  "flex shrink-0 items-center justify-center gap-2 text-muted-foreground [&_svg:not([class*='size-'])]:size-4"

/** base-nova's `ItemContent`. */
export const computeFileUploadFileContentClasses = (): string =>
  'flex min-w-0 flex-1 flex-col gap-1'

/** base-nova's `ItemTitle`: the file's name. */
export const computeFileUploadFileNameClasses = (): string =>
  'line-clamp-1 flex w-fit items-center gap-2 text-sm leading-snug font-medium break-all'

/**
 * Without a drop zone, the label that opens the picker: base-nova's outline
 * button. A `<label>` takes no `disabled`, so the disabled look is spelled.
 */
export const computeFileUploadTriggerClasses = ({
  disabled = false,
}: { readonly disabled?: boolean } = {}): string =>
  `${computePartButtonClasses({ variant: 'outline' })} cursor-pointer${disabled ? ' pointer-events-none opacity-50' : ''}`

/**
 * The id of a compact upload's hint, from the id of the upload it sits beside:
 * the server draws the hint, and the island's file input names it in
 * `aria-describedby`, so both derive it the same way.
 */
export const fileUploadCompactHintId = (uploadId: string): string => `${uploadId}-hint`

/**
 * The line beside a compact trigger: muted and on one line, kept for assistive
 * technology on a phone, where the toolbar has no room to paint it.
 */
export const computeFileUploadCompactHintClasses = (): string =>
  'text-xs whitespace-nowrap text-muted-foreground max-sm:sr-only'

/** The validation message under the control. */
export const computeFileUploadErrorClasses = (): string => 'text-sm text-destructive'

// ──────────────────────────────────────────────────────────────────────────────
// DRAWN COPY — shared so the placeholder and the island say the same thing
// ──────────────────────────────────────────────────────────────────────────────

/** The drop zone's title. */
export const FILE_UPLOAD_DROPZONE_PROMPT = 'Drop files here'

/** The button that opens the file picker. */
export const FILE_UPLOAD_BROWSE_LABEL = 'Browse files'

/** A byte count in the largest whole unit a reader expects: `10 MB`, `512 KB`. */
const formatSize = (bytes: number): string => {
  const [unit, size] = bytes >= 1_048_576 ? ['MB', 1_048_576] : ['KB', 1024]
  return `${Number((bytes / size).toFixed(1))} ${unit}`
}

/** "up to N files" in the page language (`fileUpload.maxOneFile` / `fileUpload.maxFiles`). */
const fileCountWords = (maxFiles: number, strings?: Readonly<Record<string, string>>): string =>
  (maxFiles === 1
    ? (strings?.['fileUpload.maxOneFile'] ?? 'up to 1 file')
    : (strings?.['fileUpload.maxFiles'] ?? 'up to {count} files')
  ).replace('{count}', String(maxFiles))

/** "N MB each" in the page language (`fileUpload.sizeEach`). */
const fileSizeWords = (maxFileSize: number, strings?: Readonly<Record<string, string>>): string =>
  (strings?.['fileUpload.sizeEach'] ?? '{size} each').replace('{size}', formatSize(maxFileSize))

/** What a drop zone's description states: the accepted types, in words when known, and the limits. */
export interface FileUploadHintInput {
  readonly accept?: string
  readonly acceptLabel?: string
  readonly maxFiles?: number
  readonly maxFileSize?: number
}

/**
 * The description under the title, or `undefined` when there is nothing true
 * to say. The types read as `acceptLabel` — `accept` in words (`PNG, PDF`),
 * resolved by the server where the page language is known — and fall back to
 * `accept` as the author wrote it.
 */
export const fileUploadDropzoneHint = (
  { accept, acceptLabel, maxFiles, maxFileSize }: FileUploadHintInput,
  strings?: Readonly<Record<string, string>>
): string | undefined => {
  const types = acceptLabel ?? accept
  const parts = [
    types === undefined || types.trim() === '' ? undefined : types,
    maxFiles === undefined ? undefined : fileCountWords(maxFiles, strings),
    maxFileSize === undefined ? undefined : fileSizeWords(maxFileSize, strings),
  ].filter((part): part is string => part !== undefined)
  return parts.length === 0 ? undefined : parts.join(' · ')
}
