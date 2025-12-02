# Prettier Code Formatter

## Overview

**Version**: 3.7.3
**Purpose**: Enforces consistent code formatting across the entire codebase automatically, eliminating style debates and ensuring uniform code appearance

## Why Prettier

- Zero-config opinionated formatter (minimal configuration needed)
- Supports TypeScript, JavaScript, JSX, TSX, JSON, Markdown, and more
- Integrates seamlessly with Bun via `bunx`
- Prevents formatting inconsistencies in version control
- Saves time during code reviews by eliminating style discussions

## Prettier vs ESLint

- **Prettier**: Code **formatting** (quotes, semicolons, spacing, line breaks)
- **ESLint**: Code **quality** (logic errors, unused variables, best practices)
- **Complementary**: Prettier makes code look good, ESLint makes code work correctly
- **Workflow**: ESLint first (fix logic), then Prettier (fix formatting)

## Running Prettier with Bun

```bash
# Format all files in the project
bun run format

# Check formatting without modifying files (useful for CI/CD)
bun run format:check

# Alternative: Direct bunx commands
bunx prettier --write .          # Format all files
bunx prettier --check .          # Check formatting

# Format specific files or directories
bunx prettier --write src/
bunx prettier --write "src/**/*.ts"
bunx prettier --write index.ts

# Check specific files
bunx prettier --check "src/**/*.{ts,tsx,json}"

# Format with custom config (if needed)
bunx prettier --write . --config .prettierrc.json
```

## Configuration File: .prettierrc.json

### Active Configuration

```json
{
  "semi": false, // No semicolons
  "trailingComma": "es5", // Trailing commas where valid in ES5
  "singleQuote": true, // Single quotes for strings
  "tabWidth": 2, // 2 spaces per indentation level
  "useTabs": false, // Spaces, not tabs
  "printWidth": 100, // Wrap lines at 100 characters
  "singleAttributePerLine": true // Each attribute on separate line (HTML/JSX)
}
```

## Configuration Impact on Code Generation

- **No Semicolons**: All statements should omit trailing semicolons
- **Single Quotes**: String literals use `'` instead of `"`
- **100 Character Line Width**: Break long lines at 100 characters
- **Trailing Commas**: Add trailing commas in arrays, objects, function parameters
- **2-Space Indentation**: Use 2 spaces for all indentation levels
- **Single Attribute Per Line**: JSX/TSX attributes each on their own line

## Formatting Standards

### 1. Quotes: Always Use Single Quotes

```typescript
// CORRECT
const message = 'Hello world'
const path = './module.ts'

// INCORRECT
const message = 'Hello world' // ❌ Double quotes
```

### 2. Semicolons: Never Use Semicolons

```typescript
// CORRECT
const value = 42
const fn = () => console.log('done')

// INCORRECT
const value = 42 // ❌ Semicolon
const fn = () => console.log('done') // ❌ Semicolon
```

### 3. Line Width: Maximum 100 Characters

```typescript
// CORRECT - Breaks at 100 characters
const longObject = {
  propertyOne: 'value',
  propertyTwo: 'another value',
  propertyThree: 'yet another value',
}

// INCORRECT - Exceeds 100 characters
const longObject = {
  propertyOne: 'value',
  propertyTwo: 'another value',
  propertyThree: 'yet another value',
} // ❌
```

### 4. Trailing Commas: Use in Multi-line Structures

```typescript
// CORRECT
const array = [
  'item1',
  'item2',
  'item3', // Trailing comma
]

const object = {
  key1: 'value1',
  key2: 'value2', // Trailing comma
}

// INCORRECT
const array = [
  'item1',
  'item2',
  'item3', // ❌ Missing trailing comma
]
```

### 5. Indentation: 2 Spaces (No Tabs)

```typescript
// CORRECT
function example() {
  if (condition) {
    return true
  }
}

// INCORRECT - Uses 4 spaces or tabs
function example() {
  if (condition) {
    // ❌ Wrong indentation
    return true
  }
}
```

### 6. JSX/TSX Attributes: One Attribute Per Line

```typescript
// CORRECT
<Component
  prop1="value1"
  prop2="value2"
  prop3="value3"
/>

// INCORRECT
<Component prop1="value1" prop2="value2" prop3="value3" />  // ❌
```

## File Support

- TypeScript: `.ts`, `.tsx`
- JavaScript: `.js`, `.jsx`, `.mjs`
- JSON: `.json`
- Markdown: `.md`
- YAML: `.yml`, `.yaml`
- HTML: `.html`

## Integration with Development Workflow

1. **Pre-commit**: Run `bunx prettier --write .` before commits
2. **CI/CD**: Add formatting checks to continuous integration
3. **IDE/Editor**: Configure editor to format on save (see IDE Integration section)
4. **After ESLint**: Run Prettier after ESLint fixes logic issues

## IDE Integration

### VS Code (Prettier Extension)

1. Install "Prettier - Code formatter" extension
2. Add to `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

### WebStorm/IntelliJ IDEA

1. Go to Settings > Languages & Frameworks > JavaScript > Prettier
2. Enable "On save" checkbox
3. Set "Run for files" to: `{**/*,*}.{js,ts,jsx,tsx,json,md}`

### Vim/Neovim (via ALE or coc-prettier)

```vim
" Using ALE
let g:ale_fixers = {'typescript': ['prettier'], 'javascript': ['prettier']}
let g:ale_fix_on_save = 1

" Or using coc-prettier
:CocInstall coc-prettier
```

## Integration with Bun

- Command: `bun run format` (runs `prettier --write .` - format all files)
- Command: `bun run format:check` (runs `prettier --check .` - check without modifying)
- Execution: Prettier runs via `bunx` (Bun's package executor)
- Speed: Very fast formatting leveraging Bun's performance
- Compatibility: Works seamlessly with Bun's module resolution

## Automatic Formatting

- Run `bun run format` before committing code (recommended)
- Run `bun run format:check` in CI/CD to verify formatting
- Configure your IDE to format on save (highly recommended)
- Prettier will automatically fix all formatting issues

## When to Run Prettier

1. **Before Committing** (critical):

   ```bash
   bun run format  # Format all files
   ```

2. **In CI/CD Pipeline** (critical):

   ```bash
   bun run format:check  # Verify formatting without modifying
   ```

3. **After Code Changes** (recommended):

   ```bash
   bun run format  # Auto-format everything
   ```

4. **On Save** (highly recommended):
   - Configure IDE to format on save (see IDE Integration section)

## Ignoring Files: .prettierignore

Create `.prettierignore` (optional):

```
# Dependencies
node_modules/

# Build output
dist/
build/
out/

# Lock files
bun.lock

# Generated files
CHANGELOG.md

# Playwright artifacts
test-results/
playwright-report/
playwright/.cache/
```

## Prettier vs Other Tools

| Tool                 | Purpose         | When to Run              | Auto-Fix             | Speed                    |
| -------------------- | --------------- | ------------------------ | -------------------- | ------------------------ |
| **Prettier**         | Code formatting | Before commits, on save  | Yes (full)           | Very fast (milliseconds) |
| **ESLint**           | Code quality    | Before commits, in CI/CD | Partial (many rules) | Fast (seconds)           |
| **TypeScript (tsc)** | Type checking   | Before commits, in CI/CD | No                   | Medium (seconds)         |

## Integration with ESLint

- ESLint should NOT handle formatting (Prettier's job)
- Disable conflicting ESLint formatting rules
- Run ESLint first, then Prettier
- ESLint fixes logic issues, Prettier fixes appearance

## Best Practices

1. **Format before committing** - Ensure consistent formatting
2. **Enable format on save** - Catch formatting issues immediately
3. **Never manually adjust formatting** - Trust Prettier's decisions
4. **Include format:check in CI** - Prevent unformatted code from merging
5. **Run after ESLint** - Fix logic first, then format
6. **Commit .prettierrc.json** - Share configuration with team

## Troubleshooting

### Prettier conflicts with ESLint

- Ensure ESLint doesn't have conflicting formatting rules
- Run Prettier after ESLint
- Prettier should be the final formatting step

### Prettier not formatting on save

- Verify IDE extension is installed
- Check editor settings (see IDE Integration section)
- Ensure .prettierrc.json exists in project root

### Some files not formatted

- Check .prettierignore file
- Verify file extension is supported
- Run `bunx prettier --write .` to format all files

## Common Pitfalls to Avoid

- ❌ Manually adjusting code after Prettier runs
- ❌ Using ESLint for formatting instead of Prettier
- ❌ Not committing .prettierrc.json to version control
- ❌ Skipping format checks in CI/CD
- ❌ Not enabling format on save in IDE

## References

- Prettier documentation: https://prettier.io/docs/en/
- Configuration options: https://prettier.io/docs/en/options.html
- Editor integration: https://prettier.io/docs/en/editors.html
