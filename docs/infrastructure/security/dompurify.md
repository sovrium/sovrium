# DOMPurify - XSS Sanitization Library

## Overview

**Version**: ^3.3.1
**Purpose**: DOM-only XSS sanitization library that removes malicious content from HTML strings before rendering
**Layer**: Presentation (used in React components that render user-provided HTML)

DOMPurify is a security-focused library that sanitizes HTML and prevents Cross-Site Scripting (XSS) attacks. It's the industry-standard solution for safely rendering user-generated HTML content.

## Why DOMPurify for Sovrium

- **XSS Prevention**: Removes scripts, event handlers, and dangerous attributes from HTML
- **DOM-Based**: Uses browser's native DOM parser for accurate HTML parsing
- **Fast**: Optimized for performance, minimal overhead
- **Configurable**: Fine-grained control over allowed tags and attributes
- **Trusted**: Widely used (70M+ weekly downloads), actively maintained
- **Zero Dependencies**: No external dependencies, small footprint
- **TypeScript Support**: Full type definitions included

## Installation

DOMPurify is already installed in Sovrium:

```json
{
  "dependencies": {
    "dompurify": "^3.3.1"
  }
}
```

## Usage in Sovrium

### Current Implementation

DOMPurify is used in the presentation layer for rendering custom HTML elements:

**Primary Usage**: `src/presentation/components/sections/renderers/`

```typescript
// src/presentation/components/sections/renderers/specialized-renderers.tsx
import DOMPurify from 'dompurify'

export function RichTextRenderer({ content }: { content: string }) {
  const sanitizedContent = DOMPurify.sanitize(content)

  return (
    <div
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  )
}
```

```typescript
// src/presentation/components/sections/renderers/element-renderers/interactive-renderers.tsx
import DOMPurify from 'dompurify'

export function CustomHTMLRenderer(props: ElementRendererProps) {
  const sanitizedHTML = DOMPurify.sanitize((props.html as string | undefined) || '')

  return (
    <div
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
    />
  )
}
```

### When to Use DOMPurify

| Scenario                      | Use DOMPurify | Why                                     |
| ----------------------------- | ------------- | --------------------------------------- |
| User-provided HTML content    | ✅ Yes        | Prevents XSS attacks                    |
| Rendering markdown → HTML     | ✅ Yes        | Markdown can contain raw HTML           |
| Admin-provided HTML templates | ✅ Yes        | Even trusted sources can be compromised |
| Static HTML from code         | ❌ No         | Already trusted, adds overhead          |
| Plain text content            | ❌ No         | No HTML to sanitize                     |

## Security Considerations

### What DOMPurify Removes

By default, DOMPurify removes:

- `<script>` tags and JavaScript URLs
- Event handlers (`onclick`, `onerror`, `onload`, etc.)
- `javascript:`, `data:`, `vbscript:` URLs
- Dangerous tags (`<object>`, `<embed>`, `<iframe>` by default)
- Malformed HTML that could be exploited

### Security Audit Pattern

```typescript
/**
 * Security Assessment for Custom HTML Rendering
 *
 * @security-assessment
 * - Risk: None (after sanitization) - XSS prevented by DOMPurify
 * - Validation: DOMPurify removes all malicious content
 * - Input Source: User-provided content from app schema
 * - XSS Protection: DOMPurify sanitization removes scripts, event handlers, dangerous tags
 */
export function SecureHTMLRenderer({ content }: { content: string }) {
  const sanitizedHTML = DOMPurify.sanitize(content)
  return <div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />
}
```

### Configuration Options

DOMPurify can be configured for specific use cases:

```typescript
import DOMPurify from 'dompurify'

// Allow only specific tags
const cleanHTML = DOMPurify.sanitize(dirtyHTML, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
  ALLOWED_ATTR: ['href', 'title', 'target'],
})

// Allow data attributes
const withData = DOMPurify.sanitize(dirtyHTML, {
  ALLOW_DATA_ATTR: true,
})

// Return DOM object instead of string
const domNode = DOMPurify.sanitize(dirtyHTML, {
  RETURN_DOM: true,
})

// Stricter sanitization (remove all HTML)
const textOnly = DOMPurify.sanitize(dirtyHTML, {
  ALLOWED_TAGS: [],
  KEEP_CONTENT: true,
})
```

## Best Practices

### 1. Always Sanitize Before Rendering

```typescript
// ✅ CORRECT: Sanitize before dangerouslySetInnerHTML
const sanitized = DOMPurify.sanitize(userContent)
return <div dangerouslySetInnerHTML={{ __html: sanitized }} />

// ❌ WRONG: Never use unsanitized content
return <div dangerouslySetInnerHTML={{ __html: userContent }} />
```

### 2. Sanitize at the Render Point

```typescript
// ✅ CORRECT: Sanitize where HTML is rendered
function RenderUserContent({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
}

// ❌ AVOID: Sanitizing during data storage (can't trust stored data)
// XSS attacks can evolve, always sanitize at render time
```

### 3. Use Type-Safe Wrappers

```typescript
// Create a safe wrapper component
interface SafeHTMLProps {
  content: string
  className?: string
}

export function SafeHTML({ content, className }: SafeHTMLProps) {
  const sanitized = DOMPurify.sanitize(content)
  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitized }} />
}
```

### 4. Document Security Decisions

Always add security assessment comments when using `dangerouslySetInnerHTML`:

```typescript
/**
 * @security-assessment
 * - Risk: None (after sanitization) - DOMPurify removes malicious content
 * - Validation: DOMPurify sanitization before rendering
 * - Input Source: [describe where content comes from]
 * - XSS Protection: DOMPurify removes scripts, event handlers, dangerous tags
 */
```

## Common Pitfalls

- ❌ **Never skip sanitization** for user content, even from "trusted" sources
- ❌ **Don't sanitize only on input** - sanitize at render time
- ❌ **Don't assume stored data is safe** - sanitize before display
- ❌ **Don't use custom regex for HTML sanitization** - use DOMPurify
- ❌ **Don't disable DOMPurify in production** for "performance"

## Integration with Effect.ts

If you need to sanitize content in an Effect program:

```typescript
import { Effect } from 'effect'
import DOMPurify from 'dompurify'

const sanitizeHTML = (html: string) => Effect.sync(() => DOMPurify.sanitize(html))

// Usage in Effect program
const program = Effect.gen(function* () {
  const userContent = yield* getUserContent()
  const safeContent = yield* sanitizeHTML(userContent)
  return safeContent
})
```

## Testing

```typescript
import { test, expect } from 'bun:test'
import DOMPurify from 'dompurify'

test('DOMPurify removes script tags', () => {
  const dirty = '<p>Hello</p><script>alert("xss")</script>'
  const clean = DOMPurify.sanitize(dirty)
  expect(clean).toBe('<p>Hello</p>')
  expect(clean).not.toContain('script')
})

test('DOMPurify removes event handlers', () => {
  const dirty = '<img src="x" onerror="alert(1)">'
  const clean = DOMPurify.sanitize(dirty)
  expect(clean).not.toContain('onerror')
})

test('DOMPurify preserves safe content', () => {
  const safe = '<p>Hello <strong>World</strong></p>'
  const clean = DOMPurify.sanitize(safe)
  expect(clean).toBe(safe)
})
```

## References

- DOMPurify GitHub: https://github.com/cure53/DOMPurify
- DOMPurify npm: https://www.npmjs.com/package/dompurify
- OWASP XSS Prevention: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- React dangerouslySetInnerHTML: https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html
