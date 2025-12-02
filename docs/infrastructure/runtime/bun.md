# Bun Runtime and Package Manager

## Overview

**Version**: 1.3.3
**Purpose**: All-in-one JavaScript/TypeScript runtime and package manager replacing Node.js and npm

## Bun Runtime

### Key Features

- Native TypeScript execution without compilation
- Built-in JSX/TSX support
- Fastest JavaScript runtime (uses JavaScriptCore engine)
- Built-in package manager and test runner
- Native Web API support (fetch, WebSocket, etc.)

### Execution Pattern

```bash
# Direct TypeScript execution - NO compilation step needed
bun run index.ts
bun run src/any-file.ts

# Script execution from package.json
bun run <script-name>
```

### Why Bun over Node.js

- 4x faster cold starts
- Native TypeScript without build step
- Unified toolchain (runtime + package manager + test runner + bundler)
- Better memory efficiency
- Modern JavaScript features by default

## Bun Package Manager

### Lock File and Manifest

- **Lock File**: `bun.lock` (binary format, not human-readable)
- **Manifest**: `package.json` (standard npm format)

### Essential Commands

```bash
# Install all dependencies
bun install
bun i  # shorthand

# Add dependencies
bun add <package>           # runtime dependency
bun add -d <package>        # dev dependency
bun add --peer <package>    # peer dependency

# Remove dependencies
bun remove <package>

# Update dependencies
bun update <package>        # update specific
bun update                  # update all

# Clean install
rm -rf node_modules bun.lock && bun install

# Run scripts
bun run <script>           # from package.json
bun run --bun <script>     # force Bun runtime
```

### Performance Notes

- Install speed: 10-100x faster than npm
- Uses hardlinks when possible (saves disk space)
- Global cache shared across projects
- Binary lockfile for faster parsing

## Claude Code Permissions

The following Bun commands are pre-approved in `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": ["Bash(bun:*)"]
  }
}
```

This allows Claude Code to run any `bun` command without requiring user approval, enabling faster iteration during development.

## Integration with Other Tools

- **TypeScript**: Bun executes TypeScript directly; use `tsc --noEmit` for type checking
- **Testing**: Bun has built-in test runner (`bun test`) for unit tests
- **ESLint**: Run via `bunx eslint` or `bun run lint`
- **Prettier**: Run via `bunx prettier` or `bun run format`
- **Playwright**: Run via `bunx playwright` or `bun test:e2e`

## Environment Variables

Bun automatically loads `.env` files without additional packages.

**Access patterns**:

```typescript
// Both work in Bun
console.log(process.env.API_KEY)
console.log(Bun.env.API_KEY)
```

**Priority order**:

1. `.env.local`
2. `.env.[NODE_ENV]` (e.g., `.env.production`)
3. `.env`

## Best Practices

1. **Use bun commands exclusively** - Never use `node`, `npm`, `yarn`, or `pnpm`
2. **Leverage native TypeScript** - No need for compilation steps
3. **Use bunx for one-off commands** - Replace `npx` with `bunx`
4. **Commit bun.lock** - Ensures consistent installations across environments
5. **Use --frozen-lockfile in CI** - Prevents accidental dependency changes

## Common Pitfalls to Avoid

- ❌ Using `node` instead of `bun` to run scripts
- ❌ Using `npm install` instead of `bun install`
- ❌ Using `npx` instead of `bunx`
- ❌ Running `ts-node` (Bun executes TypeScript natively)
- ❌ Setting up `nodemon` (use `bun --watch` instead)

## Watch Mode

Bun includes built-in watch mode for development:

```bash
# Watch mode for automatic reloading
bun --watch src/index.ts
```

## References

- Official documentation: https://bun.sh/docs
- Package manager guide: https://bun.sh/docs/cli/install
- Runtime guide: https://bun.sh/docs/cli/run
