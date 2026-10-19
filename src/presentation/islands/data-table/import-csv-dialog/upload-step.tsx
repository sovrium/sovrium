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
import { useImportWord } from './import-words'

interface UploadStepProps {
  readonly noDataError: boolean
  readonly onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function UploadStep({ noDataError, onFileChange }: UploadStepProps) {
  const noRows = useImportWord('csvImport.noRows', 'No data rows found')
  const prompt = useImportWord('csvImport.drop', 'Drag and drop a CSV file here')
  const browse = useImportWord('csvImport.browse', 'Browse file')
  if (noDataError) {
    return <div className={computeTableToastClasses({ tone: 'error' })}>{noRows}</div>
  }
  return (
    <div className={computeTableDropZoneClasses()}>
      <p className={computeTableDialogBodyClasses()}>{prompt}</p>
      <label className="cursor-pointer">
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={onFileChange}
        />
        <span className={computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })}>
          {browse}
        </span>
      </label>
    </div>
  )
}
