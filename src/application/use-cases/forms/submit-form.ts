/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect } from 'effect'
import { FormSubmissionRepository } from '@/application/ports/repositories/form-submission-repository'
import { buildGuestSession } from '@/application/use-cases/automations/build-guest-session'
import { triggerFormSubmissionAutomations } from '@/application/use-cases/automations/trigger-form-submission'
import { createRecordProgram } from '@/application/use-cases/tables/programs'
import {
  buildConditionValueMap,
  fieldSubmitIdentifier,
  isAbsentValue,
  isFieldRequired,
  isFieldVisible,
} from '@/domain/models/shared/form-field-helpers'
import { collectFieldsInSkippedSteps } from '@/domain/models/shared/multi-step-flow'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

export class FormNotFoundError extends Data.TaggedError('FormNotFoundError')<{
  readonly formName: string
}> {}

export class FormFieldRequiredError extends Data.TaggedError('FormFieldRequiredError')<{
  readonly fieldName: string
  readonly message: string
}> {}

export interface SubmitFormResult {
  readonly submissionId: string | null
  readonly linkedRecordId: string | null
}

export const findFormByName = (app: Readonly<App>, name: string): Form | undefined =>
  app.forms?.find((form) => form.name === name)

const checkFormRequiredFields = (
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>
): Effect.Effect<void, FormFieldRequiredError, never> => {
  const values = buildConditionValueMap(form, body)
  const offending = form.fields.find((field) => {
    const identifier = fieldSubmitIdentifier(field)
    if (identifier === undefined) return false
    if (!isFieldVisible(field, values)) return false
    if (!isFieldRequired(field, values)) return false
    if (!(identifier in body)) return true
    return isAbsentValue(body[identifier])
  })
  if (offending === undefined) return Effect.void
  const fieldName = fieldSubmitIdentifier(offending) ?? 'field'
  return Effect.fail(
    new FormFieldRequiredError({
      fieldName,
      message: `${fieldName} is required`,
    })
  )
}

const stripHiddenFields = (
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>
): Record<string, unknown> => {
  const values = buildConditionValueMap(form, body)
  const hiddenIdentifiers = new Set<string>(
    form.fields
      .filter((field) => !isFieldVisible(field, values))
      .map((field) => fieldSubmitIdentifier(field))
      .filter((id): id is string => id !== undefined)
  )
  if (hiddenIdentifiers.size === 0) return { ...body }
  return Object.fromEntries(Object.entries(body).filter(([key]) => !hiddenIdentifiers.has(key)))
}

const stripSkippedStepFields = (
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>
): Record<string, unknown> => {
  if (form.steps === undefined || form.steps.length === 0) return { ...body }
  const values = buildConditionValueMap(form, body)
  const skipped = collectFieldsInSkippedSteps(form, values)
  if (skipped.size === 0) return { ...body }
  return Object.fromEntries(Object.entries(body).filter(([key]) => !skipped.has(key)))
}

const applyMapping = (
  data: Readonly<Record<string, unknown>>,
  mapping: Readonly<Record<string, string>> | undefined
): Record<string, unknown> => {
  if (!mapping) return { ...data }
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [mapping[key] ?? key, value])
  )
}

const resolveDefaultValue = (
  value: string | number | boolean,
  query: Readonly<Record<string, string>>
): string | number | boolean | undefined => {
  if (typeof value !== 'string') return value
  if (value === '$now') return new Date().toISOString()
  const queryMatch = /^\$query\.([a-zA-Z_][a-zA-Z0-9_]*)$/.exec(value)
  if (queryMatch) {
    const key = queryMatch[1]
    if (key === undefined) return undefined
    return query[key]
  }
  if (value.startsWith('$')) return undefined
  return value
}

const applyFieldDefaults = (
  data: Readonly<Record<string, unknown>>,
  form: Readonly<Form>,
  query: Readonly<Record<string, string>>
): Record<string, unknown> => {
  const visibilityValues = buildConditionValueMap(form, data)
  return form.fields.reduce<Record<string, unknown>>(
    (acc, field) => {
      const identifier = fieldSubmitIdentifier(field)
      if (identifier === undefined) return acc
      if (!('defaultValue' in field) || field.defaultValue === undefined) return acc
      if (!isFieldVisible(field, visibilityValues)) return acc
      const isHidden = (field as { readonly hidden?: boolean }).hidden === true
      const submitterSupplied = Object.hasOwn(acc, identifier) && acc[identifier] !== ''
      if (!isHidden && submitterSupplied) return acc
      const resolved = resolveDefaultValue(field.defaultValue, query)
      if (resolved === undefined) return acc
      return { ...acc, [identifier]: resolved }
    },
    { ...data }
  )
}

const filterDeclaredFields = (
  data: Readonly<Record<string, unknown>>,
  form: Readonly<Form>
): Record<string, unknown> => {
  const declared = new Set<string>(
    form.fields
      .map((field) => {
        if (field.kind === 'table-field') return field.column
        if (field.kind === 'standalone' || field.kind === 'signature') return field.name
        return undefined
      })
      .filter((name): name is string => name !== undefined)
  )
  if (declared.size === 0) return { ...data }
  return Object.fromEntries(Object.entries(data).filter(([key]) => declared.has(key)))
}

const filterTableBoundFields = (
  data: Readonly<Record<string, unknown>>,
  form: Readonly<Form>
): Record<string, unknown> => {
  const tableColumns = new Set<string>(
    form.fields
      .filter((field) => field.kind === 'table-field')
      .map((field) => (field as { readonly column: string }).column)
  )
  const mappingTargets = Object.values(form.submitTo.mapping ?? {})
  const writable = new Set<string>([...tableColumns, ...mappingTargets])
  return Object.fromEntries(Object.entries(data).filter(([key]) => writable.has(key)))
}

interface SubmitFormConfig {
  readonly app: Readonly<App>
  readonly formName: string
  readonly body: Readonly<Record<string, unknown>>
  readonly ipAddress?: string
  readonly userAgent?: string
  readonly query?: Readonly<Record<string, string>>
  readonly processEnv?: Readonly<Record<string, string | undefined>>
}

const coerceLinkedRecordId = (
  linkedRecord: { readonly id: unknown } | undefined
): string | undefined => {
  if (!linkedRecord) return undefined
  const { id } = linkedRecord
  if (typeof id === 'number') return String(id)
  if (typeof id === 'string') return id
  return undefined
}

const writeLedgerRow = (input: {
  readonly form: Readonly<Form>
  readonly mapped: Readonly<Record<string, unknown>>
  readonly linkedRecordId: string | undefined
  readonly ipAddress: string | undefined
  readonly userAgent: string | undefined
}) =>
  Effect.gen(function* () {
    const { form, mapped, linkedRecordId, ipAddress, userAgent } = input
    if (form.submitTo.storeSubmission === false) return undefined
    const repo = yield* FormSubmissionRepository
    const ledger = yield* repo.createTopLevel({
      formName: form.name,
      formId: form.id,
      status: 'received',
      data: mapped,
      ...(form.submitTo.table !== undefined ? { linkedRecordTable: form.submitTo.table } : {}),
      ...(linkedRecordId !== undefined ? { linkedRecordId } : {}),
      ...(ipAddress !== undefined ? { ipAddress } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
    })
    return ledger.id
  })

const buildLinkedRecord = (
  form: Readonly<Form>,
  linkedRecordPresent: boolean,
  linkedRecordId: string | undefined
): { readonly table: string; readonly id: string } | null => {
  if (!linkedRecordPresent || form.submitTo.table === undefined) {
    return null
  }
  return { table: form.submitTo.table, id: linkedRecordId ?? '' }
}

export const submitFormProgram = (config: Readonly<SubmitFormConfig>) =>
  Effect.gen(function* () {
    const { app, formName, body, ipAddress, userAgent, processEnv, query } = config
    const form = findFormByName(app, formName)
    if (form === undefined) {
      return yield* new FormNotFoundError({ formName })
    }

    const withDefaults = applyFieldDefaults(body, form, query ?? {})

    const fieldVisibilityFiltered = stripHiddenFields(form, withDefaults)

    const visibilityFiltered = stripSkippedStepFields(form, fieldVisibilityFiltered)

    yield* checkFormRequiredFields(form, visibilityFiltered)

    const mapped = applyMapping(
      filterDeclaredFields(visibilityFiltered, form),
      form.submitTo.mapping
    )

    const linkedRecord =
      form.submitTo.table !== undefined
        ? yield* createRecordProgram({
            session: buildGuestSession(),
            tableName: form.submitTo.table,
            fields: filterTableBoundFields(mapped, form),
          })
        : undefined

    const linkedRecordId = coerceLinkedRecordId(linkedRecord)

    const submissionId = yield* writeLedgerRow({
      form,
      mapped,
      linkedRecordId,
      ipAddress,
      userAgent,
    })

    yield* triggerFormSubmissionAutomations({
      app,
      formName: form.name,
      submissionData: mapped,
      submissionId: submissionId ?? null,
      formId: form.id,
      linkedRecord: buildLinkedRecord(form, linkedRecord !== undefined, linkedRecordId),
      processEnv: processEnv ?? {},
    })

    return {
      submissionId: submissionId ?? null,
      linkedRecordId: linkedRecordId ?? null,
    } satisfies SubmitFormResult
  })
