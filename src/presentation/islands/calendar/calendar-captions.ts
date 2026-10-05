/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The words the calendar writes itself, in the page's language.
 *
 * The toolbar carries seven strings no author ever declares: the current-period
 * button, the three view switches, and the accessible names of the `‹ ›` pair
 * and of the switch group. They are platform CHROME, so they follow the same
 * rule as the rest of it — a locale → copy table read through
 * `resolveForLanguage` against `<html lang>`, which already answers a regional
 * tag (`fr-FR`) with its short-code entry (`fr`). A language with no entry
 * keeps the English captions rather than rendering nothing.
 *
 * The view captions are title case. The visible text IS each switch's
 * accessible name (see note 2 in `calendar-toolbar.tsx`), so a lower-case
 * `month` read as a raw enum value to a screen reader as well as on screen.
 *
 * The period TITLE is not here: it is a date, and FullCalendar formats it
 * through `Intl` once it is handed the page locale (`calendar-view.tsx`).
 */

import { resolveForLanguage } from '@/domain/models/app/languages/locale-lookup-service'
import type { CalendarView } from '@/domain/models/app/pages/components/component-types/data/calendar/schema'

export interface CalendarCaptions {
  readonly today: string
  readonly views: Readonly<Record<CalendarView, string>>
  /** The month's name in the switch on a phone, where it is drawn as an agenda. */
  readonly agenda: string
  readonly previousPeriod: string
  readonly nextPeriod: string
  readonly viewGroup: string
}

const EN_CAPTIONS: CalendarCaptions = {
  today: 'Today',
  views: { month: 'Month', week: 'Week', day: 'Day' },
  agenda: 'Agenda',
  previousPeriod: 'Previous period',
  nextPeriod: 'Next period',
  viewGroup: 'Calendar view',
}

const CALENDAR_CAPTIONS: Readonly<Record<string, CalendarCaptions>> = {
  en: EN_CAPTIONS,
  fr: {
    today: 'Aujourd’hui',
    views: { month: 'Mois', week: 'Semaine', day: 'Jour' },
    agenda: 'Agenda',
    previousPeriod: 'Période précédente',
    nextPeriod: 'Période suivante',
    viewGroup: 'Vue du calendrier',
  },
}

/**
 * The caption set for a page language. Returns one of the table's own objects,
 * so the reference is stable across renders for a given language.
 */
export function resolveCalendarCaptions(lang: string | undefined): CalendarCaptions {
  return resolveForLanguage(CALENDAR_CAPTIONS, lang, EN_CAPTIONS)
}
