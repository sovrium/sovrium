/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Family 18 of the page decode rules — what an action's `onSuccess` and
 * `onError` may ask for, decided by WHERE the action sits.
 *
 * The response slots are one schema (`ActionResponseSchema`), shared by a form
 * that has fields to reset and a page to replace and by a button that has
 * neither — and reused, verbatim, by an automation's own `onError`, which is
 * why the schema itself is not narrowed. A button, a row action or a menu item
 * can show a toast, close the overlay it sits in and move on; it has no form to
 * reset, no message to draw in place of a form and no success page to show, so
 * those keys validated and did nothing. Every component action reads one key
 * of `onError`, its toast. And `role-landing` is resolved by a sign-in alone.
 * Each is refused at decode, naming the key, the place and what to write
 * instead.
 *
 * Wherever it sits, an answered action moves the reader within the app: the
 * redirect check every page action applies drops another site's address, so an
 * `onSuccess.navigate` (or a success page's `redirect`) written as an
 * `http://` / `https://` address is refused too. The literal is what is
 * judged — the domain the app is deployed on is not known when the config is
 * read — and an address filled from a reference (`$response.url`) is left to
 * the check that runs when it is followed.
 *
 * A record sheet's footer acts on the record the sheet shows, so a footer
 * `crud` action with `operation: create` — no form to fill, no record to make —
 * is refused too, pointing to a form instead.
 *
 * Called from `collectPageBindingViolations` and from nowhere else, and shares
 * its contract: pure, no I/O, human-readable messages, empty when the page is
 * well-formed. The walk is structural — every object reachable from the page's
 * `components` and `layout` — so a button nested at any depth is reached.
 *
 * @see ./page-binding-validation.ts — the caller, and the other families
 */

/** Where an action sits, as a message names it. */
type Place = 'button' | 'row action' | 'menu item'

/** The action types whose `onSuccess` / `onError` are `ActionResponseSchema` slots. */
const RESPONSE_SLOT_TYPES: ReadonlySet<string> = new Set(['automation', 'crud', 'auth', 'navigate'])

/** The `onSuccess` keys only a form can honour: a reset, an inline message, a success page. */
const FORM_ONLY_KEYS = [
  'preserveFields',
  'title',
  'message',
  'actions',
  'showSummary',
  'redirect',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The action of `entry` when it carries response slots, else `undefined`. */
function responseAction(entry: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!isRecord(entry) || !isRecord(entry['action'])) return undefined
  const { action } = entry
  return typeof action['type'] === 'string' && RESPONSE_SLOT_TYPES.has(action['type'])
    ? action
    : undefined
}

/** Every entry of `node` that is a control of its own, with the place it sits in. */
function placedEntries(
  node: Readonly<Record<string, unknown>>
): readonly { readonly entry: unknown; readonly place: Place }[] {
  const entriesOf = (key: string, place: Place) =>
    Array.isArray(node[key]) ? (node[key] as unknown[]).map((entry) => ({ entry, place })) : []
  return [
    ...(node['type'] === 'button' ? [{ entry: node, place: 'button' as const }] : []),
    ...(node['type'] === 'actions' ? entriesOf('actions', 'row action') : []),
    ...entriesOf('menuItems', 'menu item'),
  ]
}

/** What a button, row action or menu item may not ask its `onSuccess` for. */
function controlSuccessViolations(
  onSuccess: Readonly<Record<string, unknown>>,
  place: Place,
  label: string
): readonly string[] {
  const { type } = onSuccess
  const typeViolation =
    typeof type === 'string' && type !== 'navigate' && type !== 'role-landing'
      ? [
          `${label}: a ${place}'s action declares onSuccess.type '${type}' — a ${place} has no form to reset, no message to show in place of one and no success page. Write onSuccess.navigate to move on, or onSuccess.toast to confirm where the reader is.`,
        ]
      : []
  const keyViolations = FORM_ONLY_KEYS.filter((key) => onSuccess[key] !== undefined).map(
    (key) =>
      `${label}: a ${place}'s action declares onSuccess.${key}, which only a form can honour. Write onSuccess.navigate to move on, or onSuccess.toast to confirm where the reader is.`
  )
  return [...typeViolation, ...keyViolations]
}

/** `role-landing` outside the sign-in it belongs to. */
function roleLandingViolations(
  action: Readonly<Record<string, unknown>>,
  label: string
): readonly string[] {
  const { onSuccess } = action
  if (!isRecord(onSuccess) || onSuccess['type'] !== 'role-landing') return []
  if (action['type'] === 'auth' && action['method'] === 'login') return []
  return [
    `${label}: an action of type '${String(action['type'])}' declares onSuccess.type 'role-landing', which only an auth action with method 'login' can resolve — the reader's role is known once they have signed in. Write onSuccess.navigate to move on, or put role-landing on the auth login.`,
  ]
}

/** Every `onError` key a component action declares beside its toast. */
function onErrorViolations(
  action: Readonly<Record<string, unknown>>,
  label: string
): readonly string[] {
  const { onError } = action
  if (!isRecord(onError)) return []
  return Object.keys(onError)
    .filter((key) => key !== 'toast')
    .map(
      (key) =>
        `${label}: an action's onError declares '${key}', but a failed action only shows onError.toast — it never moves the reader on or changes the form, so the reader stays where they can try again. Write onError.toast to tell them what went wrong.`
    )
}

/**
 * An address written out as another site's: `http:` or `https:` then `//`, or
 * a protocol-relative `//host` — with either slash written as a backslash,
 * which a browser reads as a slash in a web address.
 */
const OFF_SITE_LITERAL = /^\s*(?:https?:)?[\\/]{2}/i

/** The addresses an `onSuccess` moves the reader to once its action is answered. */
function successAddresses(onSuccess: Readonly<Record<string, unknown>>): readonly string[] {
  const { navigate, redirect, type } = onSuccess
  return [
    ...(typeof navigate === 'string' ? [navigate] : []),
    ...(type === 'successPage' && typeof redirect === 'string' ? [redirect] : []),
  ]
}

/** The `onSuccess` slots a node answers with, each with the control it belongs to. */
function successSlotsOf(
  node: Readonly<Record<string, unknown>>
): readonly { readonly slot: unknown; readonly control: string }[] {
  const actionSlot = (entry: unknown): unknown =>
    isRecord(entry) && isRecord(entry['action']) ? entry['action']['onSuccess'] : undefined
  const placed = placedEntries(node).map(({ entry, place }) => ({
    slot: actionSlot(entry),
    control: `a ${place}`,
  }))
  const own =
    node['type'] === 'form'
      ? [
          { slot: actionSlot(node), control: 'a form' },
          {
            slot: isRecord(node['endpoint']) ? node['endpoint']['onSuccess'] : undefined,
            control: 'an endpoint form',
          },
        ]
      : node['type'] === 'file-upload'
        ? [{ slot: node['onSuccess'], control: 'a file upload' }]
        : []
  return [...placed, ...own]
}

/**
 * Every `onSuccess` of the page that would send the reader to another site —
 * on a button, a row action, a menu item, an endpoint form, a file upload or a
 * form alike, since each answers through the same redirect check. A slot the
 * walk meets on another kind of control is reported under "an action".
 */
function offSiteNavigateViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  const named = nodes.flatMap(successSlotsOf)
  const seen = new Set(named.map(({ slot }) => slot))
  const unnamed = nodes
    .map((node) => ({ slot: node['onSuccess'], control: 'an action' }))
    .filter(({ slot }) => !seen.has(slot))
  return [...named, ...unnamed].flatMap(({ slot, control }) =>
    isRecord(slot)
      ? successAddresses(slot)
          .filter((address) => OFF_SITE_LITERAL.test(address))
          .map(
            (address) =>
              `${label}: ${control}'s onSuccess moves the reader to ${JSON.stringify(address)}, on another site — once an action is answered it only moves the reader within this app, so the address would be ignored. Write a path on this site (/thanks, thanks, ?sent=1), or use a link to send the reader to another site.`
          )
      : []
  )
}

/** The footer actions of a record sheet: a `sheet` bound to a `dataSource`. */
function sheetFooterActions(node: Readonly<Record<string, unknown>>): readonly unknown[] {
  const isRecordSheet = node['type'] === 'sheet' && node['dataSource'] !== undefined
  return isRecordSheet && Array.isArray(node['actions']) ? node['actions'] : []
}

/** Every record sheet footer action that would create a record. */
function sheetFooterCreateViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  return nodes.flatMap((node) =>
    sheetFooterActions(node).flatMap((entry) => {
      if (!isRecord(entry) || !isRecord(entry['action'])) return []
      const { action } = entry
      if (action['type'] !== 'crud' || action['operation'] !== 'create') return []
      const named = typeof entry['label'] === 'string' ? ` '${entry['label']}'` : ''
      return [
        `${label}: the footer action${named} of sheet '${String(node['id'] ?? '')}' declares a crud action with operation: create, but a sheet footer acts on the record the sheet shows and has no form to fill. Use operation: update or delete here, or put a form with a crud create action in a dialog.`,
      ]
    })
  )
}

/**
 * The placement refusals of one page. `nodes` is every object the page's
 * component tree holds (the caller's structural walk); `label` names the page.
 */
export function actionPlacementViolations(
  nodes: readonly Record<string, unknown>[],
  label: string
): readonly string[] {
  const placed = nodes.flatMap((node) =>
    placedEntries(node).flatMap(({ entry, place }) => {
      const onSuccess = responseAction(entry)?.['onSuccess']
      return isRecord(onSuccess) ? controlSuccessViolations(onSuccess, place, label) : []
    })
  )
  const everywhere = nodes.flatMap((node) => {
    const action = responseAction(node)
    return action === undefined
      ? []
      : [...roleLandingViolations(action, label), ...onErrorViolations(action, label)]
  })
  return [
    ...placed,
    ...everywhere,
    ...offSiteNavigateViolations(nodes, label),
    ...sheetFooterCreateViolations(nodes, label),
  ]
}
