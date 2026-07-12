/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Data, Effect } from 'effect'
import { FormSubmissionRepository } from '@/application/ports/repositories/forms/form-submission-repository'
import {
  buildGuestSession,
  buildSyntheticSession,
} from '@/application/use-cases/automations/build-guest-session'
import { triggerFormSubmissionAutomations } from '@/application/use-cases/automations/trigger-form-submission'
import { triggerRecordEventAutomations } from '@/application/use-cases/automations/trigger-record-event'
import { coerceScalarsForArrayColumns } from '@/application/use-cases/forms/coerce-array-columns'
import { emitFormSubmissionAnalyticsEvent } from '@/application/use-cases/forms/emit-form-analytics-event'
import {
  FormFieldFormatError,
  validateFieldFormats,
} from '@/application/use-cases/forms/submit-form-format-validation'
import { checkHoneypot } from '@/application/use-cases/forms/submit-form-honeypot'
import { checkRateLimit } from '@/application/use-cases/forms/submit-form-rate-limit'
import { createRecordProgram } from '@/application/use-cases/tables/programs'
import { collectFieldsInHiddenGroups } from '@/domain/models/shared/field-groups-flow'
import { evaluateAvailabilityWindow } from '@/domain/models/shared/form-availability-flow'
import {
  buildConditionValueMap,
  fieldSubmitIdentifier,
  isAbsentValue,
  isFieldRequired,
  isFieldVisible,
} from '@/domain/models/shared/form-field-helpers'
import { collectFieldsInSkippedSteps } from '@/domain/models/shared/multi-step-flow'
import { buildCreateAuthorshipOverrides } from '@/domain/services/authorship-fields'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

const CAP_COUNTED_STATUSES = ['received', 'processing', 'done'] as const

export { FormHoneypotTrippedError } from '@/application/use-cases/forms/submit-form-honeypot'
export { FormRateLimitedError } from '@/application/use-cases/forms/submit-form-rate-limit'

export class FormNotFoundError extends Data.TaggedError('FormNotFoundError')<{
  readonly formName: string
}> {}

export class FormFieldRequiredError extends Data.TaggedError('FormFieldRequiredError')<{
  readonly fieldName: string
  readonly message: string
}> {}

export { FormFieldFormatError }

export class FormFieldForeignKeyError extends Data.TaggedError('FormFieldForeignKeyError')<{
  readonly fieldName: string
  readonly message: string
}> {}

export class FormNotYetOpenError extends Data.TaggedError('FormNotYetOpenError')<{
  readonly opensAt: string
}> {}

export class FormClosedError extends Data.TaggedError('FormClosedError')<{
  readonly closedAt: string
}> {}

export class FormSubmissionLimitError extends Data.TaggedError('FormSubmissionLimitError')<{
  readonly maxSubmissions: number
  readonly currentCount: number
}> {}

export interface SubmitFormResult {
  readonly submissionId: string | null
  readonly linkedRecordId: string | null
}

export const findFormByName = (app: Readonly<App>, name: string): Form | undefined =>
  app.forms?.find((form) => form.name === name)

const checkFormRequiredFields = (
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>,
  hiddenGroupFields: ReadonlySet<string>
): Effect.Effect<void, FormFieldRequiredError, never> => {
  const values = buildConditionValueMap(form, body)
  const offending = form.fields.find((field) => {
    const identifier = fieldSubmitIdentifier(field)
    if (identifier === undefined) return false
    if (hiddenGroupFields.has(identifier)) return false
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

const hiddenGroupFieldSet = (
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>
): ReadonlySet<string> => {
  if (form.fieldGroups === undefined || form.fieldGroups.length === 0) return new Set<string>()
  const values = buildConditionValueMap(form, body)
  return collectFieldsInHiddenGroups(form, values)
}

const stripHiddenGroupFields = (
  body: Readonly<Record<string, unknown>>,
  hidden: ReadonlySet<string>
): Record<string, unknown> => {
  if (hidden.size === 0) return { ...body }
  return Object.fromEntries(Object.entries(body).filter(([key]) => !hidden.has(key)))
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
  readonly submitterIpHash?: string
  readonly userAgent?: string
  readonly query?: Readonly<Record<string, string>>
  readonly processEnv?: Readonly<Record<string, string | undefined>>
  readonly submitterUserId?: string
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
  readonly submitterIpHash: string | undefined
  readonly userAgent: string | undefined
  readonly submitterUserId: string | undefined
}) =>
  Effect.gen(function* () {
    const { form, mapped, linkedRecordId, submitterIpHash, userAgent, submitterUserId } = input
    if (form.submitTo.storeSubmission === false) return undefined
    const repo = yield* FormSubmissionRepository
    const ledger = yield* repo.createTopLevel({
      formName: form.name,
      formId: form.id,
      status: 'received',
      data: mapped,
      ...(form.submitTo.table !== undefined ? { linkedRecordTable: form.submitTo.table } : {}),
      ...(linkedRecordId !== undefined ? { linkedRecordId } : {}),
      ...(submitterIpHash !== undefined ? { submitterIpHash } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
      ...(submitterUserId !== undefined ? { submitterUserId } : {}),
    })
    return ledger.id
  })

const reserveLedgerSlot = (input: {
  readonly form: Readonly<Form>
  readonly mapped: Readonly<Record<string, unknown>>
  readonly maxSubmissions: number
  readonly submitterIpHash: string | undefined
  readonly userAgent: string | undefined
  readonly submitterUserId: string | undefined
}) =>
  Effect.gen(function* () {
    const { form, mapped, maxSubmissions, submitterIpHash, userAgent, submitterUserId } = input
    const repo = yield* FormSubmissionRepository
    const reserved = yield* repo.reserveTopLevelSlot({
      formName: form.name,
      formId: form.id,
      status: 'received',
      data: mapped,
      maxSubmissions,
      countStatuses: CAP_COUNTED_STATUSES,
      ...(form.submitTo.table !== undefined ? { linkedRecordTable: form.submitTo.table } : {}),
      ...(submitterIpHash !== undefined ? { submitterIpHash } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
      ...(submitterUserId !== undefined ? { submitterUserId } : {}),
    })
    if (reserved === undefined) {
      const currentCount = yield* repo.countByFormNameAndStatus({
        formName: form.name,
        statuses: CAP_COUNTED_STATUSES,
      })
      return yield* new FormSubmissionLimitError({ maxSubmissions, currentCount })
    }
    return reserved.id
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

const checkAvailabilityWindow = (
  form: Readonly<Form>
): Effect.Effect<void, FormNotYetOpenError | FormClosedError, never> => {
  const windowState = evaluateAvailabilityWindow(form.availability, Date.now())
  if (windowState.kind === 'not-yet-open') {
    return Effect.fail(new FormNotYetOpenError({ opensAt: windowState.opensAt }))
  }
  if (windowState.kind === 'closed') {
    return Effect.fail(new FormClosedError({ closedAt: windowState.closedAt }))
  }
  return Effect.void
}


const processSubmissionBody = (
  app: Readonly<App>,
  form: Readonly<Form>,
  body: Readonly<Record<string, unknown>>,
  query: Readonly<Record<string, string>>
): Effect.Effect<Record<string, unknown>, FormFieldRequiredError | FormFieldFormatError, never> =>
  Effect.gen(function* () {
    const withDefaults = applyFieldDefaults(body, form, query)
    const fieldVisibilityFiltered = stripHiddenFields(form, withDefaults)
    const stepFiltered = stripSkippedStepFields(form, fieldVisibilityFiltered)
    const hiddenGroupFields = hiddenGroupFieldSet(form, stepFiltered)
    const visibilityFiltered = stripHiddenGroupFields(stepFiltered, hiddenGroupFields)
    yield* checkFormRequiredFields(form, visibilityFiltered, hiddenGroupFields)
    yield* validateFieldFormats(app, form, visibilityFiltered)
    return applyMapping(filterDeclaredFields(visibilityFiltered, form), form.submitTo.mapping)
  })

interface PersistOutcome {
  readonly submissionId: string | undefined
  readonly linkedRecordPresent: boolean
  readonly linkedRecordId: string | undefined
}

const writeBoundTableRecord = (input: {
  readonly app: Readonly<App>
  readonly form: Readonly<Form>
  readonly mapped: Readonly<Record<string, unknown>>
  readonly submitterUserId: string | undefined
}) =>
  Effect.gen(function* () {
    const { app, form, mapped, submitterUserId } = input
    if (form.submitTo.table === undefined) return undefined
    const tableName = form.submitTo.table
    return yield* createRecordProgram({
      app,
      session:
        submitterUserId !== undefined
          ? buildSyntheticSession(submitterUserId)
          : buildGuestSession(),
      tableName,
      fields: {
        ...coerceScalarsForArrayColumns(filterTableBoundFields(mapped, form), app, tableName),
        ...(submitterUserId !== undefined
          ? buildCreateAuthorshipOverrides(app.tables, tableName, submitterUserId)
          : {}),
      },
    })
  })

const persistSubmission = (input: {
  readonly app: Readonly<App>
  readonly form: Readonly<Form>
  readonly mapped: Readonly<Record<string, unknown>>
  readonly submitterIpHash: string | undefined
  readonly userAgent: string | undefined
  readonly submitterUserId: string | undefined
}) =>
  Effect.gen(function* () {
    const { app, form, mapped, submitterIpHash, userAgent, submitterUserId } = input
    const cappedSubmissionId =
      form.availability?.maxSubmissions !== undefined
        ? yield* reserveLedgerSlot({
            form,
            mapped,
            maxSubmissions: form.availability.maxSubmissions,
            submitterIpHash,
            userAgent,
            submitterUserId,
          })
        : undefined

    const linkedRecord = yield* writeBoundTableRecord({ app, form, mapped, submitterUserId })
    const linkedRecordId = coerceLinkedRecordId(linkedRecord)

    const submissionId =
      cappedSubmissionId ??
      (yield* writeLedgerRow({
        form,
        mapped,
        linkedRecordId,
        submitterIpHash,
        userAgent,
        submitterUserId,
      }))

    return {
      submissionId,
      linkedRecordPresent: linkedRecord !== undefined,
      linkedRecordId,
    } satisfies PersistOutcome
  })

const fireBoundTableRecordCreateAutomations = (input: {
  readonly app: Readonly<App>
  readonly form: Readonly<Form>
  readonly mapped: Readonly<Record<string, unknown>>
  readonly outcome: PersistOutcome
  readonly processEnv: Readonly<Record<string, string | undefined>>
  readonly submitterUserId: string | undefined
}) => {
  const { app, form, mapped, outcome, processEnv, submitterUserId } = input
  const { linkedRecordPresent, linkedRecordId } = outcome
  if (!linkedRecordPresent || form.submitTo.table === undefined || linkedRecordId === undefined) {
    return Effect.void
  }
  return triggerRecordEventAutomations({
    app,
    tableName: form.submitTo.table,
    event: 'create',
    record: { id: linkedRecordId, ...mapped },
    processEnv,
    ...(submitterUserId !== undefined ? { userId: submitterUserId } : {}),
  })
}

export const submitFormProgram = (config: Readonly<SubmitFormConfig>) =>
  Effect.gen(function* () {
    const { app, formName, body, submitterIpHash, userAgent, processEnv, query, submitterUserId } =
      config
    const form = findFormByName(app, formName)
    if (form === undefined) {
      return yield* new FormNotFoundError({ formName })
    }

    yield* checkAvailabilityWindow(form)

    yield* checkHoneypot({ form, body, submitterIpHash, userAgent })

    yield* checkRateLimit({
      form,
      body,
      submitterIpHash: submitterIpHash ?? '',
      userAgent,
    })

    const mapped = yield* processSubmissionBody(app, form, body, query ?? {})

    const { submissionId, linkedRecordPresent, linkedRecordId } = yield* persistSubmission({
      app,
      form,
      mapped,
      submitterIpHash,
      userAgent,
      submitterUserId,
    }).pipe(
      Effect.catchTag('ForeignKeyViolationError', (fk) => {
        const fieldName = fk.fieldName ?? ''
        const message = fk.fieldName
          ? `${fk.fieldName} references a record that does not exist`
          : 'references a record that does not exist'
        return Effect.fail(new FormFieldForeignKeyError({ fieldName, message }))
      })
    )

    yield* emitFormSubmissionAnalyticsEvent({
      app,
      form,
      submissionId,
      submitterIpHash,
    })

    yield* fireBoundTableRecordCreateAutomations({
      app,
      form,
      mapped,
      outcome: { submissionId, linkedRecordPresent, linkedRecordId },
      processEnv: processEnv ?? {},
      submitterUserId,
    })

    yield* triggerFormSubmissionAutomations({
      app,
      formName: form.name,
      submissionData: mapped,
      submissionId: submissionId ?? null,
      formId: form.id,
      linkedRecord: buildLinkedRecord(form, linkedRecordPresent, linkedRecordId),
      processEnv: processEnv ?? {},
    })

    return {
      submissionId: submissionId ?? null,
      linkedRecordId: linkedRecordId ?? null,
    } satisfies SubmitFormResult
  })
