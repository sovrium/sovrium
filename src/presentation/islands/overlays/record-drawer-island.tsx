/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `record-drawer` island — record-detail/edit drawer specialization
 *.
 *
 * Opens on a data-table row click (the existing `sovrium:open-drawer`
 * dispatch) OR a `?record=<id>` deep-link self-open, FETCHES the record
 * (`GET /api/tables/:t/records/:id`), renders a schema-derived body (one
 * labelled control per field), and saves editable fields via
 * `PATCH /api/tables/:t/records/:id`. A successful save dispatches
 * `sovrium:crud-success` so the grid refreshes, then closes the drawer.
 *
 * Three additive capabilities generalise the drawer:
 *
 *  - CAP-1 `actions`: a footer slot of button-shaped actions that fire against
 *    the LOADED record (`$record.*` resolved at click time via the shared
 *    `executeFetchAction`); a `confirm`-bearing action gates via the shared
 *    `InlineConfirmDialog`. See `record-drawer-content.tsx`.
 *  - CAP-2 `role`: `dialog` (default) | `region`. A region surface presents as
 *    a named landmark `region` rather than a modal dialog — same record-fetch +
 *    render machinery, non-modal, portaled to <body>. Its accessible NAME comes
 *    from `props.title`.
 *  - CAP-3 `recordFields[].renderAs`: per-field structured rendering — see
 *    `record-drawer-content.tsx`.
 *  - CAP-5 `children`: the author's composed content, injected between the
 *    record's form and the footer row, with its `$record.*` tokens resolved once
 *    the record lands — see `record-drawer-children.tsx`.
 *
 * The drawer binds to EITHER the DB-table records API (`dataSource.table`) OR a
 * system DETAIL endpoint (`dataSource.system` → `useRecordQuery` /
 * `fetchSystemDetailEndpoint`, the same single-record fetch the record-field /
 * page-record islands use). Both feed the SAME `DrawerContent`, so the trio above
 * composes for system bindings exactly as for table bindings; a system source is
 * READ-ONLY (`canEdit: false` — no save, no PATCH) and its `$record.*` footer
 * actions resolve against the system-fetched record at click time.
 *
 * LOAD GATE — why the body is inert until the record arrives.
 *
 * The drawer opens FIRST and fetches after, so there is a real window in which
 * the form is on screen holding nothing. While that window is open the drawer
 * must not accept input, because every way of resolving the collision afterwards
 * is wrong. Overwrite the operator's keystrokes when the response lands and
 * their edit vanishes silently — and the save that follows PATCHes the value
 * straight back unchanged, reporting success. Keep the keystrokes instead and
 * the save fires against a half-loaded record: either a spurious "this field is
 * required" for a field that merely has not arrived, or — if the partial form
 * happens to look complete — a PATCH that writes the gaps over real data.
 *
 * So the controls and the save affordance render but are DISABLED until the
 * record is in hand: nothing to reconcile, because nothing can be typed yet.
 * (Per-field dirty-tracking was tried first and is a trap — React suppresses the
 * change event for a write that does not alter the value, so clearing a field
 * still blank pre-load registers no edit and silently reverts on arrival.)
 */

import { optionalBodyProps, recordTitle } from './record-drawer-body-props'
import { DrawerContent, type DrawerContentProps } from './record-drawer-content'
import { withDrawerNavigation, type DrawerNavigationProps } from './record-drawer-navigation-slot'
import { useRelatedSlot, type RelatedSlotProps } from './record-drawer-related-slot'
import { useRecordSave } from './record-drawer-save'
import { DialogSurface, RegionSurface } from './record-drawer-surfaces'
import { useRecordDrawer, useDrawerRecord, useDrawerHandlers } from './use-record-drawer'
import type { DrawerAction } from './record-drawer-actions'
import type { RecordDrawerField } from './record-drawer-field'
import type { SystemDetailSource } from '@/domain/models/app/pages/components/system-detail-source'
import type { ReactElement } from 'react'

interface RecordDrawerIslandProps extends RelatedSlotProps, DrawerNavigationProps {
  readonly id?: string
  /** Accessible NAME of the surface (CAP-2). Defaults to the legacy label. */
  readonly title?: string
  /** Accessible ROLE of the surface (CAP-2): `dialog` (default) | `region`. */
  readonly role?: 'dialog' | 'region'
  readonly table?: string
  /**
   * System DETAIL-endpoint binding (CAP-2 admin), instead of `table`, for a
   * run/submission detail. READ-ONLY: the body renders it with no save.
   */
  readonly system?: SystemDetailSource
  /**
   * The controls to render, one per field. OPTIONAL: the SSR host DERIVES the
   * list from the bound table's field schema when the author declares none.
   */
  readonly recordFields?: ReadonlyArray<RecordDrawerField>
  /** Footer action slot (CAP-1) — fires against the loaded record at click time. */
  readonly actions?: ReadonlyArray<DrawerAction>
  /**
   * CAP-5 composed-content slot — the author's `children`, SSR'd to markup by
   * the host. Absent unless the author declared any, which is what keeps a
   * childless drawer rendering exactly what it rendered before the slot existed.
   */
  readonly childrenHtml?: string
  /**
   * `false` when only another drawer's related rows open this one: the page's
   * `?record=` deep link names a record of the page's own table, not of this
   * drawer's, so it must not self-open on it. Absent means `true`.
   */
  readonly deepLink?: boolean
  readonly canEdit?: boolean
  /**
   * Interpreter-provided control labels, resolved against the app's language by
   * the SSR host. The island cannot resolve them itself — author
   * `languages.translations` overrides live in the config, not the DOM — so the
   * fallbacks here are the platform-default (English) catalog entries, used only
   * if a host ever mounts the island without them.
   */
  readonly saveLabel?: string
  readonly closeLabel?: string
  /** A refused save's message (`form.operationFailed`). */
  readonly saveFailedLabel?: string
  /** What a drawer says of a record it cannot show (`recordDrawer.notFound`). */
  readonly notFoundLabel?: string
  /** The author's `props.className`, added to the surface the reader sees. */
  readonly className?: string
}

const EMPTY_FIELDS: ReadonlyArray<RecordDrawerField> = []
const EMPTY_ACTIONS: ReadonlyArray<DrawerAction> = []
/** Platform-default (English) fallbacks — the SSR host normally supplies these. */
const DEFAULT_TITLE = 'Record details'
const DEFAULT_SAVE_LABEL = 'Save'
const DEFAULT_CLOSE_LABEL = 'Close'
const DEFAULT_NOT_FOUND_LABEL = 'This record could not be found.'

/**
 * Build the shared record body (CAP-1 actions + CAP-3 structured fields + the
 * read-only display) — both surfaces and both bindings render THIS one body.
 * Lifted out of the island component so that function stays inside the
 * per-function line budget islands are held to.
 */
function renderDrawerBody(props: DrawerContentProps): ReactElement {
  return <DrawerContent {...props} />
}

/**
 * The surface's three interpreter-provided strings. The SSR host resolves them
 * against the app language (author `languages.translations` overrides included),
 * so these fallbacks only cover a host that mounts the island without them.
 */
function resolveDrawerLabels(props: RecordDrawerIslandProps): {
  readonly title: string
  readonly save: string
  readonly close: string
} {
  return {
    title: props.title ?? DEFAULT_TITLE,
    save: props.saveLabel ?? DEFAULT_SAVE_LABEL,
    close: props.closeLabel ?? DEFAULT_CLOSE_LABEL,
  }
}

/**
 * A record the records API answers `404` — missing, or one its reader may not
 * read — shows the same state either way: nothing to edit, nothing to save.
 */
function notFoundBody(label: string | undefined): ReactElement {
  return <p className="text-muted-foreground text-md">{label ?? DEFAULT_NOT_FOUND_LABEL}</p>
}

/** Record-drawer island — the schema-derived record-detail/edit drawer. */
export default function RecordDrawerIsland(props: RecordDrawerIslandProps): ReactElement | null {
  const {
    id,
    role = 'dialog',
    table,
    system,
    recordFields = EMPTY_FIELDS,
    actions = EMPTY_ACTIONS,
    canEdit = true,
  } = props
  const labels = resolveDrawerLabels(props)
  const drawer = useRecordDrawer(id, table, system, props.deepLink !== false)
  const { open, setOpen, recordId, values, setValues, loading } = drawer
  const record = useDrawerRecord(system, recordId, drawer.record)
  const { error, setError, onChange, onClose } = useDrawerHandlers(setValues, setOpen)
  const saved = { recordFields, values, table, recordId, setOpen, setError }
  const onSave = useRecordSave({ ...saved, failedLabel: props.saveFailedLabel })
  const slot = useRelatedSlot(props, { open, recordId, save: labels.save }, onClose)
  const related = withDrawerNavigation(props, { record, recordId }, slot)
  const body = drawer.notFound
    ? notFoundBody(props.notFoundLabel)
    : renderDrawerBody({
        fields: recordFields,
        values,
        record,
        canEdit,
        loading,
        actions,
        onChange,
        onSave,
        onClose,
        saveLabel: labels.save,
        ...optionalBodyProps(error, table, props.childrenHtml, related),
      })

  const surface = {
    title: recordTitle(labels.title, record),
    body,
    closeLabel: labels.close,
    open,
    className: props.className,
  }
  return role === 'region' ? (
    <RegionSurface
      {...surface}
      onClose={onClose}
    />
  ) : (
    <DialogSurface
      {...surface}
      onOpenChange={setOpen}
    />
  )
}
