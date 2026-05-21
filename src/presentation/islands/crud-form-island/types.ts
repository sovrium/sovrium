/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type FieldDef } from '../components/crud-form/fields'
import { type FieldGroup, type FormBodyState } from '../components/crud-form/layout'
import { type SuccessToast } from '../components/crud-form/toast'
import {
  type useCreateRecord,
  type useUpdateRecord,
  type useDeleteRecord,
} from '../hooks/use-table-mutations'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'

export type CrudOperation = 'create' | 'update' | 'delete' | 'automation'

export interface WizardStep {
  readonly label: string
  readonly fields: readonly string[]
}

export interface SuccessPageActionConfig {
  readonly label: string
  readonly action: 'reset' | 'navigate'
  readonly url?: string
}

export interface SuccessPageConfig {
  readonly title?: string
  readonly message?: string
  readonly actions?: readonly SuccessPageActionConfig[]
  readonly showSummary?: boolean
  readonly redirect?: string
}

export interface CrudFormIslandProps {
  readonly operation: CrudOperation
  readonly table: string
  readonly fields: readonly FieldDef[]
  readonly record?: Record<string, unknown>
  readonly recordId?: string
  readonly redirectUrl?: string
  readonly successToast?: SuccessToast
  readonly resetOnSuccess?: boolean
  readonly preserveFields?: readonly string[]
  readonly successPage?: SuccessPageConfig
  readonly confirm?: boolean
  readonly confirmMessage?: string
  readonly buttonLabel?: string
  readonly variant?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  readonly initialValues?: Record<string, string>
  readonly layout?: string
  readonly fieldGroups?: readonly FieldGroup[]
  readonly wizard?: readonly WizardStep[]
  readonly automationName?: string
  readonly inputData?: Record<string, unknown>
  readonly autoSave?: AutoSaveConfig
}

export type FormState = FormBodyState & {
  readonly deleted?: boolean
  readonly successPageShown?: {
    readonly values: Record<string, string>
  }
}

export interface SubmitContext {
  readonly operation: CrudOperation
  readonly fields: readonly FieldDef[]
  readonly recordId?: string
  readonly redirectUrl?: string
  readonly successToast?: SuccessToast
  readonly resetOnSuccess?: boolean
  readonly preserveFields?: readonly string[]
  readonly successPage?: SuccessPageConfig
  readonly values: Record<string, string>
  readonly setState: (s: FormState) => void
  readonly resetValues: () => void
  readonly afterReset?: () => void
  readonly createRecord: ReturnType<typeof useCreateRecord>
  readonly updateRecord: ReturnType<typeof useUpdateRecord>
  readonly deleteRecord: ReturnType<typeof useDeleteRecord>
  readonly automationName?: string
  readonly inputData?: Record<string, unknown>
}
