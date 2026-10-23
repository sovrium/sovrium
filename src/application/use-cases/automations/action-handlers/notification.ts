/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `notification` `create` — notify people of something, one notification per
 * recipient, of a kind the app declares, on the channels each chose for it.
 *
 * `recipients` is read with its type kept, so `'{{trigger.mentions}}'` stays
 * the list of ids it names; a list of templates gives one id each, and a
 * comma-separated text is read as a list too. An id that names nobody is
 * skipped. The notification stores its source's table and record id only.
 */

import { Effect } from 'effect'
import { sendNotificationsProgram } from '@/application/use-cases/automations/notification-programs'
import { logError } from '@/infrastructure/logging/logger'
import { typedOwnProp } from './document-run'
import { actionAttributes, stringProp } from './shared'
import type { ActionHandler } from './shared'

/** The ids a recipients value names: a list, a JSON list, or comma-separated text. */
const recipientIdsOf = (raw: unknown): readonly string[] => {
  if (Array.isArray(raw)) return raw.flatMap((entry) => recipientIdsOf(entry))
  if (typeof raw !== 'string') return raw === undefined || raw === null ? [] : [String(raw)]
  const text = raw.trim()
  if (text.startsWith('[')) {
    try {
      return recipientIdsOf(JSON.parse(text) as unknown)
    } catch {
      // Not a JSON list: read it as comma-separated text below.
    }
  }
  return text
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
}

/** The record a notification is about, when the step names one. */
const sourceOf = (
  raw: unknown
): { readonly table: string; readonly recordId: string } | undefined => {
  if (typeof raw !== 'object' || raw === null) return undefined
  const source = raw as Readonly<Record<string, unknown>>
  const table = String(source['table'] ?? '').trim()
  const recordId = String(source['recordId'] ?? '').trim()
  return table === '' || recordId === '' ? undefined : { table, recordId }
}

export const handleNotificationCreate: ActionHandler = (action, app, _automation, runContext) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const title = stringProp(props, 'title').trim()
    if (title === '') {
      return {
        status: 'failure',
        error: 'notification.create: the title is empty once rendered',
      } as const
    }
    const body = stringProp(props, 'body').trim()
    const sent = yield* Effect.result(
      sendNotificationsProgram(app, {
        kind: stringProp(props, 'kind'),
        recipientIds: recipientIdsOf(typedOwnProp(props, 'recipients', runContext)),
        title,
        body: body === '' ? undefined : body,
        source: sourceOf(props['source']),
      })
    )
    if (sent._tag === 'Failure') {
      logError('[automations] notification.create could not write the notifications', sent.failure)
      return {
        status: 'failure',
        error: 'notification.create: the notifications could not be written',
      } as const
    }
    return { status: 'success', output: sent.success } as const
  }).pipe(
    Effect.withSpan('automations.handle-notification-create', {
      attributes: actionAttributes(action),
    })
  )
