/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `calendar/exportIcs` — build an iCalendar (`.ics`) file holding ONE event
 * and write it as a temporary file, through the document output road, so a
 * later step attaches it: `email/send` reads `'{{steps.<name>.file}}'` in its
 * existing `attachments`.
 *
 * A timed event is written on the wall clock of `timezone` (the operator
 * timezone when unset) with the zone's `VTIMEZONE`; an all-day event as dates,
 * its end the day after its last day. Without `end`, a timed event lasts one
 * hour and an all-day event one day. The `UID` defaults to
 * `<table>-<record id>@<host>` from the record that started the run, so a
 * second invite for the same record updates the event; a run no record
 * started must set `uid`. An end before the start, a zone the engine does not
 * know, or a missing `uid` fails the step before anything is written.
 *
 * Output: `{ file, uid }` — `file` is the temporary-file result every
 * document step returns.
 */

import { Clock, Effect } from 'effect'
import { ServerOrigin } from '@/application/ports/services/server-origin'
import { nextDay } from '@/domain/kernel/format/icalendar'
import {
  isKnownTimeZone,
  writeICalendarInvite,
  type InviteDay,
  type InviteTime,
} from '@/domain/kernel/format/icalendar-invite'
import { zonedIsoDate, zonedWallClockInstant } from '@/domain/kernel/time/zoned-calendar'
import { triggerOfType } from '@/domain/models/app/automations/trigger-entries-service'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'
import { writeGeneratedFile } from './document-output'
import { runDocumentAction } from './document-run'
import { actionAttributes, stringProp } from './shared'
import type { ActionHandler, ActionRunContext, AutomationContext } from './shared'
import type { App } from '@/domain/models/app'

const HOUR_MS = 3_600_000
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
/** A reading with no offset, which only the event's zone can place. */
const NO_OFFSET = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/

/** A step that cannot build its invite: the step's error, `calendar.exportIcs: <message>`. */
class InviteRefusal {
  readonly _tag = 'InviteRefusal'
  constructor(readonly message: string) {}
}

/**
 * The instant `text` names, read on the clock of `zone` when it carries no
 * offset — never on the host's clock, and never rolled over from a day or an
 * hour that does not exist (a 30 February, or 25:00).
 */
const instantOf = (text: string, zone: string): number | undefined => {
  const trimmed = text.trim()
  if (NO_OFFSET.test(trimmed)) {
    const reading = DATE_ONLY.test(trimmed) ? `${trimmed}T00:00` : trimmed
    return zonedWallClockInstant(reading, zone)?.getTime()
  }
  const parsed = Date.parse(trimmed)
  return Number.isNaN(parsed) ? undefined : parsed
}

/** The calendar day `text` names: its own day, or the day of its instant on the clock of `zone`. */
const dayOf = (text: string, zone: string): string | undefined => {
  const trimmed = text.trim()
  const at = instantOf(trimmed, zone)
  if (at === undefined) return undefined
  return DATE_ONLY.test(trimmed) ? trimmed : zonedIsoDate(new Date(at), zone)
}

/** An event's start and exclusive end. */
interface EventTimes {
  readonly start: InviteDay | InviteTime
  readonly end: InviteDay | InviteTime
}

/** An all-day event's first day and the day after its last, or why they cannot be read. */
const allDayTimes = (
  startText: string,
  endText: string,
  zone: string
): EventTimes | InviteRefusal => {
  const first = dayOf(startText, zone)
  const last = endText === '' ? first : dayOf(endText, zone)
  if (first === undefined) return new InviteRefusal(`the start "${startText}" is not a date`)
  if (last === undefined) return new InviteRefusal(`the end "${endText}" is not a date`)
  if (last < first) return new InviteRefusal(`the end ${last} is before the start ${first}`)
  return { start: { kind: 'date', date: first }, end: { kind: 'date', date: nextDay(last) } }
}

/** A timed event's start and end on the clock of `zone`, or why they cannot be read. */
const timedTimes = (
  startText: string,
  endText: string,
  zone: string
): EventTimes | InviteRefusal => {
  const startMs = instantOf(startText, zone)
  if (startMs === undefined) return new InviteRefusal(`the start "${startText}" is not a date`)
  const endMs = endText === '' ? startMs + HOUR_MS : instantOf(endText, zone)
  if (endMs === undefined) return new InviteRefusal(`the end "${endText}" is not a date`)
  if (endMs < startMs) {
    return new InviteRefusal(`the end ${endText} is before the start ${startText}`)
  }
  return {
    start: { kind: 'zoned', epochMs: startMs, timeZone: zone },
    end: { kind: 'zoned', epochMs: endMs, timeZone: zone },
  }
}

/** The event's start and exclusive end, or the reason they cannot be read. */
const timesOf = (
  props: Readonly<Record<string, unknown>>,
  zone: string
): EventTimes | InviteRefusal => {
  const startText = stringProp(props, 'start')
  const endText = stringProp(props, 'end').trim()
  return props['allDay'] === true || props['allDay'] === 'true'
    ? allDayTimes(startText, endText, zone)
    : timedTimes(startText, endText, zone)
}

/** `<table>-<record id>` of the record that started the run, when a record did. */
const triggerRecordKey = (
  app: App,
  automation: AutomationContext,
  runContext: ActionRunContext | undefined
): string | undefined => {
  const declared = app.automations?.find((candidate) => candidate.name === automation.name)
  const table = declared === undefined ? undefined : triggerOfType(declared, 'record')?.table
  const record = runContext?.triggerData['record'] as { readonly id?: unknown } | undefined
  const id = record?.id
  if (table === undefined || (typeof id !== 'string' && typeof id !== 'number')) return undefined
  return `${table}-${String(id)}`
}

/** The event's `UID`: the step's own, else one derived from the record that started the run. */
const uidOf = (
  props: Readonly<Record<string, unknown>>,
  input: {
    readonly app: App
    readonly automation: AutomationContext
    readonly runContext: ActionRunContext | undefined
  }
) =>
  Effect.gen(function* () {
    const own = stringProp(props, 'uid').trim()
    if (own !== '') return own
    const key = triggerRecordKey(input.app, input.automation, input.runContext)
    if (key === undefined) {
      return yield* Effect.fail(
        new InviteRefusal('a run no record started must set `uid`, so the event can be recognised')
      )
    }
    const origin = yield* (yield* ServerOrigin).current
    return `${key}@${new URL(origin).hostname}`
  })

/** A trimmed text prop, or nothing when it is empty. */
const optionalText = (props: Readonly<Record<string, unknown>>, name: string) => {
  const value = stringProp(props, name)
  return value.trim() === '' ? undefined : value
}

export const handleCalendarExportIcs: ActionHandler = (action, app, automation, runContext) => {
  const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
  const program = Effect.gen(function* () {
    const zone = stringProp(props, 'timezone').trim() || parseSovriumTimezone().zoneId
    if (!isKnownTimeZone(zone)) {
      return yield* Effect.fail(
        new InviteRefusal(`the time zone "${zone}" is not one the engine knows`)
      )
    }
    const times = timesOf(props, zone)
    if (times instanceof InviteRefusal) return yield* Effect.fail(times)
    const uid = yield* uidOf(props, { app, automation, runContext })
    const ics = writeICalendarInvite({
      uid,
      stampMs: yield* Clock.currentTimeMillis,
      summary: stringProp(props, 'title'),
      ...times,
      location: optionalText(props, 'location'),
      description: optionalText(props, 'description'),
    })
    const file = yield* writeGeneratedFile({
      output: { filename: 'invite.ics' },
      file: { bytes: new TextEncoder().encode(ics), contentType: 'text/calendar; charset=utf-8' },
      app,
      automation,
      runContext,
    })
    return { file, uid }
  })
  return runDocumentAction('calendar.exportIcs', program).pipe(
    Effect.withSpan('automations.handle-calendar-export-ics', {
      attributes: actionAttributes(action),
    })
  )
}
