# Bun Runtime and Package Manager

## Overview

**Version**: 1.3.10
**Purpose**: All-in-one JavaScript/TypeScript runtime and package manager replacing Node.js and npm
**Full Reference**: https://bun.sh/llms.txt

## Why Bun for Sovrium

- Native TypeScript execution without compilation
- Built-in JSX/TSX support
- Fastest JavaScript runtime (JavaScriptCore engine)
- Built-in package manager, test runner, and bundler
- Native Web API support (fetch, WebSocket, etc.)
- Native PostgreSQL support via `bun:sql` module

## Sovrium-Specific Configuration

### Essential Commands

```bash
# Development
bun install                 # Install dependencies
bun run start               # Run application via CLI (src/cli.ts)
bun run src/index.ts        # Run application directly

# Testing
bun test:unit               # Unit tests (PATTERN FILTER: .test.ts .test.tsx only)
bun test:e2e                # E2E tests (Playwright)
bun test:all                # All tests (unit + E2E regression)

# Quality
bun run quality             # Full code quality pipeline
bun run lint                # ESLint
bun run format              # Prettier
bun run typecheck           # TypeScript type checking (tsc --noEmit)

# Database
bun run db:generate         # Generate migration from schema changes
bun run db:migrate          # Apply migrations
bun run db:push             # Push schema changes (dev only)
bun run db:studio           # Launch Drizzle Studio
```

### Lock File

- **Lock File**: `bun.lock` (binary format)
- **Manifest**: `package.json` (standard npm format)
- Always commit `bun.lock` to ensure consistent installations

### Claude Code Permissions

Pre-approved in `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": ["Bash(bun:*)"]
  }
}
```

### Environment Variables

Bun automatically loads `.env` files without additional packages:

```typescript
// Both work in Bun
console.log(process.env.API_KEY)
console.log(Bun.env.API_KEY)
```

**Priority order**: `.env.local` > `.env.[NODE_ENV]` > `.env`

### Watch Mode

```bash
bun --watch src/index.ts    # Auto-reload on changes
```

## Key Differences from Typical Stacks

- **NOT Node.js** — Use Bun exclusively
- **NOT npm/yarn/pnpm** — Use `bun install`, `bun add`, `bun remove`
- **NOT npx** — Use `bunx` for one-off commands
- **NOT ts-node** — Bun executes TypeScript natively
- **NOT nodemon** — Use `bun --watch`

## References

- Official docs: https://bun.sh/docs
- LLM-optimized: https://bun.sh/llms.txt
- Package manager: https://bun.sh/docs/cli/install
