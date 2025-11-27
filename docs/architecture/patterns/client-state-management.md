# Client State Management Pattern

## Overview

Sovrium uses **TanStack Query** for server state management combined with **Effect.ts** for type-safe business logic. This document describes patterns for integrating these tools effectively.

## State Categories

### Server State (TanStack Query)

- Data fetched from API endpoints
- Cached, deduplicated, and automatically refreshed
- Examples: user data, table records, organization settings

### Client State (React State)

- UI-only state not persisted to server
- Ephemeral interactions
- Examples: modal open/closed, form input values, sidebar collapsed

### Derived State (Computed)

- Calculated from server or client state
- Examples: filtered lists, aggregated totals, formatted dates

## TanStack Query + Effect Integration

### Pattern 1: Query with Effect Fetcher

```typescript
import { useQuery } from '@tanstack/react-query'
import { Effect } from 'effect'

// Define Effect program for fetching
const fetchUser = (id: number) =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => fetch(`/api/users/${id}`),
      catch: () => new NetworkError('Failed to fetch user')
    })

    if (!response.ok) {
      return yield* Effect.fail(new UserNotFoundError(id))
    }

    const data = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () => new ParseError('Invalid JSON response')
    })

    return data as User
  })

// Use in React component
function UserProfile({ userId }: { userId: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => Effect.runPromise(fetchUser(userId)),
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage error={error} />
  return <UserCard user={data} />
}
```

### Pattern 2: Mutation with Effect

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Effect } from 'effect'

// Define Effect program for mutation
const updateUser = (id: number, data: UpdateUserInput) =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
      catch: () => new NetworkError('Failed to update user')
    })

    if (!response.ok) {
      return yield* Effect.fail(new UpdateFailedError(id))
    }

    return yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () => new ParseError('Invalid response')
    })
  })

// Use in React component
function EditUserForm({ userId }: { userId: number }) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (data: UpdateUserInput) =>
      Effect.runPromise(updateUser(userId, data)),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['user', userId] })
    },
  })

  const handleSubmit = (data: UpdateUserInput) => {
    mutation.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving...' : 'Save'}
      </button>
    </form>
  )
}
```

### Pattern 3: Optimistic Updates

```typescript
const mutation = useMutation({
  mutationFn: (newData: UpdateUserInput) => Effect.runPromise(updateUser(userId, newData)),

  // Optimistically update cache before server responds
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['user', userId] })

    // Snapshot previous value
    const previousUser = queryClient.getQueryData(['user', userId])

    // Optimistically update
    queryClient.setQueryData(['user', userId], (old: User) => ({
      ...old,
      ...newData,
    }))

    // Return context with snapshot
    return { previousUser }
  },

  // Rollback on error
  onError: (err, newData, context) => {
    queryClient.setQueryData(['user', userId], context?.previousUser)
  },

  // Always refetch after error or success
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['user', userId] })
  },
})
```

## Caching Strategy

### Query Key Conventions

```typescript
// Entity queries
;['user', userId]['users'][('users', { role: 'admin' })][ // Single user // User list // Filtered list
  // Nested resources
  ('organization', orgId, 'members')
][('table', tableId, 'records')][ // Org members // Table records
  // Paginated queries
  ('users', { page: 1, limit: 10 })
] // Paginated list
```

### Stale Time Configuration

```typescript
// Query client configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Retry failed requests 3 times
      retry: 3,
      // Don't refetch on window focus in development
      refetchOnWindowFocus: process.env.NODE_ENV === 'production',
    },
  },
})
```

### Cache Invalidation Patterns

```typescript
// Invalidate single query
queryClient.invalidateQueries({ queryKey: ['user', userId] })

// Invalidate all user queries
queryClient.invalidateQueries({ queryKey: ['users'] })

// Invalidate with predicate
queryClient.invalidateQueries({
  predicate: (query) => query.queryKey[0] === 'organization' && query.queryKey[1] === orgId,
})

// Remove from cache entirely
queryClient.removeQueries({ queryKey: ['user', userId] })
```

## Error Handling

### Effect Errors → React Query Errors

```typescript
// Custom error boundary for queries
function QueryErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <div>
              <p>Something went wrong: {error.message}</p>
              <button onClick={resetErrorBoundary}>Try again</button>
            </div>
          )}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
```

### Error Type Mapping

```typescript
// Map Effect errors to user-friendly messages
function getErrorMessage(error: unknown): string {
  if (error instanceof UserNotFoundError) {
    return 'User not found'
  }
  if (error instanceof NetworkError) {
    return 'Network error. Please check your connection.'
  }
  if (error instanceof UnauthorizedError) {
    return 'Please sign in to continue'
  }
  return 'Something went wrong. Please try again.'
}
```

## Loading States

### Skeleton Loading Pattern

```typescript
function UserList() {
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => Effect.runPromise(fetchUsers()),
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <UserCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {data?.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  )
}
```

### Suspense Pattern (React 18+)

```typescript
// Enable suspense for query
const { data } = useSuspenseQuery({
  queryKey: ['user', userId],
  queryFn: () => Effect.runPromise(fetchUser(userId)),
})

// Wrap in Suspense boundary
function UserPage({ userId }: { userId: number }) {
  return (
    <Suspense fallback={<UserCardSkeleton />}>
      <UserProfile userId={userId} />
    </Suspense>
  )
}
```

## Best Practices

### Do's

- ✅ Use query keys that uniquely identify data
- ✅ Invalidate related queries after mutations
- ✅ Handle loading and error states
- ✅ Use optimistic updates for better UX
- ✅ Configure appropriate stale times
- ✅ Keep Effect programs pure (no side effects outside Effect)

### Don'ts

- ❌ Don't store server state in React state
- ❌ Don't forget to handle error cases
- ❌ Don't use `useEffect` for data fetching (use useQuery)
- ❌ Don't manually manage cache (let TanStack Query handle it)
- ❌ Don't mix async/await with Effect in the same function

## Related Documentation

- `@docs/infrastructure/ui/tanstack-query.md` - TanStack Query setup
- `@docs/architecture/patterns/react-effect-integration.md` - Effect in React
- `@docs/architecture/patterns/error-handling-strategy.md` - Error handling
- `@docs/infrastructure/framework/effect.md` - Effect.ts patterns
