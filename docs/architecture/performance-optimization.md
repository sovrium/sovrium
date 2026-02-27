# Performance Optimization Guide

## Overview

This guide provides performance optimization strategies for the Sovrium stack, covering React 19, Effect.ts, Bun, and related technologies. Performance optimization should be applied strategically based on actual measurements, not premature optimization.

## Core Principles

1. **Measure First**: Use profiling tools before optimizing
2. **Optimize Bottlenecks**: Focus on areas with the biggest impact
3. **Maintain Readability**: Don't sacrifice code clarity for micro-optimizations
4. **Manual Optimization When Measured**: Use `useMemo`, `useCallback`, `React.memo` only when profiling shows a bottleneck (React Compiler automatic memoization is NOT available in Sovrium — see below)
5. **Leverage the Stack**: Use Bun's speed, Effect's lazy evaluation, and React's virtual DOM

---

## React 19 Performance

### React Compiler Status in Sovrium

> **WARNING**: The React 19 Compiler's automatic memoization is **NOT available** in Sovrium. Bun does not yet support `babel-plugin-react-compiler`, which is required for the Compiler to work. See `docs/infrastructure/ui/react.md` for details.

This means **manual performance optimization is still required** when profiling reveals bottlenecks. All React 19 features work (Actions, `use()` hook, Server Components, document metadata, ref as prop) — only the Compiler's automatic memoization is unavailable.

### Manual Optimization (When Measured)

Use `useMemo`, `useCallback`, and `React.memo` when profiling shows a component re-renders excessively or performs expensive computations:

```tsx
// Use useMemo for expensive computations that re-run on every render
function ExpensiveComponent({ data }: { data: Data }) {
  // Only memoize if processData is measurably slow (profile first!)
  const processed = useMemo(() => processData(data), [data])

  // Only memoize handlers passed to memoized children
  const handleClick = useCallback(() => {
    console.log(processed)
  }, [processed])

  return <div onClick={handleClick}>{processed.value}</div>
}

// Use React.memo for components that re-render with unchanged props
const StableChild = React.memo(ExpensiveChild) // Only if measured benefit
```

**When to optimize**:

- `useMemo`: Expensive computations (100ms+) that re-run on every render
- `useCallback`: Handlers passed as props to `React.memo`-wrapped children
- `React.memo`: Components that receive unchanged props but re-render due to parent updates
- **Always profile first** — premature memoization adds complexity without measurable benefit

### Code Splitting

Split large components to reduce initial bundle size:

```tsx
// ✅ CORRECT: Lazy load heavy components
import { lazy, Suspense } from 'react'

const HeavyDashboard = lazy(() => import('./HeavyDashboard'))
const HeavyChart = lazy(() => import('./HeavyChart'))

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <HeavyDashboard />
      <HeavyChart />
    </Suspense>
  )
}
```

### Virtual Scrolling for Large Lists

Use virtual scrolling for lists with 100+ items:

```tsx
// ✅ CORRECT: Virtualize long lists
import { useVirtualizer } from '@tanstack/react-virtual'

function LargeList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Estimated item height
  })

  return (
    <div
      ref={parentRef}
      className="h-screen overflow-auto"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <ItemComponent item={items[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Effect.ts Performance

### Lazy Evaluation

Effect programs are lazy by default - they only execute when run:

```typescript
import { Effect } from 'effect'

// ✅ CORRECT: Effect is lazy - no execution until runPromise
const fetchUser = (id: number) =>
  Effect.gen(function* () {
    console.log('Fetching user') // Only logs when Effect runs
    const user = yield* UserService.findById(id)
    return user
  })

// Creating the Effect doesn't execute it
const userProgram = fetchUser(1) // No fetch happens yet

// Execution happens here
const user = await Effect.runPromise(userProgram) // Fetch happens now
```

**Benefit**: Compose complex Effect programs without executing them prematurely.

### Parallel Execution

Use `Effect.all` for parallel operations:

```typescript
// ❌ INCORRECT: Sequential execution (slow)
const sequentialProgram = Effect.gen(function* () {
  const user = yield* fetchUser(1) // Wait 200ms
  const posts = yield* fetchPosts() // Wait 300ms
  const comments = yield* fetchComments() // Wait 150ms
  // Total: 650ms

  return { user, posts, comments }
})

// ✅ CORRECT: Parallel execution (fast)
const parallelProgram = Effect.all({
  user: fetchUser(1),
  posts: fetchPosts(),
  comments: fetchComments(),
}) // Total: 300ms (longest operation)
```

### Caching Effect Results

Cache expensive Effect computations:

```typescript
import { Effect, Cache } from 'effect'

// ✅ CORRECT: Cache Effect results
const getUserWithCache = (id: number) =>
  Effect.gen(function* () {
    const cache = yield* Cache.make({
      capacity: 100,
      timeToLive: '5 minutes',
      lookup: (id: number) => UserService.findById(id),
    })

    return yield* Cache.get(cache, id)
  })

// First call fetches from database
const user1 = await Effect.runPromise(getUserWithCache(1))

// Second call returns cached result (fast)
const user2 = await Effect.runPromise(getUserWithCache(1))
```

### Avoid Unnecessary Effect Wrapping

Don't wrap pure functions in Effect:

```typescript
// ❌ INCORRECT: Pure function unnecessarily wrapped in Effect
function calculateTotal(items: Item[]): Effect.Effect<number, never, never> {
  return Effect.succeed(items.reduce((sum, item) => sum + item.price, 0)) // Unnecessary Effect wrapper
}

// ✅ CORRECT: Pure function stays pure
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0)
}

// Use Effect only when side effects are needed
const saveTotal = (items: Item[]) =>
  Effect.gen(function* () {
    const total = calculateTotal(items) // Pure calculation
    yield* Database.save({ total }) // Side effect in Effect
    return total
  })
```

---

## Bun Runtime Performance

### Native TypeScript Execution

Bun executes TypeScript directly (no compilation overhead):

```bash
# ✅ Bun: Direct execution (fast)
bun run index.ts

# ❌ Node.js: Requires compilation step (slower)
tsc index.ts && node index.js
```

**Benefit**: 4x faster cold starts compared to Node.js with ts-node.

### Bun.file for File Operations

Use `Bun.file` for efficient file reading:

```typescript
// ✅ CORRECT: Bun.file (optimized)
const file = Bun.file('data.json')
const data = await file.json()

// ❌ SLOWER: fs.readFile (less optimized)
import { readFile } from 'fs/promises'
const buffer = await readFile('data.json')
const data = JSON.parse(buffer.toString())
```

**Benefit**: Bun's file API is highly optimized with native code.

### Avoid Unnecessary Serialization

```typescript
// ❌ INCORRECT: Unnecessary JSON serialization
const data = { name: 'Alice', age: 30 }
const json = JSON.stringify(data)
const parsed = JSON.parse(json) // Why?

// ✅ CORRECT: Use object directly
const data = { name: 'Alice', age: 30 }
// Use data directly
```

---

## Database Query Optimization

### Use Select Statements Efficiently

Only fetch columns you need:

```typescript
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

// ❌ INCORRECT: Fetch all columns (wasteful)
const user = await db.select().from(users).where(eq(users.id, 1))

// ✅ CORRECT: Fetch only needed columns
const user = await db
  .select({
    id: users.id,
    name: users.name,
    email: users.email,
  })
  .from(users)
  .where(eq(users.id, 1))
```

### Use Joins Instead of Multiple Queries

```typescript
// ❌ INCORRECT: N+1 query problem
const users = await db.select().from(users)
const usersWithPosts = await Promise.all(
  users.map(async (user) => ({
    ...user,
    posts: await db.select().from(posts).where(eq(posts.userId, user.id)),
  }))
) // N+1 queries!

// ✅ CORRECT: Single query with join
const usersWithPosts = await db.select().from(users).leftJoin(posts, eq(posts.userId, users.id))
```

### Use Indexes for Frequent Queries

```typescript
// Define indexes in schema for performance
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
  },
  (table) => ({
    // Index for frequent email lookups
    emailIdx: index('email_idx').on(table.email),
  })
)
```

---

## Bundle Size Optimization

### Tree Shaking

Ensure imports support tree shaking:

```typescript
// ✅ CORRECT: Named imports (tree-shakeable)
import { pipe, Effect } from 'effect'

// ❌ INCORRECT: Namespace imports (entire module)
import * as Effect from 'effect' // Imports everything
```

### Analyze Bundle Size

```bash
# Use Bun's build command with analysis
bun build src/index.ts --outdir=dist --minify --sourcemap

# Check output size
ls -lh dist/
```

### Code Splitting

Split routes in Hono applications:

```typescript
// ✅ CORRECT: Split routes into separate files
import { Hono } from 'hono'

const app = new Hono()

app.route('/users', await import('./routes/users'))
app.route('/posts', await import('./routes/posts'))
app.route('/admin', await import('./routes/admin'))
```

---

## TanStack Query Optimization

### Stale-While-Revalidate Pattern

```typescript
// ✅ CORRECT: Efficient caching strategy
const { data } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
  staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
  cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
})
```

### Prefetching Data

```typescript
import { useQueryClient } from '@tanstack/react-query'

function UserList() {
  const queryClient = useQueryClient()

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })

  // Prefetch user details on hover
  const prefetchUser = (userId: number) => {
    queryClient.prefetchQuery({
      queryKey: ['user', userId],
      queryFn: () => fetchUser(userId),
    })
  }

  return (
    <ul>
      {users.map(user => (
        <li
          key={user.id}
          onMouseEnter={() => prefetchUser(user.id)}
        >
          <Link to={`/users/${user.id}`}>{user.name}</Link>
        </li>
      ))}
    </ul>
  )
}
```

### Optimistic Updates

```typescript
const mutation = useMutation({
  mutationFn: updateUser,
  onMutate: async (newUser) => {
    // Cancel outgoing queries
    await queryClient.cancelQueries({ queryKey: ['user', newUser.id] })

    // Snapshot previous value
    const previousUser = queryClient.getQueryData(['user', newUser.id])

    // Optimistically update cache
    queryClient.setQueryData(['user', newUser.id], newUser)

    return { previousUser }
  },
  onError: (err, newUser, context) => {
    // Rollback on error
    queryClient.setQueryData(['user', newUser.id], context?.previousUser)
  },
})
```

---

## Tailwind CSS Performance

### Purge Unused Styles

Tailwind v4 automatically purges unused utilities in production builds.

**Verify purging**:

```bash
# Build for production
bun run build

# Check CSS file size (should be small)
ls -lh dist/styles.css
```

### Use JIT Mode (Default in v4)

Tailwind v4 uses Just-In-Time compilation by default, generating only the CSS you use.

### Avoid Complex Selectors

```css
/* ❌ INCORRECT: Complex selector (slower) */
.container div.card > span.title {
  @apply text-lg font-bold;
}

/* ✅ CORRECT: Simple utility classes (faster) */
<span className="text-lg font-bold">Title</span>
```

---

## Profiling and Monitoring

### React DevTools Profiler

```tsx
import { Profiler } from 'react'

function App() {
  const onRenderCallback = (id: string, phase: 'mount' | 'update', actualDuration: number) => {
    console.log(`${id} (${phase}) took ${actualDuration}ms`)
  }

  return (
    <Profiler
      id="App"
      onRender={onRenderCallback}
    >
      <YourComponent />
    </Profiler>
  )
}
```

### Bun Performance API

```typescript
// Measure execution time
const start = performance.now()

// Your code here
const result = await expensiveOperation()

const end = performance.now()
console.log(`Execution time: ${end - start}ms`)
```

### Effect Performance Tracking

```typescript
import { Effect, Metric } from 'effect'

const fetchUserMetric = Metric.timer('fetch_user_duration')

const fetchUserWithMetrics = (id: number) =>
  Effect.gen(function* () {
    const startTime = yield* Effect.clock

    const user = yield* UserService.findById(id)

    const endTime = yield* Effect.clock
    const duration = endTime - startTime

    yield* Metric.set(fetchUserMetric, duration)

    return user
  })
```

---

## Performance Checklist

Before deploying to production, verify:

- [ ] **Bundle Size**: Check that bundle is optimized (< 200KB initial JS)
- [ ] **Code Splitting**: Heavy components are lazy-loaded
- [ ] **Database Indexes**: Frequent queries have indexes
- [ ] **Caching Strategy**: TanStack Query staleTime/cacheTime configured
- [ ] **Effect Parallelization**: Independent operations run in parallel
- [ ] **React Profiling**: No components re-rendering unnecessarily
- [ ] **Tailwind Purging**: Unused CSS removed in production build
- [ ] **Image Optimization**: Images compressed and lazy-loaded
- [ ] **Bun Runtime**: Using Bun's native APIs where possible

---

## Common Performance Anti-Patterns

### ❌ Anti-Pattern 1: Premature Optimization

```typescript
// ❌ Don't optimize before measuring
const memoizedValue = useMemo(() => x + y, [x, y]) // Unnecessary for simple addition
```

### ❌ Anti-Pattern 2: Blocking the Event Loop

```typescript
// ❌ Synchronous heavy computation blocks UI
function processLargeArray(items: Item[]) {
  for (let i = 0; i < 1_000_000; i++) {
    // Heavy computation
  }
}

// ✅ Use Web Workers or break into chunks
```

### ❌ Anti-Pattern 3: Over-fetching Data

```typescript
// ❌ Fetch entire user object when only name needed
const user = await db.select().from(users).where(eq(users.id, 1))
return user.name

// ✅ Fetch only required field
const result = await db.select({ name: users.name }).from(users).where(eq(users.id, 1))
return result[0].name
```

---

## Performance Goals

Target metrics for Sovrium applications:

| Metric                             | Target  | Tool            |
| ---------------------------------- | ------- | --------------- |
| **First Contentful Paint (FCP)**   | < 1.5s  | Lighthouse      |
| **Largest Contentful Paint (LCP)** | < 2.5s  | Lighthouse      |
| **Time to Interactive (TTI)**      | < 3.5s  | Lighthouse      |
| **Total Blocking Time (TBT)**      | < 300ms | Lighthouse      |
| **Cumulative Layout Shift (CLS)**  | < 0.1   | Lighthouse      |
| **Initial JS Bundle**              | < 200KB | Bundle analyzer |
| **Database Query Time**            | < 100ms | Effect metrics  |

---

## Resources

- [React 19 Compiler](https://react.dev/blog/2024/12/05/react-19#react-compiler)
- [Effect Performance](https://effect.website/docs/guides/performance)
- [Bun Performance Guide](https://bun.sh/docs/performance)
- [TanStack Query Performance](https://tanstack.com/query/latest/docs/react/guides/optimistic-updates)
- [Tailwind CSS Optimization](https://tailwindcss.com/docs/optimizing-for-production)
- [Web Vitals](https://web.dev/vitals/)

---

**Remember**: Measure first, optimize second. The React 19 Compiler's automatic memoization is NOT available in Sovrium — use manual `useMemo`/`useCallback`/`React.memo` only when profiling confirms a bottleneck.
