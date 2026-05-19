/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { ActionSchema } from './action'


export const optStr = (description: string) =>
  Schema.optional(Schema.String.annotations({ description }))

export const optBool = (description: string) =>
  Schema.optional(Schema.Boolean.annotations({ description }))


export const ComponentSizeSchema = Schema.Literal('sm', 'md', 'lg').annotations({
  title: 'Component Size',
  description: 'Standard size variant for UI components',
})


export const OptionItemSchema = Schema.Struct({
  label: Schema.String.annotations({
    description: 'Display text shown to the user',
  }),
  value: Schema.String.annotations({
    description: 'Value stored when this option is selected',
  }),
  disabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, option cannot be selected',
    })
  ),
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Lucide icon name to display next to the option label',
    })
  ),
}).annotations({
  title: 'Option Item',
  description: 'A single option in a selection-based form control',
})


export const MenuItemSchema = Schema.Struct({
  label: Schema.optional(
    Schema.String.annotations({
      description: 'Display text for the menu item (omit for separator)',
    })
  ),
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Lucide icon name displayed next to the label',
    })
  ),
  action: Schema.optional(ActionSchema),
  shortcut: Schema.optional(
    Schema.String.annotations({
      description: 'Keyboard shortcut hint displayed on the right (e.g. "Ctrl+C")',
    })
  ),
  disabled: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, item is visible but cannot be clicked',
    })
  ),
  separator: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, renders a divider line instead of a clickable item',
    })
  ),
  variant: Schema.optional(
    Schema.Literal('default', 'destructive').annotations({
      description: 'Visual style variant (destructive shows red text)',
    })
  ),
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


export const NavItemSchema = Schema.Struct({
  label: Schema.String.annotations({
    description: 'Display text for the navigation item',
  }),
  href: Schema.optional(
    Schema.String.annotations({
      description: 'URL or route path (omit for parent items with children)',
    })
  ),
  description: Schema.optional(
    Schema.String.annotations({
      description: 'Description text displayed below the label in mega-menu style',
    })
  ),
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Lucide icon name displayed next to the label',
    })
  ),
  target: Schema.optional(
    Schema.Literal('_self', '_blank', '_parent', '_top').annotations({
      description: 'Anchor target — typically "_blank" for external links',
    })
  ),
  rel: Schema.optional(
    Schema.String.annotations({
      description: 'Anchor rel attribute, commonly "noopener noreferrer" with target=_blank',
    })
  ),
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


export const BreadcrumbItemSchema = Schema.Struct({
  label: Schema.String.annotations({
    description: 'Display text for the breadcrumb segment',
  }),
  href: Schema.optional(
    Schema.String.annotations({
      description: 'URL or route path (omit for the current page item)',
    })
  ),
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Lucide icon name displayed before the label',
    })
  ),
}).annotations({
  title: 'Breadcrumb Item',
  description: 'A single segment in a breadcrumb trail',
})


export const CommandItemSchema = Schema.Struct({
  label: Schema.String.annotations({
    description: 'Display text for the command',
  }),
  icon: Schema.optional(
    Schema.String.annotations({
      description: 'Lucide icon name displayed before the label',
    })
  ),
  shortcut: Schema.optional(
    Schema.String.annotations({
      description: 'Keyboard shortcut hint (e.g. "Ctrl+K")',
    })
  ),
  action: Schema.optional(ActionSchema),
}).annotations({
  title: 'Command Item',
  description: 'A single command in a command palette group',
})

export const CommandGroupSchema = Schema.Struct({
  heading: Schema.optional(
    Schema.String.annotations({
      description: 'Group heading text displayed above the items',
    })
  ),
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

export const BadgeVariantSchema = Schema.Literal(
  'default',
  'secondary',
  'destructive',
  'outline'
).annotations({
  title: 'Badge Variant',
  description: 'Visual style variant for badge components',
})

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


export const TagItemSchema = Schema.Struct({
  label: Schema.String.annotations({
    description: 'Display text for the tag',
  }),
  color: Schema.optional(
    Schema.String.annotations({
      description: 'Color for the tag background (CSS color or theme token name)',
    })
  ),
  removable: Schema.optional(
    Schema.Boolean.annotations({
      description: 'If true, shows a remove button on the tag',
    })
  ),
}).annotations({
  title: 'Tag Item',
  description: 'A single tag/chip in a tags component',
})


export const AvatarItemSchema = Schema.Struct({
  src: Schema.String.annotations({
    description: 'URL to the avatar image',
  }),
  alt: Schema.String.annotations({
    description: 'Alt text for the avatar image (screen reader accessible)',
  }),
  fallback: Schema.optional(
    Schema.String.annotations({
      description: 'Fallback text (e.g. initials) when the image cannot be loaded',
    })
  ),
}).annotations({
  title: 'Avatar Item',
  description: 'A single avatar in an avatar group',
})


export const TimeFormatSchema = Schema.Literal('12h', '24h').annotations({
  title: 'Time Format',
  description: 'Time display format (12-hour with AM/PM or 24-hour)',
})


export const ProgressVariantSchema = Schema.Literal('bar', 'circle').annotations({
  title: 'Progress Variant',
  description: 'Visual variant for the progress component (linear bar or circular)',
})


export const FloatingSideSchema = Schema.Literal('top', 'right', 'bottom', 'left').annotations({
  title: 'Floating Side',
  description: 'Preferred side to place the floating element relative to trigger',
})

export const FloatingAlignSchema = Schema.Literal('start', 'center', 'end').annotations({
  title: 'Floating Align',
  description: 'Alignment of the floating element along the side axis',
})


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

export type AggregateFunction = Schema.Schema.Type<typeof AggregateFunctionSchema>


export type ComponentSize = Schema.Schema.Type<typeof ComponentSizeSchema>
export type OptionItem = Schema.Schema.Type<typeof OptionItemSchema>
export type MenuItem = Schema.Schema.Type<typeof MenuItemSchema>
export type NavItem = Schema.Schema.Type<typeof NavItemSchema>
export type BreadcrumbItem = Schema.Schema.Type<typeof BreadcrumbItemSchema>
export type CommandItem = Schema.Schema.Type<typeof CommandItemSchema>
export type CommandGroup = Schema.Schema.Type<typeof CommandGroupSchema>
export type ButtonVariant = Schema.Schema.Type<typeof ButtonVariantSchema>
export type BadgeVariant = Schema.Schema.Type<typeof BadgeVariantSchema>
export type AlertVariant = Schema.Schema.Type<typeof AlertVariantSchema>
export type FloatingSide = Schema.Schema.Type<typeof FloatingSideSchema>
export type FloatingAlign = Schema.Schema.Type<typeof FloatingAlignSchema>
export type TagItem = Schema.Schema.Type<typeof TagItemSchema>
export type AvatarItem = Schema.Schema.Type<typeof AvatarItemSchema>
export type TimeFormat = Schema.Schema.Type<typeof TimeFormatSchema>
export type ProgressVariant = Schema.Schema.Type<typeof ProgressVariantSchema>
