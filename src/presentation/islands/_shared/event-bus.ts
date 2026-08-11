/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Typed cross-island event bus.
 *
 * Sovrium's client-side islands are independent React.lazy() bundles that
 * never share a state-management library (no Redux, no Zustand). When one
 * island needs to notify another that a runtime event happened — a CRUD
 * mutation succeeded, a drawer should open with a specific record — the
 * messenger of last resort is a browser-native `CustomEvent` dispatched on
 * `document`.
 *
 * Until now, those events were created and listened to inline:
 *
 *   document.dispatchEvent(new CustomEvent('sovrium:crud-success', { detail: {...} }))
 *   document.addEventListener('sovrium:crud-success', (e) => ...)
 *
 * That works but loses type safety: nothing prevents two call-sites from
 * shipping payloads with different shapes under the same event name, and
 * the listener side has to cast `event.detail` by hand. After the first two
 * events landed organically in Phase 5 (`sovrium:crud-success`,
 * `sovrium:open-drawer`), this module introduces a typed wrapper before more
 * events accumulate.
 *
 *.
 */

/**
 * The closed enum of all cross-island event names. Adding a new event is a
 * one-line addition here plus a matching entry in {@link SovriumEventPayloads}.
 */
export type SovriumEventName =
  | 'sovrium:crud-success'
  | 'sovrium:open-drawer'
  | 'sovrium:refetch'
  | 'sovrium:view-saved'
  | 'sovrium:view-applied'
  | 'sovrium:view-deleted'

/**
 * Payload shape for `sovrium:crud-success`. Fired by `crud-form-island` after
 * a successful create / update / delete against a bound table.
 *
 * Consumers (data-table islands, drawer islands) filter on `table` to decide
 * whether the event is relevant to them.
 */
export interface CrudSuccessDetail {
  readonly table: string
  readonly operation: 'create' | 'update' | 'delete' | 'automation'
  readonly recordId?: string
}

/**
 * Payload shape for `sovrium:open-drawer`. Fired by `data-table` body when a
 * row click resolves to an `action: 'openDrawer'` action (PG-04 quick-edit
 * pattern). The drawer island whose `id` matches `detail.id` opens and
 * populates its form fields from `detail.record`.
 */
export interface OpenDrawerDetail {
  readonly id: string
  readonly record: Record<string, unknown>
}

/**
 * Payload shape for `sovrium:refetch`. Fired by a fetch action's
 * `onSuccess.refetch` effect (the shared `action-executor`) after a successful
 * mutate, naming a sibling data-bound component by its `props.id`. The
 * data-table island whose `searchSourceId` matches `detail.id` re-queries — so a
 * freshly-mutated DB-table OR `dataSource.system` list reflects the change
 * without a full reload.
 */
export interface RefetchDetail {
  readonly id: string
}

/**
 * Payload shape for `sovrium:view-saved`. Fired by the data-table island after
 * a personal saved view is created (`viewId`/`name`) or updated. Sibling
 * islands on the same page bound to the same table can listen and refresh
 * their views list — same as `crud-success` does for record mutations.
 */
export interface ViewSavedDetail {
  readonly table: string
  readonly viewId: string
  readonly name: string
  readonly operation: 'create' | 'update'
}

/**
 * Payload shape for `sovrium:view-applied`. Fired by the data-table island
 * when the user selects a saved or developer-configured view from the Views
 * menu. The `viewId` is `null` for the cleared/default state.
 */
export interface ViewAppliedDetail {
  readonly table: string
  readonly viewId: string | null
  readonly source: 'personal' | 'developer'
}

/**
 * Payload shape for `sovrium:view-deleted`. Fired by the data-table island
 * after a personal saved view is removed via the delete-confirmation dialog.
 */
export interface ViewDeletedDetail {
  readonly table: string
  readonly viewId: string
}

/**
 * Type-level map from event name to payload type. Keep alphabetised with
 * {@link SovriumEventName}.
 */
export interface SovriumEventPayloads {
  readonly 'sovrium:crud-success': CrudSuccessDetail
  readonly 'sovrium:open-drawer': OpenDrawerDetail
  readonly 'sovrium:refetch': RefetchDetail
  readonly 'sovrium:view-applied': ViewAppliedDetail
  readonly 'sovrium:view-deleted': ViewDeletedDetail
  readonly 'sovrium:view-saved': ViewSavedDetail
}

/**
 * Dispatch a typed cross-island event on `document`.
 *
 * The compiler enforces that `detail` matches the payload shape registered
 * for `name` in {@link SovriumEventPayloads}.
 *
 * @example
 *   dispatch('sovrium:crud-success', {
 *     table: 'projects',
 *     operation: 'update',
 *     recordId: '42',
 *   })
 */
export function dispatch<T extends SovriumEventName>(
  name: T,
  detail: SovriumEventPayloads[T]
): void {
  if (typeof document === 'undefined') return
  document.dispatchEvent(new CustomEvent(name, { detail }))
}

/**
 * Subscribe to a typed cross-island event on `document`. Returns an
 * unsubscribe function — callers MUST call it on unmount to prevent leaks.
 *
 * The handler receives the narrowed payload type for `name`, so no casts are
 * needed at the consumer site.
 *
 * @example
 *   useEffect(() => subscribe('sovrium:crud-success', (detail) => {
 *     if (detail.table !== targetTable) return
 *     handleRefresh()
 *   }), [targetTable, handleRefresh])
 */
export function subscribe<T extends SovriumEventName>(
  name: T,
  handler: (detail: SovriumEventPayloads[T]) => void
): () => void {
  if (typeof document === 'undefined') return () => undefined
  const listener = (event: Event): void => {
    const { detail } = event as CustomEvent<SovriumEventPayloads[T]>
    handler(detail)
  }
  document.addEventListener(name, listener)
  return () => document.removeEventListener(name, listener)
}
