/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useImportWords } from './import-words'
import type { ImportWizardStep } from './types'

/** Which of the three steps each wizard state belongs to: the preview is part of File. */
const STEP_INDEX: Readonly<Record<ImportWizardStep, number>> = {
  upload: 0,
  preview: 0,
  mapping: 1,
  'duplicate-handling': 2,
}

/**
 * The wizard's three steps — File, Columns, Check — in order, the one the
 * reader is on marked `aria-current="step"`.
 */
export function WizardSteps({ step }: { readonly step: ImportWizardStep }) {
  const t = useImportWords()
  const current = STEP_INDEX[step]
  const names = [
    t('csvImport.stepFile', 'File'),
    t('csvImport.stepColumns', 'Columns'),
    t('csvImport.stepCheck', 'Check'),
  ]
  return (
    <ol
      aria-label={t('csvImport.steps', 'Import steps')}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
    >
      {names.map((name, index) => (
        <li
          key={name}
          aria-current={index === current ? 'step' : undefined}
          className={`flex items-center gap-2 ${index === current ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
        >
          <span
            aria-hidden="true"
            className={`flex size-5 items-center justify-center rounded-full border text-xs ${index <= current ? 'bg-primary text-primary-foreground border-transparent' : ''}`}
          >
            {index + 1}
          </span>
          {name}
        </li>
      ))}
    </ol>
  )
}
