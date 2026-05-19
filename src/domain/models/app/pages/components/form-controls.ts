/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { OptionItemSchema } from './shared-schemas'


export const OptionsSchema = Schema.Array(OptionItemSchema).pipe(
  Schema.minItems(1),
  Schema.annotations({
    title: 'Options',
    description: 'Array of selectable options for select, radio-group, or combobox',
  })
)


export const OrientationSchema = Schema.Literal('horizontal', 'vertical').annotations({
  title: 'Orientation',
  description: 'Layout orientation for grouped controls',
})


export const DatePickerModeSchema = Schema.Literal('single', 'range').annotations({
  title: 'Date Picker Mode',
  description: 'Whether to select a single date or a date range',
})


export const InputTypeSchema = Schema.Literal(
  'text',
  'email',
  'password',
  'number',
  'tel',
  'url',
  'search'
).annotations({
  title: 'Input Type',
  description: 'HTML input type attribute for the input component',
})


export const SkeletonVariantSchema = Schema.Literal('text', 'circular', 'rectangular').annotations({
  title: 'Skeleton Variant',
  description: 'Shape variant for skeleton loading placeholder',
})


export const DrawerSideSchema = Schema.Literal('left', 'right', 'top', 'bottom').annotations({
  title: 'Drawer Side',
  description: 'Edge of the screen the drawer slides in from',
})

export const DrawerSizeSchema = Schema.Literal('sm', 'md', 'lg', 'full').annotations({
  title: 'Drawer Size',
  description: 'Width/height preset for the drawer panel',
})


export const CarouselOrientationSchema = Schema.Literal('horizontal', 'vertical').annotations({
  title: 'Carousel Orientation',
  description: 'Scroll direction for the carousel',
})


export const ResizableDirectionSchema = Schema.Literal('horizontal', 'vertical').annotations({
  title: 'Resizable Direction',
  description: 'Direction of the resizable panel layout',
})


export const ScrollOrientationSchema = Schema.Literal('vertical', 'horizontal', 'both').annotations(
  {
    title: 'Scroll Orientation',
    description: 'Which axis the scroll area scrolls on',
  }
)


export const AccordionTypeSchema = Schema.Literal('single', 'multiple').annotations({
  title: 'Accordion Type',
  description: 'Whether only one item or multiple items can be open simultaneously',
})


export const TabsOrientationSchema = Schema.Literal('horizontal', 'vertical').annotations({
  title: 'Tabs Orientation',
  description: 'Layout direction of the tab triggers',
})


export const ToggleTypeSchema = Schema.Literal('single', 'multiple').annotations({
  title: 'Toggle Type',
  description: 'Whether single or multiple toggles can be active simultaneously',
})


export type Options = Schema.Schema.Type<typeof OptionsSchema>
export type Orientation = Schema.Schema.Type<typeof OrientationSchema>
export type DatePickerMode = Schema.Schema.Type<typeof DatePickerModeSchema>
export type InputType = Schema.Schema.Type<typeof InputTypeSchema>
export type SkeletonVariant = Schema.Schema.Type<typeof SkeletonVariantSchema>
export type DrawerSide = Schema.Schema.Type<typeof DrawerSideSchema>
export type DrawerSize = Schema.Schema.Type<typeof DrawerSizeSchema>
export type CarouselOrientation = Schema.Schema.Type<typeof CarouselOrientationSchema>
export type ResizableDirection = Schema.Schema.Type<typeof ResizableDirectionSchema>
export type ScrollOrientation = Schema.Schema.Type<typeof ScrollOrientationSchema>
export type AccordionType = Schema.Schema.Type<typeof AccordionTypeSchema>
export type TabsOrientation = Schema.Schema.Type<typeof TabsOrientationSchema>
export type ToggleType = Schema.Schema.Type<typeof ToggleTypeSchema>
