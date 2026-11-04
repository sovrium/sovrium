/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a signing flow names resolves against the rest of the app.
 *
 * Every rule here reads more than the flow: the table, its fields, the signing
 * page, the connection, and the forms and automations that name a flow. It is
 * run from the closing `AppSchema` filter (`validateAppDeclarations`), never
 * as a filter of its own, because one more link in that chain collapses the
 * derived `App` type. Loose shapes on purpose: this module imports no other
 * property's schema.
 *
 * The first refusal wins; each message names the flow and the key at fault.
 */

import { SIGNATURE_REQUEST_STATUSES } from './signature'

interface LooseField {
  readonly name: string
  readonly type: string
  readonly options?: readonly unknown[]
}

interface LooseTable {
  readonly name: string
  readonly fields: readonly LooseField[]
}

interface LooseFlow {
  readonly name: string
  readonly table: string
  readonly document: { readonly field: string }
  readonly statement: string
  readonly verify?: { readonly sms?: { readonly connection: string } }
  readonly surface: { readonly page: string; readonly fields?: readonly string[] }
  readonly signers: readonly {
    readonly name: string
    readonly email: string
    readonly phone?: string
    readonly displayName?: string
    readonly field: string
  }[]
  readonly output: {
    readonly signedFile: string
    readonly proofFile: string
    readonly status?: string
  }
}

interface LooseAction {
  readonly type?: string
  readonly operator?: string
  readonly props?: unknown
}

/** The parts of an app a signing flow is checked against. */
export interface SignatureValidationApp {
  readonly signatures?: readonly LooseFlow[]
  readonly tables?: readonly LooseTable[]
  readonly pages?: readonly { readonly name: string; readonly path: unknown }[]
  readonly connections?: readonly { readonly name: string }[]
  readonly forms?: readonly {
    readonly name: string
    readonly submitTo?: { readonly table?: string }
    readonly fields: readonly unknown[]
  }[]
  readonly automations?: readonly {
    readonly name: string
    readonly trigger?: unknown
    readonly triggers?: readonly unknown[]
    readonly actions?: readonly LooseAction[]
  }[]
}

const RECORD_REFERENCE = /\$record\.([A-Za-z_][A-Za-z0-9_]*)/g

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const optionValue = (option: unknown): unknown => (isRecord(option) ? option['value'] : option)

const firstError = (checks: readonly (() => string | undefined)[]): string | undefined =>
  checks.reduce<string | undefined>((found, check) => found ?? check(), undefined)

/** `field` of `table`, refused unless it exists and has one of `types`. */
const fieldOfType =
  (flow: LooseFlow, table: LooseTable) =>
  (key: string, name: string, types: readonly string[]): string | undefined => {
    const field = table.fields.find((candidate) => candidate.name === name)
    if (field === undefined) {
      return `signatures.${flow.name}: ${key} names "${name}", which is not a field of table "${table.name}"`
    }
    return types.includes(field.type)
      ? undefined
      : `signatures.${flow.name}: ${key} "${name}" must be a ${types.join(' or ')} field, not ${field.type}`
  }

const statusFieldError = (flow: LooseFlow, table: LooseTable): string | undefined => {
  const name = flow.output.status
  if (name === undefined) return undefined
  const typeError = fieldOfType(flow, table)('output.status', name, [
    'single-line-text',
    'single-select',
    'status',
  ])
  if (typeError !== undefined) return typeError
  const field = table.fields.find((candidate) => candidate.name === name)
  if (field?.type === 'single-line-text') return undefined
  const values = new Set((field?.options ?? []).map(optionValue))
  const missing = SIGNATURE_REQUEST_STATUSES.filter((status) => !values.has(status))
  return missing.length === 0
    ? undefined
    : `signatures.${flow.name}: output.status "${name}" lacks the option(s) ${missing.join(', ')}`
}

/** No field of the flow is claimed twice: document, outputs and signer fields are all distinct. */
const claimedTwiceError = (flow: LooseFlow): string | undefined => {
  const claimed = [
    flow.document.field,
    flow.output.signedFile,
    flow.output.proofFile,
    ...(flow.output.status === undefined ? [] : [flow.output.status]),
    ...flow.signers.map((signer) => signer.field),
  ]
  const twice = claimed.find((name, index) => claimed.indexOf(name) !== index)
  return twice === undefined
    ? undefined
    : `signatures.${flow.name}: field "${twice}" is used for two purposes in the flow`
}

const recordReferenceError = (flow: LooseFlow, table: LooseTable): string | undefined => {
  const texts = [
    flow.statement,
    ...flow.signers.flatMap((signer) => [
      signer.email,
      signer.phone ?? '',
      signer.displayName ?? '',
    ]),
  ]
  const names = texts.flatMap((text) => [...text.matchAll(RECORD_REFERENCE)].map((m) => m[1] ?? ''))
  const unknown = names.find((name) => !table.fields.some((field) => field.name === name))
  return unknown === undefined
    ? undefined
    : `signatures.${flow.name}: $record.${unknown} is not a field of table "${table.name}"`
}

const surfaceFieldError = (flow: LooseFlow, table: LooseTable): string | undefined => {
  const unknown = (flow.surface.fields ?? []).find(
    (name) => !table.fields.some((field) => field.name === name)
  )
  return unknown === undefined
    ? undefined
    : `signatures.${flow.name}: surface.fields names "${unknown}", which is not a field of table "${table.name}"`
}

const pathCarriesToken = (path: unknown): boolean => {
  const paths = typeof path === 'string' ? [path] : isRecord(path) ? Object.values(path) : []
  return (
    paths.length > 0 &&
    paths.every((value) => typeof value === 'string' && value.split('/').includes(':token'))
  )
}

const surfacePageError = (flow: LooseFlow, app: SignatureValidationApp): string | undefined => {
  const page = (app.pages ?? []).find((candidate) => candidate.name === flow.surface.page)
  if (page === undefined) {
    return `signatures.${flow.name}: surface.page "${flow.surface.page}" is not a declared page`
  }
  return pathCarriesToken(page.path)
    ? undefined
    : `signatures.${flow.name}: page "${page.name}" must have a :token segment in its path to be a signing page`
}

const connectionError = (flow: LooseFlow, app: SignatureValidationApp): string | undefined => {
  const connection = flow.verify?.sms?.connection
  if (connection === undefined) return undefined
  return (app.connections ?? []).some((candidate) => candidate.name === connection)
    ? undefined
    : `signatures.${flow.name}: verify.sms.connection "${connection}" is not a declared connection`
}

const flowError = (flow: LooseFlow, app: SignatureValidationApp): string | undefined => {
  const table = (app.tables ?? []).find((candidate) => candidate.name === flow.table)
  if (table === undefined) {
    return `signatures.${flow.name}: table "${flow.table}" is not declared`
  }
  return firstError([
    () => fieldOfType(flow, table)('document.field', flow.document.field, ['single-attachment']),
    () =>
      flow.signers
        .map((signer) =>
          fieldOfType(flow, table)(`signer ${signer.name} field`, signer.field, ['signature'])
        )
        .find((error) => error !== undefined),
    () =>
      fieldOfType(flow, table)('output.signedFile', flow.output.signedFile, ['single-attachment']),
    () =>
      fieldOfType(flow, table)('output.proofFile', flow.output.proofFile, ['single-attachment']),
    () => statusFieldError(flow, table),
    () => claimedTwiceError(flow),
    () => recordReferenceError(flow, table),
    () => surfaceFieldError(flow, table),
    () => surfacePageError(flow, app),
    () => connectionError(flow, app),
  ])
}

/** A signature field claimed by two flows would be written by both. */
const sharedFieldError = (flows: readonly LooseFlow[]): string | undefined => {
  const claims = flows.flatMap((flow) =>
    flow.signers.map((signer) => ({ key: `${flow.table}.${signer.field}`, flow: flow.name }))
  )
  const twice = claims.find(
    (claim, index) => claims.findIndex((other) => other.key === claim.key) !== index
  )
  return twice === undefined
    ? undefined
    : `signatures.${twice.flow}: field ${twice.key} is already a signer field of another flow`
}

/** Every action of a list, nested `path` branches and `loop` bodies included. */
const flattenActions = (actions: readonly LooseAction[]): readonly LooseAction[] =>
  actions.flatMap((action) => {
    const props = isRecord(action.props) ? action.props : {}
    const branches = Array.isArray(props['paths']) ? (props['paths'] as readonly unknown[]) : []
    const nested = [
      ...branches.flatMap((branch) =>
        isRecord(branch) && Array.isArray(branch['actions'])
          ? (branch['actions'] as readonly LooseAction[])
          : []
      ),
      ...(Array.isArray(props['actions']) ? (props['actions'] as readonly LooseAction[]) : []),
    ]
    return [action, ...flattenActions(nested)]
  })

const automationFlowError = (
  app: SignatureValidationApp,
  declared: ReadonlySet<string>
): string | undefined =>
  (app.automations ?? [])
    .flatMap((automation) => {
      const triggers = [
        ...(automation.trigger === undefined ? [] : [automation.trigger]),
        ...(automation.triggers ?? []),
      ]
      const fromTriggers = triggers
        .filter((trigger) => isRecord(trigger) && trigger['type'] === 'signature')
        .map((trigger) => ({
          where: 'its signature trigger',
          flow: (trigger as Record<string, unknown>)['flow'],
        }))
      const fromActions = flattenActions(automation.actions ?? [])
        .filter((action) => action.type === 'signature' && isRecord(action.props))
        .map((action) => ({
          where: `its signature/${action.operator ?? ''} step`,
          flow: (action.props as Record<string, unknown>)['flow'],
        }))
      return [...fromTriggers, ...fromActions].map((use) =>
        typeof use.flow === 'string' && !declared.has(use.flow)
          ? `automation "${automation.name}": ${use.where} names signing flow "${use.flow}", which is not declared under signatures`
          : undefined
      )
    })
    .find((error) => error !== undefined)

interface LooseFormBinding {
  readonly name: string
  readonly bind?: { readonly column?: string; readonly flow?: string; readonly signer?: string }
}

const columnBindingError = (
  app: SignatureValidationApp,
  flows: readonly LooseFlow[],
  table: string | undefined,
  column: string
): string | undefined => {
  const declared = (app.tables ?? []).find((candidate) => candidate.name === table)
  const field = declared?.fields.find((candidate) => candidate.name === column)
  if (field?.type !== 'signature') {
    return `bind.column "${column}" must be a signature field of the form's submitTo.table`
  }
  const owner = flows.find(
    (flow) => flow.table === table && flow.signers.some((signer) => signer.field === column)
  )
  return owner === undefined
    ? undefined
    : `bind.column "${column}" is signed through flow "${owner.name}"; bind the flow instead`
}

const flowBindingError = (
  flows: readonly LooseFlow[],
  bind: NonNullable<LooseFormBinding['bind']>
): string | undefined => {
  const flow = flows.find((candidate) => candidate.name === bind.flow)
  if (flow === undefined) return `bind.flow "${String(bind.flow)}" is not declared under signatures`
  return bind.signer === undefined || flow.signers.some((signer) => signer.name === bind.signer)
    ? undefined
    : `bind.signer "${bind.signer}" is not a signer of flow "${flow.name}"`
}

const formBindingError = (
  app: SignatureValidationApp,
  flows: readonly LooseFlow[]
): string | undefined =>
  (app.forms ?? [])
    .flatMap((form) =>
      form.fields
        .filter(
          (field): field is LooseFormBinding =>
            isRecord(field) && field['kind'] === 'signature' && isRecord(field['bind'])
        )
        .map((field) => {
          const bind = field.bind ?? {}
          const error =
            bind.column === undefined
              ? flowBindingError(flows, bind)
              : columnBindingError(app, flows, form.submitTo?.table, bind.column)
          return error === undefined
            ? undefined
            : `form "${form.name}" signature field "${field.name}": ${error}`
        })
    )
    .find((error) => error !== undefined)

/**
 * Every signing flow resolves, and every form, trigger and step that names a
 * flow names a declared one; the first refusal, or `true`.
 */
export const validateAllSignatureFlows = (app: SignatureValidationApp): true | string => {
  const flows = app.signatures ?? []
  const declared = new Set(flows.map((flow) => flow.name))
  const error = firstError([
    () => flows.map((flow) => flowError(flow, app)).find((found) => found !== undefined),
    () => sharedFieldError(flows),
    () => automationFlowError(app, declared),
    () => formBindingError(app, flows),
  ])
  return error ?? true
}
