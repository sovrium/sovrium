/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  type useCreateRecord,
  type useUpdateRecord,
  type useDeleteRecord,
} from '../hooks/use-table-mutations'
import { type FieldDef } from '../parts/crud-form/fields'
import { type FieldGroup, type FormBodyState } from '../parts/crud-form/layout'
import { type SuccessToast } from '../parts/crud-form/toast'
import type { AutoSaveConfig } from '@/domain/models/app/pages/components/auto-save'

export type CrudOperation = 'create' | 'update' | 'delete' | 'automation'

export interface WizardStep {
  readonly label: string
  readonly fields: readonly string[]
}

/**
 * A success-page action button. `reset` returns the form to its empty state;
 * `navigate` links the submitter to `url`.
 */
export interface SuccessPageActionConfig {
  readonly label: string
  readonly action: 'reset' | 'navigate'
  readonly url?: string
}

/**
 * `onSuccess.type: 'successPage'` configuration. When present, the form is
 * replaced by a success page after a successful create/update submission.
 */
export interface SuccessPageConfig {
  readonly title?: string
  readonly message?: string
  readonly actions?: readonly SuccessPageActionConfig[]
  readonly showSummary?: boolean
  /** URL navigated to after the success page is shown. Supports `$record.id`. */
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
  /** When true, the form clears its fields after a successful submission. */
  readonly resetOnSuccess?: boolean
  /** Field names retained when the form resets after success. */
  readonly preserveFields?: readonly string[]
  /** When set, the form is replaced by a success page after a successful submit. */
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
  /**
   * Optional auto-save configuration. When `saveMode` is `auto` or `onBlur`,
   * field edits are persisted automatically (debounced or on blur) without an
   * explicit submit. Auto-save applies only to `update` (edit) mode — `create`
   * forms always require an explicit submit.
   */
  readonly autoSave?: AutoSaveConfig
}

export type FormState = FormBodyState & {
  readonly deleted?: boolean
  /**
   * When set, the submission succeeded with `onSuccess.type: 'successPage'`.
   * Carries a snapshot of the submitted values (for `showSummary`) so the
   * success page can list them after the form fields are unmounted.
   */
  readonly successPageShown?: {
    readonly values: Record<string, string>
  }
}

export interface SubmitContext {
  readonly operation: CrudOperation
  /**
   * Bound table name. Used by PG-04's `sovrium:crud-success` dispatch so
   * sibling data-tables can invalidate their TanStack Query cache after a
   * drawer-hosted mutation lands.
   */
  readonly tableName?: string
  readonly fields: readonly FieldDef[]
  readonly recordId?: string
  readonly redirectUrl?: string
  readonly successToast?: SuccessToast
  /** When true, clear the form fields after a successful submission. */
  readonly resetOnSuccess?: boolean
  /** Field names retained when the form resets after success. */
  readonly preserveFields?: readonly string[]
  /** When set, replace the form with a success page after a successful submit. */
  readonly successPage?: SuccessPageConfig
  readonly values: Record<string, string>
  readonly setState: (s: FormState) => void
  /** Resets the form field values, retaining `preserveFields`. */
  readonly resetValues: () => void
  /**
   * Optional callback invoked after a `resetOnSuccess` reset completes.
   * Used by the wizard form to return to step 1.
   */
  readonly afterReset?: () => void
  readonly createRecord: ReturnType<typeof useCreateRecord>
  readonly updateRecord: ReturnType<typeof useUpdateRecord>
  readonly deleteRecord: ReturnType<typeof useDeleteRecord>
  readonly automationName?: string
  readonly inputData?: Record<string, unknown>
}
