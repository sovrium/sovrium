# lucide-react - Icon Library

## Overview

**Version**: ^0.575.0
**Purpose**: SVG icon library for React with 1000+ icons, used for config-driven icon rendering
**Usage**: Exactly one file — `src/presentation/ui/sections/renderers/element-renderers/interactive-renderers.tsx`

## Sovrium-Specific Pattern: Dynamic Icon Resolution

Lucide is imported as a namespace (`* as LucideIcons`) and icons are resolved at runtime by kebab-case name from the app schema. This enables schema-defined UI to reference icons without hard-coding React component imports.

### How It Works

```typescript
// App schema defines icons by kebab-case name
{ type: 'icon', props: { name: 'check-circle', size: 24, color: 'currentColor' } }

// interactive-renderers.tsx resolves at runtime:
import * as LucideIcons from 'lucide-react'

function kebabToPascalCase(name: string): string {
  return name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')
}

function resolveLucideIcon(iconName: string | undefined) {
  const component = (LucideIcons as Record<string, unknown>)[kebabToPascalCase(iconName)]
  // Lucide icons use forwardRef — they are objects (typeof === 'object'), not plain functions
  if (typeof component === 'function') return component
  if (typeof component === 'object' && component !== null) return component
  return undefined
}
```

### Icon Element Props

| Prop          | Type     | Default          | Description                                       |
| ------------- | -------- | ---------------- | ------------------------------------------------- |
| `name`        | `string` | required         | Kebab-case Lucide icon name (e.g. `check-circle`) |
| `size`        | `number` | `24`             | SVG width/height in pixels                        |
| `color`       | `string` | `'currentColor'` | SVG stroke color                                  |
| `strokeWidth` | `number` | `2`              | SVG stroke width                                  |
| `ariaLabel`   | `string` | —                | Accessible label; if set, adds `role="img"`       |
| `className`   | `string` | —                | CSS classes forwarded to the SVG element          |

### Fallback Behavior

If the icon name does not match any Lucide component, `renderIcon` renders an empty `<svg>` placeholder with `data-testid="icon-{name}"`. This prevents render errors from unknown icon names.

### Accessibility

- Without `ariaLabel`: renders with `aria-hidden="true"` (decorative icon)
- With `ariaLabel`: renders with `role="img"` and `aria-label="{value}"` (meaningful icon)

## Finding Valid Icon Names

Lucide icon names in the app schema use **kebab-case** matching Lucide's naming convention:

| Kebab-case (schema) | PascalCase (component) |
| ------------------- | ---------------------- |
| `check-circle`      | `CheckCircle`          |
| `arrow-right`       | `ArrowRight`           |
| `x`                 | `X`                    |
| `settings`          | `Settings`             |
| `user`              | `User`                 |

Full icon reference: https://lucide.dev/icons/

## Integration

- **App Schema**: Icons are defined in `src/domain/models/app/page/sections.ts` as `type: 'icon'` elements
- **Rendering**: `renderIcon()` is called by `src/presentation/ui/sections/renderers/element-renderers.ts`
- **Testing**: Unknown icons render a `<svg data-testid="icon-{name}">` fallback — use this in test assertions

## Best Practices

1. **Use kebab-case names in app schema** — matches Lucide's URL naming, converts to PascalCase automatically
2. **Set `ariaLabel` for meaningful icons** — decorative icons default to `aria-hidden="true"`
3. **Verify icon names at https://lucide.dev/icons/** before using in schema config
4. **Do NOT import individual icons** — the namespace import enables runtime resolution; individual imports would require code changes per icon

## References

- Lucide icons browser: https://lucide.dev/icons/
- lucide-react GitHub: https://github.com/lucide-icons/lucide
