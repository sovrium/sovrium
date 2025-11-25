# Jiti - Runtime TypeScript and ESM Support

## Overview

**Version**: 2.6.1 (transitive dependency)
**Purpose**: Runtime TypeScript and ESM loader for Node.js, used internally by Tailwind CSS
**Usage**: Indirect (not directly imported by Sovrium code)
**Installed By**: `@tailwindcss/node` package

## What is Jiti?

Jiti is a lightweight runtime TypeScript and ESM (ECMAScript Modules) loader for Node.js. It allows Node.js to execute TypeScript files directly without pre-compilation, similar to `ts-node` but with better performance and ESM support.

**Key Features**:
- **TypeScript Support**: Execute `.ts` files directly in Node.js
- **ESM/CJS Interop**: Seamless interoperability between ESM and CommonJS
- **Fast Execution**: Minimal overhead compared to ts-node
- **No Configuration**: Works out-of-the-box
- **Source Map Support**: Accurate error stack traces

## Why Jiti Exists in Sovrium

**⚠️ Note**: Jiti is **NOT directly used** by Sovrium code. It's a transitive dependency installed by Tailwind CSS.

### Tailwind CSS Dependency Chain

```
sovrium
└── tailwindcss@4.1.18
    └── @tailwindcss/node@4.1.17
        └── jiti@2.6.1
```

### Why Tailwind CSS Uses Jiti

Tailwind CSS v4 uses Jiti internally for:
1. **Configuration Loading**: Load `tailwind.config.ts` files (TypeScript configs)
2. **Plugin System**: Execute TypeScript-based Tailwind plugins
3. **Custom Utilities**: Process custom utility definitions written in TypeScript

**In Sovrium's case**: We don't use static Tailwind config files (`tailwind.config.ts`), so Jiti is rarely invoked. However, it remains a dependency because Tailwind CSS requires it for its plugin system.

## Sovrium's Approach (Bun Instead of Jiti)

Sovrium uses **Bun** as its runtime, which natively executes TypeScript without requiring Jiti or any transpilation step:

| Tool | TypeScript Support | Performance | Used By Sovrium |
|------|-------------------|-------------|-----------------|
| **Bun** | Native (built-in) | Fastest | ✅ Yes (primary runtime) |
| **Jiti** | Runtime loader | Fast | ❌ No (transitive dependency only) |
| **ts-node** | Runtime loader | Slower | ❌ No |
| **tsx** | Runtime loader | Fast | ❌ No |

**Why Bun is better**:
- Native TypeScript execution (no transpilation step)
- ~10x faster than Node.js with jiti/ts-node
- All-in-one tool (runtime + package manager + test runner)

## When Jiti is Invoked (Rare)

Jiti may be invoked in these scenarios:

1. **Tailwind CSS Plugin Loading** (if using custom plugins):
   ```typescript
   // tailwind.config.ts (we don't use this)
   import { myPlugin } from './my-plugin.ts'
   export default { plugins: [myPlugin] }
   ```

2. **PostCSS Config with TypeScript** (if using postcss.config.ts):
   ```typescript
   // postcss.config.ts (we don't use this)
   export default { plugins: { tailwindcss: {} } }
   ```

**Sovrium uses programmatic compilation instead** (see `@docs/infrastructure/css/css-compiler.md`), so these scenarios don't apply.

## Configuration

No configuration needed. Jiti is automatically used by Tailwind CSS when required.

**Default behavior**:
- Transpiles TypeScript to JavaScript in-memory
- Caches compiled modules for performance
- Resolves both ESM and CommonJS imports

## Troubleshooting

### Issue: Jiti Errors in Tailwind CSS

If you see errors like:
```
Error: Cannot find module 'jiti'
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'jiti'
```

**Cause**: Corrupted node_modules or missing dependencies

**Fix**:
```bash
# Reinstall dependencies
rm -rf node_modules bun.lock
bun install
```

### Issue: TypeScript Config Not Loaded

If Tailwind CSS can't load a TypeScript config file:

**Cause**: Syntax error in config file or jiti not installed

**Fix**:
1. Check TypeScript syntax in config file
2. Ensure jiti is installed: `bun install` (auto-installed via Tailwind CSS)
3. Use JavaScript config instead: `tailwind.config.js` (plain JS, no transpilation)

**Note**: Sovrium doesn't use static config files, so this is unlikely to occur.

## Best Practices

### ✅ Do

- **Trust transitive dependencies**: Let Tailwind CSS manage jiti version
- **Use Bun for scripts**: Run TypeScript scripts with `bun run`, not jiti
- **Keep Tailwind CSS updated**: Ensures jiti compatibility

### ❌ Don't

- **Don't directly import jiti**: Use Bun's native TypeScript support instead
- **Don't add jiti to package.json dependencies**: It's already a transitive dep
- **Don't use jiti for custom scripts**: Bun is faster and more capable

## Alternative Tools

If you need runtime TypeScript execution outside of Tailwind CSS:

| Tool | Use Case | Performance | Recommendation |
|------|----------|-------------|----------------|
| **Bun** | All scripts, tests, server | Fastest (native) | ✅ Use this (already installed) |
| **tsx** | Node.js-specific scripts | Fast | ⚠️ Unnecessary (Bun is better) |
| **ts-node** | Legacy Node.js projects | Slow | ❌ Avoid |
| **jiti** | Tailwind CSS plugins | Fast | ⚠️ Only via Tailwind CSS |

**Recommendation**: Always use `bun run script.ts` instead of jiti.

## Related Documentation

- **Tailwind CSS**: `@docs/infrastructure/ui/tailwind.md`
- **CSS Compiler**: `@docs/infrastructure/css/css-compiler.md` (Sovrium's approach)
- **Bun Runtime**: `@docs/infrastructure/runtime/bun.md`

## External Resources

- [Jiti GitHub Repository](https://github.com/unjs/jiti)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [Bun Documentation](https://bun.sh/docs)

## Summary

**TL;DR**:
- Jiti is a transitive dependency installed by Tailwind CSS
- Sovrium doesn't directly use jiti (Bun handles TypeScript natively)
- No configuration or special handling required
- Trust Tailwind CSS to manage jiti version
- Use Bun for all custom TypeScript scripts
