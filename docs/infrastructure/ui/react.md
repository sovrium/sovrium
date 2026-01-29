# React - Component-Based UI Library

## Overview

**Version**: ^19.2.4
**React DOM Version**: ^19.2.4
**Purpose**: Declarative, component-based JavaScript library for building fast, interactive user interfaces with a focus on composability, reusability, and developer experience

React is a modern UI library created by Facebook (Meta) that revolutionized web development with its component-based architecture and virtual DOM. React 19 introduces significant improvements including the React Compiler for automatic optimization, Actions for simplified form handling, and enhanced server-side rendering capabilities.

## Why React for Sovrium

- **Component-Based Architecture**: Build complex UIs from small, isolated, reusable pieces
- **Declarative Approach**: Describe what the UI should look like, React handles updates
- **Rich Ecosystem**: Massive collection of libraries, tools, and community resources
- **Excellent TypeScript Support**: First-class TypeScript integration with full type inference
- **Perfect for SSR**: Server-side rendering with Hono for fast initial page loads
- **Seamless Tailwind Integration**: Works beautifully with utility-first CSS
- **Effect-Ready**: Integrates naturally with Effect for business logic and data fetching
- **Fast Performance**: Virtual DOM and React 19 Compiler provide exceptional speed
- **Developer Experience**: Hot reloading, great debugging tools, extensive documentation
- **Battle-Tested**: Used by millions of websites including Facebook, Instagram, Netflix

## React 19 Major Features

### ⚠️ React Compilation in Sovrium - Important Distinction

There are **two different types of "React compilation"** - Sovrium uses Bun which supports one but not the other:

#### ✅ JSX Transpilation (Available with Bun)

This is **syntax transformation** - converting JSX to JavaScript. Bun handles this natively:

```tsx
// JSX (what you write)
;<Button onClick={handleClick}>Click me</Button>

// JavaScript (what Bun compiles to)
React.createElement(Button, { onClick: handleClick }, 'Click me')
```

**Status**: ✅ **Fully supported** via Bun's built-in JSX/TSX transpiler
**What it enables**: You can write React components with JSX syntax
**How it works**: Bun automatically transpiles `.tsx` files at runtime (no build step needed)
**Reference**: [Bun Fullstack Dev Server](https://bun.com/docs/bundler/fullstack)

#### ❌ React Compiler Optimization (Not Available Yet)

This is **performance optimization** - automatic memoization to reduce unnecessary re-renders:

```tsx
// What the React Compiler would add automatically:
// - Memoizes processData(data) result
// - Memoizes handler functions
// - Optimizes re-render boundaries
```

**Status**: ❌ **NOT available** - requires `babel-plugin-react-compiler` which Bun doesn't support yet
**What it would enable**: Automatic `useMemo`, `useCallback`, and `React.memo` optimizations
**Workaround**: Use manual optimization patterns (see Performance Optimization section below) when needed

**Key Takeaway**: All React 19 features work in Sovrium EXCEPT the Compiler's automatic memoization. You can use Actions, `use()` hook, Server Components, document metadata, and ref as prop - but manual performance optimization is still required for computationally expensive components.

---

### 1. React Compiler (Automatic Optimization) - NOT AVAILABLE IN SOVRIUM

> **⚠️ IMPORTANT**: The automatic React Compiler optimization described below is **NOT currently available** in Sovrium. Bun does not yet support `babel-plugin-react-compiler`. The examples show the target architecture, but manual optimization is still required.

React 19 introduces an automatic compiler that would optimize components without manual intervention:

- **Automatic Memoization**: No more manual `useMemo`, `useCallback`, or `React.memo`
- **Smart Re-rendering**: Compiler determines optimal re-render boundaries
- **Zero Runtime Overhead**: Optimizations happen at build time
- **Backward Compatible**: Works with existing React code without changes

**What This Means**:

- Write simpler, cleaner code without performance annotations
- React automatically optimizes component re-renders
- No need for manual optimization (unless extreme cases)

```tsx
// Before React 19 - Manual optimization required
const ExpensiveComponent = React.memo(({ data }: { data: Data }) => {
  const processed = useMemo(() => processData(data), [data])
  const handler = useCallback(() => handleClick(processed), [processed])

  return <div onClick={handler}>{processed.value}</div>
})

// React 19 - Compiler optimizes automatically
const ExpensiveComponent = ({ data }: { data: Data }) => {
  const processed = processData(data) // Automatically memoized
  const handler = () => handleClick(processed) // Automatically memoized

  return <div onClick={handler}>{processed.value}</div>
}
```

### 2. Actions (Simplified Form Handling)

Actions provide a new way to handle async operations and form submissions:

```tsx
import { useActionState } from 'react'

function ProfileForm() {
  const [error, submitAction, isPending] = useActionState(async (previousState, formData) => {
    const name = formData.get('name')

    // Call API
    const error = await updateProfile(name)
    return error ? error : null
  }, null)

  return (
    <form action={submitAction}>
      <input
        name="name"
        type="text"
      />
      <button
        type="submit"
        disabled={isPending}
      >
        {isPending ? 'Saving...' : 'Save'}
      </button>
      {error && <p className="text-red-600">{error}</p>}
    </form>
  )
}
```

**Key Benefits**:

- **Automatic Pending States**: `isPending` tracks form submission status
- **Optimistic Updates**: `useOptimistic` hook for instant UI feedback
- **Error Handling**: Built-in error state management
- **Progressive Enhancement**: Works without JavaScript enabled

### 3. use() Hook (Async Data Reading)

The `use()` hook allows reading promises and context values during render:

```tsx
import { use } from 'react'

function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  // Suspends until promise resolves
  const user = use(userPromise)

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  )
}

// Usage with Suspense
function App() {
  const userPromise = fetchUser(123)

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  )
}
```

**Key Features**:

- **Async Data**: Read promises directly in components
- **Context Reading**: Access context conditionally
- **Suspense Integration**: Works seamlessly with React Suspense
- **Type-Safe**: Full TypeScript support for promise types

### 4. Server Components (React Server Components)

React 19 improves Server Components for rendering on the server:

```tsx
// Server Component (default in React 19)
async function ProductList() {
  const products = await db.query('SELECT * FROM products')

  return (
    <ul>
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  )
}

// Client Component (marked with 'use client')
;('use client')

function ProductCard({ product }: { product: Product }) {
  const [count, setCount] = useState(0)

  return (
    <div>
      <h2>{product.name}</h2>
      <button onClick={() => setCount(count + 1)}>Add to Cart ({count})</button>
    </div>
  )
}
```

**Benefits for Sovrium**:

- **Server-Side Data Fetching**: Fetch data directly in components on the server
- **Smaller Client Bundles**: Server components don't ship JavaScript to client
- **Better Performance**: Reduced client-side work and faster initial loads
- **Seamless with Hono**: Perfect for server-side rendering with Hono

### 5. Document Metadata Support

React 19 natively supports `<title>`, `<meta>`, and `<link>` tags anywhere in components:

```tsx
function BlogPost({ post }: { post: Post }) {
  return (
    <>
      <title>{post.title} - Sovrium Blog</title>
      <meta
        name="description"
        content={post.excerpt}
      />
      <meta
        property="og:title"
        content={post.title}
      />
      <meta
        property="og:image"
        content={post.coverImage}
      />

      <article>
        <h1>{post.title}</h1>
        <p>{post.content}</p>
      </article>
    </>
  )
}
```

**Features**:

- **Automatic Hoisting**: React moves metadata tags to `<head>`
- **Deduplication**: Duplicate tags are automatically merged
- **Server & Client**: Works in both server and client components
- **SEO-Friendly**: Perfect for dynamic page metadata

### 6. ref as a Prop

No more `forwardRef` - refs can be passed as regular props:

```tsx
// Before React 19
const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return (
    <input
      ref={ref}
      {...props}
    />
  )
})

// React 19 - ref is just a prop
function Input({ ref, ...props }: InputProps & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <input
      ref={ref}
      {...props}
    />
  )
}
```

### 7. Improved Error Handling

React 19 provides better error messages and debugging:

- **Hydration Errors**: Clearer diffs showing client vs server mismatch
- **Error Boundaries**: Improved error boundary behavior
- **Development Warnings**: More helpful warnings during development

## Installation

React 19 is already installed in Sovrium:

```json
{
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  }
}
```

No additional installation needed.

## Basic Usage

### Creating Components

React components are JavaScript/TypeScript functions that return JSX:

```tsx
// Simple functional component
function Welcome() {
  return <h1>Welcome to Sovrium!</h1>
}

// Component with props and TypeScript
interface UserProps {
  name: string
  email: string
  isAdmin?: boolean
}

function UserCard({ name, email, isAdmin = false }: UserProps) {
  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-xl font-bold">{name}</h2>
      <p className="text-gray-600">{email}</p>
      {isAdmin && <span className="text-sm text-blue-600">Admin</span>}
    </div>
  )
}

// Component with children
interface CardProps {
  title: string
  children: React.ReactNode
}

function Card({ title, children }: CardProps) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <div>{children}</div>
    </div>
  )
}

// Usage
function App() {
  return (
    <Card title="User Information">
      <UserCard
        name="Alice Johnson"
        email="alice@example.com"
        isAdmin
      />
    </Card>
  )
}
```

### JSX Syntax

JSX is a syntax extension that looks like HTML but is actually JavaScript:

```tsx
function Example() {
  const name = 'Alice'
  const isLoggedIn = true
  const items = ['Apple', 'Banana', 'Orange']

  return (
    <div className="container">
      {/* JavaScript expressions in curly braces */}
      <h1>Hello, {name}!</h1>

      {/* Conditional rendering */}
      {isLoggedIn ? <p>Welcome back!</p> : <p>Please sign in</p>}

      {/* Conditional rendering with && */}
      {isLoggedIn && <button>Logout</button>}

      {/* Rendering lists */}
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>

      {/* Inline styles (use Tailwind instead) */}
      <div style={{ color: 'blue', fontSize: '16px' }}>Styled text</div>

      {/* Class names (className, not class) */}
      <div className="bg-blue-500 p-4 text-white">Tailwind classes</div>

      {/* Self-closing tags */}
      <img
        src="/logo.png"
        alt="Logo"
      />
      <input type="text" />
    </div>
  )
}
```

**JSX Rules**:

- Must return a single root element (or use `<>...</>` Fragment)
- Use `className` instead of `class`
- Use `htmlFor` instead of `for`
- Close all tags (even self-closing ones like `<img />`)
- Use camelCase for attributes (`onClick`, not `onclick`)

### Props and TypeScript

Props are how you pass data from parent to child components:

```tsx
// Define props interface
interface ButtonProps {
  variant?: 'primary' | 'secondary'
  size?: 'small' | 'medium' | 'large'
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}

function Button({
  variant = 'primary',
  size = 'medium',
  onClick,
  disabled = false,
  children,
}: ButtonProps) {
  const baseClasses = 'rounded font-medium transition-colors'

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700',
  }

  const sizeClasses = {
    small: 'px-2 py-1 text-sm',
    medium: 'px-4 py-2',
    large: 'px-6 py-3 text-lg',
  }

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

// Usage
function App() {
  return (
    <div>
      <Button
        variant="primary"
        size="large"
        onClick={() => console.log('Clicked!')}
      >
        Click Me
      </Button>
      <Button
        variant="secondary"
        onClick={() => console.log('Secondary')}
      >
        Cancel
      </Button>
    </div>
  )
}
```

### State Management with useState

The `useState` hook manages component state:

```tsx
import { useState } from 'react'

function Counter() {
  // State: [value, setter] = useState(initialValue)
  const [count, setCount] = useState(0)

  return (
    <div className="p-4">
      <p className="text-xl">Count: {count}</p>
      <button
        className="mr-2 rounded bg-blue-600 px-4 py-2 text-white"
        onClick={() => setCount(count + 1)}
      >
        Increment
      </button>
      <button
        className="rounded bg-red-600 px-4 py-2 text-white"
        onClick={() => setCount(0)}
      >
        Reset
      </button>
    </div>
  )
}

// State with objects
interface FormData {
  name: string
  email: string
}

function Form() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
  })

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
    <form>
      <input
        type="text"
        value={formData.name}
        onChange={(e) => handleChange('name', e.target.value)}
        placeholder="Name"
      />
      <input
        type="email"
        value={formData.email}
        onChange={(e) => handleChange('email', e.target.value)}
        placeholder="Email"
      />
      <p>
        Name: {formData.name}, Email: {formData.email}
      </p>
    </form>
  )
}
```

### Side Effects with useEffect

The `useEffect` hook handles side effects like data fetching, subscriptions, and DOM manipulation:

```tsx
import { useState, useEffect } from 'react'

function UserProfile({ userId }: { userId: number }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Effect runs when userId changes
    let cancelled = false

    const fetchUser = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/users/${userId}`)
        const data = await response.json()

        if (!cancelled) {
          setUser(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to fetch user')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchUser()

    // Cleanup function (runs before next effect or unmount)
    return () => {
      cancelled = true
    }
  }, [userId]) // Dependency array - effect runs when userId changes

  if (loading) return <p>Loading...</p>
  if (error) return <p className="text-red-600">{error}</p>
  if (!user) return null

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  )
}

// Effect with no dependencies (runs once on mount)
function Analytics() {
  useEffect(() => {
    console.log('Component mounted')

    return () => {
      console.log('Component unmounted')
    }
  }, []) // Empty array = run once

  return <div>Analytics tracking active</div>
}

// Effect with multiple dependencies
function SearchResults({ query, filters }: { query: string; filters: Filters }) {
  const [results, setResults] = useState([])

  useEffect(() => {
    // Runs when query OR filters change
    searchAPI(query, filters).then(setResults)
  }, [query, filters])

  return <ul>{/* render results */}</ul>
}
```

## Additional Resources

For advanced React topics and integrations with the Sovrium stack, see:

### Sovrium Stack Integration

- **Server-Side Rendering**: `@docs/infrastructure/framework/hono.md` - Rendering React with Hono
- **Styling**: `@docs/infrastructure/ui/tailwind.md` - Tailwind CSS patterns for React components
- **Data Fetching**: `@docs/infrastructure/ui/tanstack-query.md` - TanStack Query with React
- **Effect Integration**: `@docs/infrastructure/framework/effect.md` - Using Effect.ts with React components
- **Form Handling**: `@docs/infrastructure/ui/react-hook-form.md` - React Hook Form with Zod validation
- **Testing**: `@docs/infrastructure/testing/bun-test.md` and `@docs/architecture/testing-strategy.md`

### Official React Documentation

- **React Docs**: [https://react.dev](https://react.dev) - Official React documentation
- **React 19 Release**: [https://react.dev/blog/2024/12/05/react-19](https://react.dev/blog/2024/12/05/react-19)
- **TypeScript with React**: [https://react-typescript-cheatsheet.netlify.app](https://react-typescript-cheatsheet.netlify.app)
- **React Patterns**: [https://reactpatterns.com](https://reactpatterns.com)
- **React Server Components**: [https://react.dev/reference/rsc/server-components](https://react.dev/reference/rsc/server-components)

## Best Practices for Sovrium

1. **Use Functional Components**: Always use functional components with hooks
2. **TypeScript for Props**: Define prop interfaces for all components
3. **Server-Side Rendering**: Leverage Hono for SSR to improve performance and SEO
4. **Tailwind for Styling**: Use Tailwind utility classes instead of custom CSS
5. **Effect for Business Logic**: Use Effect for data fetching, error handling, and side effects
6. **Effect Schema for Validation**: Validate all user inputs with Effect Schema
7. **Component Composition**: Build complex UIs from small, reusable components
8. **Manual Performance Optimization**: Use `useMemo`, `useCallback`, `React.memo` when measured performance issues occur (React Compiler not available yet)
9. **Co-locate Tests**: Keep component tests close to component files
10. **Semantic HTML**: Use proper HTML tags for accessibility

## Common Pitfalls to Avoid

- ❌ Mutating state directly (always use setter functions)
- ❌ Missing dependencies in useEffect (causes stale closures)
- ❌ Using indexes as keys in lists (breaks reconciliation)
- ❌ Forgetting to clean up effects (causes memory leaks)
- ❌ Not using performance optimization when needed (React Compiler not available - use manual optimization for expensive computations)
- ❌ Not handling loading and error states
- ❌ Using class components (use functional components instead)
- ❌ Mixing server and client logic in components

## When to Use React

**Use React for:**

- Building interactive user interfaces
- Server-side rendered applications with Hono
- Component-based UI architecture
- Applications requiring rich interactivity
- Projects with complex state management needs
- SEO-critical applications (with SSR)

**Consider alternatives for:**

- Simple static websites (use plain HTML/CSS)
- Non-interactive content (use static site generators)
- Extremely performance-critical apps (use vanilla JS)

## Integration with Bun

- **Native TypeScript**: React TSX runs directly with Bun
- **Fast Startup**: Bun's speed complements React's performance
- **Hot Reload**: Use `bun --watch` for development
- **Server-Side Rendering**: Bun executes React server-side with Hono
- **Type Checking**: Use `tsc --noEmit` to validate React types

## References

- React documentation: https://react.dev/
- React 19 announcement: https://react.dev/blog/2024/12/05/react-19
- React API reference: https://react.dev/reference/react
- React DOM API: https://react.dev/reference/react-dom
- React hooks reference: https://react.dev/reference/react/hooks
- TypeScript with React: https://react-typescript-cheatsheet.netlify.app/
