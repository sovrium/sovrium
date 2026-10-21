/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the reader of a page may see of the table each embedded form writes to.
 *
 * A form placed with `formRef` draws its table-bound fields from the TABLE: a
 * column's name, its label and its options. The page is readable with "view
 * source", so it must name no field the records API would not name the same
 * reader. That answer is the table API's own (`db.readTableAsCaller`, the map
 * `GET /api/tables/:t/permissions` serves her), read here before the
 * synchronous expansion pass — exactly as a grid or an edit form is stamped
 * (`caller-table-stamp.ts`) — and narrowed with the same predicate
 * (`readableFieldsOf`).
 *
 * A table the reader may not read, or whose list admits her no row, answers
 * no map. That is the public intake case: a visitor who may not read `leads` still fills the
 * contact form writing to it. The form then offers her the fields her own
 * field rules let her read or write (`formFields`), and names no other.
 */

import { readableFieldsOf } from '@/presentation/render/props/caller-table-inputs'
import { embeddedFormNames } from './form-ref-option-sources'
import type { CallerTableView } from '@/application/ports/services/page-renderer'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Form } from '@/domain/models/app/forms'
import type { Page } from '@/domain/models/app/pages'
import type { DataSourceDb } from '@/presentation/render/resolve/data-source-contracts'

/** The reader's view of each embedded form's table, keyed by form name. */
export type FormRefReaders = Readonly<Record<string, CallerTableView>>

/**
 * Read, for every form `components` embeds, the table it writes to as this
 * reader may see it. Nothing is read without auth (every field is readable) or
 * outside the page route funnel, where no reader was injected.
 */
export async function resolveFormRefReaders(
  components: Page['components'],
  ctx: {
    readonly app: App
    readonly db: DataSourceDb
    readonly session: SessionInfo | undefined
  }
): Promise<FormRefReaders> {
  const read = ctx.db.readTableAsCaller
  if (!ctx.app.auth || read === undefined) return {}
  const entries = await Promise.all(
    embeddedFormNames(components, ctx.session, ctx.app).flatMap((name) => {
      const table = ctx.app.forms?.find((form) => form.name === name)?.submitTo.table
      if (table === undefined || !(ctx.app.tables ?? []).some((t) => t.name === table)) return []
      return [read(ctx.app, table, ctx.session).then((view) => [name, view] as const)]
    })
  )
  return Object.fromEntries(entries)
}

/**
 * The form as `reader` may see it: every table-bound field on a column she may
 * not read is left out — neither drawn nor named; on a table answering her no
 * map, every one she may neither read nor write. The same form back when
 * nothing is dropped, or without a reader.
 */
export function formForReader(
  form: Readonly<Form>,
  app: Readonly<App>,
  reader: CallerTableView | undefined
): Readonly<Form> {
  if (reader === undefined) return form
  const table = app.tables?.find((t) => t.name === form.submitTo.table)
  if (table === undefined) return form
  // Her permission map's readable fields; with no map, those her field rules
  // let her read or write. Nothing to narrow by: the form as declared.
  const shown =
    reader.permissionMap === undefined ? reader.formFields : readableFieldsOf(table, reader)
  if (shown === undefined) return form
  const readable = new Set(shown)
  const fields = form.fields.filter((field) => {
    const { kind, column } = field as { readonly kind?: unknown; readonly column?: unknown }
    return kind !== 'table-field' || typeof column !== 'string' || readable.has(column)
  })
  return fields.length === form.fields.length ? form : { ...form, fields }
}
