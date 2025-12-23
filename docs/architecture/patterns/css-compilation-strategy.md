# CSS Compilation Strategy

## Overview

Sovrium uses **programmatic CSS compilation** instead of static configuration files. The CSS compiler (`src/infrastructure/css/compiler.ts`) generates Tailwind CSS dynamically from domain theme models at runtime.

## Architecture Decision: No Static Configuration

### Why No `tailwind.config.js`?

**Traditional Approach** (static configuration):

```javascript
// tailwind.config.js
export default {
  theme: {
    colors: {
      primary: '#007bff',
      secondary: '#6c757d',
    },
  },
}
```

**Sovrium Approach** (programmatic generation):

```typescript
// Domain model (src/domain/models/app/theme.ts)
const ThemeSchema = Schema.Struct({
  colors: Schema.optional(ColorsConfigSchema),
  fonts: Schema.optional(FontsConfigSchema),
  spacing: Schema.optional(SpacingConfigSchema),
  // ... other design tokens
})

// Compiler generates CSS dynamically
const sourceCSS = buildSourceCSS(app.theme)
```

### Architectural Rationale

| Aspect                   | Static Config          | Programmatic Compilation      |
| ------------------------ | ---------------------- | ----------------------------- |
| **Multi-Tenancy**        | One theme for all apps | Each app has its own theme    |
| **Configuration Source** | JavaScript file        | App schema (JSON/YAML)        |
| **Runtime Flexibility**  | Rebuild required       | Dynamic generation            |
| **Type Safety**          | Limited                | Full Effect Schema validation |
| **Testing**              | Mock config file       | Pure Effect programs          |
| **Deployment**           | Pre-build step         | On-demand compilation         |
| **Version Control**      | Static theme file      | Schema-driven themes          |

**Key Benefit**: Sovrium is a **configuration-driven platform** where each app instance can have a completely different theme without code changes.

## Compilation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. App Schema (JSON/YAML)                                   │
│    {                                                         │
│      "theme": {                                              │
│        "colors": { "primary": "#007bff" },                   │
│        "fonts": { "sans": { "family": "Inter" } }            │
│      }                                                       │
│    }                                                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼ Effect Schema validation
┌─────────────────────────────────────────────────────────────┐
│ 2. Domain Theme Model (src/domain/models/app/theme.ts)      │
│    type Theme = {                                            │
│      colors?: ColorsConfig                                   │
│      fonts?: FontsConfig                                     │
│      spacing?: SpacingConfig                                 │
│      // ... validated design tokens                          │
│    }                                                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼ Effect.gen program
┌─────────────────────────────────────────────────────────────┐
│ 3. CSS Compiler (src/infrastructure/css/compiler.ts)        │
│    - Generates @theme CSS variables                         │
│    - Generates @layer base (global styles)                  │
│    - Generates @layer components (reusable classes)         │
│    - Generates @layer utilities (custom utilities)          │
│    - Generates @keyframes animations                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼ PostCSS + Tailwind v4
┌─────────────────────────────────────────────────────────────┐
│ 4. Compiled CSS (In-Memory)                                 │
│    @import 'tailwindcss';                                    │
│    @theme {                                                  │
│      --color-primary: #007bff;                               │
│      --font-sans: 'Inter', system-ui, sans-serif;            │
│    }                                                         │
│    /* ... compiled Tailwind utilities */                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼ HTTP response
┌─────────────────────────────────────────────────────────────┐
│ 5. Presentation Layer (/assets/output.css)                  │
│    Hono route serves compiled CSS with cache headers        │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Compiler Entry Point

**File**: `src/infrastructure/css/compiler.ts`

```typescript
export const compileCSS = (app?: App): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  Effect.gen(function* () {
    const theme = app?.theme
    const cacheKey = getThemeCacheKey(theme)

    // Use declarative cache helper with theme-based key
    const result = yield* getOrComputeCachedCSS(cacheKey, compileCSSInternal(theme))

    return result
  })
```

**Key Points**:

- Accepts optional `App` parameter (theme extracted from `app.theme`)
- Returns `Effect.Effect<CompiledCSS, CSSCompilationError>`
- Uses caching service for performance (see Caching Strategy below)

### CSS Generation Phases

#### Phase 1: Theme Variables (`@theme` directive)

```typescript
function generateThemeCSS(theme?: Theme): string {
  if (!theme) return ''

  const themeTokens = [
    generateThemeColors(theme.colors), // --color-primary, --color-secondary
    generateThemeFonts(theme.fonts), // --font-sans, --font-mono
    generateThemeSpacing(theme.spacing), // --spacing-section, --spacing-card
    generateThemeShadows(theme.shadows), // --shadow-sm, --shadow-md
    generateThemeBorderRadius(theme.borderRadius), // --radius-sm, --radius-md
    generateThemeBreakpoints(theme.breakpoints), // --breakpoint-tablet, --breakpoint-desktop
  ].filter(Boolean)

  return `@theme {\n${themeTokens.join('\n')}\n}`
}
```

**Output Example**:

```css
@theme {
  /* Colors */
  --color-primary: #007bff;
  --color-secondary: #6c757d;

  /* Fonts */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'Fira Code', monospace;

  /* Spacing */
  --spacing-section: 4rem;
  --spacing-card: 1.5rem;
}
```

#### Phase 2: Base Layer (Global Styles)

**File**: `src/infrastructure/css/theme-layer-generators.ts`

```typescript
export function generateBaseLayer(theme?: Theme): string {
  return `
@layer base {
  body {
    font-family: var(--font-sans, system-ui, sans-serif);
    line-height: 1.6;
  }

  h1, h2, h3 {
    font-weight: 700;
    line-height: 1.2;
  }
}
`.trim()
}
```

#### Phase 3: Component Layer (Reusable Classes)

**File**: `src/infrastructure/css/component-layer-generators.ts`

```typescript
export function generateComponentsLayer(theme?: Theme): string {
  const hasColors = theme?.colors !== undefined
  const primaryBg = hasColors ? 'bg-primary' : 'bg-blue-600'

  return `
@layer components {
  .btn {
    @apply rounded px-4 py-2 font-medium transition-colors;
  }

  .btn-primary {
    @apply ${primaryBg} text-white hover:opacity-90;
  }

  .card {
    @apply rounded-lg border p-6 shadow-sm;
  }

  .container-page {
    @apply mx-auto px-4;
  }
}
`.trim()
}
```

**Conditional Logic**:

- If `theme.colors.primary` exists → Use `bg-primary`
- If no theme colors → Fallback to `bg-blue-600`
- This ensures components work with or without theme configuration

#### Phase 4: Utilities Layer (Custom Utilities)

```typescript
export function generateUtilitiesLayer(): string {
  return `
@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
`.trim()
}
```

#### Phase 5: Animations

**File**: `src/infrastructure/css/animation-styles-generator.ts`

```typescript
export function generateAnimationStyles(animations?: AnimationsConfig, theme?: Theme): string {
  if (!animations) return ''

  // Generate @keyframes and animation utility classes
  // Uses theme colors if available for color-based animations
}
```

### PostCSS Processing

```typescript
const compileCSSInternal = (theme?: Theme): Effect.Effect<CompiledCSS, CSSCompilationError> =>
  Effect.gen(function* () {
    // Build SOURCE_CSS with theme
    const sourceCSS = buildSourceCSS(theme)

    // Process CSS through PostCSS with Tailwind plugin
    const result = yield* Effect.tryPromise({
      try: async () => {
        const processor = postcss([tailwindcss()])
        return await processor.process(sourceCSS, {
          from: process.cwd() + '/src/styles/global.css',
          to: undefined, // No output file (in-memory)
        })
      },
      catch: (error) => new CSSCompilationError(error),
    })

    return {
      css: result.css,
      timestamp: Date.now(),
    }
  })
```

**Key Points**:

- `sourceCSS` is generated dynamically (not read from file)
- PostCSS processes in-memory (no file I/O)
- Errors wrapped in `CSSCompilationError` for type-safe error handling

## Caching Strategy

### In-Memory Cache with Effect.Ref

**File**: `src/infrastructure/css/css-cache-service.ts`

```typescript
/**
 * In-memory cache for compiled CSS using Effect.Ref
 * Stores multiple themes keyed by normalized theme hash
 */
const cssCache = Ref.unsafeMake<Map<string, CompiledCSS>>(new Map())

export interface CompiledCSS {
  readonly css: string
  readonly timestamp: number
}
```

### Cache Key Normalization

**Problem**: JavaScript object property order can vary, causing cache misses for identical themes.

**Solution**: Recursive key sorting for consistent cache keys.

```typescript
const sortObjectKeys = (obj: unknown): unknown => {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys)
  }

  const record = obj as Record<string, unknown>
  const sortedKeys = Object.keys(record).toSorted()

  return sortedKeys.reduce<Record<string, unknown>>(
    (acc, key) => ({ ...acc, [key]: sortObjectKeys(record[key]) }),
    {}
  )
}

export const getThemeCacheKey = (theme?: Theme): string => {
  const normalized = sortObjectKeys(theme) as Theme | undefined
  return JSON.stringify(normalized ?? {})
}
```

**Example**:

```typescript
// These produce the SAME cache key:
getThemeCacheKey({ colors: { primary: '#007bff' }, fonts: { sans: 'Inter' } })
getThemeCacheKey({ fonts: { sans: 'Inter' }, colors: { primary: '#007bff' } })

// Cache key: '{"colors":{"primary":"#007bff"},"fonts":{"sans":"Inter"}}'
// (keys always sorted alphabetically)
```

### Cache Retrieval Flow

```typescript
export const getOrComputeCachedCSS = <E>(
  cacheKey: string,
  compute: Effect.Effect<CompiledCSS, E>
): Effect.Effect<CompiledCSS, E> =>
  Effect.gen(function* () {
    // 1. Try to get from cache
    const cached = yield* getCachedCSS(cacheKey)
    if (cached !== undefined) {
      return cached // Cache hit
    }

    // 2. Cache miss - compile CSS
    const compiled = yield* compute

    // 3. Store in cache
    yield* setCachedCSS(cacheKey, compiled)

    return compiled
  })
```

**Performance Characteristics**:
| Scenario | Time | Cache State |
|----------|------|-------------|
| First request (new theme) | ~100-200ms | Miss → Compile → Store |
| Subsequent requests (same theme) | <1ms | Hit → Return cached |
| Different theme | ~100-200ms | Miss → Compile → Store |
| Same theme (property order differs) | <1ms | Hit (normalized key) |

### Cache Invalidation

**Manual Invalidation** (useful for testing or hot reload):

```typescript
export const clearCSSCache = (): Effect.Effect<void, never> => Ref.set(cssCache, new Map())
```

**Automatic Invalidation**:

- Cache invalidates automatically when theme changes (different cache key)
- No TTL (time-to-live) - cache persists until server restart or manual clear
- Cache is per-process (multiple server instances have independent caches)

## Effect.ts Integration

### Error Handling

**Error Type**:

```typescript
// src/infrastructure/errors/css-compilation-error.ts
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

**Error Recovery** (in presentation layer):

```typescript
app.get('/assets/output.css', async (c) => {
  const program = compileCSS(app).pipe(
    Effect.catchTag('CSSCompilationError', (error) => {
      console.error('CSS compilation failed:', error.cause)
      return Effect.succeed({
        css: '/* CSS compilation failed */',
        timestamp: Date.now(),
      })
    })
  )

  const result = await Effect.runPromise(program)
  return c.text(result.css, 200, {
    'Content-Type': 'text/css',
    'Cache-Control': 'public, max-age=31536000',
  })
})
```

### Functional Composition

**Compiler is a Pure Effect Program**:

```typescript
// Domain model → Infrastructure service → Presentation route
const program = Effect.gen(function* () {
  const theme = app.theme // Domain model
  const compiled = yield* compileCSS(app) // Infrastructure service
  return compiled.css // Presentation layer consumes
})
```

**Testability**:

```typescript
// Test with mock theme
const mockTheme: Theme = {
  colors: { primary: '#007bff' },
}

const program = compileCSS({ theme: mockTheme })
const result = await Effect.runPromise(program)

expect(result.css).toContain('--color-primary: #007bff')
```

## Layer Separation

### Domain Layer (Pure Models)

**File**: `src/domain/models/app/theme.ts`

```typescript
export const ThemeSchema = Schema.Struct({
  colors: Schema.optional(ColorsConfigSchema),
  fonts: Schema.optional(FontsConfigSchema),
  spacing: Schema.optional(SpacingConfigSchema),
  animations: Schema.optional(AnimationsConfigSchema),
  breakpoints: Schema.optional(BreakpointsConfigSchema),
  shadows: Schema.optional(ShadowsConfigSchema),
  borderRadius: Schema.optional(BorderRadiusConfigSchema),
})

export type Theme = Schema.Schema.Type<typeof ThemeSchema>
```

**Responsibility**: Define what a theme IS (structure, validation rules, types)

### Infrastructure Layer (CSS Compilation)

**Files**:

- `src/infrastructure/css/compiler.ts` - Main compilation logic
- `src/infrastructure/css/css-cache-service.ts` - Caching
- `src/infrastructure/css/theme-generators.ts` - @theme generation
- `src/infrastructure/css/theme-layer-generators.ts` - @layer base
- `src/infrastructure/css/component-layer-generators.ts` - @layer components, utilities
- `src/infrastructure/css/animation-styles-generator.ts` - @keyframes

**Responsibility**: Transform domain theme models into CSS strings (HOW to compile)

### Presentation Layer (HTTP Routes)

**File**: `src/presentation/api/routes/*.ts`

```typescript
app.get('/assets/output.css', async (c) => {
  const compiled = yield * compileCSS(app)
  return c.text(compiled.css, 200, {
    'Content-Type': 'text/css',
    'Cache-Control': 'public, max-age=31536000',
  })
})
```

**Responsibility**: Serve compiled CSS to browsers (WHERE to deliver)

## Configuration Files (What's Missing)

### No Static Files Required

Sovrium does **NOT** use these traditional Tailwind configuration files:

- ❌ `tailwind.config.js` - Replaced by programmatic generation
- ❌ `tailwind.config.ts` - Not needed (TypeScript types from domain models)
- ❌ `postcss.config.js` - PostCSS configured in-memory
- ❌ `src/styles/global.css` - CSS generated dynamically
- ❌ `src/styles/*.css` - No static CSS source files

### Why This Approach?

| Traditional                 | Sovrium                   | Benefit                   |
| --------------------------- | ------------------------- | ------------------------- |
| Static `tailwind.config.js` | Dynamic theme from schema | Multi-tenant support      |
| Pre-build CSS compilation   | Runtime CSS compilation   | No build step required    |
| One theme per deployment    | Theme per app instance    | Configuration flexibility |
| Rebuild for theme changes   | Instant theme updates     | Developer experience      |
| Version control theme file  | Schema-driven themes      | Declarative configuration |

## Usage Examples

### Basic Usage

```typescript
import { compileCSS } from '@/infrastructure/css'
import { Effect } from 'effect'

// Compile CSS with app theme
const program = Effect.gen(function* () {
  const compiled = yield* compileCSS(app)
  console.log(`Compiled ${compiled.css.length} bytes`)
  return compiled
})

const result = await Effect.runPromise(program)
```

### Error Handling

```typescript
const programWithErrorHandling = compileCSS(app).pipe(
  Effect.tap((result) => Console.log(`CSS compiled: ${result.css.length} bytes`)),
  Effect.catchTag('CSSCompilationError', (error) => {
    console.error('Compilation failed:', error.cause)
    return Effect.succeed(fallbackCSS)
  })
)
```

### Testing

```typescript
import { test, expect } from 'bun:test'
import { compileCSS } from '@/infrastructure/css'
import { Effect } from 'effect'

test('compiles CSS with theme colors', async () => {
  const app = {
    theme: {
      colors: { primary: '#007bff' },
    },
  }

  const result = await Effect.runPromise(compileCSS(app))

  expect(result.css).toContain('--color-primary: #007bff')
  expect(result.css).toContain("@import 'tailwindcss'")
})

test('compiles CSS without theme (minimal)', async () => {
  const result = await Effect.runPromise(compileCSS())

  expect(result.css).toContain("@import 'tailwindcss'")
  expect(result.css).not.toContain('@theme')
})
```

## Performance Optimization

### Caching Effectiveness

**Scenario 1: Same Theme, Multiple Requests**

```
Request 1: Compile (200ms) → Cache store
Request 2: Cache hit (<1ms)
Request 3: Cache hit (<1ms)
...
Request N: Cache hit (<1ms)
```

**Scenario 2: Different Themes, Multiple Apps**

```
App A Request 1: Compile (200ms) → Cache store (key: "theme-A")
App B Request 1: Compile (200ms) → Cache store (key: "theme-B")
App A Request 2: Cache hit (<1ms) (key: "theme-A")
App B Request 2: Cache hit (<1ms) (key: "theme-B")
```

**Scenario 3: Theme Update**

```
Before: Cache hit for theme-v1 (<1ms)
After theme change: Compile theme-v2 (200ms) → Cache store
Subsequent requests: Cache hit for theme-v2 (<1ms)
```

### Memory Usage

**Estimated memory per cached theme**: ~500KB - 2MB (depending on theme complexity)

**Cache growth**: Linear with number of unique themes

- 10 themes ≈ 5-20 MB
- 100 themes ≈ 50-200 MB
- 1000 themes ≈ 500MB - 2GB

**Mitigation**: Cache is per-process, resets on server restart (no persistent storage)

## Related Documentation

- `@docs/infrastructure/ui/tailwind.md` - Tailwind CSS v4 usage patterns
- `@docs/infrastructure/css/css-compiler.md` - Detailed compiler technical reference
- `@docs/domain/models/theme-design-tokens.md` - Theme schema documentation
- `@docs/architecture/layer-based-architecture.md` - Layer separation principles
- `@docs/infrastructure/framework/effect.md` - Effect.ts patterns

## Summary

Sovrium's CSS compilation strategy is:

1. **Programmatic, not static** - CSS generated from domain models at runtime
2. **Schema-driven** - Theme configuration comes from app schema
3. **Cached per theme** - Normalized cache keys prevent duplicate compilation
4. **Effect-based** - Type-safe error handling and functional composition
5. **Layer-separated** - Domain models → Infrastructure compiler → Presentation routes
6. **Multi-tenant ready** - Each app can have a unique theme without code changes

This approach enables Sovrium's vision as a **configuration-driven platform** where CSS is just another aspect derived from declarative app configuration.
