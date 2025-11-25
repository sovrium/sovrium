# Prettier Plugin Tailwindcss - Automatic Class Sorting

## Overview

**Status**: ⚠️ Configured but NOT installed (missing dependency)
**Purpose**: Automatically sort Tailwind CSS classes in a consistent, recommended order
**Configuration**: Referenced in `.prettierrc.json` but not in `package.json`
**Recommendation**: Install to ensure consistent class ordering across the codebase

## What is prettier-plugin-tailwindcss?

prettier-plugin-tailwindcss is an official Prettier plugin that automatically sorts Tailwind CSS class names according to Tailwind's recommended class order. It parses your code, identifies Tailwind utility classes, and reorders them consistently.

**Key Features**:

- **Automatic Sorting**: Classes sorted on save (no manual ordering)
- **Consistent Style**: Follows Tailwind's official class order
- **Zero Configuration**: Works out-of-the-box with Prettier
- **Multi-Framework**: Supports HTML, JSX, TSX, Vue, Svelte
- **Performance**: Fast (uses Tailwind's class detection logic)

## Why Automatic Class Sorting?

### The Problem Without Sorting

**Inconsistent class order** leads to:

- Hard to read: `mt-4 text-blue-500 hover:bg-gray-100 p-2 flex`
- Merge conflicts: Different developers order classes differently
- Difficult code review: Can't quickly identify missing utilities

### With prettier-plugin-tailwindcss

**Consistent class order**:

```jsx
// Before (manual, inconsistent)
<div className="mt-4 text-blue-500 hover:bg-gray-100 p-2 flex">

// After (auto-sorted)
<div className="flex p-2 mt-4 text-blue-500 hover:bg-gray-100">
```

**Tailwind's Recommended Order**:

1. Layout (flex, grid, block, etc.)
2. Spacing (p-, m-, space-)
3. Sizing (w-, h-, min-, max-)
4. Typography (text-, font-, leading-)
5. Backgrounds (bg-)
6. Borders (border-, rounded-)
7. Effects (shadow-, opacity-)
8. Transitions (transition-, duration-)
9. Transforms (transform, rotate-, scale-)
10. Interactivity (cursor-, select-)
11. Variants (hover:, focus:, md:, etc.)

## Current Status in Sovrium

### Configured (`.prettierrc.json`):

```json
{
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### ⚠️ Missing from `package.json`:

```json
{
  "devDependencies": {
    // prettier-plugin-tailwindcss NOT listed
  }
}
```

**Result**: Prettier will throw a warning or silently skip the plugin.

## Installation (Recommended)

### Add to package.json

```bash
bun add -d prettier-plugin-tailwindcss
```

**Recommended version**: Latest stable (check [npm](https://www.npmjs.com/package/prettier-plugin-tailwindcss))

After installation, `package.json` should include:

```json
{
  "devDependencies": {
    "prettier": "^3.x.x",
    "prettier-plugin-tailwindcss": "^0.6.x"
  }
}
```

### Verify Installation

```bash
# Check if installed
bun pm ls prettier-plugin-tailwindcss

# Test formatting
echo '<div className="mt-4 text-blue-500 p-2 flex">' | bunx prettier --parser html

# Expected output: <div className="flex p-2 mt-4 text-blue-500">
```

## Configuration

### Minimal Setup (Current)

`.prettierrc.json`:

```json
{
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**This is sufficient** - no additional config needed.

### Advanced Configuration (Optional)

If using custom Tailwind CSS configuration:

`.prettierrc.json`:

```json
{
  "plugins": ["prettier-plugin-tailwindcss"],
  "tailwindConfig": "./tailwind.config.ts",
  "tailwindFunctions": ["classnames", "clsx", "cn"]
}
```

**Sovrium doesn't need this** because:

- No static `tailwind.config.ts` file (programmatic compilation)
- No custom utility function tracking required

## How It Works

### Detection Algorithm

1. **Parse code**: Prettier parses JSX/HTML attributes
2. **Identify Tailwind classes**: Check if attribute is `className`, `class`, etc.
3. **Extract utilities**: Parse class string into individual utilities
4. **Sort by category**: Apply Tailwind's official class order
5. **Reassemble**: Join sorted classes back into string

### Example Transformations

**React Component**:

```tsx
// Before
<button className="hover:bg-blue-700 font-bold py-2 px-4 bg-blue-500 text-white rounded">
  Click me
</button>

// After (auto-sorted)
<button className="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700">
  Click me
</button>
```

**HTML**:

```html
<!-- Before -->
<div class="mt-2 border-2 bg-white p-4 shadow-md">
  <!-- After -->
  <div class="mt-2 border-2 bg-white p-4 shadow-md"></div>
</div>
```

**Hono JSX**:

```tsx
// src/presentation/pages/HomePage.tsx
export const HomePage = () => (
  <div className="container mx-auto px-4 py-8">{/* Auto-sorted on save */}</div>
)
```

## Integration with Sovrium

### File Types Affected

prettier-plugin-tailwindcss processes:

- `src/**/*.tsx` - React components
- `src/**/*.jsx` - Legacy JSX (if any)
- `specs/**/*.spec.ts` - E2E tests with JSX
- HTML templates (if generated)

### Workflow

```
Write code → Save file → Prettier formats → Plugin sorts classes → File updated
```

**Example**:

1. Developer writes: `<div className="text-red-500 flex p-4">`
2. Saves file (Ctrl+S / Cmd+S)
3. Prettier + plugin runs: Classes reordered to `<div className="flex p-4 text-red-500">`
4. File auto-updates with sorted classes

### IDE Integration

**VS Code** (`.vscode/settings.json`):

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

**Cursor** (inherits VS Code settings)

**WebStorm/IntelliJ**:

- Settings → Languages & Frameworks → Prettier
- Check "On save" option

## Troubleshooting

### Issue: Classes Not Sorted

```
Classes remain unsorted after running Prettier
```

**Causes**:

1. Plugin not installed: `bun pm ls prettier-plugin-tailwindcss` shows nothing
2. Prettier not running: Check IDE settings
3. Syntax error: Invalid class string (e.g., missing quotes)

**Fix**:

```bash
# Install plugin
bun add -d prettier-plugin-tailwindcss

# Verify Prettier config
cat .prettierrc.json | grep prettier-plugin-tailwindcss

# Manually format file
bunx prettier --write src/presentation/pages/HomePage.tsx
```

### Issue: Plugin Conflicts

```
Error: Prettier plugin conflict
```

**Cause**: Multiple Prettier plugins competing

**Fix**:

```json
{
  "plugins": [
    "prettier-plugin-tailwindcss" // Must be LAST in array
  ]
}
```

**Why last?** prettier-plugin-tailwindcss should run after other plugins to ensure all transformations are complete before class sorting.

### Issue: Custom Classes Not Sorted

```
Custom utility classes (not from Tailwind) not sorted correctly
```

**Cause**: Plugin only sorts official Tailwind utilities

**Example**:

```tsx
// Custom class stays at end
<div className="flex p-4 text-blue-500 my-custom-class">
```

**This is expected behavior** - plugin only sorts recognized Tailwind utilities.

**Workaround**: Define custom utilities in Tailwind config (but Sovrium uses programmatic approach).

### Issue: Performance Impact

```
Prettier formatting slow after adding plugin
```

**Cause**: Plugin parses Tailwind class database on every run

**Benchmarks**:

- Without plugin: ~50ms per file
- With plugin: ~100ms per file (2x slower)

**Mitigation**:

- Acceptable for dev (only runs on save)
- CI/CD: Use `prettier --check` (validation only, no writes)

## Best Practices

### ✅ Do

- **Install plugin**: Don't just configure it, actually install it
- **Run on save**: Enable format-on-save in IDE for automatic sorting
- **Commit sorted classes**: Ensures consistency across team
- **Lint in CI**: Add `prettier --check` to GitHub Actions
- **Trust the sort order**: Tailwind's order is battle-tested

### ❌ Don't

- **Don't manually sort**: Let the plugin handle it (avoid merge conflicts)
- **Don't override order**: Plugin uses Tailwind's official order (don't fight it)
- **Don't disable for specific files**: Consistency is key
- **Don't use conflicting plugins**: prettier-plugin-tailwindcss must be last

## Performance Considerations

### Build Time Impact

**Development**: Negligible (only runs on changed files)
**CI/CD**: Minimal (~2-5 seconds for entire codebase)

### Optimization Strategies

1. **Cache node_modules**: Speed up CI by caching dependencies
2. **Format on commit**: Use `lint-staged` to format only staged files
3. **Parallel formatting**: Prettier supports `--cache` flag

```bash
# Fast formatting (with cache)
bunx prettier --write --cache "src/**/*.tsx"
```

## Alternatives

| Tool                       | Purpose               | Why Not Use                    |
| -------------------------- | --------------------- | ------------------------------ |
| **Manual sorting**         | Hand-sort classes     | ❌ Error-prone, inconsistent   |
| **ESLint plugin**          | Sort classes via lint | ⚠️ Slower than Prettier plugin |
| **Tailwind Prettier sort** | Official plugin       | ✅ This IS the official plugin |
| **Headwind VS Code**       | VS Code-only sorter   | ⚠️ IDE-specific (not portable) |

**Verdict**: prettier-plugin-tailwindcss is the industry standard.

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/lint.yml
name: Lint

on: [push, pull_request]

jobs:
  prettier:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run format:check # Checks if classes are sorted
```

### Pre-Commit Hook (Recommended)

```bash
# .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Format staged files
bunx lint-staged
```

**`lint-staged` config** (`package.json`):

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["prettier --write", "eslint --fix"]
  }
}
```

**Result**: Classes auto-sorted before every commit.

## Related Documentation

- **Prettier**: `@docs/infrastructure/quality/prettier.md`
- **Tailwind CSS**: `@docs/infrastructure/ui/tailwind.md`
- **ESLint**: `@docs/infrastructure/quality/eslint.md`

## External Resources

- [prettier-plugin-tailwindcss (Official)](https://github.com/tailwindlabs/prettier-plugin-tailwindcss)
- [Tailwind CSS Class Order](https://tailwindcss.com/blog/automatic-class-sorting-with-prettier)
- [Prettier Plugin API](https://prettier.io/docs/en/plugins.html)

## Action Items

### Immediate (Phase 2):

1. **Install plugin**: `bun add -d prettier-plugin-tailwindcss`
2. **Format codebase**: `bun run format` (applies sorting to all files)
3. **Commit changes**: Commit sorted classes as a single PR
4. **Update docs-index**: Add this doc to `.claude/docs-index.md`

### Future (Phase 3):

- Add pre-commit hook (lint-staged) for automatic formatting
- Add `prettier --check` to GitHub Actions CI

## Summary

**TL;DR**:

- prettier-plugin-tailwindcss sorts Tailwind classes automatically
- Currently configured in `.prettierrc.json` but NOT installed
- **Action required**: Install with `bun add -d prettier-plugin-tailwindcss`
- Once installed, classes auto-sort on save (no manual intervention)
- Ensures consistent class order across entire codebase
- Industry standard for Tailwind CSS projects
