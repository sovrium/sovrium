# PostCSS - CSS Transformation Pipeline

## Overview

**Version**: 8.5.6 (flexible range, minimum 8.5.6)
**Purpose**: CSS transformation tool that processes CSS with JavaScript plugins
**Usage**: Required by Tailwind CSS v4 for programmatic CSS compilation
**Integration**: Used by `src/infrastructure/css/compiler.ts` via `@tailwindcss/postcss`

## What is PostCSS?

PostCSS is a tool for transforming CSS with JavaScript plugins. It parses CSS, transforms it through a series of plugins, and outputs processed CSS. Think of it as Babel for CSS - it allows you to use modern CSS features and custom transformations.

**Key Capabilities**:

- **CSS Parsing**: Converts CSS strings into an Abstract Syntax Tree (AST)
- **Plugin System**: Extensible architecture for CSS transformations
- **Source Maps**: Maintains accurate CSS source maps through transformations
- **Performance**: Fast processing with minimal overhead
- **Ecosystem**: Large plugin ecosystem (autoprefixer, cssnano, etc.)

## Why PostCSS in Sovrium?

**Primary Use Case**: Tailwind CSS v4 compilation

Sovrium uses PostCSS exclusively for processing Tailwind CSS via the `@tailwindcss/postcss` plugin. The CSS compiler programmatically invokes PostCSS to transform source CSS (with `@theme` directives and Tailwind utilities) into production-ready CSS.

### Architecture

```
Source CSS (@theme, @import)
    ↓
PostCSS Parser (CSS → AST)
    ↓
@tailwindcss/postcss Plugin
    ├── Expand @theme directives
    ├── Generate utility classes
    ├── Process @import statements
    └── Minify output (production)
    ↓
PostCSS Stringifier (AST → CSS)
    ↓
Compiled CSS (ready for browser)
```

## Installation

PostCSS is already installed in Sovrium:

```json
{
  "dependencies": {
    "postcss": "^8.5.6",
    "@tailwindcss/postcss": "^4.1.18"
  }
}
```

**Why these versions**:

- **postcss@8.5.6**: Stable version with modern features (container queries, nesting)
- **@tailwindcss/postcss@4.1.18**: Tailwind CSS v4 PostCSS plugin (required)

## Usage in Sovrium

### Programmatic API (Current Implementation)

Sovrium uses PostCSS programmatically in the CSS compiler:

```typescript
// src/infrastructure/css/compiler.ts (simplified)
import postcss from 'postcss'
import tailwindcss from '@tailwindcss/postcss'

// Source CSS with Tailwind directives
const sourceCss = `
  @import "tailwindcss";
  @theme {
    --color-primary: #3b82f6;
  }
`

// Process CSS with PostCSS + Tailwind plugin
const result = await postcss([tailwindcss()]).process(sourceCss, {
  from: undefined, // No source file (programmatic)
})

const compiledCss = result.css // Production-ready CSS
```

**Key Points**:

- **No config file**: PostCSS configured programmatically, not via `postcss.config.js`
- **Single plugin**: Only `@tailwindcss/postcss` plugin used
- **In-memory processing**: CSS never touches disk during compilation
- **Effect.ts integration**: PostCSS wrapped in Effect for error handling

### Why Programmatic (Not Config File)?

**Traditional approach** (NOT used):

```javascript
// postcss.config.js (we don't use this)
export default {
  plugins: {
    tailwindcss: {},
  },
}
```

**Sovrium's approach** (programmatic):

```typescript
// src/infrastructure/css/compiler.ts
const result = await postcss([tailwindcss()]).process(sourceCss)
```

**Benefits of programmatic approach**:

1. **Dynamic themes**: Generate CSS per app schema (not static config)
2. **Type safety**: Full TypeScript support (no JS config files)
3. **Caching**: In-memory cache per theme (faster than file I/O)
4. **Effect integration**: Wrap in Effect for functional error handling
5. **Testability**: Easy to unit test without file system

## PostCSS Features Used

### 1. CSS Parsing & AST

PostCSS parses CSS into an Abstract Syntax Tree (AST):

```typescript
import postcss from 'postcss'

const root = postcss.parse('a { color: black; }')
root.walkRules((rule) => {
  console.log(rule.selector) // "a"
})
```

**Sovrium usage**: PostCSS parser used internally by `@tailwindcss/postcss`

### 2. Source Maps

PostCSS maintains source maps for debugging:

```typescript
const result = await postcss([tailwindcss()]).process(sourceCss, {
  from: 'source.css',
  map: { inline: false }, // Generate external source map
})

console.log(result.map.toString()) // Source map JSON
```

**Sovrium usage**: Source maps disabled in production (not needed for utility CSS)

### 3. Async Processing

PostCSS supports async plugins:

```typescript
const result = await postcss([
  tailwindcss(), // Async plugin
]).process(sourceCss)
```

**Sovrium usage**: Tailwind CSS plugin is async, so we use `await`

## PostCSS Plugins (Ecosystem)

### Currently Used

| Plugin                   | Version | Purpose                  |
| ------------------------ | ------- | ------------------------ |
| **@tailwindcss/postcss** | 4.1.18  | Tailwind CSS v4 compiler |

### NOT Used (But Popular)

| Plugin                 | Purpose             | Why Not Used                              |
| ---------------------- | ------------------- | ----------------------------------------- |
| **autoprefixer**       | Add vendor prefixes | ⚠️ Tailwind CSS v4 includes this          |
| **cssnano**            | Minify CSS          | ⚠️ Tailwind CSS v4 minifies automatically |
| **postcss-nested**     | Nested CSS syntax   | ⚠️ Tailwind CSS v4 supports nesting       |
| **postcss-preset-env** | Modern CSS features | ⚠️ Tailwind CSS v4 includes polyfills     |

**Why minimal plugins?**

- Tailwind CSS v4 includes most post-processing features
- Reduces dependency chain (fewer potential bugs)
- Faster compilation (fewer transformation steps)
- Simpler debugging (single plugin to troubleshoot)

## Configuration (Programmatic)

### Basic Setup

```typescript
import postcss from 'postcss'
import tailwindcss from '@tailwindcss/postcss'

const processor = postcss([
  tailwindcss({
    // Tailwind CSS options (if any)
  }),
])

const result = await processor.process(css, {
  from: undefined, // No source file
  to: undefined, // No output file
})
```

### With Error Handling (Sovrium Style)

```typescript
import { Effect } from 'effect'
import postcss from 'postcss'
import tailwindcss from '@tailwindcss/postcss'

const compileCSS = (sourceCss: string) =>
  Effect.tryPromise({
    try: () => postcss([tailwindcss()]).process(sourceCss, { from: undefined }),
    catch: (error) => ({
      _tag: 'CSSCompilationError' as const,
      message: String(error),
    }),
  }).pipe(Effect.map((result) => result.css))

// Usage
const program = compileCSS('@import "tailwindcss";')
const css = await Effect.runPromise(program)
```

## Performance Considerations

### PostCSS Performance

PostCSS itself is fast:

- **Parsing**: ~100ms for 10,000 lines of CSS
- **Processing**: Depends on plugins (Tailwind is the bottleneck)
- **Memory**: Minimal overhead (~10MB for large projects)

### Tailwind CSS v4 Performance

The performance bottleneck is Tailwind CSS, not PostCSS:

- **Initial compilation**: 200-500ms (generates all utilities)
- **Recompilation**: 50-100ms (cached utilities)
- **Production build**: ~1 second (includes minification)

### Sovrium's Optimization

```typescript
// Cache compiled CSS per theme (in-memory)
const cssCache = new Map<string, string>()

const getCachedCSS = (themeKey: string, sourceCss: string) => {
  if (cssCache.has(themeKey)) {
    return Effect.succeed(cssCache.get(themeKey)!)
  }

  return compileCSS(sourceCss).pipe(
    Effect.tap((css) => Effect.sync(() => cssCache.set(themeKey, css)))
  )
}
```

**Result**: Sub-millisecond response time for cached themes

## Troubleshooting

### Issue: PostCSS Errors in Compilation

```
Error: PostCSS plugin @tailwindcss/postcss failed
```

**Common causes**:

1. **Invalid CSS syntax**: Check source CSS for syntax errors
2. **Missing @import**: Ensure source CSS includes `@import "tailwindcss"`
3. **Version mismatch**: Ensure postcss and @tailwindcss/postcss are compatible

**Fix**:

```bash
# Reinstall dependencies
rm -rf node_modules bun.lock
bun install

# Verify versions
bun pm ls postcss @tailwindcss/postcss
```

### Issue: Compilation is Slow

```
CSS compilation taking >5 seconds
```

**Causes**:

- Large source CSS (>10,000 lines)
- Complex @theme directives
- Missing cache

**Fix**:

```typescript
// Add caching (see "Sovrium's Optimization" above)
// Reduce source CSS size (split into multiple files)
// Profile with:
const start = performance.now()
await postcss([tailwindcss()]).process(css)
console.log(`Compilation: ${performance.now() - start}ms`)
```

### Issue: Source Maps Not Working

```
CSS source maps point to wrong files
```

**Cause**: Missing `from` option in PostCSS

**Fix**:

```typescript
const result = await postcss([tailwindcss()]).process(css, {
  from: 'path/to/source.css', // Required for source maps
  map: { inline: false },
})
```

**Note**: Sovrium doesn't use source maps (utility CSS doesn't need debugging)

## Testing PostCSS

### Unit Test Example

```typescript
import { test, expect } from 'bun:test'
import postcss from 'postcss'
import tailwindcss from '@tailwindcss/postcss'

test('PostCSS compiles Tailwind CSS', async () => {
  const input = '@import "tailwindcss"; .text-red-500 { }'
  const result = await postcss([tailwindcss()]).process(input, {
    from: undefined,
  })

  expect(result.css).toContain('.text-red-500')
  expect(result.css).toContain('color: rgb(239 68 68)')
})
```

### Integration Test (E2E)

```typescript
// specs/css/compiler.spec.ts
test('CSS compiler generates valid CSS', async ({ page }) => {
  await page.goto('/api/css') // CSS endpoint

  const response = await page.request.get('/api/css')
  const css = await response.text()

  expect(css).toContain('@layer') // PostCSS processed
  expect(css).toContain('.text-') // Tailwind utilities
  expect(response.headers()['content-type']).toBe('text/css')
})
```

## Best Practices

### ✅ Do

- **Use programmatic API**: Better than config files for dynamic CSS
- **Enable caching**: Cache compiled CSS per theme (in-memory)
- **Wrap in Effect**: Functional error handling for compilation failures
- **Minimal plugins**: Only use @tailwindcss/postcss (v4 includes everything)
- **Profile performance**: Track compilation time in development
- **Trust Tailwind CSS**: Let Tailwind handle autoprefixer, minification, nesting

### ❌ Don't

- **Don't use postcss.config.js**: Config files don't support dynamic themes
- **Don't add unnecessary plugins**: Tailwind v4 has most features built-in
- **Don't process CSS twice**: Cache results to avoid redundant compilation
- **Don't generate source maps in production**: Adds overhead without benefit
- **Don't bypass PostCSS**: Tailwind CSS requires PostCSS to function

## Alternatives to PostCSS

| Tool              | Use Case                    | Why Not Used                            |
| ----------------- | --------------------------- | --------------------------------------- |
| **Lightning CSS** | Faster CSS parser (Rust)    | ⚠️ Not compatible with Tailwind CSS     |
| **esbuild**       | CSS bundling + minification | ⚠️ No plugin system like PostCSS        |
| **Parcel**        | Zero-config bundler         | ⚠️ Too opinionated for Sovrium          |
| **Vanilla CSS**   | No build step               | ❌ No utility classes (defeats purpose) |

**Verdict**: PostCSS is the only option for Tailwind CSS v4.

## Related Documentation

- **Tailwind CSS**: `@docs/infrastructure/ui/tailwind.md`
- **CSS Compiler**: `@docs/infrastructure/css/css-compiler.md`
- **Bun Runtime**: `@docs/infrastructure/runtime/bun.md`

## External Resources

- [PostCSS Documentation](https://postcss.org/)
- [PostCSS GitHub Repository](https://github.com/postcss/postcss)
- [PostCSS Plugin Directory](https://www.postcss.parts/)
- [Tailwind CSS PostCSS Plugin](https://tailwindcss.com/docs/installation/using-postcss)

## Summary

**TL;DR**:

- PostCSS is required by Tailwind CSS v4 for CSS compilation
- Sovrium uses PostCSS programmatically (no config files)
- Only plugin: `@tailwindcss/postcss` (v4 includes autoprefixer, minification, nesting)
- Wrapped in Effect.ts for functional error handling
- In-memory caching for fast recompilation
- No source maps (not needed for utility CSS)
