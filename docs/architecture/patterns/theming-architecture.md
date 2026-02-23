# Theming Architecture Pattern

## Overview

Sovrium's theming system implements a **Domain-Driven CSS Compilation Pattern** that bridges functional domain models with Tailwind CSS v4's `@theme` directive. This pattern ensures type-safe, configuration-driven styling while maintaining strict layer-based architecture boundaries.

**Key Characteristics**:

- **Domain Layer**: Theme models define design tokens as pure data structures (Effect Schema)
- **Infrastructure Layer**: CSS compiler transforms domain models into Tailwind CSS at runtime
- **Zero Variable Substitution**: No `$theme.spacing` in className props - direct Tailwind utilities only
- **Immutable Compilation**: Functional CSS generation with in-memory caching via Effect.Ref

---

## Why This Pattern Exists

### Problem Statement

Traditional theme systems suffer from:

1. **Runtime variable substitution complexity** - Parsing `className="p-$theme.spacing"` requires complex AST transformations
2. **Type safety gaps** - String-based theme references (`$theme.colors.primary`) lack compile-time validation
3. **Architecture violations** - Direct coupling between presentation layer and theme infrastructure
4. **Performance overhead** - Per-component theme lookups slow down rendering

### Solution: Domain-Driven CSS Compilation

Sovrium's approach solves these problems by:

1. **Pure Domain Models** (Domain Layer)
   - Theme configuration defined as immutable Effect Schemas
   - No coupling to CSS generation logic (pure data)
   - Enforces semantic naming and validation rules

2. **Compile-Time CSS Generation** (Infrastructure Layer)
   - Transforms domain theme models into Tailwind `@theme` CSS once at server startup
   - Generates CSS variables (`--color-primary`, `--spacing-section`) accessible via Tailwind utilities
   - Caches compiled CSS in memory (Effect.Ref) for zero-cost subsequent requests

3. **Direct Tailwind Utilities** (Presentation Layer)
   - Components use standard Tailwind classes: `className="bg-primary p-section"`
   - No variable substitution - Tailwind resolves `bg-primary` to `var(--color-primary)`
   - Type-safe via TypeScript and ESLint (standard Tailwind validation)

---

## Architecture Layers Integration

```
┌─────────────────────────────────────────────────────────────────┐
│ PRESENTATION LAYER (UI Components)                              │
│  - React components use Tailwind utilities: "bg-primary"        │
│  - NO theme variable substitution ($theme.x)                    │
│  - Tailwind CSS resolves utilities to CSS variables             │
├─────────────────────────────────────────────────────────────────┤
│ APPLICATION LAYER (Use Cases)                                   │
│  - compileCSS use case orchestrates CSS generation              │
│  - Reads App domain model, triggers infrastructure compiler     │
├─────────────────────────────────────────────────────────────────┤
│ DOMAIN LAYER (Theme Models) - PURE                              │
│  ✅ Theme schema (Effect Schema with validation)                │
│  ✅ Design tokens: colors, fonts, spacing, animations, etc.     │
│  ✅ Zero dependencies on infrastructure or presentation         │
├─────────────────────────────────────────────────────────────────┤
│ INFRASTRUCTURE LAYER (CSS Compiler)                             │
│  - compileCSS(): Transforms domain Theme → Tailwind @theme CSS  │
│  - In-memory cache (Effect.Ref) for compiled CSS                │
│  - PostCSS + Tailwind v4 plugin for CSS processing              │
└─────────────────────────────────────────────────────────────────┘
```

### Dependency Flow (Enforced by ESLint boundaries)

```
Presentation (Tailwind utilities) → Application (compileCSS) → Domain (Theme) ← Infrastructure (CSS Compiler)
```

**Critical Rule**: Domain layer theme models depend on NOTHING. Infrastructure reads domain models but never modifies them.

---

## Implementation Details

### 1. Domain Layer: Theme Models

**Location**: `src/domain/models/app/theme/`

**Why in Domain Layer**:

- Theme configuration represents **business domain knowledge** (brand identity, design system)
- Pure data structures with validation rules (no side effects)
- Shared across all layers (presentation needs theme, infrastructure compiles it)
- Follows "Domain is the truth" principle - theme is a core domain concept

**Structure**:

```typescript
// src/domain/models/app/theme.ts
export const ThemeSchema = Schema.Struct({
  colors: Schema.optional(ColorsConfigSchema), // Visual identity
  fonts: Schema.optional(FontsConfigSchema), // Typography
  spacing: Schema.optional(SpacingConfigSchema), // Layout rhythm
  animations: Schema.optional(AnimationsConfigSchema), // Motion design
  breakpoints: Schema.optional(BreakpointsConfigSchema), // Responsive
  shadows: Schema.optional(ShadowsConfigSchema), // Elevation
  borderRadius: Schema.optional(BorderRadiusConfigSchema), // Corners
})
```

**Key Design Decisions**:

1. **All properties optional** - Supports minimal themes (colors-only) or comprehensive design systems (all 7 categories)
2. **Effect Schema validation** - Ensures semantic naming, valid CSS values, progressive scales
3. **Immutable by design** - `readonly` enforced via ESLint `functional/prefer-immutable-types`

**Example Theme Configuration**:

```typescript
const theme: Theme = {
  colors: {
    primary: '#007bff',
    'primary-hover': '#0056b3',
    text: '#212529',
  },
  spacing: {
    section: '4rem',
    gap: '1rem',
  },
  fonts: {
    body: {
      family: 'Inter',
      fallback: 'sans-serif',
    },
  },
}
```

### 2. Infrastructure Layer: CSS Compiler

**Location**: `src/infrastructure/css/compiler.ts`

**Why in Infrastructure Layer**:

- Performs I/O (PostCSS processing, file system access for Tailwind config)
- External dependency on Tailwind CSS plugin
- Side effects (CSS compilation, caching)
- NOT pure business logic (domain concern)

**Core Function**:

```typescript
export const compileCSS = (app?: App): Effect.Effect<CompiledCSS, CSSCompilationError>
```

**Process Flow**:

1. **Extract Theme**: Read `app.theme` from domain model
2. **Generate @theme CSS**: Transform theme tokens into Tailwind v4 `@theme` directive
   ```css
   @theme {
     --color-primary: #007bff;
     --spacing-section: 4rem;
     --font-body: Inter, sans-serif;
   }
   ```
3. **PostCSS Processing**: Run Tailwind CSS plugin to expand utilities
4. **Cache Result**: Store compiled CSS in Effect.Ref (in-memory cache)

**Caching Strategy**:

```typescript
// Functional cache using Effect.Ref (immutable state management)
const cssCache = Ref.unsafeMake<Map<string, CompiledCSS>>(new Map())

// Cache key: JSON hash of theme (same theme = same CSS)
function getThemeCacheKey(theme?: Theme): string {
  return JSON.stringify(theme || {})
}
```

**Why In-Memory Cache**:

- CSS compilation is expensive (~100-300ms for full Tailwind build)
- Theme changes are rare (design system updates, not per-request)
- Functional state management via Effect.Ref (no mutations)
- Cache invalidation: New theme hash = new cache entry

### 3. Presentation Layer: Tailwind Utilities

**Why No Variable Substitution**:

**❌ Rejected Approach** (Variable Substitution):

```typescript
// This was REMOVED - complexity without benefits
<div className="p-$theme.spacing bg-$theme.colors.primary" />
```

**Problems**:

1. Requires runtime AST parsing of className strings
2. No TypeScript autocomplete for theme paths
3. Hard to validate (ESLint can't check `$theme.spacing` exists)
4. Performance overhead (parse every className prop)

**✅ Current Approach** (Direct Tailwind Utilities):

```typescript
// Clean, type-safe, performant
<div className="p-section bg-primary" />
```

**Benefits**:

1. **Standard Tailwind** - No custom syntax to learn
2. **TypeScript autocomplete** - IDE suggests `bg-primary` from generated CSS
3. **ESLint validation** - Tailwind ESLint plugin validates utilities exist
4. **Zero runtime cost** - Tailwind resolves `bg-primary` to `var(--color-primary)` at build time

**How It Works**:

```css
/* Generated by CSS Compiler */
@theme {
  --color-primary: #007bff;
  --spacing-section: 4rem;
}

/* Tailwind expands utilities */
.bg-primary {
  background-color: var(--color-primary);
}
.p-section {
  padding: var(--spacing-section);
}
```

**Component Usage**:

```tsx
// src/presentation/ui/ui/hero-section.tsx
export function HeroSection() {
  return (
    <section className="p-section bg-primary">
      <h1 className="font-heading text-text">Welcome</h1>
    </section>
  )
}
```

---

## Enforcement Mechanisms

### ESLint Boundaries Enforcement

**Layer Isolation** (Enforced by `eslint-plugin-boundaries`):

```typescript
// eslint/boundaries.config.ts
{
  from: ['domain-model-app'], // Theme is in domain/models/app/theme/
  allow: ['domain-model-app'], // Can only import other domain models
  message: 'Domain violation: Theme models must be pure (no infrastructure/presentation dependencies)'
}

{
  from: ['infrastructure-css'], // CSS compiler
  allow: ['domain-model-app'], // Can read theme models
  message: 'Infrastructure violation: CSS compiler reads domain models (unidirectional dependency)'
}
```

**What This Prevents**:

- ❌ Theme models importing CSS compiler logic (domain → infrastructure violation)
- ❌ CSS compiler modifying theme models (infrastructure should read, not write)
- ❌ Presentation layer importing CSS compiler directly (use application layer)

### Functional Programming Enforcement

**Immutability** (Enforced by `eslint-plugin-functional`):

```typescript
// eslint/functional.config.ts
{
  'functional/prefer-immutable-types': ['error', {
    enforcement: 'ReadonlyShallow',
  }],
  'functional/immutable-data': ['error', {
    ignoreImmediateMutation: false,
  }],
}
```

**What This Enforces**:

- ✅ Theme models are `readonly` (cannot mutate `theme.colors.primary = '#new'`)
- ✅ CSS compiler uses immutable transformations (no `theme.colors.push()`)
- ✅ Cache updates use functional patterns (`new Map([...cache, [key, value]])`)

**Example Enforcement**:

```typescript
// ❌ ESLint Error: functional/immutable-data
theme.colors.primary = '#new-color'

// ✅ Correct: Create new theme object
const updatedTheme = { ...theme, colors: { ...theme.colors, primary: '#new-color' } }
```

### TypeScript Strict Mode

**Type Safety** (Enforced by `tsconfig.json`):

```json
{
  "strict": true,
  "strictNullChecks": true,
  "noImplicitAny": true
}
```

**What This Enforces**:

- ✅ Theme models have explicit types (no `any`)
- ✅ Optional theme properties handled correctly (`theme?.colors`)
- ✅ CSS compiler input/output types validated

---

## Best Practices

### 1. Theme Configuration

**✅ DO: Use Semantic Naming**

```typescript
const theme = {
  colors: {
    primary: '#007bff',
    'primary-hover': '#0056b3',
    text: '#212529',
    background: '#ffffff',
  },
}
```

**❌ DON'T: Use Arbitrary Names**

```typescript
const theme = {
  colors: {
    blue1: '#007bff',
    blue2: '#0056b3',
  },
}
```

**Why**: Semantic names communicate intent. `primary-hover` tells developers this is a hover state color.

### 2. Progressive Scales

**✅ DO: Use Numbered Scales for Grays**

```typescript
const theme = {
  colors: {
    'gray-100': '#f8f9fa',
    'gray-500': '#adb5bd',
    'gray-900': '#212529',
  },
}
```

**❌ DON'T: Use Non-Progressive Naming**

```typescript
const theme = {
  colors: {
    'light-gray': '#f8f9fa',
    'medium-gray': '#adb5bd',
    'dark-gray': '#212529',
  },
}
```

**Why**: Numbered scales (100-900) are industry standard (Tailwind, Material Design) and easier to extend.

### 3. Minimal Themes

**✅ DO: Start Simple, Grow as Needed**

```typescript
// Phase 1: Colors only
const minimalTheme = {
  colors: { primary: '#007bff' },
}

// Phase 2: Add typography
const extendedTheme = {
  colors: { primary: '#007bff' },
  fonts: { body: { family: 'Inter' } },
}
```

**❌ DON'T: Over-Engineer Upfront**

```typescript
// Premature complexity - most projects don't need all 7 categories immediately
const theme = {
  colors: {
    /* 50 colors */
  },
  fonts: {
    /* 10 font families */
  },
  spacing: {
    /* 20 spacing values */
  },
  animations: {
    /* 30 animations */
  },
  // ...
}
```

**Why**: Theme complexity should match project needs. Start minimal, extend when patterns emerge.

### 4. CSS Variable Naming

**✅ DO: Follow Tailwind Conventions**

```typescript
// CSS compiler generates: --color-primary, --spacing-section
const theme = {
  colors: { primary: '#007bff' },
  spacing: { section: '4rem' },
}
```

**❌ DON'T: Use Non-Standard Prefixes**

```typescript
// Would generate: --theme-color-primary (breaks Tailwind utilities)
// Not supported by current compiler
```

**Why**: Tailwind utilities expect `--color-*`, `--spacing-*` naming. Custom prefixes break utility resolution.

---

## Common Pitfalls

### 1. Attempting Variable Substitution in className

**❌ PITFALL**:

```tsx
<div className="p-$theme.spacing" />
```

**Error**: Variable substitution is NOT supported. This will render literally as `class="p-$theme.spacing"`.

**✅ SOLUTION**:

```tsx
// Define spacing in theme
const theme = { spacing: { section: '4rem' } }

// Use Tailwind utility
<div className="p-section" />
```

**Why**: Tailwind utilities are generated at compile-time. Runtime variable substitution would require custom AST parsing.

### 2. Mutating Theme Models

**❌ PITFALL**:

```typescript
// ESLint error: functional/immutable-data
theme.colors.primary = '#new-color'
```

**✅ SOLUTION**:

```typescript
// Create new theme object
const updatedTheme = {
  ...theme,
  colors: { ...theme.colors, primary: '#new-color' },
}
```

**Why**: Theme models are immutable. Mutations break functional programming principles and can cause cache invalidation issues.

### 3. Direct Infrastructure Imports in Presentation

**❌ PITFALL**:

```typescript
// src/presentation/ui/ui/button.tsx
import { compileCSS } from '@/infrastructure/css/compiler' // ❌ Layer violation
```

**Error**: ESLint boundaries error - Presentation cannot import Infrastructure directly.

**✅ SOLUTION**:

```typescript
// Presentation uses Application layer use cases
import { getCompiledCSS } from '@/application/use-cases/css'
```

**Why**: Layer-based architecture requires Presentation → Application → Infrastructure flow.

### 4. Assuming Immediate CSS Updates

**❌ PITFALL**:

```typescript
// Update theme
app.theme.colors.primary = '#new-color'

// Expect CSS to update immediately
// Reality: CSS cache still has old compiled CSS
```

**✅ SOLUTION**:

```typescript
// Updating theme requires recompiling CSS
const updatedApp = { ...app, theme: newTheme }
const newCSS = await Effect.runPromise(compileCSS(updatedApp))
```

**Why**: CSS compilation happens at server startup. Theme changes require cache invalidation and recompilation.

---

## Testing Strategy

### Domain Layer Tests (Unit Tests - Bun Test)

**Location**: `src/domain/models/app/theme/*.test.ts`

**What to Test**:

- ✅ Schema validation (valid colors, fonts, spacing)
- ✅ Edge cases (empty theme, minimal theme, comprehensive theme)
- ✅ Error messages (invalid color format, invalid spacing value)

**Example**:

```typescript
// src/domain/models/app/theme/colors.test.ts
test('ColorValueSchema validates hex colors', () => {
  const validHex = '#007bff'
  const result = Schema.decodeUnknownSync(ColorValueSchema)(validHex)
  expect(result).toBe(validHex)
})

test('ColorValueSchema rejects invalid hex colors', () => {
  const invalidHex = 'not-a-color'
  expect(() => Schema.decodeUnknownSync(ColorValueSchema)(invalidHex)).toThrow()
})
```

### Infrastructure Layer Tests (Unit Tests - Bun Test)

**Location**: `src/infrastructure/css/compiler.test.ts`

**What to Test**:

- ✅ CSS generation (theme → Tailwind @theme CSS)
- ✅ Caching logic (same theme = same CSS, different theme = different CSS)
- ✅ Error handling (invalid theme, PostCSS errors)

**Example**:

```typescript
// src/infrastructure/css/compiler.test.ts
test('compileCSS generates Tailwind @theme CSS', async () => {
  const app = {
    name: 'test-app',
    theme: { colors: { primary: '#007bff' } },
  }

  const result = await Effect.runPromise(compileCSS(app))
  expect(result.css).toContain('--color-primary: #007bff')
})
```

### E2E Tests (Playwright)

**Location**: `specs/app/theme/*.spec.ts`

**What to Test**:

- ✅ Visual regression (screenshot comparisons)
- ✅ CSS output (verify compiled CSS serves correctly)
- ✅ Component rendering (Tailwind utilities apply theme correctly)

**Example**:

```typescript
// specs/app/theme/theme.spec.ts
test('APP-THEME-001: should validate theme with colors as the only design token category', async ({
  page,
}) => {
  // GIVEN: minimal theme with colors only
  // WHEN: page renders
  // THEN: CSS contains color definitions AND element renders with correct styles

  const cssResponse = await page.request.get('/assets/output.css')
  const css = await cssResponse.text()
  expect(css).toContain('--color-primary: #007bff')

  const element = page.locator('[data-testid="color-primary"]')
  const bgColor = await element.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bgColor).toBe('rgb(0, 123, 255)') // #007bff
})
```

---

## Performance Considerations

### CSS Compilation Cost

**Benchmark** (on typical machine):

- Initial compilation (no cache): ~100-300ms
- Cached retrieval: <1ms (in-memory Map lookup)
- Theme hash computation: <5ms (JSON.stringify)

**Optimization Strategy**:

1. **Compile once at startup** - Server initialization includes CSS compilation
2. **Cache in-memory** - Effect.Ref provides functional, zero-cost cache access
3. **Hash-based invalidation** - New theme = new hash = new cache entry (old cache retained until GC)

### When to Worry About Performance

**✅ OK**:

- 1-5 themes per application (typical use case)
- Theme updates every few weeks/months (design system evolution)

**⚠️ CONCERN**:

- 100+ themes (multi-tenant SaaS with per-customer themes)
- Theme updates every request (dynamic theming based on user preferences)

**Solution for High-Volume Scenarios**:

- Pre-compile CSS for known themes (build-time compilation)
- Implement LRU cache eviction (currently cache never evicts)
- Consider CDN caching for compiled CSS (serve from edge)

---

## Migration Guide

### From Variable Substitution to Direct Utilities

**Before** (Variable Substitution - NOT SUPPORTED):

```tsx
<div className="p-$theme.spacing bg-$theme.colors.primary" />
```

**After** (Direct Tailwind Utilities):

```tsx
// 1. Define theme
const theme = {
  spacing: { section: '4rem' },
  colors: { primary: '#007bff' },
}

// 2. Use Tailwind utilities
<div className="p-section bg-primary" />
```

**Migration Steps**:

1. Identify all `$theme.*` references in className props
2. Extract theme token names (e.g., `$theme.spacing` → `section`)
3. Update theme configuration to include those tokens
4. Replace variable references with Tailwind utilities
5. Run `bun test:e2e` to verify visual consistency

---

## Related Documentation

- **Layer-Based Architecture**: `@docs/architecture/layer-based-architecture.md`
- **Functional Programming Principles**: `@docs/architecture/functional-programming.md`
- **ESLint Boundaries Configuration**: `@docs/infrastructure/quality/eslint.md`
- **Effect Schema Validation**: `@docs/infrastructure/framework/effect.md`
- **Tailwind CSS Integration**: `@docs/infrastructure/ui/tailwind.md`

---

## Revision History

| Date       | Version | Changes                                       |
| ---------- | ------- | --------------------------------------------- |
| 2025-11-10 | 1.0.0   | Initial documentation of theming architecture |
