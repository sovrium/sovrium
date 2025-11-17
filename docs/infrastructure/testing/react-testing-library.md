# React Testing Library + Happy DOM (Bun Test)

## Overview

React Testing Library (RTL) is used for unit testing React components in this project. It runs on **Bun's test runner** (NOT Jest/Vitest) with **Happy DOM** as the DOM environment. This setup enables fast, lightweight component testing without a real browser.

**Key difference from typical setups**: Bun's native test runner replaces Jest/Vitest, and Happy DOM replaces jsdom for better performance.

## Installation

```bash
bun add -d @testing-library/react @testing-library/jest-dom @happy-dom/global-registrator
```

**Already installed in this project** (see package.json):

- `@testing-library/react` v16.3.0
- `@testing-library/jest-dom` v6.9.1
- `@happy-dom/global-registrator` v20.0.10

## Configuration

### Happy DOM Setup (Required First)

Happy DOM must be configured before React Testing Library can work. Unlike jsdom (used with Jest), Happy DOM is a lightweight, pure JavaScript DOM implementation optimized for Bun.

**Create `test/setup.ts`** (if not already present):

```typescript
/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { GlobalRegistrator } from '@happy-dom/global-registrator'
import '@testing-library/jest-dom'

// Register Happy DOM globals (document, window, etc.)
GlobalRegistrator.register()
```

**Configure `bunfig.toml`** (project root):

```toml
[test]
preload = ["./test/setup.ts"]
```

This preloads Happy DOM before all tests run, making `document`, `window`, and other DOM APIs globally available.

### TypeScript Support

**Add to test files** to resolve DOM type errors:

```typescript
/// <reference lib="dom" />
```

This triple-slash directive tells TypeScript to include DOM API types.

## Usage Patterns

### Basic Component Test

```typescript
/// <reference lib="dom" />

import { describe, test, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'

function Button({ children }: { children: React.ReactNode }) {
  return <button>{children}</button>
}

test('renders button with text', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByRole('button')).toHaveTextContent('Click me')
})
```

**Note**: Use Bun's `test` function, NOT Jest's `it` or `test`.

### Testing with Props and State

```typescript
/// <reference lib="dom" />

import { describe, test, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { Banner } from './banner'

describe('Banner', () => {
  test('should render message prop', () => {
    render(
      <Banner
        enabled={true}
        message="Welcome to our website!"
      />
    )

    const bannerText = screen.getByTestId('banner-text')
    expect(bannerText.textContent).toBe('Welcome to our website!')
  })

  test('should return undefined when enabled is false', () => {
    const { container } = render(
      <Banner
        enabled={false}
        message="Should not render"
      />
    )

    expect(container.children.length).toBe(0)
  })
})
```

### Testing with User Interactions

```typescript
/// <reference lib="dom" />

import { describe, test, expect } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'

function Counter() {
  const [count, setCount] = React.useState(0)
  return (
    <div>
      <p data-testid="count">{count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  )
}

test('increments counter on button click', () => {
  render(<Counter />)

  const button = screen.getByRole('button', { name: 'Increment' })
  const countDisplay = screen.getByTestId('count')

  expect(countDisplay.textContent).toBe('0')

  fireEvent.click(button)
  expect(countDisplay.textContent).toBe('1')
})
```

### Testing Async Components

```typescript
/// <reference lib="dom" />

import { describe, test, expect } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'

function AsyncComponent() {
  const [data, setData] = React.useState<string | null>(null)

  React.useEffect(() => {
    setTimeout(() => setData('Loaded!'), 100)
  }, [])

  return <div>{data ?? 'Loading...'}</div>
}

test('shows loading state then data', async () => {
  render(<AsyncComponent />)

  // Initial state
  expect(screen.getByText('Loading...')).toBeDefined()

  // Wait for async update
  await waitFor(() => {
    expect(screen.getByText('Loaded!')).toBeDefined()
  })
})
```

### Server-Side Rendering (SSR) Tests

For components that don't need interactivity testing, use `renderToString` or `renderToStaticMarkup`:

```typescript
/// <reference lib="dom" />

import { describe, test, expect } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { ComponentRenderer } from './component-renderer'

test('should substitute variables in block reference', () => {
  const blocks = [
    {
      name: 'hero',
      type: 'section',
      props: { id: 'hero' },
      children: [{ type: 'h1', children: ['$title'] }],
    },
  ]

  const component = {
    block: 'hero',
    vars: { title: 'Welcome to Our Platform' },
  }

  const html = renderToString(
    <ComponentRenderer
      component={component}
      blocks={blocks}
    />
  )

  expect(html).toContain('Welcome to Our Platform')
  expect(html).not.toContain('$title')
})
```

**When to use SSR rendering**:

- Testing static HTML output
- Testing variable substitution/templating
- Testing markup structure without interactivity
- Performance: Faster than full DOM rendering

## Queries and Assertions

### Recommended Query Priority (RTL Philosophy)

1. **ByRole** (preferred) - Accessible to screen readers

   ```typescript
   screen.getByRole('button', { name: 'Submit' })
   ```

2. **ByLabelText** - Form inputs

   ```typescript
   screen.getByLabelText('Email address')
   ```

3. **ByPlaceholderText** - Form inputs (when no label)

   ```typescript
   screen.getByPlaceholderText('Enter email...')
   ```

4. **ByText** - Non-interactive text

   ```typescript
   screen.getByText('Welcome!')
   ```

5. **ByTestId** - Last resort when semantic queries fail
   ```typescript
   screen.getByTestId('custom-element')
   ```

**Avoid**: `getByClassName`, `getByTagName` (not user-facing)

### Custom Matchers (@testing-library/jest-dom)

These matchers work with Bun Test (despite the "jest-dom" name):

```typescript
import '@testing-library/jest-dom'

// Visibility
expect(element).toBeVisible()
expect(element).toBeInTheDocument()

// Content
expect(element).toHaveTextContent('Hello')
expect(element).toContainHTML('<span>Hello</span>')

// Attributes
expect(element).toHaveAttribute('href', '/login')
expect(element).toHaveClass('bg-blue-500')
expect(element).toHaveStyle('display: flex')

// Forms
expect(input).toHaveValue('test@example.com')
expect(checkbox).toBeChecked()
expect(button).toBeDisabled()
```

## Best Practices for Functional Components

### 1. Test Behavior, Not Implementation

**Bad** (testing implementation):

```typescript
// Don't test internal state or structure
expect(component.state.isOpen).toBe(true)
```

**Good** (testing behavior):

```typescript
// Test what the user sees
expect(screen.getByRole('dialog')).toBeVisible()
```

### 2. Use Accessible Queries

**Bad**:

```typescript
const button = container.querySelector('.btn-primary')
```

**Good**:

```typescript
const button = screen.getByRole('button', { name: 'Submit' })
```

### 3. Cleanup Between Tests

**Global cleanup** (in `test/setup.ts`):

```typescript
import { afterEach } from 'bun:test'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup() // Unmount React trees
  document.body.innerHTML = '' // Clear DOM
})
```

**Why**: Prevents state leakage between tests.

### 4. Avoid waitFor with Exact Times

**Bad**:

```typescript
await new Promise((resolve) => setTimeout(resolve, 500))
```

**Good**:

```typescript
await waitFor(() => {
  expect(screen.getByText('Loaded!')).toBeInTheDocument()
})
```

### 5. Test Accessibility

```typescript
test('button has accessible label', () => {
  render(<IconButton onClick={() => {}} />)

  const button = screen.getByRole('button')
  expect(button).toHaveAttribute('aria-label')
})
```

## Integration with Sovrium Architecture

### Testing Functional Components (No Classes)

This project uses **functional components only** (no class components):

```typescript
/// <reference lib="dom" />

import { describe, test, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'

// Pure functional component
function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}!</h1>
}

test('renders greeting with name', () => {
  render(<Greeting name="World" />)
  expect(screen.getByRole('heading')).toHaveTextContent('Hello, World!')
})
```

### Testing Components with Effect Integration

If components use Effect.ts (e.g., via React hooks wrapping Effect programs):

```typescript
/// <reference lib="dom" />

import { describe, test, expect } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import { Effect, Runtime } from 'effect'

function DataLoader() {
  const [data, setData] = React.useState<string | null>(null)

  React.useEffect(() => {
    const program = Effect.gen(function* () {
      // Simulate Effect program
      yield* Effect.sleep('100 millis')
      return 'Loaded data'
    })

    Runtime.runPromise(program).then(setData)
  }, [])

  return <div>{data ?? 'Loading...'}</div>
}

test('loads data from Effect program', async () => {
  render(<DataLoader />)

  expect(screen.getByText('Loading...')).toBeDefined()

  await waitFor(() => {
    expect(screen.getByText('Loaded data')).toBeDefined()
  }, { timeout: 1000 })
})
```

**Best practice**: Mock Effect programs in tests to avoid real I/O.

### Testing with Tailwind CSS Classes

```typescript
/// <reference lib="dom" />

import { describe, test, expect } from 'bun:test'
import { render, screen } from '@testing-library/react'

function StyledButton({ variant }: { variant: 'primary' | 'secondary' }) {
  const className = variant === 'primary'
    ? 'bg-blue-500 text-white'
    : 'bg-gray-200 text-black'

  return <button className={className}>Click me</button>
}

test('applies primary styles', () => {
  render(<StyledButton variant="primary" />)

  const button = screen.getByRole('button')
  expect(button).toHaveClass('bg-blue-500')
  expect(button).toHaveClass('text-white')
})
```

**Note**: Tailwind classes are tested as strings. CSS-in-JS computation doesn't run in unit tests (use E2E for visual regression).

## Common Patterns and Examples

### Testing Conditional Rendering

```typescript
test('shows error message when validation fails', () => {
  render(<LoginForm hasError={true} />)

  const errorMessage = screen.queryByRole('alert')
  expect(errorMessage).toBeInTheDocument()
  expect(errorMessage).toHaveTextContent('Invalid credentials')
})

test('hides error message when no error', () => {
  render(<LoginForm hasError={false} />)

  const errorMessage = screen.queryByRole('alert')
  expect(errorMessage).toBeNull()
})
```

### Testing Lists and Iterations

```typescript
test('renders all items in list', () => {
  const items = ['Apple', 'Banana', 'Cherry']
  render(<ItemList items={items} />)

  items.forEach(item => {
    expect(screen.getByText(item)).toBeInTheDocument()
  })
})
```

### Testing Forms

```typescript
import { fireEvent } from '@testing-library/react'

test('submits form with input values', () => {
  const handleSubmit = jest.fn() // Use Bun's mock if needed
  render(<ContactForm onSubmit={handleSubmit} />)

  const emailInput = screen.getByLabelText('Email')
  const submitButton = screen.getByRole('button', { name: 'Submit' })

  fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
  fireEvent.click(submitButton)

  expect(handleSubmit).toHaveBeenCalledWith({ email: 'test@example.com' })
})
```

### Testing Custom Hooks (Advanced)

```typescript
import { renderHook } from '@testing-library/react'

function useCounter(initialValue = 0) {
  const [count, setCount] = React.useState(initialValue)
  const increment = () => setCount((c) => c + 1)
  return { count, increment }
}

test('useCounter increments correctly', () => {
  const { result } = renderHook(() => useCounter(5))

  expect(result.current.count).toBe(5)

  act(() => {
    result.current.increment()
  })

  expect(result.current.count).toBe(6)
})
```

## Differences from Jest/Vitest Setup

| Feature               | Jest/Vitest                            | Bun + RTL                         |
| --------------------- | -------------------------------------- | --------------------------------- |
| **Test runner**       | `jest` / `vitest`                      | `bun test`                        |
| **DOM environment**   | jsdom                                  | Happy DOM                         |
| **Setup file**        | `setupTests.js`                        | `test/setup.ts` + `bunfig.toml`   |
| **Config file**       | `jest.config.js`                       | `bunfig.toml`                     |
| **Import style**      | `import { test } from '@jest/globals'` | `import { test } from 'bun:test'` |
| **Preload mechanism** | `setupFilesAfterEnv`                   | `preload` in bunfig.toml          |
| **Mock functions**    | `jest.fn()`                            | `Bun.mock()` (or manual)          |
| **Performance**       | Slower (jsdom overhead)                | Faster (Happy DOM + Bun)          |

**Key takeaway**: All RTL APIs work the same, but test runner APIs differ.

## Happy DOM vs jsdom

| Aspect              | Happy DOM        | jsdom                             |
| ------------------- | ---------------- | --------------------------------- |
| **Implementation**  | Pure JavaScript  | C++ bindings (faster but heavier) |
| **Speed**           | Very fast        | Moderate                          |
| **Memory usage**    | Low              | Higher                            |
| **API coverage**    | ~95% of DOM APIs | ~98% of DOM APIs                  |
| **Bun integration** | Native support   | Requires extra setup              |
| **Best for**        | Fast unit tests  | Full browser simulation           |

**When Happy DOM falls short**:

- Complex browser APIs (e.g., `IntersectionObserver`, `ResizeObserver`)
- Canvas/WebGL rendering
- Advanced CSS features

**Solution**: Mock these APIs or use Playwright E2E tests.

## Troubleshooting

### Issue: "ReferenceError: document is not defined"

**Cause**: Happy DOM not configured properly.

**Solution**:

1. Verify `test/setup.ts` imports `GlobalRegistrator.register()`
2. Check `bunfig.toml` has `preload = ["./test/setup.ts"]`
3. Add `/// <reference lib="dom" />` to test file

### Issue: "TypeError: Cannot read property 'toHaveTextContent' of undefined"

**Cause**: `@testing-library/jest-dom` not imported.

**Solution**: Add to `test/setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

### Issue: "Warning: ReactDOM.render has been deprecated"

**Cause**: Using old React 17 patterns with React 19.

**Solution**: RTL's `render()` already uses `createRoot()` internally. Ignore or update RTL version.

### Issue: "Element not found" in async tests

**Cause**: Query runs before component updates.

**Solution**: Use `waitFor` or `findBy` queries:

```typescript
// Instead of getBy (throws immediately)
const element = await screen.findByText('Loaded!')

// Or with waitFor
await waitFor(() => {
  expect(screen.getByText('Loaded!')).toBeInTheDocument()
})
```

### Issue: Tests pass individually but fail when run together

**Cause**: State leakage between tests.

**Solution**: Add cleanup to `test/setup.ts`:

```typescript
import { afterEach } from 'bun:test'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})
```

## References

- **React Testing Library**: https://testing-library.com/docs/react-testing-library/intro
- **Bun Test Runner**: https://bun.sh/docs/cli/test
- **Bun + Happy DOM**: https://bun.sh/docs/test/dom#happy-dom
- **Bun + RTL**: https://bun.sh/docs/test/dom#react-testing-library
- **Happy DOM GitHub**: https://github.com/capricorn86/happy-dom
- **@testing-library/jest-dom**: https://github.com/testing-library/jest-dom

## Summary

- **Unit tests use**: Bun Test + React Testing Library + Happy DOM
- **File naming**: `*.test.tsx` (co-located with components)
- **Setup**: `test/setup.ts` + `bunfig.toml` preload
- **Key difference**: Bun's test runner (NOT Jest), Happy DOM (NOT jsdom)
- **Philosophy**: Test behavior users see, not implementation details
- **Integration**: Works seamlessly with functional components, Tailwind, Effect.ts
