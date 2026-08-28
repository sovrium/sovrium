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
 * Schema.optional(Schema.String.annotate({ description: 'Field label' }))
 * ```
 *
 * Use when the field has no other annotations (no title, no examples,
 * no validation pipes). For richer annotations, expand to the full form.
 */
export const optStr = (description: string) =>
  Schema.optional(Schema.String.annotate({ description }))

/**
 * Optional `Schema.Boolean` annotated with a `description`.
 *
 * Shorthand for the very common pattern across component schemas:
 *
 * ```ts
 * Schema.optional(Schema.Boolean.annotate({ description: 'Toggle X' }))
 * ```
 *
 * Use when the field has no other annotations (no title, no examples,
 * no validation pipes). For richer annotations, expand to the full form.
 */
export const optBool = (description: string) =>
  Schema.optional(Schema.Boolean.annotate({ description }))

// ---------------------------------------------------------------------------
// Size schema (reused by button, switch, progress, toggle, slider)
// ---------------------------------------------------------------------------

/**
 * Standard size options for UI components
 */
export const ComponentSizeSchema = Schema.Literals(['sm', 'md', 'lg']).annotate({
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
  label: Schema.String.annotate({
    description: 'Display text shown to the user',
  }),
  /** Value submitted when option is selected */
  value: Schema.String.annotate({
    description: 'Value stored when this option is selected',
  }),
  /** Whether this option is disabled */
  disabled: Schema.optional(
    Schema.Boolean.annotate({
      description: 'If true, option cannot be selected',
    })
  ),
  /** Lucide icon name displayed alongside the option */
  icon: Schema.optional(
    Schema.String.annotate({
      description: 'Lucide icon name to display next to the option label',
    })
  ),
}).annotate({
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
    Schema.String.annotate({
      description: 'Display text for the menu item (omit for separator)',
    })
  ),
  /** Lucide icon name displayed alongside the item */
  icon: Schema.optional(
    Schema.String.annotate({
      description: 'Lucide icon name displayed next to the label',
    })
  ),
  /** Action triggered when the item is clicked */
  action: Schema.optional(ActionSchema),
  /** Keyboard shortcut hint text */
  shortcut: Schema.optional(
    Schema.String.annotate({
      description: 'Keyboard shortcut hint displayed on the right (e.g. "Ctrl+C")',
    })
  ),
  /** Whether this item is disabled */
  disabled: Schema.optional(
    Schema.Boolean.annotate({
      description: 'If true, item is visible but cannot be clicked',
    })
  ),
  /** Render as a separator divider instead of a menu item */
  separator: Schema.optional(
    Schema.Boolean.annotate({
      description: 'If true, renders a divider line instead of a clickable item',
    })
  ),
  /** Visual variant for destructive actions */
  variant: Schema.optional(
    Schema.Literals(['default', 'destructive']).annotate({
      description: 'Visual style variant (destructive shows red text)',
    })
  ),
  /** Sub-menu items (nested menus) */
  children: Schema.optional(
    Schema.Array(Schema.Record(Schema.String, Schema.Unknown)).pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        description: 'Nested sub-menu items',
      })
    )
  ),
}).annotate({
  title: 'Menu Item',
  description: 'A single item in a dropdown menu, context menu, or menubar',
})

/**
 * Badge visual variants
 *
 * Declared here (above `NavItemSchema`) rather than beside the other variant
 * literals lower in the file because `NavItemSchema.badge` references it at
 * module-eval time — a later `const` would land in the temporal dead zone.
 */
export const BadgeVariantSchema = Schema.Literals([
  'default',
  'secondary',
  'destructive',
  'outline',
]).annotate({
  title: 'Badge Variant',
  description: 'Visual style variant for badge components',
})

// ---------------------------------------------------------------------------
// Nav item schema (reused by navigation-menu, breadcrumb)
// ---------------------------------------------------------------------------

/**
 * A single navigation item.
 *
 * Declared as an explicit interface so `children` can reference `NavItem`
 * recursively (a nav item's children are themselves nav items), which lets the
 * generated JSON Schema document child-level fields — including `badge` — via a
 * `$defs/NavItem` entry instead of an opaque record.
 */
export interface NavItem {
  readonly label: string
  readonly href?: string
  readonly description?: string
  readonly icon?: string
  readonly target?: '_self' | '_blank' | '_parent' | '_top'
  readonly rel?: string
  readonly badge?: {
    readonly text: string
    readonly variant?: BadgeVariant
  }
  readonly children?: readonly NavItem[]
}

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
 *         badge:
 *           text: New
 *           variant: secondary
 * ```
 */
export const NavItemSchema: Schema.Codec<NavItem> = Schema.Struct({
  /** Display text for the navigation item */
  label: Schema.String.annotate({
    description: 'Display text for the navigation item',
  }),
  /** URL or path to navigate to */
  href: Schema.optional(
    Schema.String.annotate({
      description: 'URL or route path (omit for parent items with children)',
    })
  ),
  /** Descriptive text shown in mega-menu layouts */
  description: Schema.optional(
    Schema.String.annotate({
      description: 'Description text displayed below the label in mega-menu style',
    })
  ),
  /** Lucide icon name */
  icon: Schema.optional(
    Schema.String.annotate({
      description: 'Lucide icon name displayed next to the label',
    })
  ),
  /** Anchor target attribute (e.g. "_blank" for new tab) */
  target: Schema.optional(
    Schema.Literals(['_self', '_blank', '_parent', '_top']).annotate({
      description: 'Anchor target — typically "_blank" for external links',
    })
  ),
  /** Anchor rel attribute (e.g. "noopener noreferrer") */
  rel: Schema.optional(
    Schema.String.annotate({
      description: 'Anchor rel attribute, commonly "noopener noreferrer" with target=_blank',
    })
  ),
  /**
   * Optional pill rendered next to the item label (e.g. "New", "Beta"),
   * reusing the shared badge variant tones.
   */
  badge: Schema.optional(
    Schema.Struct({
      text: Schema.String.annotate({
        description: 'Short pill text rendered next to the item label (e.g. "New", "Beta")',
      }),
      variant: Schema.optional(BadgeVariantSchema),
    }).annotate({
      title: 'Nav Item Badge',
      description:
        'Optional pill rendered next to the navigation item label, reusing the badge variant tones',
    })
  ),
  /** Child navigation items (for sub-menus or mega-menus) */
  children: Schema.optional(
    Schema.Array(Schema.suspend((): Schema.Codec<NavItem> => NavItemSchema)).pipe(
      Schema.check(Schema.isMinLength(1)),
      Schema.annotate({
        description: 'Child navigation items forming a sub-menu or mega-menu',
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'NavItem',
    title: 'Nav Item',
    description: 'A single item in a navigation menu or breadcrumb trail',
  })
)

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
  label: Schema.String.annotate({
    description: 'Display text for the breadcrumb segment',
  }),
  /** URL to navigate to (omit for current/last item) */
  href: Schema.optional(
    Schema.String.annotate({
      description: 'URL or route path (omit for the current page item)',
    })
  ),
  /** Lucide icon name */
  icon: Schema.optional(
    Schema.String.annotate({
      description: 'Lucide icon name displayed before the label',
    })
  ),
}).annotate({
  title: 'Breadcrumb Item',
  description: 'A single segment in a breadcrumb trail',
})

// ---------------------------------------------------------------------------
// Button variant schema
// ---------------------------------------------------------------------------

/**
 * Button visual variants matching common design system patterns
 */
export const ButtonVariantSchema = Schema.Literals([
  'default',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link',
  'fab',
]).annotate({
  title: 'Button Variant',
  description: 'Visual style variant for button components',
})

/**
 * Alert visual variants
 */
export const AlertVariantSchema = Schema.Literals([
  'default',
  'destructive',
  'warning',
  'info',
  'success',
]).annotate({
  title: 'Alert Variant',
  description: 'Visual style variant for alert components',
})

// ---------------------------------------------------------------------------
// Tag item schema (reused by tags component)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Time format schema (reused by time-picker component)
// ---------------------------------------------------------------------------

/**
 * Time display format
 */
export const TimeFormatSchema = Schema.Literals(['12h', '24h']).annotate({
  title: 'Time Format',
  description: 'Time display format (12-hour with AM/PM or 24-hour)',
})

// ---------------------------------------------------------------------------
// Progress variant schema (enhancement to existing progress component)
// ---------------------------------------------------------------------------

/**
 * Progress visual variant
 */
export const ProgressVariantSchema = Schema.Literals(['bar', 'circle']).annotate({
  title: 'Progress Variant',
  description: 'Visual variant for the progress component (linear bar or circular)',
})

// ---------------------------------------------------------------------------
// Positioning schemas (reused by popover, tooltip, hover-card)
// ---------------------------------------------------------------------------

/**
 * Side positioning for floating elements
 */
export const FloatingSideSchema = Schema.Literals(['top', 'right', 'bottom', 'left']).annotate({
  title: 'Floating Side',
  description: 'Preferred side to place the floating element relative to trigger',
})

/**
 * Alignment for floating elements
 */
export const FloatingAlignSchema = Schema.Literals(['start', 'center', 'end']).annotate({
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
export const AggregateFunctionSchema = Schema.Literals([
  'count',
  'sum',
  'avg',
  'min',
  'max',
]).annotate({
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
/**
 * @public
 * `NavItem` is declared as an explicit `interface` beside `NavItemSchema`
 * (required for the recursive `children` self-reference), so it is not
 * re-derived here — the interface IS the exported type.
 */
export type BreadcrumbItem = Schema.Schema.Type<typeof BreadcrumbItemSchema>
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
export type TimeFormat = Schema.Schema.Type<typeof TimeFormatSchema>
/** @public */
export type ProgressVariant = Schema.Schema.Type<typeof ProgressVariantSchema>
