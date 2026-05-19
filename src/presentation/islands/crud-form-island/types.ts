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

export type CrudOperation = 'create' | 'update' | 'delete' | 'automation'

export interface WizardStep {
  readonly label: string
  readonly fields: readonly string[]
}

export interface CrudFormIslandProps {
  readonly operation: CrudOperation
  readonly table: string
  readonly fields: readonly FieldDef[]
  readonly record?: Record<string, unknown>
  readonly recordId?: string
  readonly redirectUrl?: string
  readonly successToast?: SuccessToast
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
}

export type FormState = FormBodyState & {
  readonly deleted?: boolean
}

export interface SubmitContext {
  readonly operation: CrudOperation
  readonly fields: readonly FieldDef[]
  readonly recordId?: string
  readonly redirectUrl?: string
  readonly successToast?: SuccessToast
  readonly values: Record<string, string>
  readonly setState: (s: FormState) => void
  readonly createRecord: ReturnType<typeof useCreateRecord>
  readonly updateRecord: ReturnType<typeof useUpdateRecord>
  readonly deleteRecord: ReturnType<typeof useDeleteRecord>
  readonly automationName?: string
  readonly inputData?: Record<string, unknown>
}
