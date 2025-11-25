# CSS Compiler - Programmatic Tailwind CSS Generation

## Overview

**Location**: `src/infrastructure/css/compiler.ts`
**Purpose**: Compile Tailwind CSS dynamically from domain theme models using PostCSS
**Integration**: Effect.ts for functional error handling and caching
**Approach**: Programmatic CSS generation (NO static config files)

The CSS compiler transforms domain theme models into Tailwind CSS v4 with `@theme` directives. It generates CSS on-demand at runtime, caches compiled results per theme, and serves CSS via Hono routes.

## Installation

Dependencies already configured in `package.json`:

```json
{
  "dependencies": {
    "tailwindcss": "^4.1.18",
    "@tailwindcss/postcss": "^4.1.18",
    "postcss": "^8.5.6",
    "tw-animate-css": "^1.4.0"
  }
}
```

## Core Architecture

### Compilation Flow

```
App Schema → Domain Models → CSS Compiler → PostCSS → Compiled CSS → Cache → HTTP Response
```

**Step-by-step**:

1. App schema defines `app.theme` (colors, fonts, spacing, etc.)
2. Domain models validate theme structure (Effect Schema)
3. CSS compiler generates SOURCE_CSS string with `@theme` tokens
4. PostCSS processes SOURCE_CSS with Tailwind plugin
5. Compiled CSS cached in-memory per theme hash
6. CSS served as `/assets/output.css` via Hono route

### Key Components

| Component             | Purpose                                      | Type            |
| --------------------- | -------------------------------------------- | --------------- |
| `compileCSS()`        | Main compilation function                    | Effect program  |
| `buildSourceCSS()`    | Generate SOURCE_CSS with theme tokens        | Pure function   |
| `generateThemeCSS()`  | Create `@theme` directive from domain models | Pure function   |
| `cssCache`            | In-memory cache per theme                    | Effect.Ref<Map> |
| `CSSCompilationError` | Type-safe error class                        | Effect error    |

## Configuration

### No Static Config Files

Sovrium does NOT use:

- ❌ `tailwind.config.js`
- ❌ `tailwind.config.ts`
- ❌ `postcss.config.js`
- ❌ Static CSS source files (e.g., `src/styles/main.css`)

**Why?**

- CSS is generated programmatically from app schema
- Each app can have different themes (multi-tenancy)
- Type-safe domain models enforce valid configurations
- Dynamic compilation supports runtime theme switching

### Programmatic Configuration

Configuration is embedded in `compiler.ts` as constants and functions:

```typescript
// Static imports (always included)
const STATIC_IMPORTS = `@import 'tailwindcss';
@import 'tw-animate-css';
@custom-variant dark (&:is(.dark *));`

// Layer-based CSS structure
const BASE_LAYER = generateBaseLayer(theme)
const COMPONENTS_LAYER = generateComponentsLayer(theme)
const UTILITIES_LAYER = `@layer utilities { ... }`

// Dynamic @theme directive
const THEME_CSS = generateThemeCSS(theme)
```

## Usage

### Basic Compilation

```typescript
import { compileCSS } from '@/infrastructure/css'
import { Effect } from 'effect'

// Compile CSS without theme (minimal CSS)
const program = Effect.gen(function* () {
  const result = yield* compileCSS()
  console.log(`Compiled ${result.css.length} bytes`)
  return result
})

Effect.runPromise(program)
```

### Compilation with Theme

```typescript
import { compileCSS } from '@/infrastructure/css'
import { Effect } from 'effect'
import type { App } from '@/domain/models/app'

const app: App = {
  name: 'my-app',
  theme: {
    colors: {
      primary: '#007bff',
      secondary: '#6c757d',
    },
    fonts: {
      body: { family: 'Inter', fallback: 'sans-serif' },
    },
    spacing: {
      section: '4rem',
    },
  },
  pages: [...],
}

// Compile CSS with app theme
const program = Effect.gen(function* () {
  const result = yield* compileCSS(app)
  console.log(`Compiled ${result.css.length} bytes with theme`)
  return result
})

Effect.runPromise(program)
```

### Serving CSS via Hono

```typescript
import { Hono } from 'hono'
import { compileCSS } from '@/infrastructure/css'
import { Effect } from 'effect'

const app = new Hono()

app.get('/assets/output.css', async (c) => {
  const program = Effect.gen(function* () {
    const compiled = yield* compileCSS(appConfig)
    return compiled
  })

  const result = await Effect.runPromise(program)

  return c.text(result.css, 200, {
    'Content-Type': 'text/css',
    'Cache-Control': 'public, max-age=31536000',
  })
})
```

## Theme Token Generation

### Colors

**Domain Model**: `src/domain/models/app/theme/colors.ts`

```typescript
// Input (app schema)
{
  colors: {
    primary: '#007bff',
    secondary: '#6c757d',
    text: '#212529',
  }
}

// Output (CSS @theme)
@theme {
  --color-primary: #007bff;
  --color-secondary: #6c757d;
  --color-text: #212529;
}
```

**Usage in HTML**:

```html
<div class="bg-primary text-text">Themed element</div>
```

### Fonts

**Domain Model**: `src/domain/models/app/theme/fonts.ts`

```typescript
// Input (app schema)
{
  fonts: {
    body: { family: 'Inter', fallback: 'sans-serif' },
    heading: { family: 'Poppins', fallback: 'sans-serif' },
  }
}

// Output (CSS @theme)
@theme {
  --font-body: Inter, sans-serif;
  --font-heading: Poppins, sans-serif;
}
```

**Usage in HTML**:

```html
<body class="font-body">
  <h1 class="font-heading">Heading</h1>
</body>
```

### Spacing

**Domain Model**: `src/domain/models/app/theme/spacing.ts`

```typescript
// Input (app schema)
{
  spacing: {
    section: '4rem',
    container: '80rem',
    gap: '1.5rem',
  }
}

// Output (CSS @theme)
@theme {
  --spacing-section: 4rem;
  --spacing-container: 80rem;
  --spacing-gap: 1.5rem;
}
```

**Usage in HTML**:

```html
<section class="p-section max-w-container">
  <div class="gap-gap grid">...</div>
</section>
```

### Shadows

**Domain Model**: `src/domain/models/app/theme/shadows.ts`

```typescript
// Input (app schema)
{
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  }
}

// Output (CSS @theme)
@theme {
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}
```

**Usage in HTML**:

```html
<div class="shadow-md hover:shadow-lg">Card with shadow</div>
```

### Border Radius

**Domain Model**: `src/domain/models/app/theme/border-radius.ts`

```typescript
// Input (app schema)
{
  borderRadius: {
    DEFAULT: '0.25rem',
    lg: '0.5rem',
    full: '9999px',
  }
}

// Output (CSS @theme)
@theme {
  --radius: 0.25rem;
  --radius-lg: 0.5rem;
  --radius-full: 9999px;
}
```

**Usage in HTML**:

```html
<button class="rounded-lg">Rounded button</button>
<div class="rounded-full">Circle</div>
```

### Breakpoints

**Domain Model**: `src/domain/models/app/theme/breakpoints.ts`

```typescript
// Input (app schema)
{
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
  }
}

// Output (CSS @theme)
@theme {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
}
```

**Usage in HTML**:

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">Responsive grid</div>
```

### Animations

**Domain Model**: `src/domain/models/app/theme/animations.ts`

```typescript
// Input (app schema)
{
  animations: {
    fadeIn: {
      keyframes: {
        '0%': { opacity: '0' },
        '100%': { opacity: '1' },
      },
      duration: '500ms',
      easing: 'ease-in-out',
    },
  }
}

// Output (CSS)
@keyframes fadeIn {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

.animate-fadeIn {
  animation: fadeIn 500ms ease-in-out 0ms;
}
```

**Usage in HTML**:

```html
<div class="animate-fadeIn">Fades in on load</div>
```

## Layer-Based CSS Structure

### @layer base

**Purpose**: Global HTML element styles

**Generated CSS**:

```css
@layer base {
  body {
    @apply font-sans antialiased;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    @apply font-semibold tracking-tight;
  }

  a {
    @apply text-blue-600 transition-colors hover:text-blue-700;
  }
}
```

**Theme-Aware**:

- If `theme.colors.text` exists → `body` gets `text-text` class
- If `theme.colors.primary` exists → `a` gets `text-primary hover:text-primary-hover`

### @layer components

**Purpose**: Reusable component classes

**Generated CSS**:

```css
@layer components {
  .container-page {
    @apply mx-auto max-w-4xl px-4 py-8;
  }

  .card {
    @apply rounded-lg border border-gray-200 bg-white p-6 shadow-sm;
  }

  button,
  .btn {
    @apply inline-flex items-center justify-center rounded-md px-4 py-2 font-medium transition-colors;
  }

  .btn-primary {
    @apply bg-primary hover:bg-primary-hover text-white;
  }
}
```

**Theme-Aware**:

- If `theme.colors.primary` exists → `.btn-primary` uses theme colors
- If not → Falls back to `bg-blue-600 text-white hover:bg-blue-700`

### @layer utilities

**Purpose**: Custom utility classes

**Generated CSS**:

```css
@layer utilities {
  .text-balance {
    text-wrap: balance;
  }

  .text-center {
    text-align: center;
  }
}
```

## Caching Strategy

### Cache Implementation

```typescript
const cssCache = Ref.unsafeMake<Map<string, CompiledCSS>>(new Map())

function getThemeCacheKey(theme?: Theme): string {
  return JSON.stringify(theme || {})
}
```

**Cache Key**: JSON-stringified theme object
**Cache Storage**: Effect.Ref with Map<string, CompiledCSS>
**Cache Type**:

```typescript
interface CompiledCSS {
  readonly css: string
  readonly timestamp: number
}
```

### Cache Flow

1. **Request comes in** → `compileCSS(app)` called
2. **Generate cache key** → `getThemeCacheKey(app?.theme)`
3. **Check cache** → `Ref.get(cssCache)` and lookup key
4. **Cache hit** → Return cached CSS immediately (no compilation)
5. **Cache miss** → Compile CSS → Store in cache → Return result

### Cache Performance

| Scenario                         | Performance                         |
| -------------------------------- | ----------------------------------- |
| First request (cold cache)       | ~50-150ms (PostCSS compilation)     |
| Subsequent requests (same theme) | <1ms (cache hit)                    |
| Different theme                  | ~50-150ms (new compilation + cache) |

### Cache Invalidation

**Automatic**: Cache key changes when theme changes

- Different colors → Different cache key → New compilation
- Same theme → Same cache key → Cache hit

**Manual**: Not supported (cache is in-memory, resets on server restart)

## Error Handling

### CSSCompilationError

**Location**: `src/infrastructure/errors/css-compilation-error.ts`

```typescript
export class CSSCompilationError {
  readonly _tag = 'CSSCompilationError'
  constructor(readonly cause: unknown) {}
}
```

**Usage in Compiler**:

```typescript
const result = yield* Effect.tryPromise({
  try: async () => {
    const processor = postcss([tailwindcss()])
    return await processor.process(sourceCSS, { ... })
  },
  catch: (error) => new CSSCompilationError(error),
})
```

**Handling Errors**:

```typescript
const program = Effect.gen(function* () {
  const result = yield* compileCSS(app)
  return result
}).pipe(
  Effect.catchTag('CSSCompilationError', (error) =>
    Effect.sync(() => {
      console.error('CSS compilation failed:', error.cause)
      return { css: '/* fallback CSS */', timestamp: Date.now() }
    })
  )
)
```

## Integration with Domain Models

### Theme Model

**Location**: `src/domain/models/app/theme.ts`

**Effect Schema Definition**:

```typescript
export const Theme = Schema.Struct({
  colors: Schema.optional(ColorsConfig),
  fonts: Schema.optional(FontsConfig),
  spacing: Schema.optional(SpacingConfig),
  shadows: Schema.optional(ShadowsConfig),
  borderRadius: Schema.optional(BorderRadiusConfig),
  breakpoints: Schema.optional(BreakpointsConfig),
  animations: Schema.optional(AnimationsConfig),
})
```

**Type Inference**:

```typescript
export type Theme = Schema.Schema.Type<typeof Theme>
```

### Validation Flow

```
JSON Schema → Effect Schema → Domain Model → CSS Compiler
```

1. App schema validated by Effect Schema
2. Theme structure enforced by domain models
3. Compiler receives type-safe theme object
4. Invalid themes rejected before compilation

## Best Practices

### For Claude Code (AI Code Generation)

1. **Always use Effect.gen**: Wrap compilation in Effect programs
2. **Handle CSSCompilationError**: Catch and handle compilation errors
3. **Use type-safe theme models**: Import from `@/domain/models/app/theme`
4. **Trust the cache**: Don't implement custom caching
5. **Don't create static CSS files**: CSS is generated programmatically
6. **Test with different themes**: Verify compiler handles various configurations

### For Developers

1. **Define theme in app schema**: Use `app.theme` for colors, fonts, spacing
2. **Reference theme tokens in HTML**: Use `bg-primary`, `text-text`, `p-section`
3. **Avoid arbitrary values**: Prefer theme tokens over `bg-[#1da1f2]`
4. **Use component classes**: Leverage `.btn`, `.card`, `.container-page`
5. **Check compiled CSS**: Visit `/assets/output.css` to inspect generated CSS
6. **Test theme variations**: Ensure UI works with different theme configs

## Common Patterns

### Pattern 1: Compile CSS at Server Startup

```typescript
import { compileCSS } from '@/infrastructure/css'
import { Effect } from 'effect'

// Pre-compile CSS on server startup
const program = Effect.gen(function* () {
  console.log('Compiling CSS...')
  const result = yield* compileCSS(app)
  console.log(`Compiled ${result.css.length} bytes`)
})

Effect.runPromise(program)
```

### Pattern 2: Dynamic CSS Route

```typescript
app.get('/assets/output.css', async (c) => {
  const program = compileCSS(app).pipe(
    Effect.map((compiled) =>
      c.text(compiled.css, 200, {
        'Content-Type': 'text/css',
        'Cache-Control': 'public, max-age=31536000',
      })
    )
  )

  return Effect.runPromise(program)
})
```

### Pattern 3: Multi-Tenant CSS

```typescript
// Each tenant has different theme
const tenants = {
  'tenant-a': { theme: { colors: { primary: '#007bff' } } },
  'tenant-b': { theme: { colors: { primary: '#28a745' } } },
}

app.get('/:tenant/assets/output.css', async (c) => {
  const tenantId = c.req.param('tenant')
  const tenantApp = tenants[tenantId]

  const program = compileCSS(tenantApp)
  const result = await Effect.runPromise(program)

  return c.text(result.css, 200, { 'Content-Type': 'text/css' })
})
```

## Troubleshooting

| Issue                    | Cause                   | Solution                               |
| ------------------------ | ----------------------- | -------------------------------------- |
| CSS not compiling        | PostCSS plugin error    | Check PostCSS version (must be ^8.5.6) |
| Theme tokens not working | Invalid theme structure | Validate theme with Effect Schema      |
| Cache not working        | Theme object mutated    | Ensure theme is immutable              |
| Large CSS bundle         | Too many utilities used | Use Tailwind classes selectively       |
| Slow compilation         | No caching              | Verify cache is working (check logs)   |

## Performance Considerations

### Compilation Time

- **First compilation**: ~50-150ms (PostCSS processing)
- **Cached compilation**: <1ms (memory lookup)
- **Typical CSS size**: 5-20 KB (gzipped)

### Optimization Tips

1. **Use cache effectively**: Same theme = cache hit
2. **Minimize theme changes**: Reduces recompilation
3. **Pre-compile at startup**: Warm cache before first request
4. **Use HTTP caching**: Set `Cache-Control` headers
5. **Monitor cache size**: Large themes = larger cache keys

## References

- Tailwind CSS v4: https://tailwindcss.com/docs
- PostCSS plugin: https://github.com/tailwindlabs/tailwindcss-postcss
- Effect.ts: https://effect.website/docs/introduction
- Sovrium theme models: `src/domain/models/app/theme/`
- CSS compiler source: `src/infrastructure/css/compiler.ts`
