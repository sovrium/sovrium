/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/*
 * The Action union and the narrowed row-click union, assembled from the
 * per-variant siblings. This module is the one every consumer names, so it
 * re-exports the variant schemas and types those consumers import through it;
 * the rest are imported from their sibling directly.
 *
 * - `action-response.ts`   — the shared post-action vocabulary (toast, onSuccess/onError)
 * - `action-operations.ts` — auth, crud, automation (engine operations)
 * - `action-client.ts`     — navigate, toast, openSheet, openImport, fill, seek (resolved in the page)
 * - `action-fetch.ts`      — fetch and its response envelope family
 */

import { Schema } from 'effect'
import {
  FillActionSchema,
  NavigateActionSchema,
  OpenDrawerActionSchema,
  OpenImportActionSchema,
  SeekActionSchema,
  ToastActionSchema,
} from './action-client'
import { FetchActionSchema } from './action-fetch'
import { AuthActionSchema, AutomationActionSchema, CrudActionSchema } from './action-operations'

export { ActionResponseSchema } from './action-response'
export { CrudActionSchema } from './action-operations'
export {
  FillActionSchema,
  NavigateActionSchema,
  OpenDrawerActionSchema,
  ToastActionSchema,
} from './action-client'
export {
  FetchResponseEnvelopeSchema,
  FetchSuccessResponseSchema,
  FetchToastResponseSchema,
  fetchSuccessExitConflict,
  fetchSuccessResponseFields,
} from './action-fetch'
export type {
  FetchAction,
  FetchResponseEnvelope,
  FetchSuccessResponse,
  FetchToastResponse,
} from './action-fetch'

/**
 * Every action variant except `fill` and `seek`, in the order
 * {@link ActionSchema} lists them. Both act on another component of the page —
 * `fill` writes into a form control, `seek` moves a media player — and run only
 * where the page's client runtime dispatches them (a button, a list item click,
 * a row or card click, and for `fill` a board drop hook), so a slot whose
 * handler never reads them takes this list instead.
 */
const NON_FILL_ACTION_MEMBERS = [
  AuthActionSchema,
  CrudActionSchema,
  AutomationActionSchema,
  NavigateActionSchema,
  ToastActionSchema,
  FetchActionSchema,
  OpenDrawerActionSchema,
  OpenImportActionSchema,
] as const

/**
 * An action slot that refuses `fill` and `seek`: the full action vocabulary
 * minus the two variants its handler never runs. Without it, `fill` validated
 * there and then did nothing. The refusal names the slot and what it accepts, so the author
 * sees where `fill` belongs instead of a bare union mismatch.
 *
 * @param slot - The option path as an author writes it, e.g. `actions[].action`
 */
export const actionWithoutFill = (
  slot: string,
  identifier: string,
  title: string,
  description: string
) =>
  Schema.Union(NON_FILL_ACTION_MEMBERS).annotate({
    identifier,
    title,
    description,
    message: `${slot} accepts an auth, crud, automation, navigate, toast, fetch, openSheet or openImport action. A fill action runs only from a button, a list item click (onRowClick) or a board drop hook (drag.onDrop); a seek action only from a button, or a list item, table row or card click.`,
  })

/**
 * Action Schema
 *
 * Discriminated union of action types that can be triggered by components.
 * The `type` field determines the action variant:
 *
 * - **auth**: Authentication operations (login, signup, logout, etc.)
 * - **crud**: Data operations (create, update, delete)
 * - **automation**: Invoke a named automation workflow
 * - **navigate**: Pure URL navigation
 * - **toast**: Show a transient toast notification
 * - **fetch**: Client-side fetch with toast response
 * - **fill**: Write a value into a form control on the same page
 * - **seek**: Move a video or audio player on the same page to a moment
 * - **openSheet**: Open a drawer component — discriminated on `action`, NOT on
 *   `type`, which is why it is easy to miss when counting this union.
 * - **openImport**: Open the CSV import dialog for one table — also on `action`.
 *   The union has TEN members; a list of seven here has already been read as
 *   authoritative by downstream comments that then undercounted it.
 *
 * @example
 * ```yaml
 * # Login form
 * action:
 *   type: auth
 *   method: login
 *   strategy: email
 *   onSuccess:
 *     navigate: /dashboard
 *     toast:
 *       message: Welcome back!
 *       variant: success
 *
 * # Create record
 * action:
 *   type: crud
 *   operation: create
 *   table: posts
 *   onSuccess:
 *     toast:
 *       message: Post created successfully
 *       variant: success
 *
 * # Trigger automation
 * action:
 *   type: automation
 *   name: generate-report
 *   inputData:
 *     month: '$currentMonth'
 *   await: true
 *   onSuccess:
 *     toast:
 *       message: Report ready!
 *       variant: success
 *
 * # Generic fetch with toast
 * action:
 *   type: fetch
 *   url: /api/tables/contacts/records
 *   method: POST
 *   body: { name: 'Alice' }
 *   onSuccess:
 *     type: toast
 *     variant: success
 *     message: Saved!
 * ```
 */
export const ActionSchema = Schema.Union([
  ...NON_FILL_ACTION_MEMBERS,
  FillActionSchema,
  SeekActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'Action',
    title: 'Action',
    description:
      'Component action. Discriminated by type: auth (authentication), crud (data operations), automation (invoke workflow), navigate (pure URL navigation), toast (transient notification), fetch (client-side HTTP with toast response), fill (write a value into a form control on the same page), seek (move a video or audio player on the same page to a moment). Open-drawer is discriminated by `action: openSheet` instead of `type` (PG-04 quick-edit drawer pattern), and open-import (the CSV import dialog for one table) by `action: openImport`. A control narrows a data component through its `publishes` on a shared-filter channel, not through an action.',
  })
)

/**
 * Row Click Action
 *
 * The subset of {@link ActionSchema} a data-table row click actually honours.
 *
 * The row-click handler implements exactly three variants — `navigate`,
 * `openSheet` and `seek` (a transcript row playing its call from where it was
 * said) — and returns `undefined` for everything else
 * (`resolveRowClickAction` in
 * `src/presentation/islands/data-table/island/data-table-island.tsx`). Typing `onRowClick`
 * as the full nine-member `ActionSchema` therefore accepted seven variants that
 * validate and then do nothing: a config declaring
 * `onRowClick: { type: 'fetch', … }` passed validation, shipped, and silently
 * never fired.
 *
 * That silence was deliberate and documented, which is precisely why it is
 * expressed in the type rather than left to a comment: a narrowed union fixes
 * the TypeScript type, the decode-time guard and the published JSON Schema at
 * once, and turns a runtime no-op into an authoring-time error the author can
 * act on.
 *
 * Richer behaviour on a row click belongs on the referenced record-drawer's
 * footer `actions`, where the full `ActionSchema` (including `fetch`) is
 * honoured.
 *
 * @example
 * ```yaml
 * # Navigate to a record page (supports $record.<field> substitution)
 * onRowClick:
 *   type: navigate
 *   path: '/deals/$record.id'
 *
 * # Open a sibling drawer component (PG-04 quick-edit pattern)
 * onRowClick:
 *   action: openSheet
 *   component: record-detail
 * ```
 */
export const RowClickActionSchema = Schema.Union([
  NavigateActionSchema,
  OpenDrawerActionSchema,
  SeekActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'RowClickAction',
    title: 'Row Click Action',
    description:
      'Action triggered by a table row click. Three variants are honoured at runtime: `navigate` (pure URL navigation, discriminated by `type: navigate`, `path` supports `$record.X` substitution), `openSheet` (opens a sibling drawer component, discriminated by `action: openSheet`) and `seek` (moves a video or audio player on the page to the moment the row names, `time` supports `$record.X`). The remaining Action variants (auth, crud, automation, toast, fetch, fill, openImport) are rejected here because the row-click handler ignores them — put richer behaviour on the footer actions of the referenced drawer component instead.',
  })
)

/**
 * Card Click Action
 *
 * What a click on a card does — a board card (`kanban.card.onClick`) or a
 * gallery card (`gallery.galleryCard.onClick`): the three verbs a grid row and
 * a list item take, and no others.
 *
 * Both handlers only ever read a navigate path, so accepting the full
 * nine-member {@link ActionSchema} would let `{ action: 'openSheet',
 * component }` — the shape a grid's `onRowClick` takes — validate on a card
 * and then do nothing, and a `{ type: 'crud' }` or `{ type: 'fetch' }`
 * validate just as quietly. Narrowing the union turns that runtime silence
 * into a decode error the author can act on, in the type, the decoder and the
 * published JSON Schema at once.
 *
 * ONE schema for both cards, so a card is one vocabulary wherever it is drawn.
 * Deliberately NOT {@link RowClickActionSchema} itself, for the reason the
 * record drawer's click on a related row gives: that node carries an
 * identifier and a description written for a grid, and a card needs its own
 * words. The two variants are the same schemas, so the vocabulary is one.
 */
export const CardClickActionSchema = Schema.Union([
  NavigateActionSchema,
  OpenDrawerActionSchema,
  SeekActionSchema,
]).annotate({
  identifier: 'CardClickAction',
  title: 'Card Click Action',
  description:
    'What a click on a card does: `navigate` follows a path, with `$record.*` read from the card record and `$param.*` from the page address; `openSheet` opens that record in the named drawer on the page, as a grid row click does; `seek` moves a video or audio player on the page to the moment the card names. Any other action is refused — put richer behaviour on the drawer footer actions instead.',
})

/**
 * List Row Click Action
 *
 * What a click on a `list` item does: the three verbs a grid row takes, plus
 * `fill` — a list beside a form is how a composer offers its reusable scripts,
 * and a click on one writes its text into the message box.
 *
 * A separate node rather than a widened {@link RowClickActionSchema}: the grid's
 * row-click handler implements `navigate`, `openSheet` and `seek` only, and widening
 * the shared union would let `fill` validate on a grid and then do nothing — the
 * exact silence the narrowed unions exist to remove.
 *
 * @example
 * ```yaml
 * onRowClick:
 *   type: fill
 *   target: composer
 *   field: body
 *   value: $record.content
 * ```
 */
export const ListRowClickActionSchema = Schema.Union([
  NavigateActionSchema,
  OpenDrawerActionSchema,
  FillActionSchema,
  SeekActionSchema,
]).annotate({
  identifier: 'ListRowClickAction',
  title: 'List Row Click Action',
  description:
    'What a click on a list item does: `navigate` follows a path filled with the item values, `openSheet` opens the item in the named drawer on the page, `fill` writes a value from the item into a form control on the same page, and `seek` moves a video or audio player on the page to the moment the item names (a transcript line playing its call from there). Any other action is refused.',
})

/** @public */
export type Action = Schema.Schema.Type<typeof ActionSchema>
/** @public */
export type RowClickAction = Schema.Schema.Type<typeof RowClickActionSchema>
/** @public */
export type CardClickAction = Schema.Schema.Type<typeof CardClickActionSchema>
/** @public */
export type ListRowClickAction = Schema.Schema.Type<typeof ListRowClickActionSchema>
