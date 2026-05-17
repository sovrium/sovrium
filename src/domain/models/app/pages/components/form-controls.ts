/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { OptionItemSchema } from './shared-schemas'

// ---------------------------------------------------------------------------
// Options array (reused by select, radio-group, combobox)
// ---------------------------------------------------------------------------

/**
 * Array of option items for selection-based form controls
 */
export const OptionsSchema = Schema.Array(OptionItemSchema).pipe(
  Schema.minItems(1),
  Schema.annotations({
    title: 'Options',
    description: 'Array of selectable options for select, radio-group, or combobox',
  })
)

// ---------------------------------------------------------------------------
// Orientation schema (reused by radio-group, toggle-group)
// ---------------------------------------------------------------------------

/**
 * Layout orientation for grouped form controls
 */
export const OrientationSchema = Schema.Literal('horizontal', 'vertical').annotations({
  title: 'Orientation',
  description: 'Layout orientation for grouped controls',
})

// ---------------------------------------------------------------------------
// Date picker mode
// ---------------------------------------------------------------------------

/**
 * Date picker selection mode
 */
export const DatePickerModeSchema = Schema.Literal('single', 'range').annotations({
  title: 'Date Picker Mode',
  description: 'Whether to select a single date or a date range',
})

// ---------------------------------------------------------------------------
// Input type schema
// ---------------------------------------------------------------------------

/**
 * HTML input type variants
 */
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

// ---------------------------------------------------------------------------
// Skeleton variant
// ---------------------------------------------------------------------------

/**
 * Skeleton loading placeholder shape variant
 */
export const SkeletonVariantSchema = Schema.Literal('text', 'circular', 'rectangular').annotations({
  title: 'Skeleton Variant',
  description: 'Shape variant for skeleton loading placeholder',
})

// ---------------------------------------------------------------------------
// Drawer/Sheet schemas
// ---------------------------------------------------------------------------

/**
 * Drawer slide-in side
 */
export const DrawerSideSchema = Schema.Literal('left', 'right', 'top', 'bottom').annotations({
  title: 'Drawer Side',
  description: 'Edge of the screen the drawer slides in from',
})

/**
 * Drawer size preset
 */
export const DrawerSizeSchema = Schema.Literal('sm', 'md', 'lg', 'full').annotations({
  title: 'Drawer Size',
  description: 'Width/height preset for the drawer panel',
})

// ---------------------------------------------------------------------------
// Carousel schemas
// ---------------------------------------------------------------------------

/**
 * Carousel scroll orientation
 */
export const CarouselOrientationSchema = Schema.Literal('horizontal', 'vertical').annotations({
  title: 'Carousel Orientation',
  description: 'Scroll direction for the carousel',
})

// ---------------------------------------------------------------------------
// Resizable schemas
// ---------------------------------------------------------------------------

/**
 * Resizable panel direction
 */
export const ResizableDirectionSchema = Schema.Literal('horizontal', 'vertical').annotations({
  title: 'Resizable Direction',
  description: 'Direction of the resizable panel layout',
})

// ---------------------------------------------------------------------------
// Scroll area orientation
// ---------------------------------------------------------------------------

/**
 * Scroll area orientation
 */
export const ScrollOrientationSchema = Schema.Literal('vertical', 'horizontal', 'both').annotations(
  {
    title: 'Scroll Orientation',
    description: 'Which axis the scroll area scrolls on',
  }
)

// ---------------------------------------------------------------------------
// Accordion type
// ---------------------------------------------------------------------------

/**
 * Accordion expansion behavior
 */
export const AccordionTypeSchema = Schema.Literal('single', 'multiple').annotations({
  title: 'Accordion Type',
  description: 'Whether only one item or multiple items can be open simultaneously',
})

// ---------------------------------------------------------------------------
// Tabs orientation
// ---------------------------------------------------------------------------

/**
 * Tabs orientation
 */
export const TabsOrientationSchema = Schema.Literal('horizontal', 'vertical').annotations({
  title: 'Tabs Orientation',
  description: 'Layout direction of the tab triggers',
})

// ---------------------------------------------------------------------------
// Toggle type (for toggle-group)
// ---------------------------------------------------------------------------

/**
 * Toggle group selection behavior
 */
export const ToggleTypeSchema = Schema.Literal('single', 'multiple').annotations({
  title: 'Toggle Type',
  description: 'Whether single or multiple toggles can be active simultaneously',
})

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

/** @public */
export type Options = Schema.Schema.Type<typeof OptionsSchema>
/** @public */
export type Orientation = Schema.Schema.Type<typeof OrientationSchema>
/** @public */
export type DatePickerMode = Schema.Schema.Type<typeof DatePickerModeSchema>
/** @public */
export type InputType = Schema.Schema.Type<typeof InputTypeSchema>
/** @public */
export type SkeletonVariant = Schema.Schema.Type<typeof SkeletonVariantSchema>
/** @public */
export type DrawerSide = Schema.Schema.Type<typeof DrawerSideSchema>
/** @public */
export type DrawerSize = Schema.Schema.Type<typeof DrawerSizeSchema>
/** @public */
export type CarouselOrientation = Schema.Schema.Type<typeof CarouselOrientationSchema>
/** @public */
export type ResizableDirection = Schema.Schema.Type<typeof ResizableDirectionSchema>
/** @public */
export type ScrollOrientation = Schema.Schema.Type<typeof ScrollOrientationSchema>
/** @public */
export type AccordionType = Schema.Schema.Type<typeof AccordionTypeSchema>
/** @public */
export type TabsOrientation = Schema.Schema.Type<typeof TabsOrientationSchema>
/** @public */
export type ToggleType = Schema.Schema.Type<typeof ToggleTypeSchema>
