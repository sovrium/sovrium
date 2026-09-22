/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/*
 * The Action union and the narrowed row-click union, assembled from the
 * per-variant siblings. This module is the one every consumer names, so it
 * re-exports the whole variant surface: the split is a file boundary, never
 * a change to what `action` exports.
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

export {
  ActionResponseSchema,
  ActionResponseTypeSchema,
  ToastSchema,
  ToastVariantSchema,
} from './action-response'
export type { ActionResponse, ActionResponseType, Toast, ToastVariant } from './action-response'
export { AuthActionSchema, AutomationActionSchema, CrudActionSchema } from './action-operations'
export type { AuthAction, AutomationAction, CrudAction } from './action-operations'
export {
  FilterActionSchema,
  NavigateActionSchema,
  OpenDrawerActionSchema,
  ToastActionSchema,
} from './action-client'
export type { FilterAction, NavigateAction, OpenDrawerAction, ToastAction } from './action-client'
export {
  FetchActionModeSchema,
  FetchActionSchema,
  FetchResponseEnvelopeSchema,
  FetchSuccessResponseSchema,
  FetchToastResponseSchema,
} from './action-fetch'
export type {
  FetchAction,
  FetchActionMode,
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

/** @public */
export type Action = Schema.Schema.Type<typeof ActionSchema>
/** @public */
export type RowClickAction = Schema.Schema.Type<typeof RowClickActionSchema>
