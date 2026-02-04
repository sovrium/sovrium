# Theme Domain

> **Domain**: theme
> **Schema Path**: `src/domain/models/app/theme/`
> **Spec Path**: `specs/api/theme/`

---

## Overview

The Theme domain controls visual styling and branding in Sovrium applications. Theme settings define colors, fonts, and overall appearance, enabling both code-based configuration and visual editing in the Admin Space.

---

## Feature Areas

| Feature Area  | Description                             | Developer | App Admin |
| ------------- | --------------------------------------- | --------- | --------- |
| visual-editor | Visual theme editing interface          | ✓         | ✓         |
| colors        | Color palette and semantic color system | ✓         | ✓         |
| typography    | Fonts, type scale, and text styling     | ✓         | ✓         |
| branding      | Logo, favicon, and brand assets         | ✓         | ✓         |
| dark-mode     | Light/dark mode support and preferences | ✓         | ✓         |

---

## Quick Links

### Visual Editor

- [As Developer](./visual-editor/as-developer.md) - CSS variables, configuration, page overrides
- [As App Administrator](./visual-editor/as-app-administrator.md) - Visual theme editor interface

### Colors

- [As Developer](./colors/as-developer.md) - Semantic color system, light/dark variants
- [As App Administrator](./colors/as-app-administrator.md) - Brand colors, surfaces, text, accents

### Typography

- [As Developer](./typography/as-developer.md) - Type scale, font weights, fallbacks
- [As App Administrator](./typography/as-app-administrator.md) - Font selection, sizes, spacing

### Branding

- [As Developer](./branding/as-developer.md) - Logo configuration, Open Graph images
- [As App Administrator](./branding/as-app-administrator.md) - Logo upload, favicon, login customization

### Dark Mode

- [As Developer](./dark-mode/as-developer.md) - System detection, manual toggle, color definitions
- [As App Administrator](./dark-mode/as-app-administrator.md) - Enable/disable, preview modes

---

## Coverage Summary

| Feature Area  | Total Stories | Complete | Partial | Not Started | Coverage |
| ------------- | ------------- | -------- | ------- | ----------- | -------- |
| visual-editor | 7             | 3        | 0       | 4           | 43%      |
| colors        | 7             | 7        | 0       | 0           | 100%     |
| typography    | 7             | 7        | 0       | 0           | 100%     |
| branding      | 5             | 2        | 0       | 3           | 40%      |
| dark-mode     | 5             | 4        | 0       | 1           | 80%      |

**Domain Total**: 23 complete, 0 partial, 8 not started (31 total, 74% complete)

---

## Implementation Status

### Implemented Features

- **CSS Variables System**: Theme values exposed as CSS custom properties
- **Semantic Color System**: Primary, secondary, success, error, warning colors
- **Dark Mode Support**: Automatic detection, manual toggle, smooth transitions
- **Type Scale**: Consistent heading/body typography with configurable weights
- **Brand Configuration**: Logo placement, favicon generation, Open Graph images

### Pending Features

- **Visual Theme Editor**: Admin Space interface for no-code theme customization
- **Branding Admin**: Logo upload, favicon configuration, login page branding
- **Dark Mode Preview**: Side-by-side preview in theme editor

---

## Related Documentation

- **Architecture**: `@docs/architecture/patterns/theming-architecture.md`
- **CSS Compiler**: `@docs/infrastructure/css/css-compiler.md`
- **Tailwind Integration**: `@docs/infrastructure/ui/tailwind.md`

---

> **Navigation**: [← Back to Specification](../README.md)
