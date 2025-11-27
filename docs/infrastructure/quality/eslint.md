# ESLint v9.39.1

## Overview

Static code analysis tool that catches bugs, enforces best practices, and maintains code quality beyond TypeScript's type system.

**Key Capabilities**:

- Logic error detection (unused variables, unreachable code, etc.)
- Functional programming enforcement (immutability, Effect.ts patterns)
- Layer-based architecture validation (eslint-plugin-boundaries)
- Database safety (Drizzle ORM WHERE clause enforcement)
- Code size/complexity limits
- Auto-fixing for many violations

**ESLint v9 Features**:

- Flat configuration system (`eslint.config.ts`)
- Improved TypeScript support (typescript-eslint v8.48.0)
- Modular config structure (`eslint/*.config.ts`)

## ESLint vs Other Tools

| Tool                 | Purpose                     | What It Catches                                                       | Auto-Fix               | When to Run                       |
| -------------------- | --------------------------- | --------------------------------------------------------------------- | ---------------------- | --------------------------------- |
| **ESLint**           | Code quality & logic errors | Unused variables, logic bugs, anti-patterns, best practice violations | Partial (many rules)   | Before commits, during dev, CI/CD |
| **TypeScript (tsc)** | Type checking               | Type mismatches, missing properties, incorrect function calls         | No                     | Before commits, CI/CD             |
| **Prettier**         | Code formatting             | Style inconsistencies, formatting issues                              | Yes (full)             | Before commits, on save           |
| **Knip**             | Dead code detection         | Unused files, exports, dependencies                                   | Partial (exports only) | Weekly, before releases           |

## Why ESLint is Complementary

- **TypeScript**: Catches type errors (e.g., `string` assigned to `number`)
- **ESLint**: Catches logic errors (e.g., unused variable, unreachable code, `==` instead of `===`)
- **Prettier**: Formats code appearance (quotes, semicolons, indentation)
- **Together**: Comprehensive code quality (types + logic + style)

## Configuration Modules Quick Reference

| Module          | Focus               | Key Rules                                                     | Details                                                                         |
| --------------- | ------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **size-limits** | Code complexity     | max-lines (400), max-lines-per-function (50), complexity (10) | [Jump to section](#code-size-and-complexity-limits-eslintsize-limitsconfigts)   |
| **boundaries**  | Architecture layers | domain/application/infrastructure/presentation isolation      | [Jump to section](#architectural-enforcement-critical)                          |
| **functional**  | FP patterns         | immutability, no-let, no-throw, prefer-map/filter             | [Jump to section](#functional-programming-enforcement-eslintfunctionalconfigts) |
| **drizzle**     | Database safety     | enforce-delete-with-where, enforce-update-with-where          | [Jump to section](#database-safety-rules-eslintdrizzleconfigts)                 |
| **react**       | React 19            | hooks rules, discourage manual memoization                    | [Jump to section](#react-19-compiler-guidance-eslintreactconfigts)              |
| **typescript**  | TypeScript          | no-explicit-any, strict types                                 | See `eslint/typescript.config.ts`                                               |
| **testing**     | Test patterns       | .test.ts vs .spec.ts enforcement                              | See `eslint/testing.config.ts`                                                  |
| **import**      | Import order        | organization, no-duplicates                                   | See `eslint/import.config.ts`                                                   |
| **file-naming** | Naming              | kebab-case files, PascalCase components                       | See `eslint/file-naming.config.ts`                                              |

## Installation

```bash
bun add -d eslint @eslint/js typescript-eslint \
  eslint-plugin-boundaries eslint-plugin-drizzle \
  eslint-plugin-functional eslint-plugin-react \
  eslint-plugin-react-hooks eslint-plugin-react-refresh \
  eslint-plugin-unicorn eslint-import-resolver-typescript
```

## Commands

```bash
bun run lint              # Lint all files
bun run lint:fix          # Lint and auto-fix issues
bunx eslint src/          # Lint specific directory
bunx eslint . --fix       # Manual fix command
```

## The --fix Flag

### What --fix Automatically Corrects

- Unused imports and variables (removes them)
- Spacing and formatting issues (quotes, semicolons - though Prettier handles this better)
- Simple logic fixes (prefer `const` over `let`, sort imports, etc.)
- Most stylistic rules
- Array/object formatting issues
- Import/export ordering

### What --fix Cannot Fix

Requires manual intervention:

- Complex logic errors (infinite loops, incorrect conditionals)
- Missing error handling (try/catch blocks)
- Security vulnerabilities
- Type-related issues (those are TypeScript's domain)
- Architectural problems
- Performance issues requiring algorithmic changes

## Understanding ESLint Output

### Example Output

```bash
/Users/user/project/src/utils.ts
  10:7   error    'unusedVar' is defined but never used              @typescript-eslint/no-unused-vars
  15:3   warning  Unexpected console statement                       no-console
  22:5   error    'variable' is never reassigned. Use 'const'        prefer-const
  28:10  error    Expected '===' and instead saw '=='                eqeqeq

/Users/user/project/index.ts
  5:1    warning  Fast refresh only works when a file only exports components  react-refresh/only-export-components

✖ 5 problems (3 errors, 2 warnings)
  2 errors and 0 warnings potentially fixable with the `--fix` option.
```

### Addressing ESLint Findings

1. **Run with --fix first**: `bunx eslint . --fix` (auto-fixes many issues)
2. **Review remaining errors**: Read error messages and locate issues
3. **Fix manually**: Address logic errors and complex issues
4. **Re-run ESLint**: Verify all issues resolved: `bun run lint`
5. **Never ignore errors**: Fix root causes instead of using `// eslint-disable`

## Configuration Structure (Modular)

**Root**: `eslint.config.ts` composes all modules
**Modules**: `eslint/*.config.ts` - Focused, single-responsibility configs

```typescript
// eslint.config.ts
export default [
  ...baseConfig, // Base JavaScript/TypeScript rules
  ...typescriptConfig, // TypeScript-specific rules
  ...reactConfig, // React 19, hooks, refresh
  ...functionalConfig, // FP patterns (immutability, Effect.ts)
  ...importConfig, // Import/export organization
  ...unicornConfig, // Additional code quality rules
  ...fileNamingConfig, // File/folder naming conventions
  ...boundariesConfig, // Layer-based architecture enforcement
  ...drizzleConfig, // Database safety (WHERE clause required)
  ...sizeLimitsConfig, // Code size/complexity limits
  ...testingConfig, // Test file patterns, Bun Test vs Playwright
  ...uiComponentsConfig, // shadcn/ui patterns
  ...infrastructureConfig, // Infrastructure file patterns
  ...scriptsConfig, // Scripts directory rules
  ...playwrightConfig, // E2E test rules
] as Linter.Config[]
```

### Module Responsibilities

| Module                    | Purpose                 | Key Rules                                            |
| ------------------------- | ----------------------- | ---------------------------------------------------- |
| **base.config.ts**        | JavaScript fundamentals | no-unused-vars, eqeqeq, prefer-const                 |
| **typescript.config.ts**  | TypeScript rules        | no-explicit-any, no-unused-vars, strict types        |
| **react.config.ts**       | React 19 patterns       | hooks rules, discourage manual memoization           |
| **functional.config.ts**  | FP enforcement          | immutability, no-let, no-throw, prefer-map/filter    |
| **boundaries.config.ts**  | Architecture layers     | domain/application/infrastructure/presentation       |
| **drizzle.config.ts**     | Database safety         | enforce-delete-with-where, enforce-update-with-where |
| **size-limits.config.ts** | Code complexity         | max-lines, max-lines-per-function, complexity        |
| **testing.config.ts**     | Test patterns           | .test.ts vs .spec.ts enforcement                     |
| **import.config.ts**      | Import organization     | import order, no-duplicates                          |
| **file-naming.config.ts** | Naming conventions      | kebab-case files, PascalCase components              |

## Key Dependencies

- **eslint v9.39.1**: Core ESLint linter engine
- **@eslint/js v9.39.1**: ESLint's recommended JavaScript rules (flat config)
- **typescript-eslint v8.48.0**: TypeScript-specific rules and parser
- **globals v16.5.0**: Global variable definitions for different environments (browser, Node.js, Bun)

## typescript-eslint Integration

- Parses TypeScript syntax correctly (understands TS-specific features)
- Provides TypeScript-specific rules (e.g., `@typescript-eslint/no-unused-vars`)
- Type-aware linting rules that leverage TypeScript's type checker
- Replaces deprecated `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`
- Unified package for better maintenance and compatibility

## Common ESLint Rules Enabled

| Rule                                 | What It Catches                    | Example                                                 |
| ------------------------------------ | ---------------------------------- | ------------------------------------------------------- |
| `no-unused-vars`                     | Variables declared but never used  | `const unused = 42` (remove it)                         |
| `no-undef`                           | Using undefined variables          | `console.log(undefinedVar)`                             |
| `no-unreachable`                     | Code after return/throw/break      | `return 1; console.log('never runs')`                   |
| `eqeqeq`                             | Using `==` instead of `===`        | `if (x == null)` (use `===`)                            |
| `no-console`                         | Console statements in production   | `console.log('debug')` (remove or use proper logging)   |
| `prefer-const`                       | Variables that could be `const`    | `let x = 5` (use `const` if never reassigned)           |
| `no-var`                             | Using `var` instead of `let/const` | `var x = 1` (use `let` or `const`)                      |
| `@typescript-eslint/no-explicit-any` | Using `any` type                   | `const x: any = 42` (use proper types)                  |
| `@typescript-eslint/no-unused-vars`  | TypeScript unused variables        | Catches unused function parameters, destructured values |

## Code Size and Complexity Limits (eslint/size-limits.config.ts)

ESLint enforces file size and function complexity limits to maintain readable, testable code. These rules prevent god objects and overly complex functions.

### Default Limits (All TypeScript Files)

| Metric                     | Limit | Level | Purpose                                |
| -------------------------- | ----- | ----- | -------------------------------------- |
| **max-lines**              | 400   | warn  | Prevent overly large files             |
| **max-lines-per-function** | 50    | warn  | Keep functions focused                 |
| **complexity**             | 10    | warn  | Cyclomatic complexity (branches/paths) |
| **max-depth**              | 4     | warn  | Prevent deeply nested code             |
| **max-params**             | 4     | warn  | Encourage object parameters            |
| **max-statements**         | 20    | warn  | Limit statements per function          |

**Note**: `skipBlankLines: true` and `skipComments: true` - Only counts code lines.

### Configuration Files and Schemas (Relaxed)

```typescript
// Files: **/*.config.{ts,js}, **/schemas/**/*.ts, src/domain/models/**/*.ts
{
  'max-lines': 800,                  // Schemas can be comprehensive
  'max-lines-per-function': 'off',   // Config objects can be large
  'max-statements': 'off'            // Config setup has many statements
}
```

**Rationale**: Configuration files and schema definitions are declarative. Large size doesn't indicate complexity.

### React Components (Strict)

```typescript
// Files: src/presentation/components/**/*.tsx
{
  'max-lines': 300,                  // ERROR if exceeded
  'max-lines-per-function': 60       // WARN if exceeded
}
```

**Rationale**: UI components should be modular. Large components indicate poor separation of concerns.

### Third-Party Components (Exempted)

```typescript
// Files: src/presentation/components/ui/**/*.tsx (shadcn/ui)
{
  'max-lines-per-function': 'off',   // Follow library patterns
  'complexity': 'off'                // Complex UI patterns acceptable
}
```

**Rationale**: shadcn/ui components are copied from library. Their patterns are pre-validated.

### SSR/Page Generation Components (Exempted)

```typescript
// Files: src/presentation/components/pages/utils/**/*.tsx
{
  'max-lines-per-function': 'off',   // Declarative rendering
  'complexity': 'off'                // Conditional configuration OK
}
```

**Rationale**: SSR metadata and script rendering is declarative configuration, not imperative logic.

### Temporary Overrides (TODO: Refactor)

```typescript
// Files: DynamicPage.tsx, component-renderer.tsx
{
  'max-lines': 'warn'  // Downgraded from error temporarily
}
```

**Action Required**: These files exceed 300 lines and need refactoring into smaller modules. Tracked in codebase-refactor-auditor findings.

### When You Hit a Limit

1. **Extract functions**: Break large functions into smaller, focused ones
2. **Extract modules**: Split large files into separate files by concern
3. **Extract components**: Break large React components into smaller ones
4. **Simplify logic**: Reduce cyclomatic complexity with early returns, guard clauses
5. **Use composition**: Build complex behavior from simple functions

**Anti-Pattern**: Disabling rules without refactoring. Fix root cause, don't hide the symptom.

## Architectural Enforcement (Critical)

ESLint enforces Sovrium's layer-based architecture automatically via **eslint-plugin-boundaries** (see `eslint/boundaries.config.ts`). This ensures dependency rules are followed at compile-time, preventing architectural violations.

### Layer Dependency Rules

```
Presentation → Application + Domain (NOT Infrastructure directly)
Application → Domain + Infrastructure
Domain → NOTHING (pure, self-contained)
Infrastructure → Domain
```

### Enforcement Configuration

**Full details**: See `eslint/boundaries.config.ts` for complete layer definitions and dependency rules.

**Layer Patterns**:

```typescript
// Simplified - Full config has granular sub-layers
'boundaries/elements': [
  { type: 'domain-model-*', pattern: 'src/domain/models/**/*' },
  { type: 'application-use-case-*', pattern: 'src/application/use-cases/**/*' },
  { type: 'infrastructure-*', pattern: 'src/infrastructure/**/*' },
  { type: 'presentation-*', pattern: 'src/presentation/**/*' }
]
```

**Key Feature**: Strict feature isolation within domain layer (table models ≠> page models).

### What Gets Caught

| Violation                         | Example                                                                 | Error Message                                                                        |
| --------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Presentation → Infrastructure** | `import { DatabaseRepo } from '@/infrastructure/db'` in React component | "Presentation layer violation: Can only import from Application and Domain layers"   |
| **Domain → Any Layer**            | `import { UserRepo } from '@/application'` in domain model              | "Domain layer violation: Domain must remain pure with zero external dependencies"    |
| **Application → Presentation**    | `import { Button } from '@/presentation/ui'` in use case                | "Application layer violation: Can only import from Domain and Infrastructure layers" |
| **Infrastructure → Application**  | `import { CreateUserUseCase } from '@/application'` in repository       | "Infrastructure layer violation: Can only import from Domain layer"                  |

### Examples

```typescript
// ✅ CORRECT: Presentation → Application → Infrastructure
// src/presentation/components/UserList.tsx
import { createUser } from '@/application/usecases/createUser' // OK: Presentation → Application
import type { User } from '@/domain/models/User' // OK: Presentation → Domain

// ❌ INCORRECT: Presentation → Infrastructure (bypassing Application)
// src/presentation/components/UserList.tsx
import { UserRepository } from '@/infrastructure/repositories/UserRepository' // ERROR!
// Fix: Access UserRepository through Application layer use case

// ✅ CORRECT: Domain layer is pure
// src/domain/models/User.ts
export interface User {
  id: string
  email: string
}
// No imports - pure data structures and business logic only

// ❌ INCORRECT: Domain importing external dependencies
// src/domain/models/User.ts
import { Effect } from 'effect' // ERROR! Domain must be pure
import { validateEmail } from '@/infrastructure/validators' // ERROR!
// Fix: Keep Effect.ts in Application layer, validators in Domain as pure functions

// ✅ CORRECT: Infrastructure → Domain
// src/infrastructure/repositories/UserRepository.ts
import type { User } from '@/domain/models/User' // OK: Infrastructure → Domain
import { Effect } from 'effect' // OK: Effect is allowed in Infrastructure

// ✅ CORRECT: Application coordinates layers
// src/application/usecases/createUser.ts
import type { User } from '@/domain/models/User' // OK: Application → Domain
import { UserRepository } from '@/infrastructure/repositories/UserRepository' // OK: Application → Infrastructure
import { Effect } from 'effect' // OK: Effect is Application layer's coordination tool
```

### Why This Matters

- **Domain Purity**: Keeps business logic free from side effects, making it testable and portable
- **Prevents Coupling**: UI can't directly access database, ensuring proper abstraction
- **Enforces Patterns**: Dependency Inversion Principle enforced automatically
- **Catch Violations Early**: Architectural mistakes caught at lint time, not runtime

## Functional Programming Enforcement (eslint/functional.config.ts)

ESLint enforces functional programming patterns via **eslint-plugin-functional** to align with Effect.ts and immutability principles.

**Configuration**: See `eslint/functional.config.ts` for complete rule set.

### Immutability Rules

| Rule                                    | Enforcement | What It Catches                             |
| --------------------------------------- | ----------- | ------------------------------------------- |
| **`functional/prefer-immutable-types`** | `error`     | Mutable types (non-readonly arrays/objects) |
| **`functional/no-let`**                 | `error`     | Use of `let` (except in for-loop init)      |
| **`functional/immutable-data`**         | `error`     | Direct mutations of data structures         |
| **`no-param-reassign`**                 | `error`     | Reassigning function parameters             |

### Array Mutation Prevention

ESLint blocks mutating array methods:

```typescript
// ❌ BLOCKED: Mutating array methods
const numbers = [1, 2, 3]
numbers.push(4) // ERROR: Use [...numbers, 4]
numbers.pop() // ERROR: Use numbers.slice(0, -1)
numbers.shift() // ERROR: Use numbers.slice(1)
numbers.unshift(0) // ERROR: Use [0, ...numbers]
numbers.splice(1, 1) // ERROR: Use array.slice() + spread
numbers.reverse() // ERROR: Use [...numbers].reverse()
numbers.sort() // ERROR: Use [...numbers].sort()

// ✅ CORRECT: Immutable patterns
const added = [...numbers, 4]
const removed = numbers.slice(0, -1)
const shifted = numbers.slice(1)
const prepended = [0, ...numbers]
const sorted = [...numbers].sort()
```

### Effect.ts Patterns

```typescript
// ❌ BLOCKED: No throw statements (use Effect error handling)
function riskyOperation() {
  if (error) throw new Error('Failed') // ERROR: functional/no-throw-statements
}

// ✅ CORRECT: Effect.ts error handling
import { Effect } from 'effect'

function riskyOperation() {
  return Effect.gen(function* () {
    if (error) return yield* Effect.fail(new Error('Failed'))
    return yield* Effect.succeed(result)
  })
}

// ❌ BLOCKED: Avoid Effect.runSync in business logic
import { runSync } from 'effect' // ERROR: no-restricted-imports

// ✅ CORRECT: Use Effect.runPromise or Context/Layer
const result = await Effect.runPromise(program)
```

### Functional Loops

```typescript
// ⚠️ WARNING: Prefer functional alternatives
for (const item of items) {
  // WARN: functional/no-loop-statements
  process(item)
}

// ✅ PREFERRED: Functional transformations
items.forEach(process)
items.map(transform)
items.filter(predicate)
items.reduce(accumulate, initial)
```

### Why This Matters

- **Predictability**: Immutable code is easier to reason about and debug
- **Effect.ts Alignment**: Functional patterns work seamlessly with Effect.ts
- **Testability**: Pure functions with no side effects are trivial to test
- **Concurrency Safety**: Immutable data structures prevent race conditions

## Database Safety Rules (eslint/drizzle.config.ts)

ESLint enforces **WHERE clause requirements** on database operations via **eslint-plugin-drizzle** to prevent catastrophic mass operations.

**Configuration**: See `eslint/drizzle.config.ts` for complete rule set.

### Enforced Rules

| Rule                                    | Enforcement | Protection                                           |
| --------------------------------------- | ----------- | ---------------------------------------------------- |
| **`drizzle/enforce-delete-with-where`** | `error`     | Prevents `DELETE FROM table` without WHERE clause    |
| **`drizzle/enforce-update-with-where`** | `error`     | Prevents `UPDATE table SET ...` without WHERE clause |

### What Gets Caught

```typescript
import { db } from '@/infrastructure/database'
import { users } from '@/infrastructure/database/schema'
import { eq } from 'drizzle-orm'

// ❌ BLOCKED: Mass delete (deletes ALL users)
await db.delete(users) // ERROR: drizzle/enforce-delete-with-where
// This would delete EVERY user in the database!

// ✅ CORRECT: Delete with WHERE clause
await db.delete(users).where(eq(users.id, userId))

// ❌ BLOCKED: Mass update (updates ALL users)
await db.update(users).set({ active: false }) // ERROR: drizzle/enforce-update-with-where
// This would deactivate EVERY user!

// ✅ CORRECT: Update with WHERE clause
await db.update(users).set({ active: false }).where(eq(users.id, userId))

// ✅ CORRECT: Intentional mass operations (explicit)
// If you genuinely need to affect all rows, use a comment to acknowledge:
// eslint-disable-next-line drizzle/enforce-delete-with-where
await db.delete(users) // Intentional: Clearing test data
```

### Real-World Protection

```typescript
// Scenario: Delete a user's sessions
// ❌ DANGEROUS: Easy to forget WHERE clause
async function clearUserSessions(userId: string) {
  // Typo or copy-paste error - would delete ALL sessions!
  await db.delete(sessions) // BLOCKED by ESLint!
}

// ✅ SAFE: ESLint forces WHERE clause
async function clearUserSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId))
}
```

### Why This Matters

- **Prevents Data Loss**: Catch accidental mass deletes before they reach production
- **Safety Net**: Even experienced developers make copy-paste errors
- **Explicit Intent**: Forces developers to consciously decide on operation scope
- **Production Safety**: Critical for protecting customer data

## React 19 Compiler Guidance (eslint/react.config.ts)

ESLint provides **warnings** (not errors) to guide developers away from manual memoization, since React 19 Compiler handles optimizations automatically.

**Configuration**: See `eslint/react.config.ts` for complete rule set.

### What React 19 Compiler Does

- **Automatic memoization**: Components and values are memoized without `useMemo`
- **Callback stabilization**: Callbacks are stable without `useCallback`
- **Smart re-renders**: React.memo is rarely needed

### ESLint Warnings

```typescript
// ⚠️ WARNING: Discouraged patterns (React 19 Compiler handles these)
import { useMemo, useCallback, memo } from 'react'

// WARN: "React 19 Compiler handles memoization automatically"
const expensiveValue = useMemo(() => computeValue(data), [data])

// WARN: "React 19 Compiler stabilizes callbacks automatically"
const handleClick = useCallback(() => onClick(id), [onClick, id])

// WARN: "React 19 Compiler optimizes re-renders automatically"
const MemoizedComponent = memo(Component)
```

### When Manual Memoization Is Still OK

ESLint **warns** but doesn't block. Manual memoization is acceptable for:

1. **Expensive computations** (>100ms):

   ```typescript
   // OK: Genuinely expensive operation
   const factorial = useMemo(() => {
     return calculateFactorial(largeNumber) // Takes 200ms
   }, [largeNumber])
   ```

2. **Memoized child components** (rare):

   ```typescript
   // OK: Passing callback to manually memoized child
   const MemoizedChild = memo(ExpensiveChild)
   const callback = useCallback(() => action(), []) // Prevents child re-render
   <MemoizedChild onAction={callback} />
   ```

3. **Identity-dependent hooks** (e.g., `useEffect` deps):
   ```typescript
   // OK: useEffect depends on object/array identity
   const options = useMemo(() => ({ sort: 'asc' }), [])
   useEffect(() => fetchData(options), [options])
   ```

### Default Approach

```typescript
// ✅ PREFERRED: Trust React 19 Compiler
function UserProfile({ user }) {
  // No useMemo needed - compiler handles it
  const displayName = `${user.firstName} ${user.lastName}`

  // No useCallback needed - compiler stabilizes it
  const handleUpdate = () => updateUser(user.id)

  // No memo needed - compiler optimizes re-renders
  return (
    <div onClick={handleUpdate}>
      {displayName}
    </div>
  )
}
```

### Why This Matters

- **Cleaner Code**: Removes boilerplate memoization code
- **Better Performance**: Compiler's optimizations often outperform manual memoization
- **Less Maintenance**: No need to manage dependency arrays
- **Modern Patterns**: Align with React 19 best practices

## ESLint Catches (Examples TypeScript Misses)

```typescript
// 1. Unused variables (ESLint: error, TypeScript: optional)
const unusedVariable = 42 // ESLint: Remove this
const { used, unused } = obj // ESLint: Remove 'unused'

// 2. Logic errors TypeScript allows
if (x == null) {
} // ESLint: Use === instead of ==
return value
console.log('unreachable') // ESLint: Unreachable code

// 3. Anti-patterns TypeScript doesn't care about
var oldStyle = 1 // ESLint: Use let/const
let neverReassigned = 2 // ESLint: Use const

// 4. Code quality issues
console.log('debug') // ESLint: Remove console in production
if (true) {
  doSomething()
} // ESLint: Constant condition

// 5. Best practices
const obj: any = {} // ESLint: Avoid 'any', use proper types
```

## Integration with Bun

- Command: `bun run lint` (runs `eslint .`)
- Execution: ESLint runs via Bun runtime (native TypeScript support)
- Speed: Fast analysis leveraging Bun's performance
- Compatibility: Works seamlessly with Bun's module resolution

## Claude Code Permissions

The following ESLint commands are pre-approved in `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": ["Bash(bunx eslint:*)"]
  }
}
```

## When to Run ESLint

1. **During Development** (recommended):

   ```bash
   bunx eslint . --fix  # Auto-fix on the fly
   ```

2. **Before Committing** (critical):

   ```bash
   bun run lint  # Part of pre-commit checklist
   ```

3. **In CI/CD Pipeline** (critical):

   ```bash
   bun run lint  # Fail builds if linting errors exist
   ```

4. **After Dependency Updates** (recommended):

   ```bash
   bun run lint  # Verify no new linting issues
   ```

5. **Before Code Reviews** (helpful):
   ```bash
   bunx eslint . --fix  # Clean up before submitting PR
   ```

## IDE Integration

### VS Code (ESLint Extension)

1. Install "ESLint" extension by Microsoft
2. Add to `.vscode/settings.json`:

```json
{
  "eslint.enable": true,
  "eslint.format.enable": false, // Prettier handles formatting
  "eslint.lintTask.enable": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

- Linting errors appear as squiggles in editor
- Auto-fix on save (if configured)
- Uses project's eslint.config.ts automatically

### WebStorm/IntelliJ IDEA

1. Go to Settings > Languages & Frameworks > JavaScript > Code Quality Tools > ESLint
2. Enable "Automatic ESLint configuration"
3. Check "Run eslint --fix on save"
4. ESLint errors highlighted inline
5. Quick-fixes available via Alt+Enter

### Vim/Neovim (via ALE or coc-eslint)

```vim
" Using ALE (Asynchronous Lint Engine)
let g:ale_linters = {'typescript': ['eslint']}
let g:ale_fixers = {'typescript': ['eslint']}
let g:ale_fix_on_save = 1

" Or using coc-eslint
:CocInstall coc-eslint
```

## Performance Considerations

- ESLint analyzes entire codebase (can be slow on large projects)
- Type-aware rules are slower (leverage TypeScript's type checker)
- First run builds cache, subsequent runs are faster
- Use `--cache` flag to speed up: `bunx eslint . --cache`
- Use `--max-warnings 0` in CI to fail on warnings

## ESLint vs TypeScript Comparison

```typescript
// TypeScript CATCHES:
const num: number = 'text' // Type error
interface User {
  name: string
}
const user: User = {} // Missing property

// TypeScript ALLOWS (ESLint CATCHES):
const unused = 42 // Unused variable
if (x == null) {
} // Using == instead of ===
var oldStyle = 1 // Using var
let neverChanged = 2 // Should be const

// BOTH CATCH:
undefinedVariable // TypeScript: Cannot find name, ESLint: no-undef

// NEITHER CATCH (logic bugs):
if ((x = 10)) {
} // Assignment in condition (ESLint: no-cond-assign catches this!)
```

## Configuration Customization

### Adding Custom Rules

**Approach 1**: Add to existing module in `eslint/*.config.ts`

```typescript
// eslint/typescript.config.ts - Add TypeScript-specific rule
export default [
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'error', // Add new rule
    },
  },
] satisfies Linter.Config[]
```

**Approach 2**: Create new module for project-specific rules

```typescript
// eslint/custom.config.ts
export default [
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-console': 'warn',
      'prefer-const': 'error',
    },
  },
] satisfies Linter.Config[]

// eslint.config.ts - Import and compose
import customConfig from './eslint/custom.config'
export default [
  ...baseConfig,
  // ... other configs
  ...customConfig, // Add at end
] as Linter.Config[]
```

### Modular Configuration Benefits

1. **Single Responsibility**: Each module focuses on one concern
2. **Easy Navigation**: Find rules by category (React, FP, boundaries, etc.)
3. **Maintainability**: Update rules without touching unrelated configs
4. **Testability**: Each module can be tested independently
5. **Reusability**: Modules can be shared across projects

## Ignoring Files

Create `.eslintignore` (optional):

```
# Dependencies
node_modules/

# Build output
dist/
build/

# Lock files
bun.lock

# Configuration
*.config.js
*.config.ts
```

## Troubleshooting

### ESLint reports too many errors

- Run `bunx eslint . --fix` first to auto-fix simple issues
- Review and adjust rule severity in eslint.config.ts
- Focus on errors first, then warnings

### ESLint conflicts with Prettier

- Ensure Prettier runs after ESLint
- ESLint handles logic, Prettier handles formatting
- Don't enable ESLint formatting rules that conflict with Prettier

### ESLint is too slow

- Use `--cache` flag: `bunx eslint . --cache`
- Lint specific directories during development: `bunx eslint src/`
- Run full lint only in CI/CD

### False Positives

- Use inline comments sparingly: `// eslint-disable-next-line rule-name`
- Configure rules in eslint.config.ts rather than disabling everywhere
- Document why rules are disabled

## Best Practices

1. **Run ESLint before commits** - Catch issues early (`bun run lint`)
2. **Use --fix liberally** - Auto-fix simple issues quickly
3. **Don't disable rules without reason** - Fix root causes instead
4. **Combine with TypeScript** - Both are necessary for quality code
5. **Configure IDE integration** - Get real-time feedback while coding
6. **Include in CI/CD** - Prevent linting errors from reaching production
7. **Review ESLint output** - Learn from caught issues to avoid them
8. **Add copyright headers** - Run `bun run license` after creating new .ts/.tsx files
9. **Respect size limits** - Refactor large files/functions instead of disabling rules
10. **Use modular config** - Add rules to appropriate module in `eslint/` directory

## References

- ESLint documentation: https://eslint.org/docs/latest/
- typescript-eslint documentation: https://typescript-eslint.io/
- Flat config guide: https://eslint.org/docs/latest/use/configure/configuration-files
