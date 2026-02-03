# App Schema Specification

> Root application configuration (name, version, description)

## Overview

The App Schema defines the core identity and metadata for a Sovrium application. Every app requires these three foundational properties that follow industry standards.

**Vision Alignment**: These properties enable Sovrium's configuration-driven approach by providing consistent, validatable app identity across all environments.

## Schema Definitions

### Name

**Location**: `src/domain/models/app/name.ts`

Defines the application identifier following npm package naming conventions.

| Property       | Value                                                      |
| -------------- | ---------------------------------------------------------- |
| **Type**       | `string`                                                   |
| **Required**   | Yes                                                        |
| **Min Length** | 1                                                          |
| **Max Length** | 214                                                        |
| **Pattern**    | `^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$` |

#### Validation Rules

1. **Lowercase only** - No uppercase characters allowed
2. **No leading dots/underscores** - Cannot start with `.` or `_`
3. **URL-safe characters** - Only alphanumeric, hyphens, underscores, dots, tildes
4. **Scoped packages supported** - `@scope/package-name` format allowed
5. **No leading/trailing spaces** - Whitespace trimmed

#### Valid Examples

```yaml
name: my-app
name: todo-app
name: "@myorg/my-app"
name: blog-system
name: dashboard-admin
```

#### Invalid Examples

```yaml
name: My-App          # ❌ Uppercase not allowed
name: .hidden-app     # ❌ Cannot start with dot
name: _private-app    # ❌ Cannot start with underscore
name: "app name"      # ❌ Spaces not allowed
name: ""              # ❌ Empty string not allowed
```

---

### Version

**Location**: `src/domain/models/app/version.ts`

Defines the application version following [Semantic Versioning (SemVer) 2.0.0](https://semver.org/).

| Property       | Value                                    |
| -------------- | ---------------------------------------- |
| **Type**       | `string`                                 |
| **Required**   | Yes                                      |
| **Min Length** | 5 (`0.0.0`)                              |
| **Format**     | `MAJOR.MINOR.PATCH[-prerelease][+build]` |

#### Version Components

| Component          | Description                                    | Example           |
| ------------------ | ---------------------------------------------- | ----------------- |
| **MAJOR**          | Incremented for incompatible API changes       | `2.0.0`           |
| **MINOR**          | Incremented for backwards-compatible features  | `1.1.0`           |
| **PATCH**          | Incremented for backwards-compatible bug fixes | `1.0.1`           |
| **Pre-release**    | Optional, hyphen-separated identifiers         | `1.0.0-alpha`     |
| **Build metadata** | Optional, plus-separated identifiers           | `1.0.0+build.123` |

#### Validation Rules

1. **No leading zeros** - `01.0.0` is invalid, use `1.0.0`
2. **Non-negative integers only** - `-1.0.0` is invalid
3. **All three components required** - `1.0` is invalid, use `1.0.0`
4. **Pre-release alphanumeric** - Can include alphanumeric and hyphens

#### Valid Examples

```yaml
version: "1.0.0"
version: "0.0.1"
version: "1.2.3"
version: "1.0.0-alpha"
version: "1.0.0-beta.1"
version: "2.0.0-rc.1"
version: "1.0.0+build.123"
version: "1.0.0-alpha+001"
```

#### Invalid Examples

```yaml
version: "1.0"         # ❌ Missing PATCH
version: "01.0.0"      # ❌ Leading zero in MAJOR
version: "1.0.0.0"     # ❌ Too many components
version: "v1.0.0"      # ❌ No 'v' prefix allowed
version: ""            # ❌ Empty string not allowed
```

---

### Description

**Location**: `src/domain/models/app/description.ts`

Defines a single-line description of the application.

| Property        | Value                               |
| --------------- | ----------------------------------- |
| **Type**        | `string`                            |
| **Required**    | Yes                                 |
| **Max Length**  | 2000                                |
| **Constraints** | No line breaks (`\n`, `\r`, `\r\n`) |

#### Validation Rules

1. **Single line only** - No line breaks allowed
2. **Max 2000 characters** - Prevents UI/database issues
3. **Empty strings allowed** - Can be `""`
4. **Unicode supported** - Emojis and international characters allowed
5. **Special characters allowed** - Except line breaks

#### Valid Examples

```yaml
description: "A simple application"
description: "My app - with special characters!@#$%"
description: "Très bien! 你好 🎉"
description: "Full-featured e-commerce platform with cart, checkout & payment processing"
description: ""
```

#### Invalid Examples

```yaml
description: "Multi\nline"         # ❌ Contains \n
description: "Windows\r\nbreak"    # ❌ Contains \r\n
description: "Mac\rbreak"          # ❌ Contains \r
```

---

## E2E Test Coverage

| Spec File                       | Tests                    | Status  | Description            |
| ------------------------------- | ------------------------ | ------- | ---------------------- |
| `specs/app/name.spec.ts`        | ~5 @spec + 1 @regression | 🟢 100% | Name validation        |
| `specs/app/version.spec.ts`     | ~5 @spec + 1 @regression | 🟢 100% | SemVer validation      |
| `specs/app/description.spec.ts` | ~5 @spec + 1 @regression | 🟢 100% | Description validation |

### Test Categories

#### Happy Path

- Valid npm-style names
- Valid SemVer versions
- Valid single-line descriptions

#### Validation (Edge Cases)

- Empty strings
- Boundary lengths (1, 214, 2000 characters)
- Special characters
- Unicode/emoji support
- Scoped package names

#### Error Cases

- Invalid patterns
- Line breaks in description
- Leading zeros in version
- Uppercase in name

---

## Implementation Status

**Overall**: 🟢 100%

All three schemas are fully implemented with:

- ✅ Effect Schema validation
- ✅ TypeScript type inference
- ✅ Comprehensive E2E tests
- ✅ Full documentation

---

## Use Cases

### Example 1: Minimal App Configuration

```yaml
name: my-app
version: '1.0.0'
description: 'A simple todo application'
```

### Example 2: Scoped Package with Pre-release

```yaml
name: '@myorg/dashboard'
version: '2.0.0-beta.1'
description: 'Enterprise dashboard for monitoring and analytics'
```

### Example 3: Programmatic Validation

```typescript
import { Schema } from 'effect'
import { NameSchema, VersionSchema, DescriptionSchema } from '@/domain/models/app'

// Validate name
const name = Schema.decodeUnknownSync(NameSchema)('my-app')

// Validate version
const version = Schema.decodeUnknownSync(VersionSchema)('1.0.0')

// Validate description
const description = Schema.decodeUnknownSync(DescriptionSchema)('A simple app')
```

---

## Related Features

- [Theme](./theme.md) - Visual design tokens
- [Tables](./tables.md) - Data modeling
- [Pages](./pages.md) - UI configuration
