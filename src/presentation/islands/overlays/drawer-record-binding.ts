/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Bind the record a row click dispatched (`sovrium:open-drawer`) to the update
 * form inside a quick-edit drawer.
 *
 * The drawer's body is rendered before anyone knows which row will open it, so
 * its `crud-form` marker arrives with no record: empty inputs, an empty
 * `recordId` in its island props, and an action URL naming no record. This runs
 * from the drawer's `onInjected` step — after the markup is in place and BEFORE
 * the marker mounts — so everything the island reads at mount time already
 * names the clicked record:
 *
 *  - the input VALUES, which `island-client` captures into `initialValues` just
 *    before `createRoot` discards the skeleton;
 *  - the island PROPS (`record`, `recordId`), which the island parses once, on
 *    mount. Nothing is written into a mounted island afterwards.
 *
 * `submitInPlace` makes the form save through its update mutation (a `fetch`
 * PATCH) instead of the native POST a page-level edit form uses: a native POST
 * would navigate away from the page the drawer sits on.
 *
 * The skeleton form's own action URL is deliberately NOT patched to the record
 * any more. It was, while the drawer re-injected its body as inert markup and a
 * native POST was the only way a save left the page; now the island takes the
 * form over, and until it does `guardIslandForms` holds back a native submit,
 * so that URL is never followed.
 */

import { skeletonValueText } from '@/presentation/design/field-type-behavior'

type RawRecord = Record<string, unknown>

/** Control types whose `.value` a record field can populate. */
const FIELD_CONTROLS = 'input[name], textarea[name], select[name]'

/** An update-form marker in the drawer, with its parsed island props. */
interface UpdateForm {
  readonly host: HTMLElement
  readonly props: RawRecord
}

/**
 * Write each record field into the control of the same name. A field's value
 * is written the way the hydrated form would write it (`skeletonValueText`),
 * so a `json` object reaches its control as JSON rather than `[object Object]`.
 */
function populateControls(
  scope: HTMLElement,
  record: RawRecord,
  fieldTypes: ReadonlyMap<string, string>
): void {
  scope
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(FIELD_CONTROLS)
    .forEach((control) => {
      const key = control.getAttribute('name')
      if (!key || !(key in record) || control.type === 'file') return
      // eslint-disable-next-line functional/immutable-data, no-param-reassign -- writing the dispatched record into the not-yet-mounted skeleton IS the contract
      control.value = skeletonValueText(fieldTypes.get(key), record[key])
    })
}

function parseProps(raw: string | null): RawRecord | undefined {
  try {
    const parsed: unknown = JSON.parse(raw ?? '')
    return parsed !== null && typeof parsed === 'object' ? (parsed as RawRecord) : undefined
  } catch {
    return undefined
  }
}

/**
 * The update-form markers under `container`. A marker whose props do not parse
 * is left out — `island-client` skips it the same way.
 */
function findUpdateForms(container: HTMLElement): readonly UpdateForm[] {
  return [...container.querySelectorAll<HTMLElement>('[data-island="crud-form"]')].flatMap(
    (host) => {
      const props = parseProps(host.getAttribute('data-island-props'))
      return props?.['operation'] === 'update' ? [{ host, props }] : []
    }
  )
}

/** Field name → field type, read off the forms' own island props. */
function fieldTypesOf(forms: readonly UpdateForm[]): ReadonlyMap<string, string> {
  return new Map(
    forms.flatMap(({ props }) =>
      (Array.isArray(props['fields']) ? (props['fields'] as readonly unknown[]) : []).flatMap(
        (field) => {
          const { name, type } = (field ?? {}) as { name?: unknown; type?: unknown }
          return typeof name === 'string' && typeof type === 'string' ? [[name, type] as const] : []
        }
      )
    )
  )
}

/** Merge the record into a form's island props, so the island mounts editing it. */
function bindFormIsland(form: UpdateForm, record: RawRecord, recordId: string): void {
  form.host.setAttribute(
    'data-island-props',
    JSON.stringify({ ...form.props, record, recordId, submitInPlace: true })
  )
}

/**
 * Bind `record` to the update forms under `container`. Runs before their
 * islands mount; see the module header for what each step feeds.
 *
 * When the dispatcher named the record's `table`, only the update forms of
 * that table are bound, and only the controls inside them are written: a
 * drawer may also hold a form editing another table, whose ids are a
 * different numbering, so the clicked row's id would name an unrelated record
 * there. A dispatch naming no table keeps the original behaviour — every
 * named control in the drawer, every update form.
 */
export function bindRecordToDrawerForms(
  container: HTMLElement,
  record: RawRecord,
  table?: string
): void {
  const forms = findUpdateForms(container).filter(
    (form) => table === undefined || form.props['table'] === table
  )
  const fieldTypes = fieldTypesOf(forms)
  const scopes = table === undefined ? [container] : forms.map((form) => form.host)
  scopes.forEach((scope) => populateControls(scope, record, fieldTypes))
  const rawId = record['id']
  if (rawId === undefined || rawId === null) return
  forms.forEach((form) => bindFormIsland(form, record, String(rawId)))
}
