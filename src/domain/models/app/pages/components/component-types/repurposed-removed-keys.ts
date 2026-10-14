/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Keys refused on a REPURPOSED type: a literal renamed away to shadcn/ui's name
 * for the component, then given back with shadcn's meaning.
 *
 * `drawer` named the side panel, which is now `sheet`; the name returned as the
 * bottom drawer. A config written for the old meaning carries the side panel's
 * keys, so each of them is refused with a sentence naming the type it belongs
 * to — renaming the `type` is the whole migration. `calendar` named the event
 * view, which is now `event-calendar`; the name returned as the day grid. A bare
 * `type: drawer` or `type: calendar` with none of those keys decodes as the new
 * type, by design.
 */

const SHEET_HINT = (key: string): string =>
  `\`${key}\` belongs to the side panel, which is now \`type: sheet\`: rename the \`type\` to \`sheet\` and keep every key. \`type: drawer\` is now the panel that rises from the bottom edge.`

const EVENT_CALENDAR_HINT = (key: string): string =>
  `\`${key}\` belongs to the event view, which is now \`type: event-calendar\`: rename the \`type\` to \`event-calendar\` and keep every key. \`type: calendar\` is now a month of days to pick a date from.`

const REFUSED_ON_REPURPOSED_TYPE: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map([
  [
    'drawer',
    new Map([
      ...[
        'id',
        'drawerSize',
        'dataSource',
        'recordFields',
        'canEdit',
        'actions',
        'role',
        'related',
        'navigation',
      ].map((key) => [key, SHEET_HINT(key)] as const),
      [
        'drawerSide',
        `${SHEET_HINT('drawerSide')} A drawer from the bottom edge needs no side; for one from the top, keep \`type: drawer\` and write \`side: top\`.`,
      ],
    ]),
  ],
  [
    'calendar',
    new Map(
      [
        'dataSource',
        'dateField',
        'endDateField',
        'defaultView',
        'labelField',
        'colorField',
        'maxEventsPerDay',
        'calendarEvent',
        'calendarInteraction',
        'dayMinHeight',
        'autoSave',
        'search',
        'responsive',
      ].map((key) => [key, EVENT_CALENDAR_HINT(key)] as const)
    ),
  ],
])

/**
 * The message for a key a repurposed type refuses, or `undefined`.
 *
 * @param discriminant - The node's `type` literal.
 * @param key - The property name the author wrote.
 */
export const migrationHintForRepurposedTypeKey = (
  discriminant: string | undefined,
  key: string
): string | undefined =>
  discriminant === undefined ? undefined : REFUSED_ON_REPURPOSED_TYPE.get(discriminant)?.get(key)

/** Every refused key, per type, for the test that pins each message. @internal */
export const REPURPOSED_TYPE_REFUSED_KEYS: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(
    [...REFUSED_ON_REPURPOSED_TYPE].map(([type, keys]) => [type, [...keys.keys()]] as const)
  )
