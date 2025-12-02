# TanStack Query (React Query) - Server-State Management

## Overview

**Version**: ^5.90.11
**DevTools Version**: 5.90.2
**Purpose**: Powerful data fetching and server-state management library for React applications. Handles caching, background updates, request deduplication, and synchronization with minimal boilerplate.

> **Note**: This document provides a high-level summary with essential patterns. For comprehensive coverage including all hooks, advanced patterns, query cancellation strategies, and detailed performance optimizations, see the full documentation in the TanStack Query reference.

TanStack Query solves the fundamental challenge of managing **server state** in React applications. Unlike client state (UI state, form inputs), server state is remote, asynchronous, shared ownership, and can become stale without notice.

## Why TanStack Query for Sovrium?

### The Server State Problem

Traditional data fetching in React requires manual management of:

- **Loading states**: `isLoading`, `isPending`
- **Error states**: Try-catch blocks, error boundaries
- **Caching**: Prevent duplicate requests
- **Background updates**: Keep data fresh
- **Request deduplication**: Multiple components fetching same data
- **Garbage collection**: Clean up unused cache
- **Pagination**: Managing paginated data
- **Optimistic updates**: Update UI before server response

**TanStack Query handles all of this automatically.**

### Perfect Integration with Sovrium Stack

| Component           | Integration                                                                   |
| ------------------- | ----------------------------------------------------------------------------- |
| **React 19**        | Built for React, works with Server Components, Actions, and use() hook        |
| **Effect.ts**       | Convert Effect programs to query/mutation functions seamlessly                |
| **Hono SSR**        | Prefetch queries on server, hydrate on client for fast initial page loads     |
| **TypeScript**      | Full type safety with inferred types, discriminated unions for loading states |
| **Better Auth**     | Perfect for managing authentication state and user sessions                   |
| **Functional Code** | Immutable updates, declarative data fetching, composable queries              |

### Benefits

1. **Zero Boilerplate**: No manual loading/error state management
2. **Automatic Caching**: Smart caching with configurable stale/cache times
3. **Background Updates**: Refetch data on window focus, network reconnect
4. **Request Deduplication**: Single request for multiple components
5. **Optimistic Updates**: Instant UI feedback with automatic rollback
6. **DevTools**: Powerful debugging tools for queries and cache
7. **SSR Ready**: First-class server-side rendering support
8. **TypeScript Native**: Full type inference and safety

## Installation

TanStack Query is already installed in Sovrium:

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.90.11",
    "@tanstack/react-query-devtools": "^5.90.2"
  }
}
```

No additional installation needed.

## Basic Setup

### 1. Create QueryClient

The `QueryClient` manages query cache and configuration:

```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
        retry: 3,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
      },
    },
  })
}
```

### 2. Provide QueryClient to React Tree

Wrap your application with `QueryClientProvider`:

```typescript
// src/app.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function App() {
  // Create QueryClient instance per app instance (not at module level)
  const [queryClient] = useState(() => createQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

**IMPORTANT**: Create `QueryClient` inside the component (not at module level) to ensure each user/request has isolated cache in SSR environments.

## Core Concepts

### Query Keys

Query keys uniquely identify cached data. They're arrays that can include any serializable value:

```typescript
// Simple key
const queryKey = ['users']

// Key with parameters
const queryKey = ['user', userId]

// Key with multiple parameters
const queryKey = ['posts', { authorId, status: 'published', limit: 10 }]

// Nested keys for relationships
const queryKey = ['users', userId, 'posts', { page: 1 }]
```

**Key Conventions**:

- Use hierarchical structure: `['resource', id, 'nested', params]`
- Keep keys consistent across app
- Use objects for multiple parameters (order doesn't matter)

### Query States

Every query has these states:

```typescript
const { data, error, status, fetchStatus } = useQuery(...)

// status: 'pending' | 'error' | 'success'
// fetchStatus: 'fetching' | 'paused' | 'idle'

// Derived booleans
const { isPending, isError, isSuccess, isFetching, isLoading } = useQuery(...)

// isPending: No data yet (status === 'pending')
// isError: Error occurred (status === 'error')
// isSuccess: Data available (status === 'success')
// isFetching: Request in progress (fetchStatus === 'fetching')
// isLoading: isPending && isFetching (first load)
```

## useQuery Hook

### Basic Usage

```typescript
import { useQuery } from '@tanstack/react-query'

interface User {
  id: number
  name: string
  email: string
}

function UserProfile({ userId }: { userId: number }) {
  const { data, error, isPending, isError } = useQuery<User, Error>({
    queryKey: ['user', userId],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}`)
      if (!response.ok) throw new Error('Failed to fetch user')
      return response.json()
    },
  })

  if (isPending) return <div>Loading...</div>
  if (isError) return <div>Error: {error.message}</div>

  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.email}</p>
    </div>
  )
}
```

### Key Query Options

```typescript
useQuery({
  queryKey: ['user', userId],
  queryFn: fetchUser,

  // Caching behavior
  staleTime: 5 * 60 * 1000, // 5 minutes - data considered fresh
  gcTime: 10 * 60 * 1000, // 10 minutes - unused cache garbage collected

  // Refetching behavior
  refetchOnMount: true, // Refetch when component mounts if stale
  refetchOnWindowFocus: true, // Refetch when window regains focus
  refetchOnReconnect: true, // Refetch when network reconnects

  // Error handling
  retry: 3, // Retry failed requests 3 times

  // Conditional fetching
  enabled: userId !== 0, // Only fetch when userId is valid

  // Transform data
  select: (data) => data.posts, // Transform data before returning
})
```

### Conditional Queries

Only run queries when certain conditions are met:

```typescript
function UserPosts({ userId }: { userId: number | null }) {
  const { data: posts } = useQuery({
    queryKey: ['posts', userId],
    queryFn: () => fetchUserPosts(userId!),
    enabled: userId !== null, // Only fetch when userId exists
  })

  if (!userId) return <div>Select a user</div>

  return <PostList posts={posts ?? []} />
}
```

## Integration with Effect.ts

Convert Effect programs to TanStack Query-compatible functions:

### Pattern 1: Effect Programs as Query Functions

```typescript
import { Effect } from 'effect'
import { useQuery } from '@tanstack/react-query'

// Effect program
const fetchUserProgram = (userId: number) =>
  Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.findById(userId)
  })

// Convert to query function
function useUser(userId: number) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const program = fetchUserProgram(userId).pipe(Effect.provide(AppLayer))
      return await Effect.runPromise(program)
    },
  })
}
```

### Pattern 2: Reusable Effect Query Hook

Create a generic hook for running Effect programs:

```typescript
import { Effect, Exit, Cause } from 'effect'
import { useQuery, UseQueryOptions } from '@tanstack/react-query'

function useEffectQuery<A, E>(
  queryKey: unknown[],
  program: Effect.Effect<A, E, never>,
  options?: Omit<UseQueryOptions<A, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<A, Error>({
    queryKey,
    queryFn: async () => {
      const exit = await Effect.runPromiseExit(program)

      if (Exit.isSuccess(exit)) {
        return exit.value
      }

      const cause = Exit.causeOption(exit)
      if (cause._tag === 'Some') {
        const error = Cause.squash(cause.value)
        throw error instanceof Error ? error : new Error(String(error))
      }

      throw new Error('Unknown error occurred')
    },
    ...options,
  })
}

// Usage
function UserProfile({ userId }: { userId: number }) {
  const program = Effect.gen(function* () {
    const userService = yield* UserService
    return yield* userService.findById(userId)
  }).pipe(Effect.provide(AppLayer))

  const { data: user, isPending, isError } = useEffectQuery(['user', userId], program)

  if (isPending) return <div>Loading...</div>
  if (isError) return <div>Error loading user</div>

  return <UserCard user={user} />
}
```

## useMutation Hook

Mutations modify data on the server (POST, PUT, DELETE):

### Basic Mutation

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface CreateUserInput {
  name: string
  email: string
}

function CreateUserForm() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (newUser: CreateUserInput) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })

      if (!response.ok) throw new Error('Failed to create user')
      return response.json()
    },

    // Invalidate queries after successful mutation
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    mutation.mutate({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" required />
      <input name="email" type="email" required />
      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Creating...' : 'Create User'}
      </button>

      {mutation.isError && <p className="text-red-600">{mutation.error.message}</p>}
      {mutation.isSuccess && <p className="text-green-600">User created!</p>}
    </form>
  )
}
```

### Optimistic Updates

Update UI immediately, rollback on error:

```typescript
function useOptimisticTodo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (newTodo: Todo) => createTodo(newTodo),

    onMutate: async (newTodo) => {
      // Cancel outgoing refetches (don't overwrite optimistic update)
      await queryClient.cancelQueries({ queryKey: ['todos'] })

      // Snapshot previous state for rollback
      const previousTodos = queryClient.getQueryData<Todo[]>(['todos'])

      // Optimistically update cache
      queryClient.setQueryData<Todo[]>(['todos'], (old) => [...(old ?? []), newTodo])

      // Return context for error handling
      return { previousTodos }
    },

    onError: (err, newTodo, context) => {
      // Rollback to previous state on error
      queryClient.setQueryData(['todos'], context?.previousTodos)
    },

    onSettled: () => {
      // Refetch to sync with server (replace optimistic data)
      queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })
}
```

## useQueries Hook

Execute multiple queries in parallel:

```typescript
import { useQueries } from '@tanstack/react-query'

function UserDashboard({ userIds }: { userIds: number[] }) {
  const userQueries = useQueries({
    queries: userIds.map((id) => ({
      queryKey: ['user', id],
      queryFn: () => fetchUser(id),
      staleTime: 5 * 60 * 1000,
    })),
  })

  // Check if all queries are done
  const isLoading = userQueries.some((query) => query.isPending)
  const hasError = userQueries.some((query) => query.isError)

  if (isLoading) return <div>Loading users...</div>
  if (hasError) return <div>Error loading some users</div>

  return (
    <div>
      {userQueries.map((query, index) => (
        <UserCard key={userIds[index]} user={query.data} />
      ))}
    </div>
  )
}
```

## useInfiniteQuery Hook

Handle paginated or infinite scroll data:

```typescript
import { useInfiniteQuery } from '@tanstack/react-query'

interface PostsPage {
  posts: Post[]
  nextCursor: number | null
}

function InfinitePostList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['posts'],
    queryFn: async ({ pageParam = 0 }) => {
      const response = await fetch(`/api/posts?cursor=${pageParam}`)
      return response.json() as Promise<PostsPage>
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
  })

  return (
    <div>
      {data?.pages.map((page, pageIndex) => (
        <div key={pageIndex}>
          {page.posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ))}

      <button onClick={() => fetchNextPage()} disabled={!hasNextPage || isFetchingNextPage}>
        {isFetchingNextPage ? 'Loading more...' : hasNextPage ? 'Load More' : 'No more posts'}
      </button>
    </div>
  )
}
```

## Server-Side Rendering (SSR) with Hono

TanStack Query provides first-class SSR support for fast initial page loads.

### SSR Setup Pattern

```typescript
// src/server.tsx
import { Hono } from 'hono'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider, dehydrate, HydrationBoundary } from '@tanstack/react-query'

const app = new Hono()

app.get('/', async (c) => {
  // 1. Create QueryClient for this request
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // Avoid immediate refetch on client
      },
    },
  })

  // 2. Prefetch queries on the server
  await queryClient.prefetchQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })

  // 3. Prefetch multiple queries in parallel
  await Promise.all([
    queryClient.prefetchQuery({ queryKey: ['posts'], queryFn: fetchPosts }),
    queryClient.prefetchQuery({ queryKey: ['stats'], queryFn: fetchStats }),
  ])

  // 4. Dehydrate state to serialize cache
  const dehydratedState = dehydrate(queryClient)

  // 5. Render React with hydration boundary
  const html = renderToString(
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>
        <App />
      </HydrationBoundary>
    </QueryClientProvider>
  )

  // 6. Send HTML with embedded state
  return c.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Sovrium App</title>
        <script>
          window.__TANSTACK_QUERY_STATE__ = ${JSON.stringify(dehydratedState)}
        </script>
      </head>
      <body>
        <div id="root">${html}</div>
        <script src="/client.js"></script>
      </body>
    </html>
  `)
})

export default app
```

### Client-Side Hydration

```typescript
// src/client.tsx
import { hydrateRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// 1. Create client QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
    },
  },
})

// 2. Hydrate with server state (automatically restores cache)
hydrateRoot(
  document.getElementById('root')!,
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)
```

### SSR Best Practices

**1. Create QueryClient per request**:

```typescript
// ❌ DON'T: Shared QueryClient (data leakage between users)
const queryClient = new QueryClient()

app.get('/', (c) => {
  // Uses same QueryClient for all users!
})

// ✅ DO: QueryClient per request
app.get('/', (c) => {
  const queryClient = new QueryClient()
  // Isolated cache per request
})
```

**2. Set appropriate staleTime**: Prevent immediate refetch on client hydration

**3. Parallel prefetching**:

```typescript
await Promise.all([
  queryClient.prefetchQuery({ queryKey: ['users'], queryFn: fetchUsers }),
  queryClient.prefetchQuery({ queryKey: ['posts'], queryFn: fetchPosts }),
])
```

### SSR with Effect.ts

Prefetch Effect programs on the server:

```typescript
import { Effect } from 'effect'
import { QueryClient } from '@tanstack/react-query'

app.get('/users/:id', async (c) => {
  const userId = Number(c.req.param('id'))
  const queryClient = new QueryClient()

  // Prefetch Effect program
  await queryClient.prefetchQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const program = Effect.gen(function* () {
        const userService = yield* UserService
        return yield* userService.findById(userId)
      })

      return await Effect.runPromise(program.pipe(Effect.provide(AppLayer)))
    },
  })

  const dehydratedState = dehydrate(queryClient)

  // Render with prefetched data
  const html = renderToString(
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>
        <UserProfile userId={userId} />
      </HydrationBoundary>
    </QueryClientProvider>
  )

  return c.html(renderHtmlTemplate(html, dehydratedState))
})
```

## Authentication with Better Auth

Manage authentication state with TanStack Query:

### Auth Query Hook

```typescript
import { useQuery } from '@tanstack/react-query'
import { authClient } from '@/lib/auth'

export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      const session = await authClient.getSession()
      return session
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry auth failures
  })
}

// Usage in components
function Profile() {
  const { data: session, isPending } = useAuth()

  if (isPending) return <div>Loading...</div>

  if (!session) {
    return <LoginPrompt />
  }

  return <UserProfile user={session.user} />
}
```

### Auth Mutations

```typescript
export function useLogin() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      return await authClient.signIn.email(credentials)
    },

    onSuccess: () => {
      // Invalidate auth queries to refetch user session
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      return await authClient.signOut()
    },

    onSuccess: () => {
      // Clear all queries on logout
      queryClient.clear()
    },
  })
}
```

### Protected Queries

Only fetch data when authenticated:

```typescript
function useProtectedData() {
  const { data: session } = useAuth()

  return useQuery({
    queryKey: ['protected-data'],
    queryFn: fetchProtectedData,
    enabled: !!session, // Only fetch when authenticated
  })
}
```

## Testing with TanStack Query

### Testing Queries

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { test, expect } from 'bun:test'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false }, // Disable retries in tests
      mutations: { retry: false },
    },
  })
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

test('useUser fetches user data', async () => {
  const { result } = renderHook(() => useUser(1), { wrapper })

  // Initially pending
  expect(result.current.isPending).toBe(true)

  // Wait for query to complete
  await waitFor(() => expect(result.current.isSuccess).toBe(true))

  // Check data
  expect(result.current.data).toEqual({ id: 1, name: 'Test User' })
})
```

## Best Practices

### 1. Query Key Organization

Establish consistent query key conventions:

```typescript
const queryKeys = {
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: UserFilters) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.users.details(), id] as const,
  },
}

// Usage
useQuery({ queryKey: queryKeys.users.detail(1), queryFn: ... })

// Invalidate all user queries
queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
```

### 2. Stale Time Configuration

Configure stale time based on data characteristics:

```typescript
// Fast-changing data (stock prices, live scores)
staleTime: 0 // Always stale, refetch immediately

// Moderate-changing data (user profile, posts)
staleTime: 60 * 1000 // 1 minute

// Slow-changing data (settings, static content)
staleTime: 5 * 60 * 1000 // 5 minutes

// Rarely-changing data (categories, countries)
staleTime: Infinity // Never stale, manual invalidation only
```

### 3. Error Handling

Consistent error handling patterns:

```typescript
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      console.error(`Query error for ${query.queryKey}:`, error)
      toast.error('Failed to load data. Please try again.')
    },
  }),

  mutationCache: new MutationCache({
    onError: (error) => {
      console.error('Mutation error:', error)
      toast.error('Failed to save changes.')
    },
  }),
})
```

### 4. Loading States

Handle loading states gracefully:

```typescript
function DataView() {
  const { data, isPending, isFetching, isError, error } = useQuery({
    queryKey: ['data'],
    queryFn: fetchData,
  })

  // Initial load
  if (isPending) return <Skeleton />

  // Error state
  if (isError) return <ErrorMessage error={error} />

  return (
    <div>
      {/* Background refetch indicator */}
      {isFetching && <RefetchingIndicator />}

      {/* Data display */}
      <DataDisplay data={data} />
    </div>
  )
}
```

### 5. Invalidation Strategies

Choose appropriate invalidation strategy:

```typescript
// Option 1: Invalidate (marks stale, refetches if active)
queryClient.invalidateQueries({ queryKey: ['users'] })

// Option 2: Reset (clears cache + refetches)
queryClient.resetQueries({ queryKey: ['users'] })

// Option 3: Remove (clears cache, no refetch)
queryClient.removeQueries({ queryKey: ['users'] })

// Option 4: Set query data (optimistic update)
queryClient.setQueryData(['users'], newUsers)
```

### 6. Avoid Over-Fetching

Don't fetch more data than needed:

```typescript
// ❌ DON'T: Fetch all users just to display count
const { data: users } = useQuery({ queryKey: ['users'], queryFn: fetchAllUsers })
const userCount = users?.length

// ✅ DO: Fetch only count
const { data: count } = useQuery({ queryKey: ['users', 'count'], queryFn: fetchUserCount })
```

### 7. Normalize Related Data

Separate related data into distinct queries:

```typescript
// ✅ DO: Separate queries
const { data: user } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
})

const { data: posts } = useQuery({
  queryKey: ['posts', { userId }],
  queryFn: () => fetchUserPosts(userId),
})
```

### 8. Use TypeScript Strictly

Leverage TypeScript for type-safe queries:

```typescript
// ✅ Generic types for data and error
const { data, error } = useQuery<User, UserError>({
  queryKey: ['user', userId],
  queryFn: fetchUser,
})

// data: User | undefined
// error: UserError | null
```

## Common Pitfalls to Avoid

### ❌ Don't Create QueryClient at Module Level (SSR)

```typescript
// ❌ WRONG: Shared across all requests
const queryClient = new QueryClient()

function App() {
  return <QueryClientProvider client={queryClient}>...</QueryClientProvider>
}

// ✅ CORRECT: New instance per request
function App() {
  const [queryClient] = useState(() => new QueryClient())
  return <QueryClientProvider client={queryClient}>...</QueryClientProvider>
}
```

### ❌ Don't Forget to Invalidate After Mutations

```typescript
// ❌ WRONG: No invalidation, stale data
useMutation({
  mutationFn: createUser,
})

// ✅ CORRECT: Invalidate to refetch
useMutation({
  mutationFn: createUser,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] })
  },
})
```

### ❌ Don't Use Queries Inside Event Handlers

```typescript
// ❌ WRONG: Query called on click
function UserButton() {
  const handleClick = () => {
    const { data } = useQuery({ queryKey: ['user'], queryFn: fetchUser })
    console.log(data)
  }

  return <button onClick={handleClick}>Fetch User</button>
}

// ✅ CORRECT: Use mutation for imperative fetches
function UserButton() {
  const queryClient = useQueryClient()

  const handleClick = async () => {
    const data = await queryClient.fetchQuery({
      queryKey: ['user'],
      queryFn: fetchUser,
    })
    console.log(data)
  }

  return <button onClick={handleClick}>Fetch User</button>
}
```

### ❌ Don't Ignore Query Enabled Option

```typescript
// ❌ WRONG: Fetches even when userId is null
const { data } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId!),
})

// ✅ CORRECT: Only fetch when userId exists
const { data } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId!),
  enabled: userId !== null,
})
```

### ❌ Don't Overuse Optimistic Updates

```typescript
// ❌ WRONG: Optimistic update for critical operations
useMutation({
  mutationFn: processPayment,
  onMutate: async (payment) => {
    queryClient.setQueryData(['balance'], (old) => old - payment.amount)
  },
})

// ✅ CORRECT: Wait for server confirmation for critical operations
useMutation({
  mutationFn: processPayment,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['balance'] })
  },
})
```

## Performance Optimization

### Request Deduplication

TanStack Query automatically deduplicates identical requests:

```typescript
// Multiple components rendering simultaneously
function Component1() {
  useQuery({ queryKey: ['users'], queryFn: fetchUsers })
}

function Component2() {
  useQuery({ queryKey: ['users'], queryFn: fetchUsers })
}

// Only ONE request sent, result shared between components
```

### Prefetching

Prefetch data before it's needed:

```typescript
function UserList() {
  const queryClient = useQueryClient()

  const handleMouseEnter = (userId: number) => {
    // Prefetch user detail on hover
    queryClient.prefetchQuery({
      queryKey: ['user', userId],
      queryFn: () => fetchUser(userId),
    })
  }

  return (
    <ul>
      {users?.map((user) => (
        <li key={user.id} onMouseEnter={() => handleMouseEnter(user.id)}>
          <Link to={`/users/${user.id}`}>{user.name}</Link>
        </li>
      ))}
    </ul>
  )
}
```

## DevTools

### Setup

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
      <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
    </QueryClientProvider>
  )
}
```

### Features

- **Query Inspector**: View all queries, their state, and cached data
- **Mutation Inspector**: See active and recent mutations
- **Cache Explorer**: Browse and edit cached data
- **Query Timeline**: Visualize query lifecycles
- **Manual Actions**: Trigger refetch, invalidation, reset

DevTools are automatically excluded from production builds (tree-shaken).

## Summary

TanStack Query transforms server-state management in Sovrium:

1. **Zero Boilerplate**: No manual loading/error state management
2. **Automatic Caching**: Smart caching with configurable stale times
3. **Background Updates**: Keep data fresh with window focus, reconnect refetching
4. **Request Deduplication**: Single request for multiple components
5. **Optimistic Updates**: Instant UI feedback with automatic rollback
6. **SSR Support**: First-class server-side rendering with Hono
7. **Effect.ts Integration**: Seamlessly convert Effect programs to queries
8. **TypeScript Native**: Full type inference and safety

### When to Use TanStack Query

**Use TanStack Query for**:

- Fetching data from APIs
- Managing server state (users, posts, data from backend)
- Caching API responses
- Background refetching
- Pagination and infinite scroll
- Optimistic UI updates
- Authentication state

**Don't use TanStack Query for**:

- Client state (form inputs, UI toggles) - use React state
- Global client state - use Context or Zustand
- Static data that never changes - use constants
- One-time fetches that don't need caching - use useEffect + fetch

With TanStack Query, Sovrium applications achieve exceptional user experience through intelligent server-state management, perfect integration with Effect.ts, and seamless server-side rendering with Hono.

## References

- TanStack Query documentation: https://tanstack.com/query/latest
- React Query (TanStack Query): https://tanstack.com/query/latest/docs/framework/react/overview
- Server-Side Rendering: https://tanstack.com/query/latest/docs/framework/react/guides/ssr
- Optimistic Updates: https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
- TypeScript Guide: https://tanstack.com/query/latest/docs/framework/react/typescript
