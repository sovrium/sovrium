/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeMismatchMatrix } from './cell-mismatch'
import { PasteDialogFooter } from './paste-dialog-footer'
import { PreviewMappingHeader } from './preview-mapping-header'
import { PreviewRows } from './preview-rows'
import type { ParsedTsv } from './parse-tsv'
import type { FieldMetaMap } from '../../hooks/use-inline-editing'

interface PastePreviewDialogProps {
  /** Parsed clipboard data: header labels + data rows. */
  readonly parsed: ParsedTsv
  /** Per-column target field (or skip sentinel); index-aligned with headers. */
  readonly mappings: readonly string[]
  /** Available table field names offered as mapping targets. */
  readonly tableFields: readonly string[]
  /** Field metadata (types) used to flag type-mismatched cells. */
  readonly fieldMeta?: FieldMetaMap
  /** Whether the batch create is in flight. */
  readonly isPasting: boolean
  /** Updates the target field for one column. */
  readonly onMappingChange: (columnIndex: number, value: string) => void
  /** Confirms the import. */
  readonly onPaste: () => void
  /** Dismisses the dialog without importing. */
  readonly onCancel: () => void
}

/**
 * The paste-preview dialog.
 *
 * Shows the first preview rows of the pasted clipboard data with a native
 * `<select>` per column for mapping the pasted column onto a table field (or
 * skipping it). Confirming triggers a batch record create.
 */
export function PastePreviewDialog({
  parsed,
  mappings,
  tableFields,
  fieldMeta,
  isPasting,
  onMappingChange,
  onPaste,
  onCancel,
}: PastePreviewDialogProps) {
  const mismatchMatrix = computeMismatchMatrix(parsed, mappings, fieldMeta)
  return (
    <>
      <div
        className="bg-scrim/50 fixed inset-0 z-40"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paste-preview-dialog-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="bg-background-overlay flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg p-6 shadow-xl">
          <h2
            id="paste-preview-dialog-title"
            className="text-foreground mb-4 text-lg font-semibold"
          >
            Paste Preview
          </h2>
          <div className="border-border overflow-auto rounded border">
            <table className="divide-border min-w-full divide-y text-sm">
              <PreviewMappingHeader
                headers={parsed.headers}
                mappings={mappings}
                tableFields={tableFields}
                onMappingChange={onMappingChange}
              />
              <PreviewRows
                parsed={parsed}
                mismatchMatrix={mismatchMatrix}
              />
            </table>
          </div>
          <PasteDialogFooter
            isPasting={isPasting}
            onPaste={onPaste}
            onCancel={onCancel}
          />
        </div>
      </div>
    </>
  )
}
