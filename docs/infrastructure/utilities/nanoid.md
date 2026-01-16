# nanoid - Unique ID Generator

## Overview

**Version**: ^5.1.6
**Purpose**: Secure, URL-friendly, unique string ID generator
**Usage**: Client-side unique identifiers, temporary references, form field keys

nanoid is a tiny, secure, URL-friendly unique string ID generator. It's used in Sovrium for generating unique identifiers where UUIDs are not required (e.g., React component keys, temporary client-side IDs).

## Why nanoid for Sovrium

- **Tiny**: Only 130 bytes (minified and brotlied)
- **Fast**: 2x faster than UUID v4
- **Secure**: Uses cryptographically strong random APIs
- **URL-Friendly**: Uses A-Za-z0-9\_- alphabet (no special encoding needed)
- **Customizable**: Adjustable size and custom alphabets
- **No Dependencies**: Zero external dependencies
- **Cross-Platform**: Works in Node.js, browsers, and Bun

## Installation

nanoid is already installed in Sovrium:

```json
{
  "dependencies": {
    "nanoid": "^5.1.6"
  }
}
```

## Basic Usage

```typescript
import { nanoid } from 'nanoid'

// Generate a 21-character unique ID (default)
const id = nanoid()
// => "V1StGXR8_Z5jdHi6B-myT"

// Generate a shorter ID (10 characters)
const shortId = nanoid(10)
// => "IRFa-VaY2b"

// Generate a longer ID for more collision resistance
const longId = nanoid(36)
// => "dWZz7NqvIaYBLF3u5lK8fGxE2tRjCpHn1sO0"
```

## ID Length and Collision Probability

| Length       | Collision after | Use Case            |
| ------------ | --------------- | ------------------- |
| 10           | ~1,000 IDs      | Temporary UI keys   |
| 21 (default) | ~1 million IDs  | General purpose     |
| 36           | ~1 trillion IDs | High-volume systems |

**Calculation**: At 1000 IDs/second, 21-character IDs have <1% collision probability after 1 million years.

## Common Use Cases in Sovrium

### 1. React List Keys

```typescript
import { nanoid } from 'nanoid'

// Generate unique keys for dynamic lists
function DynamicList({ items }: { items: string[] }) {
  const itemsWithKeys = items.map(item => ({
    id: nanoid(10), // Short ID for React keys
    content: item,
  }))

  return (
    <ul>
      {itemsWithKeys.map(item => (
        <li key={item.id}>{item.content}</li>
      ))}
    </ul>
  )
}
```

### 2. Form Field IDs

```typescript
import { nanoid } from 'nanoid'

interface FormFieldProps {
  label: string
  type: string
}

function FormField({ label, type }: FormFieldProps) {
  // Generate unique ID for label-input association
  const fieldId = nanoid(10)

  return (
    <div>
      <label htmlFor={fieldId}>{label}</label>
      <input id={fieldId} type={type} />
    </div>
  )
}
```

### 3. Temporary Client-Side References

```typescript
import { nanoid } from 'nanoid'

interface PendingUpload {
  tempId: string
  file: File
  status: 'pending' | 'uploading' | 'complete'
}

function useFileUpload() {
  const [uploads, setUploads] = useState<PendingUpload[]>([])

  const addFile = (file: File) => {
    setUploads((prev) => [
      ...prev,
      {
        tempId: nanoid(), // Temporary ID before server assigns real ID
        file,
        status: 'pending',
      },
    ])
  }

  return { uploads, addFile }
}
```

### 4. Request Correlation IDs

```typescript
import { nanoid } from 'nanoid'

function createRequestContext() {
  return {
    correlationId: nanoid(),
    timestamp: Date.now(),
  }
}

// Usage in API requests
async function fetchWithCorrelation(url: string) {
  const ctx = createRequestContext()

  const response = await fetch(url, {
    headers: {
      'X-Correlation-ID': ctx.correlationId,
    },
  })

  return response
}
```

## Custom Alphabets

For specific requirements, use `customAlphabet`:

```typescript
import { customAlphabet } from 'nanoid'

// Lowercase only (URL slug-friendly)
const slugId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10)
slugId() // => "a3kd8fjsk2"

// Numbers only
const numericId = customAlphabet('0123456789', 6)
numericId() // => "847291"

// Hex IDs
const hexId = customAlphabet('0123456789abcdef', 16)
hexId() // => "3a7f2b9c8d1e4f6a"
```

## nanoid vs UUID

| Aspect             | nanoid             | UUID v4              |
| ------------------ | ------------------ | -------------------- |
| **Size**           | 130 bytes          | 3.3KB (uuid package) |
| **Speed**          | 2x faster          | Standard             |
| **Output**         | 21 chars (default) | 36 chars             |
| **URL-Safe**       | Yes                | No (needs encoding)  |
| **Collision Risk** | Equivalent         | Equivalent           |

**When to use nanoid**:

- Client-side unique IDs
- React component keys
- Short, readable identifiers
- URL-friendly slugs

**When to use UUID**:

- Database primary keys (use Drizzle's native UUID)
- API responses that need standard format
- Interoperability with systems expecting UUIDs

## Best Practices

### 1. Use Appropriate Length

```typescript
// ✅ Short IDs for ephemeral uses
const tempKey = nanoid(10)

// ✅ Default length for general use
const standardId = nanoid()

// ✅ Longer IDs for high-volume systems
const highVolumeId = nanoid(36)
```

### 2. Don't Use for Database Primary Keys

```typescript
// ❌ AVOID: nanoid for database PKs
const user = { id: nanoid(), name: 'Alice' }

// ✅ CORRECT: Use database-native UUIDs (Drizzle)
import { uuid } from 'drizzle-orm/pg-core'

const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
})
```

### 3. Generate at Point of Use

```typescript
// ❌ AVOID: Pre-generating IDs
const ids = Array.from({ length: 100 }, () => nanoid())

// ✅ CORRECT: Generate when needed
function createItem() {
  return { id: nanoid(), createdAt: Date.now() }
}
```

## Integration with Effect.ts

```typescript
import { Effect } from 'effect'
import { nanoid } from 'nanoid'

const generateId = Effect.sync(() => nanoid())

// Usage in Effect program
const createResource = Effect.gen(function* () {
  const id = yield* generateId
  return { id, type: 'resource' }
})
```

## Testing

```typescript
import { test, expect } from 'bun:test'
import { nanoid } from 'nanoid'

test('nanoid generates unique IDs', () => {
  const ids = new Set()
  for (let i = 0; i < 1000; i++) {
    ids.add(nanoid())
  }
  expect(ids.size).toBe(1000) // All unique
})

test('nanoid respects custom length', () => {
  const id = nanoid(10)
  expect(id.length).toBe(10)
})

test('nanoid is URL-safe', () => {
  const id = nanoid()
  const encoded = encodeURIComponent(id)
  expect(encoded).toBe(id) // No encoding needed
})
```

## Common Pitfalls

- ❌ **Don't use for database primary keys** - Use Drizzle's native UUID support
- ❌ **Don't assume sequential order** - IDs are random, not sequential
- ❌ **Don't parse nanoid for meaning** - They're random strings, not structured data
- ❌ **Don't use very short IDs for persistent data** - Higher collision risk

## References

- nanoid documentation: https://github.com/ai/nanoid
- nanoid npm: https://www.npmjs.com/package/nanoid
- Collision probability calculator: https://zelark.github.io/nano-id-cc/
