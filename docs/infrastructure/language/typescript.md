# TypeScript Configuration and Type Checking

## Overview

**TypeScript Compiler**: ^5.9.3 (actual compiler version)
**tsc Wrapper**: v2.0.4 (CLI wrapper package)
**Configuration**: Optimized for Bun's bundler mode with strict type safety

**Note**: The `tsc` package (v2.0.4) is a lightweight wrapper that provides the `tsc` command. The actual TypeScript compiler is installed as a peer dependency (^5.9.3).

## Critical Distinction: Execution vs Type Checking

### Bun Runtime

- **Purpose**: Executes TypeScript directly WITHOUT type checking
- **Speed**: Very fast (~4x faster than Node.js)
- **Use case**: Development, production, testing

### TypeScript Compiler (tsc)

- **Purpose**: Validates types WITHOUT emitting files
- **Speed**: Slow (type analysis is expensive)
- **Use case**: Pre-commit, CI/CD, manual checks

**Both are needed**: Bun for execution speed, tsc for type safety validation

## The Two-Phase Workflow

1. **Development/Execution**: `bun run index.ts` - Fast execution, no type checking
2. **Validation**: `bun run typecheck` - Slow type checking, no execution

## tsconfig.json Configuration

### Key Settings

```json
{
  "compilerOptions": {
    // Environment & Features
    "lib": ["ESNext"], // Latest JavaScript features
    "target": ["ESNext"], // No downleveling needed
    "module": "Preserve", // Preserves original module syntax
    "moduleDetection": "force", // Treat all files as modules
    "jsx": "react-jsx", // JSX support (if React is added)
    "allowJs": true, // Allow JavaScript files

    // Bundler Mode (Bun-specific)
    "moduleResolution": "bundler", // Bun's resolution algorithm
    "allowImportingTsExtensions": true, // Can import .ts files directly
    "verbatimModuleSyntax": true, // Explicit import/export syntax
    "noEmit": true, // CRITICAL: Bun handles execution, not tsc

    // Type Safety (Strict Mode)
    "strict": true, // Enable all strict type-checking options
    "skipLibCheck": true, // Skip type checking of declaration files
    "noFallthroughCasesInSwitch": true, // Prevent switch fallthrough bugs
    "noUncheckedIndexedAccess": true, // Array/object access returns T | undefined
    "noImplicitOverride": true, // Explicit override keyword required

    // Additional Strictness (enabled for code quality)
    "noUnusedLocals": true, // Detect unused local variables for code cleanliness
    "noUnusedParameters": false, // Allow unused parameters (disabled for incomplete test stubs)
    "noPropertyAccessFromIndexSignature": false // Allow obj['prop'] syntax
  }
}
```

### Why noEmit is Critical

- `noEmit: true` prevents tsc from generating JavaScript files
- Bun executes TypeScript directly at runtime (no compilation needed)
- tsc is ONLY used for static type validation, not for building
- This separation allows: Fast execution (Bun) + Comprehensive type checking (tsc)

## Import Conventions

```typescript
// CORRECT - Bun allows .ts extensions
import { something } from './module.ts'

// CORRECT - Type-only imports must be explicit
import type { SomeType } from './types.ts'

// INCORRECT - Don't omit extensions
import { something } from './module' // ❌
```

## Running Type Checks

### Via npm Script (Recommended)

```bash
bun run typecheck
```

### Direct tsc Command

```bash
# Direct tsc command (equivalent)
bun tsc --noEmit

# With bunx (alternative)
bunx tsc --noEmit

# Watch mode for continuous type checking during development
bunx tsc --noEmit --watch

# Check specific files/directories
bunx tsc --noEmit src/
bunx tsc --noEmit src/**/*.ts
```

## Understanding --noEmit Flag

- **Critical for Bun projects**: Prevents tsc from generating .js files
- **Why it matters**: Bun executes TypeScript directly; tsc-generated files would be redundant
- **Type checking only**: tsc validates types but doesn't produce output
- **Configuration**: Set in tsconfig.json (`"noEmit": true`) and reinforced via CLI flag

## Type Checking vs Execution Comparison

| Aspect              | Bun Runtime                         | TypeScript Compiler (tsc)               |
| ------------------- | ----------------------------------- | --------------------------------------- |
| **Speed**           | Very fast (~4x faster than Node.js) | Slow (type analysis is expensive)       |
| **Type Checking**   | None (skipped for performance)      | Comprehensive (all type rules enforced) |
| **Purpose**         | Execute code, run application       | Validate types, catch errors            |
| **Output**          | Program execution, side effects     | Error messages, type diagnostics        |
| **When to Use**     | Development, production, testing    | Pre-commit, CI/CD, manual checks        |
| **Files Generated** | None                                | None (with --noEmit)                    |
| **Typical Time**    | Milliseconds                        | Seconds (depends on project size)       |

## Common Type Errors Caught by tsc

```typescript
// Example type errors tsc will catch that Bun runtime won't:

// 1. Type mismatches
const num: number = 'string' // Error: Type 'string' not assignable to 'number'

// 2. Missing properties
interface User {
  name: string
  age: number
}
const user: User = { name: 'Alice' } // Error: Property 'age' is missing

// 3. Undefined access (with noUncheckedIndexedAccess)
const items = [1, 2, 3]
const item = items[10] // Type: number | undefined (must handle undefined)

// 4. Incorrect function calls
function greet(name: string) {}
greet(42) // Error: Argument of type 'number' not assignable to 'string'

// 5. Type inference issues
const value = Math.random() > 0.5 ? 'text' : 42
const length = value.length // Error: Property 'length' does not exist on 'number'
```

## When to Run Type Checks

1. **During Development** (optional, for real-time feedback):

   ```bash
   bunx tsc --noEmit --watch
   ```

2. **Before Committing** (recommended):

   ```bash
   bun run typecheck  # Part of pre-commit checklist
   ```

3. **In CI/CD Pipeline** (critical):

   ```bash
   bun run typecheck  # Fail builds if type errors exist
   ```

4. **After Adding Dependencies** (recommended):

   ```bash
   bun run typecheck  # Verify type compatibility
   ```

5. **Before Production Deployment** (critical):
   ```bash
   bun run typecheck  # Final validation before release
   ```

## Type Check Failure Handling

### Example Output

```bash
src/index.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.

10     const age: number = '25'
       ~~~

Found 1 error in src/index.ts:10
```

### Resolution Steps

1. **Read the error message carefully** - tsc provides detailed diagnostics
2. **Locate the file and line number** - Navigate to the error location
3. **Understand the type mismatch** - Identify what types conflict
4. **Fix the code** - Update types, add type guards, or adjust logic
5. **Re-run type check** - Verify the fix: `bun run typecheck`

## IDE Integration

### VS Code (Built-in TypeScript Support)

- Type errors appear as red squiggles
- Hover over code to see inferred types
- Uses same tsconfig.json as tsc command
- Real-time type checking as you type
- No additional configuration needed

### WebStorm/IntelliJ IDEA

- Enable TypeScript Language Service in settings
- Automatic type checking on file save
- Type errors highlighted inline
- Uses project's tsconfig.json automatically

### Vim/Neovim (via Language Server Protocol)

```vim
" Using coc-tsserver or typescript-language-server
" Install: :CocInstall coc-tsserver
" Type checking happens automatically
```

## Performance Considerations

Type checking large projects can be slow:

```bash
# Skip library type checks for faster validation (already in tsconfig.json)
# "skipLibCheck": true

# Check only specific directories
bunx tsc --noEmit src/

# Incremental mode (caches previous results)
bunx tsc --noEmit --incremental

# Project references (for monorepos/large projects)
# Configure in tsconfig.json for faster rebuilds
```

## Why tsc v2.0.4 Package

- Provides consistent tsc executable across environments
- Wrapper around TypeScript peer dependency (^5)
- Allows `bun tsc` command without global TypeScript installation
- Respects project's TypeScript version (via peer dependency)
- Ensures compatibility between tsc wrapper and TypeScript compiler

## Type Checking Best Practices

1. **Run type checks frequently** - Don't wait until pre-commit
2. **Use watch mode during development** - Catch errors immediately
3. **Never commit with type errors** - Fix all errors before committing
4. **Include typecheck in CI/CD** - Prevent type errors from reaching production
5. **Trust the type checker** - If tsc reports an error, there's likely a real issue
6. **Fix root causes, not symptoms** - Use proper types instead of `any` or `@ts-ignore`

## Integration with Bun

- Bun and tsc are **complementary**, not competing tools
- Bun handles **runtime execution** with maximum performance
- tsc handles **static validation** with maximum type safety
- Together they provide: Fast iteration + Comprehensive error detection

## References

- TypeScript documentation: https://www.typescriptlang.org/docs/
- tsconfig reference: https://www.typescriptlang.org/tsconfig
- Bun TypeScript guide: https://bun.sh/docs/runtime/typescript
