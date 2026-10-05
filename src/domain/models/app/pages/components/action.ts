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
 * - `action-client.ts`     — filter, navigate, toast, openDrawer (resolved in the page)
 * - `action-fetch.ts`      — fetch and its response envelope family
 */

import { Schema } from 'effect'
import {
  FilterActionSchema,
  NavigateActionSchema,
  OpenDrawerActionSchema,
  ToastActionSchema,
} from './action-client'
import { FetchActionSchema } from './action-fetch'
import { AuthActionSchema, AutomationActionSchema, CrudActionSchema } from './action-operations'

export { ActionResponseSchema } from './action-response'
export { CrudActionSchema } from './action-operations'
export { NavigateActionSchema, OpenDrawerActionSchema, ToastActionSchema } from './action-client'
export {
  FetchResponseEnvelopeSchema,
  FetchSuccessResponseSchema,
  FetchToastResponseSchema,
} from './action-fetch'
export type {
  FetchAction,
  FetchResponseEnvelope,
  FetchSuccessResponse,
  FetchToastResponse,
} from './action-fetch'

/**
 * Action Schema
 *
 * Discriminated union of action types that can be triggered by components.
 * The `type` field determines the action variant:
 *
 * - **auth**: Authentication operations (login, signup, logout, etc.)
 * - **crud**: Data operations (create, update, delete)
 * - **automation**: Invoke a named automation workflow
 * - **filter**: Cross-component data source filtering
 * - **navigate**: Pure URL navigation
 * - **toast**: Show a transient toast notification
 * - **fetch**: Client-side fetch with toast response
 * - **openDrawer**: Open a drawer component — discriminated on `action`, NOT on
 *   `type`, which is why it is easy to miss when counting this union. The union
 *   has EIGHT members; a list of seven here has already been read as
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
 * # Category filter dropdown
 * action:
 *   type: filter
 *   targetDataSource: product-list
 *   field: category
 *   operator: eq
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
  AuthActionSchema,
  CrudActionSchema,
  AutomationActionSchema,
  FilterActionSchema,
  NavigateActionSchema,
  ToastActionSchema,
  FetchActionSchema,
  OpenDrawerActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'Action',
    title: 'Action',
    description:
      'Component action. Discriminated by type: auth (authentication), crud (data operations), automation (invoke workflow), filter (cross-component filtering), navigate (pure URL navigation), toast (transient notification), fetch (client-side HTTP with toast response). Open-drawer is discriminated by `action: openDrawer` instead of `type` (PG-04 quick-edit drawer pattern).',
  })
)

/**
 * Row Click Action
 *
 * The subset of {@link ActionSchema} a data-table row click actually honours.
 *
 * The row-click handler implements exactly two variants — `navigate` and
 * `openDrawer` — and returns `undefined` for everything else
 * (`resolveRowClickAction` in
 * `src/presentation/islands/data-table/island/index.tsx`). Typing `onRowClick`
 * as the full eight-member `ActionSchema` therefore accepted six variants that
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
 *   action: openDrawer
 *   component: record-detail
 * ```
 */
export const RowClickActionSchema = Schema.Union([
  NavigateActionSchema,
  OpenDrawerActionSchema,
]).pipe(
  Schema.annotate({
    identifier: 'RowClickAction',
    title: 'Row Click Action',
    description:
      'Action triggered by a table row click. Only two variants are honoured at runtime: `navigate` (pure URL navigation, discriminated by `type: navigate`, `path` supports `$record.X` substitution) and `openDrawer` (opens a sibling drawer component, discriminated by `action: openDrawer`). The remaining Action variants (auth, crud, automation, filter, toast, fetch) are rejected here because the row-click handler ignores them — put richer behaviour on the footer actions of the referenced drawer component instead.',
  })
)

/**
 * Card Click Action
 *
 * What a click on a card does — a board card (`kanban.card.onClick`) or a
 * gallery card (`gallery.galleryCard.onClick`): the two verbs a grid row and
 * a list item take, and no others.
 *
 * Both cards used to accept the full eight-member {@link ActionSchema}, and
 * both handlers only ever read a navigate path. `{ action: 'openDrawer',
 * component }` — the shape a grid's `onRowClick` takes — validated on a card
 * and then did nothing, and a `{ type: 'crud' }` or `{ type: 'fetch' }`
 * validated just as quietly. Narrowing the union turns that runtime silence
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
]).annotate({
  identifier: 'CardClickAction',
  title: 'Card Click Action',
  description:
    'What a click on a card does: `navigate` follows a path, with `$record.*` read from the card record and `$param.*` from the page address; `openDrawer` opens that record in the named drawer on the page, as a grid row click does. Any other action is refused — put richer behaviour on the drawer footer actions instead.',
})

/** @public */
export type Action = Schema.Schema.Type<typeof ActionSchema>
/** @public */
export type RowClickAction = Schema.Schema.Type<typeof RowClickActionSchema>
/** @public */
export type CardClickAction = Schema.Schema.Type<typeof CardClickActionSchema>
