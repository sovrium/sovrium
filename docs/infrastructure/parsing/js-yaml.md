# js-yaml v4.1.1

## Overview

js-yaml is a JavaScript implementation of YAML 1.2 parser and serializer. In Sovrium, it's used exclusively in the CLI to parse YAML configuration files for app schemas.

## Installation

```bash
bun add js-yaml
bun add -d @types/js-yaml
```

## Configuration

No configuration file required. Uses default settings for safe YAML parsing.

## Usage

| Import                                        | Purpose                                  |
| --------------------------------------------- | ---------------------------------------- |
| `import { load as parseYaml } from 'js-yaml'` | Parse YAML strings to JavaScript objects |

### CLI Configuration File Parsing

**Location**: `src/cli.ts`

```typescript
import { load as parseYaml } from 'js-yaml'

// Parse YAML file content
const content = await file.text()
const parsed = parseYaml(content) // Returns JavaScript object
```

**Supported formats**:

- `.yaml` files
- `.yml` files
- `.json` files (for compatibility)

### Format Detection

```typescript
const detectFormat = (filePath: string): 'json' | 'yaml' | 'unsupported' => {
  const lowerPath = filePath.toLowerCase()
  if (lowerPath.endsWith('.json')) return 'json'
  if (lowerPath.endsWith('.yaml') || lowerPath.endsWith('.yml')) return 'yaml'
  return 'unsupported'
}
```

### CLI Command Examples

```bash
# Start server with YAML config
sovrium start app.yaml

# Generate static site with YAML config
sovrium static app.yml

# JSON files still work
sovrium start app.json
```

## Integration

**Related tools**:

- **Bun**: File I/O via `Bun.file()` API
- **Effect**: Error handling for parse failures
- **App Schema**: Parsed YAML is validated against `AppEncoded` type

**Workflow**:

1. CLI receives config file path
2. Detect format from file extension (`.yaml`, `.yml`, `.json`)
3. Read file content with `Bun.file().text()`
4. Parse with `parseYaml()` or `JSON.parse()` based on format
5. Pass parsed object to `start()` or `build()` function

## Best Practices

1. **Use `load()` not `loadAll()`** - Single document configs only
2. **Rename on import** - Use `load as parseYaml` for clarity
3. **Type the result** - Cast to `AppEncoded` after parsing
4. **Error handling** - Wrap in try-catch for invalid YAML
5. **File extension check** - Validate `.yaml`/`.yml` before parsing

### Error Handling Pattern

```typescript
try {
  const content = await file.text()
  if (format === 'yaml') {
    const parsed = parseYaml(content)
    return parsed as AppEncoded
  }
} catch (error) {
  Effect.runSync(Console.error('Failed to parse YAML file:', error.message))
  process.exit(1)
}
```

## YAML Features Supported

| Feature                | Supported | Example                                     |
| ---------------------- | --------- | ------------------------------------------- |
| **Comments**           | ✅        | `# This is a comment`                       |
| **Multi-line strings** | ✅        | `description: \|` (literal) or `>` (folded) |
| **Anchors & aliases**  | ✅        | `&anchor` and `*anchor`                     |
| **Nested objects**     | ✅        | Indented structures                         |
| **Arrays**             | ✅        | `- item` or `[item1, item2]`                |
| **Boolean/null**       | ✅        | `true`, `false`, `null`                     |

**Note**: Multi-line descriptions in app configs are constrained by the `AppEncoded` schema (single-line string), not by js-yaml's capabilities.

## Project-Specific Constraints

**CLI usage only** - js-yaml is NOT used in:

- Server-side validation (uses Effect Schema)
- Client-side forms (uses Zod)
- Database operations (uses Drizzle ORM)

**Single responsibility** - Parse YAML files → JavaScript objects, nothing more

**No serialization** - We only use the `load()` function (parsing). The `dump()` function (serialization) is not used.

## Troubleshooting

| Issue                                       | Solution                                            |
| ------------------------------------------- | --------------------------------------------------- |
| "js-yaml: incomplete explicit mapping pair" | Check YAML indentation and colons                   |
| "js-yaml: duplicated mapping key"           | Remove duplicate keys in YAML object                |
| "js-yaml: unexpected end of the stream"     | Check for unclosed quotes or brackets               |
| Parse succeeds but validation fails         | YAML is valid but doesn't match `AppEncoded` schema |

## Common Pitfalls

1. **Tabs vs spaces** - YAML requires spaces for indentation (NOT tabs)
2. **Quote strings with special chars** - Use quotes for `:`, `#`, `[`, `{` in values
3. **Case sensitivity** - YAML keys are case-sensitive
4. **Type coercion** - `true`, `false`, `null` are parsed as primitives, not strings

## References

- Official docs: https://github.com/nodeca/js-yaml
- YAML 1.2 spec: https://yaml.org/spec/1.2/spec.html
- TypeScript types: https://www.npmjs.com/package/@types/js-yaml
