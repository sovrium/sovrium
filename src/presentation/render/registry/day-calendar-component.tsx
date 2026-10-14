/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { hostComponentType } from './island-host-attributes'
import type { ComponentRenderer } from './component-dispatch-config'

/** The keys the day grid island reads, copied from the component as written. */
const ISLAND_KEYS = [
  'mode',
  'defaultValue',
  'minDate',
  'maxDate',
  'disabled',
  'months',
  'captionLayout',
  'weekStartsOn',
  'name',
] as const

/**
 * `calendar` — the host of the day grid island. The grid is drawn in the
 * browser; the server hands it the page language's locale, read from
 * `languages`, so the caption and the weekday names are in that language.
 *
 * Source: src/domain/models/app/pages/components/component-types/form-controls/day-calendar.ts
 */
const dayCalendarComponent: ComponentRenderer = ({
  elementProps,
  component,
  currentLang,
  languages,
}) => {
  const source = (component ?? {}) as Readonly<Record<string, unknown>>
  const language = languages?.supported.find((entry) => entry.code === currentLang)
  const props = {
    ...Object.fromEntries(
      ISLAND_KEYS.flatMap((key) => (source[key] === undefined ? [] : [[key, source[key]]]))
    ),
    locale: language?.locale ?? currentLang ?? 'en-US',
    className: elementProps['className'],
  }
  return (
    <div
      data-island="calendar"
      data-component-type={hostComponentType(elementProps)}
      data-island-props={JSON.stringify(props)}
      data-testid={elementProps['data-testid'] as string | undefined}
      id={elementProps['id'] as string | undefined}
    >
      <div
        aria-hidden="true"
        className="bg-muted h-72 w-64 animate-pulse rounded-lg"
      />
    </div>
  )
}

/** The day grid renderer, keyed by type. */
export const dayCalendarComponents = {
  calendar: dayCalendarComponent,
} as const satisfies Readonly<Record<string, ComponentRenderer>>
