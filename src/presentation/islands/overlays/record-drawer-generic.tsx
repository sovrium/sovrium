/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The body of a GENERIC record sheet — one bound to a table that declares
 * neither `recordFields` nor `related`: the record's controls in one
 * list in field order, under tabs (Details, then Activity, Comments and Access
 * where its reader is offered them), "Linked from" under the fields, the
 * header's Copy link and More actions, and a sticky footer with the last
 * change, Cancel and Save.
 *
 * Opened with no record it is a new record's form: no tabs to read, no menu,
 * a line saying what the `*` marks mean, and Save creates.
 *
 * A record picked under "Linked from" opens stacked in the same sheet
 * ({@link StackedRecordBody}): that record's own fields, a Back control naming
 * the record it was reached from, and its own Save.
 */

import { AccessPanel } from './record-drawer-access-tab'
import { ActivityPanel } from './record-drawer-activity'
import { CommentsPanel } from './record-drawer-comments-tab'
import { DrawerContent, type DrawerContentProps } from './record-drawer-content'
import { SheetFooter } from './record-drawer-footer'
import { LinkedFrom, type LinkedFromSection, type LinkedPick } from './record-drawer-linked-from'
import { RecordMenu } from './record-drawer-record-menu'
import { SheetTabs, type SheetTab } from './record-drawer-tabs'
import type { ReactElement } from 'react'

/** What the server resolved for a generic sheet (`resolve-record-drawer-generic.ts`). */
export interface GenericSheet {
  readonly tabs: {
    readonly activity: boolean
    readonly comments?: Readonly<Record<string, unknown>>
    readonly access: boolean
  }
  readonly canDelete: boolean
  readonly newLabel: string
  readonly stamps?: { readonly at: string; readonly by?: string }
  readonly linkedFrom: readonly LinkedFromSection[]
  readonly limit: number
  readonly words: Readonly<Record<string, string>>
}

/** What the generic body draws from. */
export interface GenericBodyProps {
  readonly generic: GenericSheet
  readonly table: string
  readonly recordId: string | undefined
  readonly creating: boolean
  readonly title: string
  /** The record's fields and controls, Save left to the footer. */
  readonly content: DrawerContentProps
  readonly save: {
    readonly label: string
    readonly saving: string
    readonly run: () => Promise<void> | void
  }
  readonly cancelLabel: string | undefined
  readonly onClose: () => void
  readonly onPick: (pick: LinkedPick) => void
}

/** The label a history entry names a field by, or `''` for one the sheet does not show. */
const labelLookup =
  (fields: DrawerContentProps['fields']) =>
  (name: string): string => {
    const field = fields.find((candidate) => candidate.name === name)
    return field === undefined || field.readOnly === true ? '' : (field.label ?? field.name)
  }

/** The Comments tab, when the table declares comments and its reader is signed in. */
function commentsTab(props: GenericBodyProps, recordId: string): readonly SheetTab[] {
  const thread = props.generic.tabs.comments
  if (thread === undefined) return []
  const label = props.generic.words['comments'] ?? 'Comments'
  const panel = () => (
    <CommentsPanel
      table={props.table}
      recordId={recordId}
      thread={thread}
      label={label}
    />
  )
  return [{ slug: 'comments', label, panel }]
}

/** The Activity and Access tabs, each when its reader is offered it. */
function readTabs(props: GenericBodyProps, recordId: string): readonly SheetTab[] {
  const { generic, table, content } = props
  const { words } = generic
  const activity = () => (
    <ActivityPanel
      table={table}
      recordId={recordId}
      words={words}
      labelOf={labelLookup(content.fields)}
    />
  )
  const access = () => (
    <AccessPanel
      table={table}
      recordId={recordId}
      words={words}
    />
  )
  return [
    ...(generic.tabs.activity
      ? [{ slug: 'activity', label: words['activity'] ?? 'Activity', panel: activity }]
      : []),
    ...commentsTab(props, recordId),
    ...(generic.tabs.access
      ? [{ slug: 'access', label: words['access'] ?? 'Access', panel: access }]
      : []),
  ]
}

/** The tabs a record opened in the sheet offers its reader: Details first. */
function tabsOf(props: GenericBodyProps, recordId: string): readonly SheetTab[] {
  const { generic, content } = props
  const details = () => (
    <>
      <DrawerContent {...content} />
      <LinkedFrom
        sections={generic.linkedFrom}
        recordId={recordId}
        limit={generic.limit}
        heading={generic.words['linkedFrom'] ?? 'Linked from'}
        onPick={props.onPick}
      />
    </>
  )
  return [
    { slug: 'details', label: generic.words['details'] ?? 'Details', panel: details },
    ...readTabs(props, recordId),
  ]
}

const NO_RECORD: Readonly<Record<string, unknown>> = {}

/** A generic sheet's body — see the module note. */
export function GenericSheetBody(props: GenericBodyProps): ReactElement {
  const { generic, recordId, creating, content } = props
  const { words } = generic
  const opened = !creating && recordId !== undefined
  return (
    <>
      {opened && (
        <RecordMenu
          table={props.table}
          recordId={recordId}
          title={props.title}
          record={content.record}
          fields={content.fields}
          canDelete={generic.canDelete}
          words={words}
          cancelLabel={props.cancelLabel}
          onDeleted={props.onClose}
        />
      )}
      {creating && <p className="text-muted-foreground text-sm">{words['requiredNote']}</p>}
      {opened ? (
        <SheetTabs
          key={recordId}
          tabs={tabsOf(props, recordId)}
        />
      ) : (
        <DrawerContent {...content} />
      )}
      <SheetFooter
        record={creating ? NO_RECORD : content.record}
        stamps={generic.stamps}
        signedIn={generic.tabs.activity}
        words={words}
        canEdit={content.canEdit}
        loading={content.loading === true}
        save={props.save}
        onCancel={props.onClose}
      />
    </>
  )
}
