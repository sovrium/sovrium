/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from './action'

// ---------------------------------------------------------------------------
// Optional-field helpers (described primitives)
// ---------------------------------------------------------------------------

/**
 * Optional `Schema.String` annotated with a `description`.
 *
 * Shorthand for the very common pattern across component schemas:
 *
 * ```ts
 * Schema.optional(Schema.String.annotations({ description: 'Field label' }))
 * ```
 *
 * Use when the field has no other annotations (no title, no examples,
 * no validation pipes). For richer annotations, expand to the full form.
 */
export const optStr = (description: string) =>
  Schema.optional(Schema.String.annotations({ description }))

/**
 * Optional `Schema.Boolean` annotated with a `description`.
 *
 * Shorthand for the very common pattern across component schemas:
 *
 * ```ts
 * Schema.optional(Schema.Boolean.annotations({ description: 'Toggle X' }))
 * ```
 *
 * Use when the field has no other annotations (no title, no examples,
 * no validation pipes). For richer annotations, expand to the full form.
 */
export const optBool = (description: string) =>
  Schema.optional(Schema.Boolean.annotations({ description }))

// ---------------------------------------------------------------------------
// Size schema (reused by button, switch, progress, toggle, slider)
// ---------------------------------------------------------------------------

/**
 * Standard size options for UI components
 */
export const ComponentSizeSchema = Schema.Literal('sm', 'md', 'lg').annotations({
  title: 'Component Size',
  description: 'Standard size variant for UI components',
})

// ---------------------------------------------------------------------------
// Option item schema (reused by select, radio-group, combobox)
// ---------------------------------------------------------------------------

/**
 * Option item for selection-based form controls
 *
 * @example
 * ```yaml
 * options:
 *   - label: Active
 *     value: active
 *   - label: Inactive
 *     value: inactive
 *     disabled: true
 *   - label: Pending
 *     value: pending
 *     icon: clock
 * ```
 */
export const OptionItemSchema = Schema.Struct({
  /** Display text for the option */
  label: Schema.String.annotations({
    description: 'Display text shown to the user',
  }),
  /** Value submitted when option is selected */
  value: Schema.String.annotations({
    description: 'Value stored when this option is selected',
  }),
  /** Whether this option is disabled */
  disabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, option cannot be selected',
    })
  ),
  /** Lucide icon name displayed alongside the option */
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Lucide icon name to display next to the option label',
    })
  ),
}).annotations({
  title: 'Option Item',
  description: 'A single option in a selection-based form control',
})

// ---------------------------------------------------------------------------
// Menu item schema (reused by dropdown-menu, context-menu, menubar)
// ---------------------------------------------------------------------------

/**
 * Menu item for contextual menus and menubars
 *
 * Supports nested sub-menus via recursive `children`, separator dividers,
 * keyboard shortcuts, and action triggers.
 *
 * @example
 * ```yaml
 * menuItems:
 *   - label: Edit
 *     icon: pencil
 *     action:
 *       type: navigate
 *       path: /edit/$record.id
 *   - separator: true
 *   - label: Delete
 *     icon: trash
 *     variant: destructive
 *     action:
 *       type: crud
 *       operation: delete
 * ```
 */
export const MenuItemSchema = Schema.Struct({
  /** Display text for the menu item */
  label: Schema.optional(
    Schema.String.annotations({
      description: 'Display text for the menu item (omit for separator)',
    })
  ),
  /** Lucide icon name displayed alongside the item */
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Lucide icon name displayed next to the label',
    })
  ),
  /** Action triggered when the item is clicked */
  action: Schema.optional(ActionSchema),
  /** Keyboard shortcut hint text */
  shortcut: Schema.optional(
    Schema.String.annotations({
      description: 'Keyboard shortcut hint displayed on the right (e.g. "Ctrl+C")',
    })
  ),
  /** Whether this item is disabled */
  disabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, item is visible but cannot be clicked',
    })
  ),
  /** Render as a separator divider instead of a menu item */
  separator: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, renders a divider line instead of a clickable item',
    })
  ),
  /** Visual variant for destructive actions */
  variant: Schema.optional(
    Schema.Literal('default', 'destructive').annotations({
      description: 'Visual style variant (destructive shows red text)',
    })
  ),
  /** Sub-menu items (nested menus) */
  children: Schema.optional(
    Schema.Array(Schema.Record({ key: Schema.String, value: Schema.Unknown })).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Nested sub-menu items',
      })
    )
  ),
}).annotations({
  title: 'Menu Item',
  description: 'A single item in a dropdown menu, context menu, or menubar',
})

// ---------------------------------------------------------------------------
// Nav item schema (reused by navigation-menu, breadcrumb)
// ---------------------------------------------------------------------------

/**
 * Navigation item for navigation menus and breadcrumbs
 *
 * @example
 * ```yaml
 * navItems:
 *   - label: Products
 *     href: /products
 *     icon: package
 *     children:
 *       - label: All Products
 *         href: /products
 *         description: Browse our complete catalog
 *       - label: New Arrivals
 *         href: /products/new
 * ```
 */
export const NavItemSchema = Schema.Struct({
  /** Display text for the navigation item */
  label: Schema.String.annotations({
    description: 'Display text for the navigation item',
  }),
  /** URL or path to navigate to */
  href: Schema.optional(
    Schema.String.annotations({
      description: 'URL or route path (omit for parent items with children)',
    })
  ),
  /** Descriptive text shown in mega-menu layouts */
  description: Schema.optional(
    Schema.String.annotations({
      description: 'Description text displayed below the label in mega-menu style',
    })
  ),
  /** Lucide icon name */
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Lucide icon name displayed next to the label',
    })
  ),
  /** Anchor target attribute (e.g. "_blank" for new tab) */
  target: Schema.optional(
    Schema.Literal('_self', '_blank', '_parent', '_top').annotations({
      description: 'Anchor target — typically "_blank" for external links',
    })
  ),
  /** Anchor rel attribute (e.g. "noopener noreferrer") */
  rel: Schema.optional(
    Schema.String.annotations({
      description: 'Anchor rel attribute, commonly "noopener noreferrer" with target=_blank',
    })
  ),
  /** Child navigation items (for sub-menus or mega-menus) */
  children: Schema.optional(
    Schema.Array(Schema.Record({ key: Schema.String, value: Schema.Unknown })).pipe(
      Schema.minItems(1),
      Schema.annotations({
        description: 'Child navigation items forming a sub-menu or mega-menu',
      })
    )
  ),
}).annotations({
  title: 'Nav Item',
  description: 'A single item in a navigation menu or breadcrumb trail',
})

// ---------------------------------------------------------------------------
// Breadcrumb item schema
// ---------------------------------------------------------------------------

/**
 * Breadcrumb trail item
 *
 * @example
 * ```yaml
 * breadcrumbItems:
 *   - label: Home
 *     href: /
 *     icon: home
 *   - label: Products
 *     href: /products
 *   - label: Widget Pro
 * ```
 */
export const BreadcrumbItemSchema = Schema.Struct({
  /** Display text for the breadcrumb segment */
  label: Schema.String.annotations({
    description: 'Display text for the breadcrumb segment',
  }),
  /** URL to navigate to (omit for current/last item) */
  href: Schema.optional(
    Schema.String.annotations({
      description: 'URL or route path (omit for the current page item)',
    })
  ),
  /** Lucide icon name */
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Lucide icon name displayed before the label',
    })
  ),
}).annotations({
  title: 'Breadcrumb Item',
  description: 'A single segment in a breadcrumb trail',
})

// ---------------------------------------------------------------------------
// Command item schema (for command palette)
// ---------------------------------------------------------------------------

/**
 * Command palette item
 *
 * @example
 * ```yaml
 * commandGroups:
 *   - heading: Navigation
 *     items:
 *       - label: Go to Dashboard
 *         icon: layout-dashboard
 *         shortcut: Ctrl+D
 *         action:
 *           type: navigate
 *           path: /dashboard
 * ```
 */
export const CommandItemSchema = Schema.Struct({
  /** Display text */
  label: Schema.String.annotations({
    description: 'Display text for the command',
  }),
  /** Lucide icon name */
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Lucide icon name displayed before the label',
    })
  ),
  /** Keyboard shortcut hint */
  shortcut: Schema.optional(
    Schema.String.annotations({
      description: 'Keyboard shortcut hint (e.g. "Ctrl+K")',
    })
  ),
  /** Action triggered when the command is selected */
  action: Schema.optional(ActionSchema),
}).annotations({
  title: 'Command Item',
  description: 'A single command in a command palette group',
})

/**
 * Command palette group
 */
export const CommandGroupSchema = Schema.Struct({
  /** Group heading displayed above items */
  heading: Schema.optional(
    Schema.String.annotations({
      description: 'Group heading text displayed above the items',
    })
  ),
  /** Command items in this group */
  items: Schema.Array(CommandItemSchema).pipe(
    Schema.minItems(1),
    Schema.annotations({
      description: 'Command items belonging to this group',
    })
  ),
}).annotations({
  title: 'Command Group',
  description: 'A group of commands in a command palette',
})

// ---------------------------------------------------------------------------
// Button variant schema
// ---------------------------------------------------------------------------

/**
 * Button visual variants matching common design system patterns
 */
export const ButtonVariantSchema = Schema.Literal(
  'default',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link',
  'fab'
).annotations({
  title: 'Button Variant',
  description: 'Visual style variant for button components',
})

/**
 * Badge visual variants
 */
export const BadgeVariantSchema = Schema.Literal(
  'default',
  'secondary',
  'destructive',
  'outline'
).annotations({
  title: 'Badge Variant',
  description: 'Visual style variant for badge components',
})

/**
 * Alert visual variants
 */
export const AlertVariantSchema = Schema.Literal(
  'default',
  'destructive',
  'warning',
  'info',
  'success'
).annotations({
  title: 'Alert Variant',
  description: 'Visual style variant for alert components',
})

// ---------------------------------------------------------------------------
// Tag item schema (reused by tags component)
// ---------------------------------------------------------------------------

/**
 * Tag/chip item for the tags component
 *
 * @example
 * ```yaml
 * tags:
 *   - label: Urgent
 *     color: red
 *     removable: true
 *   - label: Feature
 *     color: blue
 *   - label: v2.0
 * ```
 */
export const TagItemSchema = Schema.Struct({
  /** Display text for the tag */
  label: Schema.String.annotations({
    description: 'Display text for the tag',
  }),
  /** Tag color (CSS color value or theme token) */
  color: Schema.optional(
    Schema.String.annotations({
      description: 'Color for the tag background (CSS color or theme token name)',
    })
  ),
  /** Whether the tag can be removed by the user */
  removable: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, shows a remove button on the tag',
    })
  ),
}).annotations({
  title: 'Tag Item',
  description: 'A single tag/chip in a tags component',
})

// ---------------------------------------------------------------------------
// Avatar item schema (reused by avatar-group component)
// ---------------------------------------------------------------------------

/**
 * Avatar item for the avatar-group component
 *
 * @example
 * ```yaml
 * avatars:
 *   - src: /avatars/alice.jpg
 *     alt: Alice Johnson
 *     fallback: AJ
 *   - src: /avatars/bob.jpg
 *     alt: Bob Smith
 * ```
 */
export const AvatarItemSchema = Schema.Struct({
  /** Image source URL */
  src: Schema.String.annotations({
    description: 'URL to the avatar image',
  }),
  /** Alt text for accessibility */
  alt: Schema.String.annotations({
    description: 'Alt text for the avatar image (screen reader accessible)',
  }),
  /** Fallback text when image fails to load (e.g. initials) */
  fallback: Schema.optional(
    Schema.String.annotations({
      description: 'Fallback text (e.g. initials) when the image cannot be loaded',
    })
  ),
}).annotations({
  title: 'Avatar Item',
  description: 'A single avatar in an avatar group',
})

// ---------------------------------------------------------------------------
// Time format schema (reused by time-picker component)
// ---------------------------------------------------------------------------

/**
 * Time display format
 */
export const TimeFormatSchema = Schema.Literal('12h', '24h').annotations({
  title: 'Time Format',
  description: 'Time display format (12-hour with AM/PM or 24-hour)',
})

// ---------------------------------------------------------------------------
// Progress variant schema (enhancement to existing progress component)
// ---------------------------------------------------------------------------

/**
 * Progress visual variant
 */
export const ProgressVariantSchema = Schema.Literal('bar', 'circle').annotations({
  title: 'Progress Variant',
  description: 'Visual variant for the progress component (linear bar or circular)',
})

// ---------------------------------------------------------------------------
// Positioning schemas (reused by popover, tooltip, hover-card)
// ---------------------------------------------------------------------------

/**
 * Side positioning for floating elements
 */
export const FloatingSideSchema = Schema.Literal('top', 'right', 'bottom', 'left').annotations({
  title: 'Floating Side',
  description: 'Preferred side to place the floating element relative to trigger',
})

/**
 * Alignment for floating elements
 */
export const FloatingAlignSchema = Schema.Literal('start', 'center', 'end').annotations({
  title: 'Floating Align',
  description: 'Alignment of the floating element along the side axis',
})

// ---------------------------------------------------------------------------
// Aggregate function schema (reused by chart, kpi, data-table summary)
// ---------------------------------------------------------------------------

/**
 * Aggregate function for data summarization.
 *
 * Shared across chart axes, KPI metrics, and data-table summary rows.
 * Each consumer re-exports this with a domain-specific name (e.g.
 * `ChartAggregateFunctionSchema`, `KPIAggregateFunctionSchema`,
 * `SummaryFunctionSchema`) to keep public import names stable.
 */
export const AggregateFunctionSchema = Schema.Literal(
  'count',
  'sum',
  'avg',
  'min',
  'max'
).annotations({
  title: 'Aggregate Function',
  description: 'Aggregate function applied to a numeric field (count, sum, avg, min, max)',
})

/** @public */
export type AggregateFunction = Schema.Schema.Type<typeof AggregateFunctionSchema>

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

/** @public */
export type ComponentSize = Schema.Schema.Type<typeof ComponentSizeSchema>
/** @public */
export type OptionItem = Schema.Schema.Type<typeof OptionItemSchema>
/** @public */
export type MenuItem = Schema.Schema.Type<typeof MenuItemSchema>
/** @public */
export type NavItem = Schema.Schema.Type<typeof NavItemSchema>
/** @public */
export type BreadcrumbItem = Schema.Schema.Type<typeof BreadcrumbItemSchema>
/** @public */
export type CommandItem = Schema.Schema.Type<typeof CommandItemSchema>
/** @public */
export type CommandGroup = Schema.Schema.Type<typeof CommandGroupSchema>
/** @public */
export type ButtonVariant = Schema.Schema.Type<typeof ButtonVariantSchema>
/** @public */
export type BadgeVariant = Schema.Schema.Type<typeof BadgeVariantSchema>
/** @public */
export type AlertVariant = Schema.Schema.Type<typeof AlertVariantSchema>
/** @public */
export type FloatingSide = Schema.Schema.Type<typeof FloatingSideSchema>
/** @public */
export type FloatingAlign = Schema.Schema.Type<typeof FloatingAlignSchema>
/** @public */
export type TagItem = Schema.Schema.Type<typeof TagItemSchema>
/** @public */
export type AvatarItem = Schema.Schema.Type<typeof AvatarItemSchema>
/** @public */
export type TimeFormat = Schema.Schema.Type<typeof TimeFormatSchema>
/** @public */
export type ProgressVariant = Schema.Schema.Type<typeof ProgressVariantSchema>
