/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The state grammar of `--state <page>:<key>=<value>`: one more board of a
 * page, drawn at that state. A page or a state the config does not have is
 * refused by name, with what it does have, before anything is drawn.
 *
 * | Key           | Values                                         |
 * | ------------- | ---------------------------------------------- |
 * | a query name  | one of its `enum` values, or any text          |
 * | `theme`       | `light`, `dark`                                |
 * | `width`       | a width in px, 240 to 3840                     |
 * | `role`        | a role of the app, or `*` for each one         |
 * | `data`        | `empty`, `loading`                             |
 * | `page`        | `404`, `403`, `500`                            |
 * | `form.<name>` | `refused`                                      |
 * | `session`     | `expired`                                      |
 */

import { BUILT_IN_ROLES } from '@/domain/models/app/auth/roles/role'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

/** One state a board is asked for. */
export interface PageStateRequest {
  readonly page: string
  readonly key: string
  readonly value: string
}

/** A requested state, or the sentence refusing it. */
export type PageStateCheck =
  | { readonly ok: true; readonly state: PageStateRequest }
  | { readonly ok: false; readonly message: string }

/** The narrowest and widest board a `width` state may ask for. */
const WIDTH_RANGE = [240, 3840] as const

/** The fixed values of each state key that is not a query. */
const FIXED_VALUES: Readonly<Record<string, readonly string[]>> = {
  theme: ['light', 'dark'],
  data: ['empty', 'loading'],
  page: ['404', '403', '500'],
  session: ['expired'],
}

/** Every role of the app: the built-in ones, then the ones it declares. */
export const appRolesOf = (app: App): readonly string[] => [
  ...new Set([
    ...BUILT_IN_ROLES,
    ...(
      (app.auth as { readonly roles?: readonly { readonly name: string }[] } | undefined)?.roles ??
      []
    ).map((role) => role.name),
  ]),
]

/** The query parameters a page declares, each with its values when it lists them. */
const queriesOf = (
  page: Page
): Readonly<Record<string, { readonly enum?: readonly unknown[] } | undefined>> =>
  ((page as { readonly query?: unknown }).query ?? {}) as Readonly<
    Record<string, { readonly enum?: readonly unknown[] } | undefined>
  >

const refused = (message: string): PageStateCheck => ({ ok: false, message })

/** The sentence naming the values a state key takes. */
const takes = (raw: string, key: string, values: readonly string[]): PageStateCheck =>
  refused(`--state ${raw}: ${key} takes ${values.join(', ')}, not this value.`)

/** Check a query's value against the values it lists. */
const checkQuery = (
  page: Page,
  state: PageStateRequest,
  query: { readonly enum?: readonly unknown[] }
): PageStateCheck | undefined => {
  const values = (query.enum ?? []).map(String)
  return values.length === 0 || values.includes(state.value)
    ? undefined
    : takes(`${page.name}:${state.key}=${state.value}`, state.key, values)
}

const checkWidth = (raw: string, value: string): PageStateCheck | undefined => {
  const width = Number(value)
  return Number.isInteger(width) && width >= WIDTH_RANGE[0] && width <= WIDTH_RANGE[1]
    ? undefined
    : refused(
        `--state ${raw}: width takes a width in px from ${String(WIDTH_RANGE[0])} to ${String(WIDTH_RANGE[1])}.`
      )
}

const checkRole = (app: App, raw: string, value: string): PageStateCheck | undefined => {
  const roles = appRolesOf(app)
  return value === '*' || roles.includes(value) ? undefined : takes(raw, 'role', ['*', ...roles])
}

const checkForm = (app: App, raw: string, state: PageStateRequest): PageStateCheck | undefined => {
  const name = state.key.slice('form.'.length)
  const forms = (app.forms ?? []).map((form) => form.name)
  if (!forms.includes(name)) {
    return refused(`--state ${raw}: ${name} is no form of this config (${forms.join(', ')}).`)
  }
  return state.value === 'refused' ? undefined : takes(raw, state.key, ['refused'])
}

/** Check one value against its key on a page. */
const checkValue = (
  app: App,
  page: Page,
  raw: string,
  state: PageStateRequest
): PageStateCheck | undefined => {
  const { key, value } = state
  const query = queriesOf(page)[key]
  if (query !== undefined) return checkQuery(page, state, query)
  if (key === 'width') return checkWidth(raw, value)
  if (key === 'role') return checkRole(app, raw, value)
  if (key.startsWith('form.')) return checkForm(app, raw, state)
  const fixed = FIXED_VALUES[key] ?? []
  return fixed.includes(value) ? undefined : takes(raw, key, fixed)
}

/** The state keys a page may be drawn at, its own queries first. */
const keysOf = (page: Page): readonly string[] => [
  ...Object.keys(queriesOf(page)),
  'theme',
  'width',
  'role',
  'data',
  'page',
  'form.<name>',
  'session',
]

/** Whether a page may be drawn at a state key. */
const isStateKey = (page: Page, key: string): boolean =>
  key.startsWith('form.') || keysOf(page).includes(key)

/**
 * Read one `--state` value against the config.
 *
 * @param app - the validated config.
 * @param raw - the value as typed, `<page>:<key>=<value>`.
 */
export const checkPageState = (app: App, raw: string): PageStateCheck => {
  const match = /^([^:]+):([^=]+)=(.+)$/.exec(raw)
  if (match === null) {
    return refused(
      `--state ${raw} is not a state: write <page>:<key>=<value>, as fleet:theme=dark.`
    )
  }
  const [, pageName = '', key = '', value = ''] = match
  const page = (app.pages ?? []).find((candidate) => candidate.name === pageName)
  if (page === undefined) {
    const names = (app.pages ?? []).map((candidate) => candidate.name)
    return refused(`--state ${raw}: ${pageName} is no page of this config (${names.join(', ')}).`)
  }
  const state = { page: pageName, key, value }
  if (!isStateKey(page, key)) {
    return refused(
      `--state ${raw}: the page ${pageName} has no state ${key}. Its states: ${keysOf(page).join(', ')}.`
    )
  }
  return checkValue(app, page, raw, state) ?? { ok: true, state }
}
