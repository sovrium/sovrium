# Lucide React - Icon Library

## Overview

**Version**: ^0.562.0
**Purpose**: Beautiful, consistent, open-source icon library for React applications
**Layer**: Presentation (React components only)

Lucide is a fork of Feather Icons, providing a comprehensive set of well-designed SVG icons as React components. Each icon is optimized for clarity at small sizes and includes full TypeScript support.

## Why Lucide for Sovrium

- **React Components**: Icons are native React components with proper typing
- **Tree-Shakable**: Only imports icons you actually use (optimal bundle size)
- **Customizable**: Easily adjust size, color, stroke width via props
- **Consistent Design**: All icons follow the same design language
- **Active Development**: Regular updates with new icons
- **TypeScript Native**: Full type definitions for all icons and props
- **Accessible**: Includes proper ARIA attributes by default
- **Lightweight**: Each icon is just an SVG wrapped in a React component

## Installation

Lucide React is already installed in Sovrium:

```json
{
  "dependencies": {
    "lucide-react": "^0.562.0"
  }
}
```

## Usage in Sovrium

### Current Implementation

Lucide icons are used via a centralized Icon component:

**Location**: `src/presentation/components/ui/icon.tsx`

```typescript
import { Download, ArrowRight, Rocket, ExternalLink, Package, type LucideProps } from 'lucide-react'
import type { ReactElement } from 'react'

interface IconProps extends LucideProps {
  name: string
}

const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  download: Download,
  'arrow-right': ArrowRight,
  rocket: Rocket,
  'external-link': ExternalLink,
  package: Package,
}

export function Icon({ name, ...props }: Readonly<IconProps>): Readonly<ReactElement | undefined> {
  const IconComponent = iconMap[name]

  if (!IconComponent) {
    return undefined
  }

  return (
    <IconComponent
      data-testid="icon"
      {...props}
    />
  )
}
```

### Using the Icon Component

```typescript
import { Icon } from '@/presentation/components/ui/icon'

// Basic usage
<Icon name="download" />

// With custom size
<Icon name="arrow-right" size={24} />

// With custom color
<Icon name="rocket" color="#3b82f6" />

// With Tailwind classes
<Icon name="external-link" className="h-5 w-5 text-blue-600" />
```

### Direct Import (Alternative)

For components that use specific icons frequently:

```typescript
import { Download, ArrowRight, Check, X } from 'lucide-react'

function ActionButtons() {
  return (
    <div className="flex gap-2">
      <button>
        <Download className="h-4 w-4 mr-2" />
        Download
      </button>
      <button>
        Continue
        <ArrowRight className="h-4 w-4 ml-2" />
      </button>
    </div>
  )
}
```

## Icon Props (LucideProps)

All Lucide icons accept these props:

| Prop                  | Type               | Default        | Description                                   |
| --------------------- | ------------------ | -------------- | --------------------------------------------- |
| `size`                | `number \| string` | `24`           | Icon size (width and height)                  |
| `color`               | `string`           | `currentColor` | Icon stroke color                             |
| `strokeWidth`         | `number`           | `2`            | Width of the icon strokes                     |
| `absoluteStrokeWidth` | `boolean`          | `false`        | Keep stroke width constant regardless of size |
| `className`           | `string`           | -              | CSS classes (Tailwind supported)              |

### Examples

```typescript
import { Settings, User, Mail } from 'lucide-react'

// Default size (24x24)
<Settings />

// Custom size
<Settings size={32} />
<Settings size="2rem" />

// Custom color
<User color="#6366f1" />

// Custom stroke width
<Mail strokeWidth={1.5} />

// With Tailwind classes
<Settings className="h-6 w-6 text-gray-500 hover:text-gray-700" />
```

## Adding New Icons

When you need a new icon, add it to the icon map:

```typescript
// src/presentation/components/ui/icon.tsx
import {
  Download,
  ArrowRight,
  Rocket,
  ExternalLink,
  Package,
  // Add new imports here
  Settings,
  User,
  Mail,
  type LucideProps,
} from 'lucide-react'

const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  download: Download,
  'arrow-right': ArrowRight,
  rocket: Rocket,
  'external-link': ExternalLink,
  package: Package,
  // Add new mappings here
  settings: Settings,
  user: User,
  mail: Mail,
}
```

## Available Icons

Lucide provides 1500+ icons. Browse the full catalog at: https://lucide.dev/icons

**Common Categories**:

- **Arrows**: ArrowRight, ArrowLeft, ChevronDown, ChevronUp
- **Actions**: Download, Upload, Edit, Trash, Copy, Save
- **UI Elements**: Menu, X, Check, Plus, Minus, Search
- **Communication**: Mail, MessageSquare, Phone, Send
- **Media**: Play, Pause, Volume, Image, Video
- **Social**: Github, Twitter, Linkedin, Facebook
- **Files**: File, Folder, FileText, Archive
- **Users**: User, Users, UserPlus, UserMinus

## Best Practices

### 1. Use the Icon Component for Dynamic Icons

```typescript
// ✅ CORRECT: Use Icon component when icon name comes from data
function MenuItem({ icon, label }: { icon: string; label: string }) {
  return (
    <button>
      <Icon name={icon} className="h-4 w-4 mr-2" />
      {label}
    </button>
  )
}
```

### 2. Direct Import for Static Icons

```typescript
// ✅ CORRECT: Direct import when icon is known at compile time
import { Check, X } from 'lucide-react'

function SuccessMessage() {
  return (
    <div className="flex items-center text-green-600">
      <Check className="h-5 w-5 mr-2" />
      Success!
    </div>
  )
}
```

### 3. Use Tailwind for Sizing and Colors

```typescript
// ✅ PREFERRED: Tailwind classes for consistent styling
<Icon name="settings" className="h-5 w-5 text-gray-600" />

// Also valid: Lucide props
<Icon name="settings" size={20} color="#4b5563" />
```

### 4. Accessibility

```typescript
// Add aria-label for meaningful icons
<button aria-label="Download file">
  <Download className="h-5 w-5" />
</button>

// Hide decorative icons from screen readers
<span aria-hidden="true">
  <Check className="h-5 w-5 text-green-600" />
</span>
<span>Success</span>
```

## Bundle Size Optimization

Lucide is tree-shakable. Only icons you import are included in the bundle:

```typescript
// ✅ CORRECT: Named imports (tree-shakable)
import { Download, ArrowRight } from 'lucide-react'

// ❌ AVOID: Importing all icons (huge bundle)
import * as Icons from 'lucide-react'
```

## Integration with Tailwind

Lucide icons work seamlessly with Tailwind CSS:

```typescript
// Size with Tailwind
<Download className="h-4 w-4" />  // 16x16
<Download className="h-5 w-5" />  // 20x20
<Download className="h-6 w-6" />  // 24x24

// Color with Tailwind
<Download className="text-blue-600" />
<Download className="text-gray-400 hover:text-gray-600" />

// Responsive
<Download className="h-4 w-4 md:h-5 md:w-5" />

// Animation
<Download className="animate-bounce" />
<ArrowRight className="transition-transform group-hover:translate-x-1" />
```

## Common Pitfalls

- ❌ **Don't import all icons** - Use named imports for tree-shaking
- ❌ **Don't forget aria-label** for icon-only buttons
- ❌ **Don't mix sizing approaches** - Use either Tailwind or size prop consistently
- ❌ **Don't hardcode colors** - Use Tailwind or CSS custom properties

## References

- Lucide documentation: https://lucide.dev/
- Icon search: https://lucide.dev/icons
- Lucide React npm: https://www.npmjs.com/package/lucide-react
- Lucide GitHub: https://github.com/lucide-icons/lucide
