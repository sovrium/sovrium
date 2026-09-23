/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionValue } from '@/domain/models/app/tables/select-option'

/**
 * Validates that min is less than or equal to max when both are specified.
 *
 * This validation is used by numeric field types (integer, decimal, currency, percentage)
 * to ensure that range constraints are logically valid. Returns an error message if
 * validation fails, or undefined if validation passes.
 *
 * @param field - Object containing optional min and max properties
 * @returns Error message if min > max, undefined otherwise
 *
 * @example
 * ```typescript
 * validateMinMaxRange({ min: 0, max: 100 })  // undefined (valid)
 * validateMinMaxRange({ min: 100, max: 10 }) // 'min cannot be greater than max'
 * validateMinMaxRange({ min: 0 })            // undefined (only min specified)
 * validateMinMaxRange({ max: 100 })          // undefined (only max specified)
 * ```
 */
export const validateMinMaxRange = (field: {
  readonly min?: number
  readonly max?: number
}): string | undefined => {
  if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
    return 'min cannot be greater than max'
  }
  return undefined
}

/**
 * Hex grammar shared by every option `color` (`single-select` / `multi-select`
 * / `status`).
 *
 * Six-digit `#RRGGBB` only — alpha is deliberately excluded. A fill that
 * composites with an unknown surface has no determinable luminance, so the
 * platform could not derive the WCAG AA foreground and border that
 * [[internal ref] A7](../../../../../../docs/architecture/decisions/024-restraint-as-the-design-default.md)
 * ruling 3 requires it to pair with the author's fill.
 */
const OPTION_COLOR_HEX = /^#[0-9a-fA-F]{6}$/

/**
 * A single select-field option (`single-select` / `multi-select` / `status`).
 *
 * Either a bare string — where the stored value IS the display label — or an
 * object `{ value, label?, color? }` with a stable `value`, an optional display
 * `label`, and an optional `color`. The `label` may be a `$t:` translation key
 * resolved at render time (
 * AC [internal ref] and the tables selection field-type stories).
 *
 * `color` is the author's own datum, not platform ornament, so it is admitted
 * under [internal ref] A7 ruling 1. It renders as a **fill**; the platform derives the
 * AA-contrasting foreground and the delimiting border from it (ruling 3) rather
 * than clamping or rejecting the declared hue. It is never a text colour —
 * `theme.darkColors` is inert, so one hex is the author's entire vocabulary and
 * must stay legible on both surfaces (ruling 4).
 *
 * Plain-string options remain fully valid — NO config migration is required,
 * and the two forms may be mixed within one `options` array. The stored value,
 * CHECK constraint, and DEFAULT are ALWAYS the option's `value` (never the
 * label, never the color), so colouring or translating an option never rewrites
 * data and emits byte-identical DDL.
 */
export const SelectOptionSchema = Schema.Union([
  Schema.String,
  Schema.Struct({
    value: Schema.String.annotate({
      description: 'Value stored in the record when this option is chosen.',
    }).pipe(Schema.check(Schema.isNonEmpty({ message: 'option value is required' }))),
    label: Schema.optional(
      Schema.String.annotate({
        description:
          'Text shown for this option; the value itself is shown when omitted. Accepts a `$t:` key to translate it.',
      })
    ),
    color: Schema.optional(
      Schema.String.pipe(
        Schema.check(
          Schema.isPattern(OPTION_COLOR_HEX, {
            message: 'Invalid color format - color must be a hex code (e.g., #3B82F6)',
          })
        ),
        // The trailing annotation is LOAD-BEARING for the published JSON Schema:
        // `Schema.pattern` supplies its own `description` ("a string matching the
        // pattern …"), so dropping this line silently replaces human prose with a
        // regex restatement in `sovrium schema` output. Measured on this change.
        Schema.annotate({
          description:
            'Hex color code (#RRGGBB) painted as the option chip fill; the foreground and border are derived from it',
        })
      )
    ),
  }).pipe(Schema.annotate({ title: 'Select Option (object form)' })),
]).annotate({
  title: 'Select Option',
  description:
    'A select option: a bare string, or `{ value, label?, color? }` where `label` may be a `$t:` key and `color` a `#RRGGBB` fill',
})

/** @public */
export type SelectOption = Schema.Schema.Type<typeof SelectOptionSchema>

/**
 * Creates a reusable options array schema for select-type fields.
 *
 * This schema factory is used by single-select and multi-select field types
 * to ensure consistent validation of options arrays. All select fields require
 * at least one option to be meaningful, and option VALUES must be unique
 * (uniqueness is checked on {@link optionValue}, so a bare string and an object
 * option resolving to the same value still collide).
 *
 * Each option is a {@link SelectOptionSchema} — a bare string OR a
 * `{ value, label? }` object — so the two forms may be mixed freely and
 * existing all-string configs stay valid without migration.
 *
 * @param fieldType - The type of select field (for error messages)
 * @returns Effect Schema for validating options arrays
 *
 * @example
 * ```typescript
 * // Used in single-select field
 * const optionsSchema = createOptionsSchema('single-select')
 * // Used in multi-select field
 * const optionsSchema = createOptionsSchema('multi-select')
 * ```
 */
export const createOptionsSchema = (fieldType: 'single-select' | 'multi-select') =>
  Schema.Array(SelectOptionSchema)
    .annotate({
      description:
        'Choices the field accepts. Each one is a plain value, or a value carrying its own label and colour.',
    })
    .pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        // EFFECT 4: `Annotations.Filter.message` is a `string`, where v3 took a
        // `() => string` thunk. A thunk here is not rejected at runtime, it is
        // simply not a string — so the custom line silently vanished and authors
        // got the generic "Expected a value with a length of at least 1" instead.
        // `fieldType` is a parameter of this factory, so nothing is lost by
        // interpolating eagerly.
        title: 'Options',
        message: `At least one option is required for ${fieldType} field`,
      }),
      Schema.check(
        Schema.makeFilter((options) => {
          const values = options.map(optionValue)
          const uniqueValues = new Set(values)
          return (
            values.length === uniqueValues.size || 'Options must be unique (duplicate option found)'
          )
        })
      )
    )

/**
 * Creates a reusable options array schema for `status` fields.
 *
 * Options are {@link SelectOptionSchema} — the SAME grammar `single-select` and
 * `multi-select` use — so the three selection field types no longer disagree
 * about how an option is spelled. Before this convergence `status` had its own
 * `{ value, color? }` struct: it was the only selection type that could carry a
 * `color`, and the only one that could NOT carry a `label`, so a status chip —
 * the most user-facing chip in the product — was the single selection value
 * that could not be translated. Both asymmetries existed only because nobody
 * drew the line, which is the same diagnosis
 * [[internal ref] A7](../../../../../../docs/architecture/decisions/024-restraint-as-the-design-default.md)
 * makes of the unpainted `color`.
 *
 * The convergence is a WIDENING in both directions and breaks no config:
 * existing `{ value, color }` options stay valid, `status` additionally accepts
 * the bare-string and `label` forms, and `single-select` / `multi-select`
 * additionally accept `color`. Uniqueness is checked on {@link optionValue}, so
 * a bare string and an object option resolving to the same value still collide.
 *
 * `status` keeps its own array wrapper purely for its distinct minItems message.
 *
 * @returns Effect Schema for validating status field options arrays
 *
 * @example
 * ```typescript
 * const optionsSchema = createStatusOptionsSchema()
 * // Validates: [{ value: 'Draft', color: '#6B7280' }, { value: 'Published' }]
 * // Also now valid: ['Draft', { value: 'Published', label: '$t:statusPublished' }]
 * ```
 */
export const createStatusOptionsSchema = () =>
  Schema.Array(SelectOptionSchema)
    .annotate({
      description:
        'States a record can be in. Each one is a plain value, or a value carrying its own label and colour for the status chip.',
    })
    .pipe(
      Schema.check(Schema.isMinLength(1, { message: 'at least one option required' })),
      Schema.annotate({ title: 'Status Options' }),
      Schema.check(
        Schema.makeFilter((options) => {
          const values = options.map(optionValue)
          const uniqueValues = new Set(values)
          return (
            values.length === uniqueValues.size || 'Options must be unique (duplicate option found)'
          )
        })
      )
    )

/**
 * Validates that button fields have required properties based on their action type.
 *
 * This validation is used by button field types to ensure that action-specific
 * properties are provided when needed. For example, buttons with action='url'
 * must have a url property, and buttons with action='automation' must have an
 * automation property.
 *
 * @param field - Object containing action and optional url/automation properties
 * @returns Error message if validation fails, true if validation passes
 *
 * The `action` parameter is typed as `string` rather than the field's own
 * `'url' | 'automation'` literal union so this stays a plain predicate over a
 * structural shape. The union is enforced one level up, by the field schema;
 * an unrecognised action never reaches here.
 *
 * @example
 * ```typescript
 * validateButtonAction({ action: 'url', url: 'https://example.com' })  // true (valid)
 * validateButtonAction({ action: 'url' })                              // 'url is required when action is url'
 * validateButtonAction({ action: 'automation', automation: 'approve' }) // true (valid)
 * validateButtonAction({ action: 'automation' })                       // 'automation is required when action is automation'
 * ```
 */
export const validateButtonAction = (field: {
  readonly action: string
  readonly url?: string
  readonly automation?: string
}): string | true => {
  if (field.action === 'url' && !field.url) {
    return 'url is required when action is url'
  }
  if (field.action === 'automation' && !field.automation) {
    return 'automation is required when action is automation'
  }
  return true
}

/**
 * Finds the first duplicate value in an array.
 *
 * This utility function is used for detecting duplicate IDs, field names, or other
 * values that must be unique within a collection. Uses an efficient O(n) algorithm
 * with indexOf to find the first duplicate.
 *
 * @param values - Array of values to check for duplicates
 * @returns The first duplicate value found, or undefined if no duplicates exist
 *
 * @example
 * ```typescript
 * findDuplicate(['a', 'b', 'c'])        // undefined (no duplicates)
 * findDuplicate(['a', 'b', 'a', 'c'])   // 'a' (first duplicate)
 * findDuplicate([1, 2, 3, 2])           // 2 (works with numbers)
 * findDuplicate(['x'])                  // undefined (single item)
 * ```
 */
export const findDuplicate = <T>(values: ReadonlyArray<T>): T | undefined => {
  return values.find((value, index) => values.indexOf(value) !== index)
}
