# Tailwind CSS - Utility-First CSS Framework

## Overview

**Version**: 4.1.18
**PostCSS Integration**: @tailwindcss/postcss 4.1.18
**PostCSS Version**: ^8.5.6 (flexible range, minimum 8.5.6)
**CSS Compiler**: Custom programmatic compiler (`src/infrastructure/css/compiler.ts`)
**Purpose**: Modern utility-first CSS framework for rapidly building custom user interfaces with exceptional performance

Tailwind CSS is a highly customizable, low-level CSS framework that provides utility classes for building designs directly in HTML/JSX. Version 4 represents a complete rewrite with a new engine, CSS-first configuration, and significantly improved performance.

**Sovrium-Specific Implementation**: Tailwind CSS is integrated via a custom CSS compiler that generates theme-aware CSS on-demand from domain theme models. This approach enables:

- Dynamic theme generation from app schema configuration
- In-memory CSS caching per theme
- Runtime CSS compilation without static configuration files
- Seamless integration with Effect.ts for functional error handling

## Why Tailwind CSS for Sovrium

- **Utility-First Approach**: Build complex designs without writing custom CSS
- **Rapid Development**: Compose interfaces quickly using pre-built utility classes
- **Consistent Design System**: Built-in spacing, colors, and typography scales
- **No Context Switching**: Style components directly in markup (HTML/JSX)
- **Optimized Bundle Size**: Only includes utilities actually used in production
- **TypeScript-Friendly**: Excellent IDE autocomplete and IntelliSense support
- **Responsive by Default**: Mobile-first responsive design with intuitive breakpoints
- **Dark Mode Support**: First-class dark mode with class-based or media query strategies
- **Perfect for Hono**: Easily integrate with Hono for server-rendered HTML
- **Blazing Fast v4 Engine**: New Rust-based engine for 10x faster builds

## Tailwind v4 Major Changes

### New Features in v4

1. **Rust-Based Engine**: Up to 10x faster build times with custom CSS parser
2. **CSS-First Configuration**: Configure themes using native CSS variables instead of JavaScript
3. **Simplified Import**: Single `@import "tailwindcss"` replaces complex setup
4. **@theme Directive**: Define custom utilities and theme values directly in CSS
5. **Zero Configuration**: Automatic content detection without explicit globs
6. **Unified Toolchain**: Built-in CSS processing (imports, prefixing, nesting)
7. **Native Cascade Layers**: Better CSS specificity control with `@layer`
8. **Smaller Footprint**: 35% smaller installed size compared to v3

### Migration from v3

- **No tailwind.config.js required**: Configuration now done in CSS
- **@import syntax**: `@import "tailwindcss"` instead of `@tailwind` directives
- **Theme customization**: Use `@theme` directive instead of JavaScript config
- **PostCSS plugin**: Separate `@tailwindcss/postcss` package for PostCSS integration
- **Default changes**: Border color is now `currentColor`, rings are 1px by default

## Installation

Tailwind CSS v4 is already installed in Sovrium:

```json
{
  "dependencies": {
    "tailwindcss": "^4.1.18",
    "postcss": "^8.5.6",
    "@tailwindcss/postcss": "^4.1.18",
    "tw-animate-css": "^1.4.0"
  }
}
```

**Additional Dependencies**:

- `tw-animate-css`: Pre-built animation library for Tailwind CSS
- `tailwind-merge`: Utility for merging Tailwind classes (version ^3.4.0)

No additional installation needed.

## Sovrium CSS Compilation Architecture

### Overview

Sovrium uses a **programmatic CSS compilation approach** instead of static configuration files. The CSS compiler (`src/infrastructure/css/compiler.ts`) generates Tailwind CSS dynamically from domain theme models.

**Key Characteristics**:

- **No `tailwind.config.js`**: Configuration is generated programmatically from app schema
- **No static CSS files**: CSS is compiled on-demand at runtime
- **Theme-aware**: CSS adapts to `app.theme` configuration in schema
- **Effect.ts integration**: Compilation uses Effect for error handling and caching
- **In-memory caching**: Compiled CSS cached per theme hash

### Architecture Flow

```
App Schema (JSON)
    ↓
Domain Theme Models (Effect Schema)
    ↓
CSS Compiler (src/infrastructure/css/compiler.ts)
    ↓
PostCSS + Tailwind Plugin
    ↓
Compiled CSS (cached in memory)
    ↓
Served as /assets/output.css
```

### CSS Compiler Features

1. **Dynamic `@theme` Generation**: Converts domain models to Tailwind CSS variables
   - `theme.colors` → `--color-*` CSS variables
   - `theme.fonts` → `--font-*` CSS variables
   - `theme.spacing` → `--spacing-*` CSS variables
   - `theme.shadows` → `--shadow-*` CSS variables
   - `theme.borderRadius` → `--radius-*` CSS variables
   - `theme.breakpoints` → `--breakpoint-*` CSS variables
   - `theme.animations` → `@keyframes` + animation classes

2. **Layer-Based CSS Structure**:
   - `@layer base`: Global HTML element styles (body, headings, links)
   - `@layer components`: Reusable component classes (.btn, .card, .container-page)
   - `@layer utilities`: Custom utility classes (.text-balance)

3. **Theme-Aware Defaults**: Compiler conditionally applies theme colors if defined
   - If `theme.colors.primary` exists → Uses `bg-primary` in buttons
   - If not defined → Falls back to `bg-blue-600`

4. **Functional Error Handling**: Uses `CSSCompilationError` for type-safe error propagation

### Usage in Application Code

```typescript
import { compileCSS } from '@/infrastructure/css'
import { Effect } from 'effect'

// Compile CSS with app theme
const program = Effect.gen(function* () {
  const compiled = yield* compileCSS(app)
  console.log(`Compiled ${compiled.css.length} bytes`)
  return compiled
})

// Run Effect program
const result = await Effect.runPromise(program)
```

### CSS Caching Strategy

The compiler implements per-theme caching using `Effect.Ref`:

- **Cache Key**: JSON stringified theme object
- **Cache Storage**: In-memory Map with theme hash → compiled CSS
- **Cache Invalidation**: Automatic when theme changes (different hash)
- **Performance**: Subsequent requests with same theme are instant (no recompilation)

### Integration with Hono Routes

CSS is served dynamically via Hono route:

```typescript
app.get('/assets/output.css', async (c) => {
  const compiled = yield * compileCSS(app)
  return c.text(compiled.css, 200, {
    'Content-Type': 'text/css',
    'Cache-Control': 'public, max-age=31536000',
  })
})
```

### Configuration Files

**No configuration files needed**. Sovrium does NOT use:

- ❌ `tailwind.config.js`
- ❌ `tailwind.config.ts`
- ❌ `postcss.config.js`
- ❌ Static CSS source files

Instead, CSS is generated programmatically in `src/infrastructure/css/compiler.ts`.

**Why This Approach?**

1. **Schema-Driven**: CSS follows app schema configuration
2. **Multi-Tenancy Ready**: Each app can have different themes
3. **Type-Safe**: Domain models enforce valid theme structures
4. **Testable**: Compiler is a pure Effect program
5. **Cacheable**: Compiled CSS cached efficiently per theme

See `@docs/infrastructure/css/css-compiler.md` for detailed technical documentation.

## CSS-First Configuration (v4)

### Basic CSS Setup

Create a CSS file (e.g., `src/styles/main.css`) with Tailwind import:

```css
/* src/styles/main.css */

/* Import Tailwind CSS */
@import 'tailwindcss';

/* Optional: Import Tailwind's preflight (CSS reset) */
/* @import 'tailwindcss/preflight'; */

/* Optional: Import Tailwind's utilities */
/* @import 'tailwindcss/utilities'; */
```

### Theme Customization with @theme

Customize design tokens using the `@theme` directive:

```css
/* src/styles/main.css */

@import 'tailwindcss';

@theme {
  /* Custom colors */
  --color-primary: #3b82f6;
  --color-secondary: #8b5cf6;
  --color-accent: #f59e0b;

  /* Custom spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 2rem;
  --spacing-xl: 4rem;

  /* Custom font families */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'Fira Code', monospace;

  /* Custom breakpoints */
  --breakpoint-tablet: 768px;
  --breakpoint-desktop: 1024px;
  --breakpoint-wide: 1280px;
}

/* Custom utilities using theme variables */
.btn-primary {
  background-color: var(--color-primary);
  color: white;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: 0.375rem;
}

.btn-primary:hover {
  opacity: 0.9;
}
```

### Adding Custom CSS Layers

Use `@layer` to organize custom styles:

```css
@import 'tailwindcss';

@layer base {
  /* Base styles (HTML elements) */
  body {
    @apply font-sans antialiased;
  }

  h1 {
    @apply text-4xl font-bold;
  }

  a {
    @apply text-blue-600 hover:underline;
  }
}

@layer components {
  /* Reusable component classes */
  .card {
    @apply rounded-lg border border-gray-200 p-6 shadow-sm;
  }

  .btn {
    @apply rounded px-4 py-2 font-medium transition-colors;
  }

  .btn-primary {
    @apply bg-blue-600 text-white hover:bg-blue-700;
  }

  .btn-secondary {
    @apply bg-gray-600 text-white hover:bg-gray-700;
  }
}

@layer utilities {
  /* Custom utility classes */
  .text-balance {
    text-wrap: balance;
  }

  .scrollbar-hide {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

## PostCSS Configuration

Tailwind v4 integrates via PostCSS. Create `postcss.config.js`:

```javascript
// postcss.config.js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

Or use `postcss.config.ts` for TypeScript:

```typescript
// postcss.config.ts
import type { Config } from 'postcss-load-config'

const config: Config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
```

## Basic Usage

### Utility Classes

Tailwind provides thousands of utility classes for styling:

```html
<!-- Typography -->
<h1 class="text-4xl font-bold text-gray-900">Hello World</h1>
<p class="text-base leading-relaxed text-gray-600">Welcome to Sovrium</p>

<!-- Layout -->
<div class="flex items-center justify-between p-4">
  <div class="flex-1">Content</div>
  <button class="px-4 py-2">Button</button>
</div>

<!-- Spacing -->
<div class="mt-8 mb-4 px-6 py-3">
  <span class="mr-4 ml-2">Spaced content</span>
</div>

<!-- Colors -->
<div class="border border-gray-300 bg-blue-500 text-white">
  <p class="text-gray-100">Colored box</p>
</div>

<!-- Sizing -->
<div class="h-32 min-h-screen w-64 max-w-lg">
  <img
    class="h-auto w-full"
    src="image.jpg"
    alt="Responsive image"
  />
</div>

<!-- Borders and Shadows -->
<div class="rounded-lg border-2 border-blue-500 shadow-md">
  <p class="p-4">Card with border and shadow</p>
</div>
```

### Responsive Design

Tailwind uses mobile-first breakpoints:

```html
<!-- Responsive padding: small on mobile, large on desktop -->
<div class="p-4 md:p-8 lg:p-12">
  <!-- Responsive grid: 1 column mobile, 2 tablet, 3 desktop -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    <div class="bg-gray-100 p-4">Item 1</div>
    <div class="bg-gray-100 p-4">Item 2</div>
    <div class="bg-gray-100 p-4">Item 3</div>
  </div>
</div>

<!-- Responsive text sizes -->
<h1 class="text-2xl md:text-4xl lg:text-6xl">Responsive Heading</h1>

<!-- Hide/show elements based on screen size -->
<div class="hidden md:block">Visible on tablet and desktop</div>
<div class="block md:hidden">Visible only on mobile</div>
```

**Breakpoint Reference:**

| Prefix | Min Width | Description         |
| ------ | --------- | ------------------- |
| `sm:`  | 640px     | Small tablets       |
| `md:`  | 768px     | Tablets             |
| `lg:`  | 1024px    | Laptops/desktops    |
| `xl:`  | 1280px    | Large desktops      |
| `2xl:` | 1536px    | Extra large screens |

### Dark Mode

Tailwind v4 supports dark mode with class-based or media query strategies:

```html
<!-- Class-based dark mode (recommended) -->
<div class="bg-white dark:bg-gray-900">
  <h1 class="text-gray-900 dark:text-white">Dark Mode Heading</h1>
  <p class="text-gray-600 dark:text-gray-300">Dark mode paragraph</p>
  <button class="bg-blue-500 text-white dark:bg-blue-700">Button</button>
</div>
```

Enable dark mode by adding `dark` class to root element:

```html
<html class="dark">
  <!-- Content will use dark: variants -->
</html>
```

Or use JavaScript to toggle:

```javascript
// Toggle dark mode
document.documentElement.classList.toggle('dark')

// Enable dark mode
document.documentElement.classList.add('dark')

// Disable dark mode
document.documentElement.classList.remove('dark')
```

### Hover, Focus, and State Variants

```html
<!-- Hover states -->
<button class="bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">Hover me</button>

<!-- Focus states -->
<input
  class="border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
  type="text"
/>

<!-- Active states -->
<button class="bg-blue-500 px-4 py-2 text-white active:bg-blue-700">Press me</button>

<!-- Disabled states -->
<button
  class="bg-blue-500 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
  disabled
>
  Disabled
</button>

<!-- Group hover (parent hover affects children) -->
<div class="group p-4 hover:bg-gray-100">
  <h3 class="text-gray-900 group-hover:text-blue-600">Hover parent to change my color</h3>
</div>

<!-- Peer states (sibling state affects element) -->
<input
  class="peer"
  type="checkbox"
/>
<label class="peer-checked:text-blue-600">Check the box</label>
```

## Integration with Hono

### Serving HTML with Tailwind Styles

```typescript
import { Hono } from 'hono'

const app = new Hono()

// Serve Tailwind CSS file
app.get('/styles.css', async (c) => {
  // In production, serve pre-built CSS
  // In development, use build process or CDN
  const css = await Bun.file('dist/styles.css').text()
  return c.text(css, 200, { 'Content-Type': 'text/css' })
})

// Serve HTML with Tailwind classes
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sovrium App</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body class="bg-gray-50 font-sans antialiased">
        <div class="min-h-screen flex items-center justify-center">
          <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
            <h1 class="text-3xl font-bold text-gray-900 mb-4">Welcome to Sovrium</h1>
            <p class="text-gray-600 mb-6">
              Built with Hono, Bun, and Tailwind CSS
            </p>
            <button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors">
              Get Started
            </button>
          </div>
        </div>
      </body>
    </html>
  `)
})

export default app
```

### Component-Based HTML with Tailwind

```typescript
import { Hono } from 'hono'

const app = new Hono()

// Reusable component functions
const Button = (text: string, variant: 'primary' | 'secondary' = 'primary') => {
  const classes =
    variant === 'primary'
      ? 'bg-blue-600 hover:bg-blue-700 text-white'
      : 'bg-gray-600 hover:bg-gray-700 text-white'

  return `
    <button class="${classes} font-medium py-2 px-4 rounded transition-colors">
      ${text}
    </button>
  `
}

const Card = (title: string, content: string) => `
  <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
    <h2 class="text-xl font-bold text-gray-900 mb-3">${title}</h2>
    <p class="text-gray-600">${content}</p>
  </div>
`

// Use components in routes
app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard - Sovrium</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body class="bg-gray-50">
        <div class="container mx-auto px-4 py-8">
          <h1 class="text-4xl font-bold text-gray-900 mb-8">Dashboard</h1>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            ${Card('Total Users', '1,234 active users')}
            ${Card('Revenue', '$12,345 this month')}
            ${Card('Growth', '+23% compared to last month')}
          </div>

          <div class="flex gap-4">
            ${Button('Export Data', 'primary')}
            ${Button('Settings', 'secondary')}
          </div>
        </div>
      </body>
    </html>
  `)
})

export default app
```

### Form Styling with Tailwind

```typescript
import { Hono } from 'hono'

const app = new Hono()

app.get('/register', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Register - Sovrium</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body class="bg-gray-100">
        <div class="min-h-screen flex items-center justify-center px-4">
          <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">Create Account</h2>

            <form action="/register" method="POST" class="space-y-4">
              <!-- Username Input -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter username"
                  required
                />
              </div>

              <!-- Email Input -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <!-- Password Input -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
              </div>

              <!-- Submit Button -->
              <button
                type="submit"
                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Create Account
              </button>
            </form>

            <p class="mt-4 text-center text-sm text-gray-600">
              Already have an account?
              <a href="/login" class="text-blue-600 hover:text-blue-700 font-medium">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `)
})

export default app
```

## Build Process

### Development Build

During development, Tailwind watches files and rebuilds CSS:

```bash
# Watch CSS files for changes (if using build script)
bunx tailwindcss -i src/styles/main.css -o dist/styles.css --watch

# Or integrate with Bun build process
bun --watch build.ts
```

### Production Build

For production, build optimized CSS with minification:

```bash
# Build optimized CSS for production
bunx tailwindcss -i src/styles/main.css -o dist/styles.css --minify

# Or use PostCSS directly
bunx postcss src/styles/main.css -o dist/styles.css
```

### Automatic Content Detection (v4)

Tailwind v4 automatically detects content files without configuration. It scans:

- HTML files (`**/*.html`)
- JSX/TSX files (`**/*.{js,jsx,ts,tsx}`)
- Template files in common locations

No explicit `content` configuration needed (zero-config approach).

## Common Patterns

### Layout Patterns

#### Centered Container

```html
<div class="container mx-auto px-4">
  <!-- Content centered with max-width and horizontal padding -->
</div>
```

#### Flexbox Layouts

```html
<!-- Horizontal flex container -->
<div class="flex items-center justify-between gap-4">
  <div>Left</div>
  <div>Center</div>
  <div>Right</div>
</div>

<!-- Vertical flex container -->
<div class="flex flex-col space-y-4">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>

<!-- Responsive flex direction -->
<div class="flex flex-col gap-4 md:flex-row">
  <div class="flex-1">Column on mobile, row on tablet+</div>
  <div class="flex-1">Auto-width columns</div>
</div>
```

#### Grid Layouts

```html
<!-- Basic grid -->
<div class="grid grid-cols-3 gap-4">
  <div>1</div>
  <div>2</div>
  <div>3</div>
</div>

<!-- Responsive grid -->
<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
  <div>Card 1</div>
  <div>Card 2</div>
  <div>Card 3</div>
  <div>Card 4</div>
</div>

<!-- Auto-fit grid (responsive without breakpoints) -->
<div class="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
  <div>Auto-sizing card</div>
  <div>Auto-sizing card</div>
  <div>Auto-sizing card</div>
</div>
```

### Component Patterns

#### Navigation Bar

```html
<nav class="bg-white shadow-sm">
  <div class="container mx-auto px-4">
    <div class="flex h-16 items-center justify-between">
      <!-- Logo -->
      <div class="flex items-center">
        <a
          href="/"
          class="text-xl font-bold text-gray-900"
          >Sovrium</a
        >
      </div>

      <!-- Navigation Links -->
      <div class="hidden space-x-8 md:flex">
        <a
          href="/features"
          class="text-gray-600 hover:text-gray-900"
          >Features</a
        >
        <a
          href="/pricing"
          class="text-gray-600 hover:text-gray-900"
          >Pricing</a
        >
        <a
          href="/docs"
          class="text-gray-600 hover:text-gray-900"
          >Docs</a
        >
      </div>

      <!-- CTA Button -->
      <div>
        <a
          href="/signup"
          class="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
        >
          Sign Up
        </a>
      </div>
    </div>
  </div>
</nav>
```

#### Card Component

```html
<div class="overflow-hidden rounded-lg bg-white shadow-md transition-shadow hover:shadow-lg">
  <!-- Card Image -->
  <img
    class="h-48 w-full object-cover"
    src="image.jpg"
    alt="Card image"
  />

  <!-- Card Content -->
  <div class="p-6">
    <h3 class="mb-2 text-xl font-bold text-gray-900">Card Title</h3>
    <p class="mb-4 text-gray-600">
      Card description goes here with some details about the content.
    </p>

    <!-- Card Actions -->
    <div class="flex gap-2">
      <button class="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
        Primary Action
      </button>
      <button
        class="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        Secondary
      </button>
    </div>
  </div>
</div>
```

#### Modal/Dialog

```html
<!-- Modal Overlay -->
<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
  <!-- Modal Container -->
  <div class="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
    <!-- Close Button -->
    <button class="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
      <svg
        class="h-6 w-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>

    <!-- Modal Content -->
    <h2 class="mb-4 text-2xl font-bold text-gray-900">Modal Title</h2>
    <p class="mb-6 text-gray-600">
      Modal content goes here. Explain the action or show information.
    </p>

    <!-- Modal Actions -->
    <div class="flex justify-end gap-3">
      <button class="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
        Cancel
      </button>
      <button class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Confirm</button>
    </div>
  </div>
</div>
```

#### Alert/Notification

```html
<!-- Success Alert -->
<div class="mb-4 border-l-4 border-green-500 bg-green-50 p-4">
  <div class="flex">
    <div class="flex-shrink-0">
      <svg
        class="h-5 w-5 text-green-500"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clip-rule="evenodd"
        />
      </svg>
    </div>
    <div class="ml-3">
      <p class="text-sm text-green-700">Successfully saved changes!</p>
    </div>
  </div>
</div>

<!-- Error Alert -->
<div class="mb-4 border-l-4 border-red-500 bg-red-50 p-4">
  <div class="flex">
    <div class="flex-shrink-0">
      <svg
        class="h-5 w-5 text-red-500"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clip-rule="evenodd"
        />
      </svg>
    </div>
    <div class="ml-3">
      <p class="text-sm text-red-700">There was an error processing your request.</p>
    </div>
  </div>
</div>
```

## Customization

### Adding Custom Colors

```css
@import 'tailwindcss';

@theme {
  /* Brand colors */
  --color-brand-50: #eff6ff;
  --color-brand-100: #dbeafe;
  --color-brand-500: #3b82f6;
  --color-brand-900: #1e3a8a;

  /* Semantic colors */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;
}
```

Use custom colors:

```html
<div class="bg-brand-500 text-white">Brand colored box</div>
<button class="bg-success hover:bg-success/90 text-white">Success Button</button>
```

### Custom Fonts

```css
@import 'tailwindcss';

@theme {
  --font-display: 'Playfair Display', serif;
  --font-body: 'Inter', system-ui, sans-serif;
  --font-code: 'Fira Code', monospace;
}
```

```html
<h1 class="font-display text-4xl">Display Heading</h1>
<p class="font-body text-base">Body text content</p>
<code class="font-code">const x = 42</code>
```

### Custom Spacing

```css
@import 'tailwindcss';

@theme {
  --spacing-18: 4.5rem; /* 72px */
  --spacing-22: 5.5rem; /* 88px */
  --spacing-26: 6.5rem; /* 104px */
}
```

```html
<div class="mt-18 p-22">Custom spacing</div>
```

## Performance

### JIT (Just-In-Time) Compilation

Tailwind v4 uses JIT compilation by default:

- **Instant build times**: Generates only CSS you use
- **Development mode**: Fast rebuilds on file changes
- **Production mode**: Minimal CSS bundle (only used utilities)
- **Arbitrary values**: Use custom values without configuration: `w-[137px]`

### Bundle Size Optimization

```bash
# Production build automatically purges unused CSS
bunx tailwindcss -i src/styles/main.css -o dist/styles.css --minify

# Result: Only utilities actually used in HTML/JSX are included
# Typical bundle size: 5-20 KB (gzipped) depending on usage
```

### Arbitrary Values

Use custom values without configuration:

```html
<!-- Custom width -->
<div class="w-[137px]">Exact width</div>

<!-- Custom color -->
<div class="bg-[#1da1f2]">Twitter blue</div>

<!-- Custom spacing -->
<div class="mt-[17px] p-[3.2rem]">Custom spacing</div>

<!-- Custom breakpoint -->
<div class="min-[820px]:flex">Custom breakpoint</div>
```

## Best Practices for Sovrium

### General Tailwind Practices

1. **Use Utility Classes Directly**: Build designs in HTML/JSX without custom CSS files
2. **Mobile-First Responsive Design**: Start with mobile layout, add breakpoints upward
3. **Consistent Spacing Scale**: Use default spacing (4, 8, 12, 16, etc.) for consistency
4. **Dark Mode from Start**: Plan dark mode variants early in development
5. **Keep Classes Readable**: Use line breaks for long class lists in HTML
6. **Test Across Breakpoints**: Verify responsive design at all screen sizes

### Sovrium-Specific Practices

1. **Define Theme in App Schema**: Configure colors, fonts, spacing in `app.theme` (not CSS files)
2. **Use Theme Tokens**: Reference schema-defined tokens (`bg-primary`, `text-text`, `p-section`)
3. **Avoid Hardcoded Colors**: Use theme colors or Tailwind defaults (don't use arbitrary colors like `bg-[#1da1f2]`)
4. **Test Theme Variations**: Verify UI works with different theme configurations
5. **Leverage Compiler Defaults**: Compiler provides sensible fallbacks if theme tokens missing
6. **Don't Create Static CSS Files**: CSS is generated programmatically from domain models
7. **Trust the Cache**: Compiled CSS is cached per theme for performance
8. **Use Effect.ts Patterns**: Wrap CSS compilation in Effect programs for error handling
9. **Component Classes Available**: Use `.btn`, `.card`, `.container-page` from compiled CSS
10. **Animation Library**: Use `tw-animate-css` animations or define custom in `theme.animations`

## Common Pitfalls to Avoid

- ❌ Writing custom CSS when utilities exist (use utilities first)
- ❌ Not using responsive variants (mobile-first approach)
- ❌ Ignoring dark mode support (plan for it early)
- ❌ Overusing arbitrary values (prefer theme configuration)
- ❌ Creating too many @layer components (use utilities directly when possible)
- ❌ Not leveraging group/peer variants (useful for interactive states)
- ❌ Forgetting to minify in production (always optimize builds)
- ❌ Using inline styles instead of utilities (defeats purpose of Tailwind)

## Tailwind vs Other CSS Approaches

| Approach           | Tailwind CSS                     | Traditional CSS            | CSS-in-JS                   |
| ------------------ | -------------------------------- | -------------------------- | --------------------------- |
| **Learning Curve** | Medium (utility class names)     | Low (standard CSS)         | Medium (framework-specific) |
| **Bundle Size**    | Small (purged, ~5-20KB)          | Variable (grows over time) | Variable (runtime cost)     |
| **Performance**    | Excellent (no runtime)           | Excellent (no runtime)     | Good (runtime overhead)     |
| **Maintenance**    | Easy (co-located with HTML)      | Harder (separate files)    | Easy (co-located)           |
| **Reusability**    | High (utility composition)       | Medium (custom classes)    | High (components)           |
| **Customization**  | Excellent (theme config)         | Full control (manual)      | Good (theme config)         |
| **Developer DX**   | Excellent (no context switching) | Medium (file switching)    | Good (in JS)                |

## Integration with Development Tools

### VS Code Extension

Install "Tailwind CSS IntelliSense" for:

- Autocomplete for class names
- Linting and warnings
- Hover preview of CSS values
- Syntax highlighting

## References

- Tailwind CSS documentation: https://tailwindcss.com/docs
- Tailwind v4 announcement: https://tailwindcss.com/blog/tailwindcss-v4-alpha
- PostCSS plugin: https://github.com/tailwindlabs/tailwindcss-postcss
- Component examples: https://tailwindui.com/components
- Tailwind Play (online playground): https://play.tailwindcss.com/
