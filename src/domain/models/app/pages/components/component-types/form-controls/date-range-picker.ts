/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `date-range-picker` — a period, typed or picked, with the usual presets.
 *
 * ## Why it is not `date-picker` with `datePickerMode: 'range'`
 *
 * That mode exists and stays: it turns one calendar into a two-click selection.
 * What a period actually needs is three things that mode does not have and
 * cannot grow without becoming a second component inside the first —
 *
 *  - **Two months side by side.** A range that crosses a month boundary is the
 *    common case, and paging one calendar back and forth to pick its two ends
 *    loses the shape of the selection between clicks.
 *  - **Presets.** "This month" and "Last quarter" are the majority of every
 *    period a reader picks, and they are the one thing a config cannot express:
 *    the dates have to be computed at open time, not written down.
 *  - **One value with two ends.** A single date is a string; a period is a
 *    pair, and the pair has to survive being submitted, formatted and read back.
 *
 * The two types therefore sit beside each other in the kit and `related` points
 * each at the other, rather than one hiding behind a mode flag on the other.
 *
 * ## The value is one ISO 8601 interval, not two fields
 *
 * `2026-09-01/2026-09-30` — the notation ISO 8601 already defines for exactly
 * this. Two form fields (`periodFrom`, `periodTo`) was the alternative and was
 * refused: it invents a naming convention every consumer then has to know, and
 * it lets a half-submitted period exist, which a period is not. One field means
 * one value, and the slash is where a reader and a parser both split it.
 *
 * ## Presets are a closed vocabulary because the engine computes them
 *
 * An author cannot write "last month" as a date, which is the whole point of
 * the list. So the members are named rather than declared, and each resolves
 * against the request's own clock when the panel opens.
 *
 * Source: [internal ref]
 * Specs: [internal ref] … 006, plus this type's own REGRESSION rollup
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { visibilityFields } from '../modules/visibility'

export const DateRangePickerTypeLiteral = Schema.Literal('date-range-picker')

/**
 * The periods the panel can offer as one click.
 *
 * Closed because each is a computation over the current date rather than a
 * value an author could write. A member absent from this list is one nobody has
 * taught the engine to compute yet, which is a schema change and not a config
 * one — so it is refused by name rather than silently offered and left empty.
 */
export const DateRangePresetSchema = Schema.Literals([
  'today',
  'yesterday',
  'last-7-days',
  'last-30-days',
  'this-month',
  'last-month',
  'this-quarter',
  'last-quarter',
  'this-year',
  'last-year',
]).annotate({
  title: 'Range Preset',
  description:
    'A named period the panel offers as one click, resolved against the current date when the panel opens.',
})

export const dateRangePickerFields = {
  ...coreFields,
  ...visibilityFields,
  ...i18nFields,
  /** Label above the trigger. */
  label: Schema.optional(
    Schema.String.annotate({ description: 'Label above the trigger', examples: ['Period'] })
  ),
  /**
   * Form field name.
   *
   * One field carrying the whole interval — see the module docstring for why
   * this is not a pair of names.
   */
  name: Schema.optional(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        description:
          'Form field name. Submits ONE value: the ISO 8601 interval `<from>/<to>`, e.g. `2026-09-01/2026-09-30`.',
        examples: ['period'],
      })
    )
  ),
  /** What the trigger reads before a period is chosen. */
  placeholder: Schema.optional(
    Schema.String.annotate({
      description: 'What the trigger reads before a period is chosen',
      examples: ['Pick a period'],
    })
  ),
  /**
   * The period the picker opens with.
   *
   * An ISO 8601 interval, the same notation `name` submits. A preset name is
   * NOT accepted here: a preset is what the panel offers, and accepting one as
   * the initial value would make the field mean two different things depending
   * on which string it held.
   */
  value: Schema.optional(
    Schema.String.pipe(
      Schema.check(
        Schema.isPattern(/^(\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}|\$(?:record|param)\.[\w.-]+)$/, {
          message:
            'An initial period must be the ISO 8601 interval `<from>/<to>` (e.g. `2026-09-01/2026-09-30`), or a `$record.`/`$param.` reference resolved per row. A preset name belongs in `presets`, not here.',
        })
      ),
      Schema.annotate({
        title: 'Initial Period',
        description:
          'The period the picker opens with, as the ISO 8601 interval `<from>/<to>`, or a `$record.`/`$param.` reference. A preset name is REFUSED here by pattern: a preset is what the panel offers, and accepting one as the initial value would make the field mean two different things depending on which string it held.',
        examples: ['2026-09-01/2026-09-30', '$record.period'],
      })
    )
  ),
  /** How each end of the period is printed on the trigger. */
  dateFormat: Schema.optional(
    Schema.String.annotate({
      description:
        'How each end of the period is printed on the trigger. The two ends are joined by an arrow; this formats one end.',
      examples: ['YYYY-MM-DD', 'D MMM YYYY'],
    })
  ),
  /** Earliest selectable date, ISO 8601. */
  minDate: Schema.optional(
    Schema.String.annotate({
      description: 'Earliest selectable date (ISO 8601). Days before it are unselectable.',
      examples: ['2026-01-01'],
    })
  ),
  /** Latest selectable date, ISO 8601. */
  maxDate: Schema.optional(
    Schema.String.annotate({
      description: 'Latest selectable date (ISO 8601). Days after it are unselectable.',
      examples: ['2026-12-31'],
    })
  ),
  /**
   * How many months the panel shows.
   *
   * Two by default, because a period that crosses a month boundary is the
   * common case. One is the narrow-viewport shape and is worth declaring where
   * the panel has to fit a sidebar.
   */
  months: Schema.optional(
    Schema.Literals([1, 2]).annotate({
      title: 'Months Shown',
      description:
        'How many calendars the panel shows side by side. `2` by default — a period crossing a month boundary is the common case.',
    })
  ),
  /**
   * Presets offered down the left of the panel.
   *
   * Omitted draws no preset column at all, which is the right default for a
   * picker over a bounded domain (a project's own dates) where "this quarter"
   * may name a period with nothing in it.
   */
  presets: Schema.optional(
    Schema.Array(DateRangePresetSchema).annotate({
      title: 'Presets',
      description:
        'Named periods offered down the left of the panel, in the order given. Omitted and `[]` both draw no preset column — unlike `rich-text-editor.toolbar`, an empty preset list has no second reading to distinguish.',
      examples: [['today', 'last-7-days', 'this-month', 'last-month']],
    })
  ),
} as const
