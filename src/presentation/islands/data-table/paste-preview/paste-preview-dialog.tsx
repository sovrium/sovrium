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
  readonly parsed: ParsedTsv
  readonly mappings: readonly string[]
  readonly tableFields: readonly string[]
  readonly fieldMeta?: FieldMetaMap
  readonly isPasting: boolean
  readonly onMappingChange: (columnIndex: number, value: string) => void
  readonly onPaste: () => void
  readonly onCancel: () => void
}

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
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paste-preview-dialog-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg bg-white p-6 shadow-xl">
          <h2
            id="paste-preview-dialog-title"
            className="mb-4 text-lg font-semibold text-gray-900"
          >
            Paste Preview
          </h2>
          <div className="overflow-auto rounded border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
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
