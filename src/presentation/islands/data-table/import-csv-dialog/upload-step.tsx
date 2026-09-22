/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  computeTableDialogBodyClasses,
  computeTableDropZoneClasses,
  computeTableToastClasses,
} from '@/presentation/design/table-default-classes'

interface UploadStepProps {
  readonly noDataError: boolean
  readonly onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function UploadStep({ noDataError, onFileChange }: UploadStepProps) {
  if (noDataError) {
    return <div className={computeTableToastClasses({ tone: 'error' })}>No data rows found</div>
  }
  return (
    <div className={computeTableDropZoneClasses()}>
      <p className={computeTableDialogBodyClasses()}>Drag and drop a CSV file here</p>
      <label className="cursor-pointer">
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={onFileChange}
        />
        <span className={computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })}>
          Browse file
        </span>
      </label>
    </div>
  )
}
