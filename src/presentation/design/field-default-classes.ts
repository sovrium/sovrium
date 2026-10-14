/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui field and label (https://ui.shadcn.com), registry commit 30a58d4498f270af1c1e981a7d78a15cf5740841.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The `field` component: shadcn/ui's `Field` anatomy.
 *
 * The parts verbatim from base-nova's `Field` (vertical orientation),
 * `FieldLabel` over `Label`, `FieldDescription`, `FieldError`, `FieldGroup`,
 * `FieldSet` and `FieldLegend`. They read nothing, so an island that draws a
 * field pays for these strings alone: they sit apart from the form recipes in
 * `form-layout-classes.ts`, whose banner styles read the theme tokens, so that
 * neither side's islands download the other's strings.
 */

/** shadcn/ui `Field`'s orientations. `responsive` reads the viewport (`md`), not a field-group container. */
const FIELD_ORIENTATION = {
  vertical: 'flex-col *:w-full [&>.sr-only]:w-auto',
  horizontal:
    'flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
  responsive:
    'flex-col *:w-full md:flex-row md:items-center md:*:w-auto md:has-[>[data-slot=field-content]]:items-start md:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto',
} as const

/** shadcn/ui `Field`, by orientation (vertical by default). */
export const computeFieldClasses = (
  orientation: keyof typeof FIELD_ORIENTATION = 'vertical'
): string =>
  `group/field flex w-full gap-2 data-[invalid=true]:text-destructive ${FIELD_ORIENTATION[orientation]}`

/** shadcn/ui `FieldContent`: a choice field's title and description. */
export const computeFieldContentClasses = (): string =>
  'group/field-content flex flex-1 flex-col gap-0.5 leading-snug'

/** shadcn/ui `FieldTitle`. */
export const computeFieldTitleClasses = (): string =>
  'flex w-fit items-center gap-2 text-sm font-medium group-data-[disabled=true]/field:opacity-50'

/** shadcn/ui `FieldLabel`, composed over `Label`. */
export const computeFieldLabelClasses = (): string =>
  'group/field-label peer/field-label flex w-fit items-center gap-2 text-sm leading-snug font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 group-data-[disabled=true]/field:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50'

/** shadcn/ui `FieldDescription`. */
export const computeFieldDescriptionClasses = (): string =>
  'text-left text-sm leading-normal font-normal text-muted-foreground group-has-data-horizontal/field:text-balance last:mt-0 nth-last-2:-mt-1 [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary'

/** shadcn/ui `FieldError`. */
export const computeFieldErrorClasses = (): string => 'text-sm font-normal text-destructive'

/** shadcn/ui `FieldGroup`: the column a form's fields stand in. */
export const computeFieldGroupClasses = (): string =>
  'group/field-group @container/field-group flex w-full flex-col gap-5 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4'

/** shadcn/ui `FieldSet`: a titled run of fields inside the group. */
export const computeFieldSetClasses = (): string =>
  'flex flex-col gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3'

/** shadcn/ui `FieldLegend`: the `legend` variant, `data-variant=label` for the smaller one. */
export const computeFieldLegendClasses = (): string =>
  'mb-1.5 text-base font-medium data-[variant=label]:text-sm'
