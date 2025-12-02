# Knip Dead Code Detector

## Overview

**Version**: 5.71.0
**Purpose**: Comprehensive tool for detecting and removing unused code, dependencies, exports, and configuration issues. Helps maintain a clean, optimized codebase by identifying dead code that accumulates over time.

## What Knip Detects

1. **Unused Files** - Source files that aren't imported anywhere in the project
2. **Unused Dependencies** - Packages listed in `package.json` but never used in code
3. **Unused devDependencies** - Development tools that aren't actually referenced
4. **Unused Exports** - Functions, classes, or variables exported but never imported
5. **Unreachable Code** - Dead code paths that can never be executed
6. **Duplicate Exports** - Same identifier exported multiple times
7. **Unlisted Dependencies** - Imports that aren't declared in `package.json`
8. **Configuration Issues** - Missing or incorrect tool configurations

## Why Knip is Important

- Reduces bundle size by removing unused code
- Speeds up TypeScript compilation by eliminating unused files
- Identifies unused dependencies that can be removed
- Maintains codebase hygiene during refactoring
- Catches errors like missing dependencies early
- Provides visibility into actual code usage patterns

## Running Knip with Bun

```bash
# Detection only (no modifications) - recommended first step
bun run clean

# Auto-fix unused exports (recommended after reviewing findings)
bun run clean:fix

# Alternative: Direct bunx commands
bunx knip                     # Detection only
bunx knip --fix               # Auto-fix

# Check specific issues
bunx knip --dependencies      # Only check dependencies
bunx knip --exports           # Only check exports
bunx knip --files             # Only check unused files

# Generate detailed report
bunx knip --reporter json     # JSON output
bunx knip --reporter markdown # Markdown report

# Watch mode (continuous monitoring)
bunx knip --watch

# Include/exclude patterns
bunx knip --include "src/**/*"
bunx knip --exclude "**/*.test.ts"
```

## The --fix Flag

### What --fix Does Automatically

- Removes unused exports from source files
- Cleans up dead code that can be safely deleted
- Auto-fixes simple issues without manual intervention

### What --fix Does NOT Do

Requires manual action:

- Remove unused dependencies from `package.json` (suggests removal)
- Delete unused files (reports them but doesn't delete)
- Modify complex export patterns (reports issues)
- Fix configuration problems (reports recommendations)

## Understanding Knip Output

### Example Output

```bash
Unused files (2)
  src/old-module.ts
  src/deprecated.ts

Unused dependencies (1)
  lodash

Unused devDependencies (1)
  @types/jest

Unused exports (3)
  src/utils.ts: helperFunction, CONSTANT_VALUE
  src/types.ts: OldInterface

Unlisted dependencies (1)
  lodash (imported in src/formatter.ts)
```

## Addressing Knip Findings

1. **Unused Files**: Review and delete if truly unused, or add imports if needed
2. **Unused Dependencies**: Run `bun remove <package>` to remove from `package.json`
3. **Unused Exports**: Run `bun run clean:fix` to auto-remove, or keep if part of public API
4. **Unlisted Dependencies**: Run `bun add <package>` to add to `package.json`

## Integration with Bun

- Command: `bun run clean` (runs `knip` - detection only)
- Command: `bun run clean:fix` (runs `knip --fix` - auto-fix unused exports)
- Execution: Knip runs via `bunx` (Bun's package executor)
- Speed: Fast analysis leveraging Bun's performance
- Compatibility: Works seamlessly with Bun's module resolution

## Configuration

Knip can be configured via:

- `knip.json` - Dedicated configuration file (used in this project)
- `knip.config.ts` - TypeScript configuration file
- `package.json` - `"knip"` field for inline config

### Active Configuration (knip.json)

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "project": ["src/**/*.ts", "src/**/*.tsx"],
  "ignore": [
    "**/*.test.ts",
    "**/*.spec.ts",
    "scripts/**",
    "tests/**",
    "src/presentation/components/ui/**",
    "src/presentation/hooks/use-mobile.ts",
    "src/hooks/**"
  ],
  "entry": ["src/index.ts", "src/cli.ts"],
  "ignoreDependencies": [
    "class-variance-authority",
    "lucide-react",
    "tailwindcss",
    "tw-animate-css",
    "@radix-ui/*",
    "@hookform/resolvers",
    "@tanstack/react-query",
    "@tanstack/react-query-devtools",
    "@tanstack/react-table",
    "better-auth",
    "drizzle-orm",
    "zod",
    "cmdk",
    "embla-carousel-react",
    "input-otp",
    "next-themes",
    "react-day-picker",
    "react-hook-form",
    "react-resizable-panels",
    "recharts",
    "sonner",
    "tailwind-merge",
    "vaul",
    "clsx",
    "@eslint/compat",
    "drizzle-kit"
  ],
  "ignoreExportsUsedInFile": true
}
```

### Configuration Breakdown

- **$schema**: Schema for IDE autocomplete and validation
- **project**: `["src/**/*.ts", "src/**/*.tsx"]` - Analyze all TypeScript and TSX files in src directory
- **entry**: `["src/index.ts", "src/cli.ts"]` - Entry points where analysis starts
- **ignore**: Exclude files that should not be checked for dead code:
  - `**/*.test.ts` - Unit test files (Bun Test)
  - `**/*.spec.ts` - E2E test files (Playwright)
  - `scripts/**` - Utility scripts (e.g., update-license-date.js)
  - `tests/**` - E2E test directory
  - `src/presentation/components/ui/**` - shadcn/ui components (kept for future use)
  - `src/presentation/hooks/use-mobile.ts` - Mobile detection hook
  - `src/hooks/**` - Custom React hooks directory
- **ignoreDependencies**: Dependencies that are part of the stack but may not be directly imported:
  - **UI Libraries**: All Radix UI packages (`@radix-ui/*`) - Primitives for shadcn/ui components
  - **Form Handling**: `react-hook-form`, `@hookform/resolvers` - Form management
  - **State Management**: `@tanstack/react-query`, `@tanstack/react-query-devtools` - Server state
  - **Data Table**: `@tanstack/react-table` - Data table functionality
  - **Database**: `drizzle-orm`, `drizzle-kit` - ORM and migrations
  - **Auth**: `better-auth` - Authentication system
  - **Validation**: `zod` - Schema validation
  - **UI Components**: Various UI component libraries used by shadcn/ui:
    - `cmdk` - Command palette
    - `embla-carousel-react` - Carousel component
    - `input-otp` - OTP input component
    - `next-themes` - Theme management
    - `react-day-picker` - Date picker
    - `react-resizable-panels` - Resizable panels
    - `recharts` - Charting library
    - `sonner` - Toast notifications
    - `vaul` - Drawer component
  - **CSS Utilities**:
    - `class-variance-authority` - CVA for component variants
    - `lucide-react` - Icon library
    - `tailwindcss` - CSS framework
    - `tw-animate-css` - Animation utilities
    - `tailwind-merge` - Merge Tailwind classes
    - `clsx` - Class name utility
  - **Build Tools**: `@eslint/compat` - ESLint compatibility
- **ignoreExportsUsedInFile**: `true` - Ignore exports used in the same file

### Why shadcn/ui Components Are Excluded

**shadcn/ui Components** (`src/presentation/components/ui/**`):

- shadcn/ui provides a comprehensive library of copy-paste components
- Not all components are used immediately but kept for future use
- Components are intentionally copied into the project for customization
- Removing "unused" components would defeat the purpose of having them available
- Components may be used dynamically or conditionally in the future
- Provides a consistent design system ready to use

**Related Dependencies**:

All shadcn/ui related packages are kept in `ignoreDependencies` because:

- They support components that may not be in use yet
- Removing them would break components when they're needed
- They're part of the complete shadcn/ui ecosystem
- Better to have them available than to reinstall later

### Why Test Files and Scripts Are Excluded

**Test Files** (`*.test.ts`, `*.spec.ts`):

- Tests often have intentional "unused" exports for testing purposes
- Test utilities and fixtures may not be imported across test files
- Knip would incorrectly flag test-specific code as dead code
- Tests are validated by running them, not by dead code detection

**Scripts Directory** (`scripts/**`):

- Contains utility scripts run directly (not imported)
- Scripts are executed directly by build tools or other processes
- Not part of the main application import graph
- Would be incorrectly flagged as unused files

**Tests Directory** (`tests/**`):

- Playwright E2E tests are not imported, they're executed directly
- Test files may have setup code not shared across tests
- Separate from main application source code

### Common Configuration Options

- `entry`: Entry point files (where analysis starts)
- `project`: Files to include in analysis
- `ignore`: Files/patterns to exclude (glob syntax)
- `ignoreDependencies`: Dependencies to skip checking
- `ignoreExportsUsedInFile`: Ignore exports used in same file

## When to Run Knip

1. **Weekly Maintenance** (recommended):

   ```bash
   bun run clean       # Detect unused code/dependencies
   bun run clean:fix   # Auto-fix unused exports (after review)
   ```

2. **Before Major Releases** (critical):

   ```bash
   bun run clean  # Full report before release
   ```

3. **During Refactoring** (helpful):

   ```bash
   bunx knip --watch  # Monitor changes in real-time
   ```

4. **After Dependency Updates** (recommended):

   ```bash
   bun run clean  # Verify no unused dependencies
   ```

5. **When Bundle Size Matters** (optimization):
   ```bash
   bun run clean  # Identify code to remove
   ```

## Knip vs Other Tools

| Tool                 | Purpose                       | When to Run             | Auto-Fix               |
| -------------------- | ----------------------------- | ----------------------- | ---------------------- |
| **Knip**             | Find unused code/dependencies | Weekly, before releases | Partial (exports only) |
| **TypeScript (tsc)** | Type checking                 | Before commits, CI/CD   | No                     |
| **Prettier**         | Code formatting               | Before commits, on save | Yes (full)             |
| **Bun Test**         | Functionality testing         | After changes, CI/CD    | No                     |

## Knip is NOT

- A linter (doesn't check code style or patterns)
- A type checker (doesn't validate types)
- A formatter (doesn't modify code style)
- A pre-commit check (too slow for every commit)

## Knip IS

- A maintenance tool (run periodically)
- A dead code detector (finds unused code)
- A dependency auditor (checks package usage)
- A codebase cleaner (helps remove cruft)

## Common Scenarios

### Scenario 1: After Refactoring

```bash
# You removed a feature and want to clean up leftover code
bun run clean           # Detect unused code
bun run clean:fix       # Auto-fix unused exports
# Review unused files and dependencies
# Remove unused dependencies: bun remove <package>
# Delete unused files manually
```

### Scenario 2: Optimizing Bundle Size

```bash
# Find what's not being used
bunx knip --reporter markdown > knip-report.md
# Review report and remove unused code
# Measure bundle size improvement
```

### Scenario 3: Dependency Audit

```bash
# Check if all dependencies are actually used
bun run clean --dependencies
# Remove unused ones: bun remove <package>
# Add missing ones: bun add <package>
```

### Scenario 4: Before Release

```bash
# Full cleanup before shipping
bun run clean           # Detect all issues
bun run clean:fix       # Auto-fix what can be fixed
# Address remaining findings manually
# Run again to verify: bun run clean
# Proceed with release if clean
```

## Performance Considerations

- Knip analyzes the entire codebase (can be slow on large projects)
- First run may take time as Knip builds dependency graph
- Subsequent runs are faster due to caching
- Use `--include`/`--exclude` to focus analysis on specific areas

## False Positives

Knip may report false positives in these cases:

- **Dynamic imports**: `import(dynamicPath)` may not be detected
- **Side-effect imports**: `import './side-effects'` without exports
- **Type-only exports**: Exports used only in type positions
- **Build-time usage**: Code used by build tools but not in source

### Handling False Positives

```typescript
// Ignore specific exports
export const keepThis = 'value' // @knip-ignore

// Ignore entire file
// @knip-ignore-file
```

## Integration with CI/CD (Optional)

```yaml
# Example GitHub Actions workflow
- name: Check for unused code
  run: bunx knip --reporter json
  continue-on-error: true # Don't fail build, just report
```

## Best Practices

1. **Run regularly** - Don't let dead code accumulate
2. **Review before auto-fixing** - Understand what will be removed
3. **Commit Knip config** - Share configuration with team
4. **Use in combination with other tools** - Knip complements TypeScript/Prettier
5. **Document exceptions** - Use comments to explain ignored items
6. **Start with detection only** - Run without `--fix` first to understand findings
7. **Clean incrementally** - Don't try to fix everything at once

## Troubleshooting

### Knip reports too many false positives

- Configure entry points correctly in `knip.json`
- Use `ignoreDependencies` for known good dependencies
- Add `@knip-ignore` comments for specific cases

### Knip is too slow

- Use `--include` to focus on specific directories
- Enable `skipLibCheck` in `tsconfig.json`
- Run on subsets of codebase rather than everything

### Knip removes code I need

- Review changes before committing (use `bunx knip` first)
- Add exports to public API if they're meant to be used externally
- Use `ignoreExportsUsedInFile: true` for utility functions

## References

- Knip documentation: https://knip.dev/
- Configuration guide: https://knip.dev/reference/configuration
- Rules reference: https://knip.dev/reference/rules
