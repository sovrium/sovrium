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
  Schema.check(Schema.isMinLength(1)),
  Schema.annotate({
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
export const OrientationSchema = Schema.Literals(['horizontal', 'vertical']).annotate({
  title: 'Orientation',
  description: 'Layout orientation for grouped controls',
})

// ---------------------------------------------------------------------------
// Date picker mode
// ---------------------------------------------------------------------------

/**
 * Date picker selection mode
 */
export const DatePickerModeSchema = Schema.Literals(['single', 'range']).annotate({
  title: 'Date Picker Mode',
  description: 'Whether to select a single date or a date range',
})

// ---------------------------------------------------------------------------
// Input type schema
// ---------------------------------------------------------------------------

/**
 * HTML input type variants
 */
export const InputTypeSchema = Schema.Literals([
  'text',
  'email',
  'password',
  'number',
  'tel',
  'url',
  'search',
  // Maps to `autocomplete="one-time-code"` and a numeric inputmode, which is
  // what lets a phone offer the code from the SMS or mail it just received.
  // The server half has shipped since the emailOTP plugin landed; this is the
  // control that was missing, and it is an input TYPE rather than a component
  // type because that is all it is.
  'one-time-code',
]).annotate({
  title: 'Input Type',
  description:
    'HTML input type attribute for the input component. `one-time-code` renders a verification-code entry that a device can autofill.',
})

// ---------------------------------------------------------------------------
// Skeleton variant
// ---------------------------------------------------------------------------

/**
 * Skeleton loading placeholder shape variant
 */
export const SkeletonVariantSchema = Schema.Literals(['text', 'circular', 'rectangular']).annotate({
  title: 'Skeleton Variant',
  description: 'Shape variant for skeleton loading placeholder',
})

// ---------------------------------------------------------------------------
// Drawer/Sheet schemas
// ---------------------------------------------------------------------------

/**
 * Drawer slide-in side
 */
export const DrawerSideSchema = Schema.Literals(['left', 'right', 'top', 'bottom']).annotate({
  title: 'Drawer Side',
  description: 'Edge of the screen the drawer slides in from',
})

/**
 * Drawer size preset
 */
export const DrawerSizeSchema = Schema.Literals(['sm', 'md', 'lg', 'full']).annotate({
  title: 'Drawer Size',
  description: 'Width/height preset for the drawer panel',
})

// ---------------------------------------------------------------------------
// Scroll area orientation
// ---------------------------------------------------------------------------

/**
 * Scroll area orientation
 */
export const ScrollOrientationSchema = Schema.Literals(['vertical', 'horizontal', 'both']).annotate(
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
export const AccordionTypeSchema = Schema.Literals(['single', 'multiple']).annotate({
  title: 'Accordion Type',
  description: 'Whether only one item or multiple items can be open simultaneously',
})

// ---------------------------------------------------------------------------
// Tabs orientation
// ---------------------------------------------------------------------------

/**
 * Tabs orientation
 */
export const TabsOrientationSchema = Schema.Literals(['horizontal', 'vertical']).annotate({
  title: 'Tabs Orientation',
  description: 'Layout direction of the tab triggers',
})

// ---------------------------------------------------------------------------
// Toggle type (for toggle-group)
// ---------------------------------------------------------------------------

/**
 * Toggle group selection behavior
 */
export const ToggleTypeSchema = Schema.Literals(['single', 'multiple']).annotate({
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
export type ScrollOrientation = Schema.Schema.Type<typeof ScrollOrientationSchema>
/** @public */
export type AccordionType = Schema.Schema.Type<typeof AccordionTypeSchema>
/** @public */
export type TabsOrientation = Schema.Schema.Type<typeof TabsOrientationSchema>
/** @public */
export type ToggleType = Schema.Schema.Type<typeof ToggleTypeSchema>
