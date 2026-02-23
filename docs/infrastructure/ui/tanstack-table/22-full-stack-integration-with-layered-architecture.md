# TanStack Table - Headless Table Library

> **Note**: This is part 22 of the split documentation. See navigation links below.

## Full Stack Integration with Layered Architecture

TanStack Table integrates seamlessly with Sovrium's layered architecture. This section demonstrates the complete flow from Domain → Infrastructure → Application → Presentation.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ PRESENTATION LAYER (React Components + Hono Routes)        │
│  - UserTable.tsx (React component with TanStack Table)     │
│  - /api/users route (Hono endpoint)                        │
└────────────────────┬────────────────────────────────────────┘
                     │ async/await
┌────────────────────▼────────────────────────────────────────┐
│ APPLICATION LAYER (Effect Programs - Business Logic)        │
│  - GetUsers.ts (Effect.gen program)                         │
│  - DeleteUser.ts (Effect.gen program)                       │
└────────────────────┬────────────────────────────────────────┘
                     │ Effect.gen
┌────────────────────▼────────────────────────────────────────┐
│ DOMAIN LAYER (Pure Functions - Business Rules)              │
│  - User entity, validation functions                        │
└─────────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ INFRASTRUCTURE LAYER (Effect Services - External Systems)   │
│  - UserRepository (Drizzle ORM)                             │
│  - Logger, EmailService                                     │
└─────────────────────────────────────────────────────────────┘
```

### Complete Example: Users Table with Authentication

#### 1. Domain Layer (Pure Business Logic)

```typescript
// src/domain/user/user.ts
export interface User {
  readonly id: number
  readonly name: string
  readonly email: string
  readonly role: 'admin' | 'user'
  readonly status: 'active' | 'inactive'
  readonly createdAt: Date
}
// Pure validation function
export function canDeleteUser(currentUser: User, targetUser: User): boolean {
  // Only admins can delete users
  if (currentUser.role !== 'admin') return false
  // Cannot delete yourself
  if (currentUser.id === targetUser.id) return false
  // Cannot delete other admins
  if (targetUser.role === 'admin') return false
  return true
}
// Pure transformation function
export function toUserListItem(user: User): UserListItem {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    statusBadge: user.status === 'active' ? 'Active' : 'Inactive',
    canDelete: user.role !== 'admin', // Will be refined with current user context
  }
}
```

#### 2. Infrastructure Layer (Database Access)

```typescript
// src/infrastructure/database/repositories/UserRepository.ts
import { Effect, Context } from 'effect'
import { db } from '../drizzle'
import { users } from '../schema'
import { eq } from 'drizzle-orm'
export class DatabaseError {
  readonly _tag = 'DatabaseError'
  constructor(readonly message: string) {}
}
export class UserRepository extends Context.Tag('UserRepository')<
  UserRepository,
  {
    readonly findAll: () => Effect.Effect<readonly User[], DatabaseError>
    readonly findById: (id: number) => Effect.Effect<User, DatabaseError>
    readonly delete: (id: number) => Effect.Effect<void, DatabaseError>
    readonly bulkDelete: (ids: readonly number[]) => Effect.Effect<void, DatabaseError>
  }
>() {}
// Live implementation with Drizzle ORM
export const UserRepositoryLive = Layer.succeed(UserRepository, {
  findAll: () =>
    Effect.tryPromise({
      try: async () => {
        const result = await db.select().from(users)
        return result.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role as 'admin' | 'user',
          status: row.status as 'active' | 'inactive',
          createdAt: new Date(row.created_at),
        }))
      },
      catch: (error) => new DatabaseError(`Failed to fetch users: ${error}`),
    }),
  findById: (id: number) =>
    Effect.tryPromise({
      try: async () => {
        const result = await db.select().from(users).where(eq(users.id, id)).limit(1)
        if (result.length === 0) {
          throw new Error('User not found')
        }
        return result[0] as User
      },
      catch: (error) => new DatabaseError(`Failed to fetch user ${id}: ${error}`),
    }),
  delete: (id: number) =>
    Effect.tryPromise({
      try: async () => {
        await db.delete(users).where(eq(users.id, id))
      },
      catch: (error) => new DatabaseError(`Failed to delete user ${id}: ${error}`),
    }),
  bulkDelete: (ids: readonly number[]) =>
    Effect.tryPromise({
      try: async () => {
        await db.delete(users).where(inArray(users.id, ids as number[]))
      },
      catch: (error) => new DatabaseError(`Failed to bulk delete users: ${error}`),
    }),
})
```

#### 3. Application Layer (Business Logic with Effect)

```typescript
// src/application/users/GetUsers.ts
import { Effect } from 'effect'
import { UserRepository } from '@/infrastructure/database/repositories/UserRepository'
import { toUserListItem } from '@/domain/user/user'
export const GetUsers = Effect.gen(function* () {
  const userRepo = yield* UserRepository
  const users = yield* userRepo.findAll()
  return users.map(toUserListItem)
})
// src/application/users/DeleteUser.ts
import { Effect } from 'effect'
import { UserRepository } from '@/infrastructure/database/repositories/UserRepository'
import { AuthService } from '@/infrastructure/auth/AuthService'
import { canDeleteUser } from '@/domain/user/user'
export class UnauthorizedError {
  readonly _tag = 'UnauthorizedError'
  constructor(readonly message: string) {}
}
export class UserNotFoundError {
  readonly _tag = 'UserNotFoundError'
  constructor(readonly userId: number) {}
}
export const DeleteUser = (userId: number) =>
  Effect.gen(function* () {
    const userRepo = yield* UserRepository
    const authService = yield* AuthService
    // Get current user (from Better Auth session)
    const currentUser = yield* authService.getCurrentUser()
    // Get target user
    const targetUser = yield* userRepo.findById(userId)
    // Domain validation
    if (!canDeleteUser(currentUser, targetUser)) {
      return yield* Effect.fail(
        new UnauthorizedError('You do not have permission to delete this user')
      )
    }
    // Delete user
    yield* userRepo.delete(userId)
    return { success: true, deletedUserId: userId }
  })
// src/application/users/BulkDeleteUsers.ts
export const BulkDeleteUsers = (userIds: readonly number[]) =>
  Effect.gen(function* () {
    const userRepo = yield* UserRepository
    const authService = yield* AuthService
    const currentUser = yield* authService.getCurrentUser()
    // Fetch all target users
    const targetUsers = yield* Effect.all(userIds.map((id) => userRepo.findById(id)))
    // Validate each deletion
    const canDeleteAll = targetUsers.every((user) => canDeleteUser(currentUser, user))
    if (!canDeleteAll) {
      return yield* Effect.fail(
        new UnauthorizedError('You do not have permission to delete one or more users')
      )
    }
    // Bulk delete
    yield* userRepo.bulkDelete(userIds)
    return { success: true, deletedCount: userIds.length }
  })
```

#### 4. Presentation Layer - Hono Route (API Endpoint)

```typescript
// src/presentation/routes/users.ts
import { Hono } from 'hono'
import { GetUsers, DeleteUser, BulkDeleteUsers } from '@/application/users'
import { AppLayer } from '@/infrastructure/layers'
const app = new Hono()
// GET /api/users - Fetch all users
app.get('/api/users', async (c) => {
  const program = GetUsers.pipe(Effect.provide(AppLayer))
  const result = await Effect.runPromise(program.pipe(Effect.either))
  if (result._tag === 'Left') {
    const error = result.left
    return c.json({ error: error.message }, 500)
  }
  return c.json({ users: result.right }, 200)
})
// DELETE /api/users/:id - Delete single user
app.delete('/api/users/:id', async (c) => {
  const userId = Number(c.req.param('id'))
  const program = DeleteUser(userId).pipe(Effect.provide(AppLayer))
  const result = await Effect.runPromise(program.pipe(Effect.either))
  if (result._tag === 'Left') {
    const error = result.left
    if (error._tag === 'UnauthorizedError') {
      return c.json({ error: error.message }, 403)
    }
    if (error._tag === 'UserNotFoundError') {
      return c.json({ error: `User ${error.userId} not found` }, 404)
    }
    return c.json({ error: 'Internal server error' }, 500)
  }
  return c.json(result.right, 200)
})
// POST /api/users/bulk-delete - Delete multiple users
app.post('/api/users/bulk-delete', async (c) => {
  const body = await c.req.json()
  const userIds = body.userIds as number[]
  const program = BulkDeleteUsers(userIds).pipe(Effect.provide(AppLayer))
  const result = await Effect.runPromise(program.pipe(Effect.either))
  if (result._tag === 'Left') {
    const error = result.left
    if (error._tag === 'UnauthorizedError') {
      return c.json({ error: error.message }, 403)
    }
    return c.json({ error: 'Internal server error' }, 500)
  }
  return c.json(result.right, 200)
})
export default app
```

#### 5. Presentation Layer - React Component (TanStack Table)

```typescript
// src/presentation/ui/UsersTable.tsx
import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
} from '@tanstack/react-table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
interface UserListItem {
  id: number
  name: string
  email: string
  role: 'admin' | 'user'
  statusBadge: string
  canDelete: boolean
}
export function UsersTable() {
  const queryClient = useQueryClient()
  const [rowSelection, setRowSelection] = useState({})
  // Fetch users with TanStack Query
  const { data, isLoading, isError } = useQuery<{ users: UserListItem[] }>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await fetch('/api/users')
      if (!response.ok) throw new Error('Failed to fetch users')
      return response.json()
    },
  })
  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (userIds: number[]) => {
      const response = await fetch('/api/users/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error)
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setRowSelection({})
    },
  })
  // Column definitions
  const columns = useMemo<ColumnDef<UserListItem>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="cursor-pointer"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            disabled={!row.original.canDelete}
            onChange={row.getToggleSelectedHandler()}
            className="cursor-pointer"
          />
        ),
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: (info) => <span className="text-gray-600">{info.getValue()}</span>,
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: (info) => {
          const role = info.getValue<'admin' | 'user'>()
          return (
            <span
              className={cn(
                'rounded-full px-2 py-1 text-xs font-medium',
                role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
              )}
            >
              {role}
            </span>
          )
        },
      },
      {
        accessorKey: 'statusBadge',
        header: 'Status',
        cell: (info) => {
          const status = info.getValue<string>()
          return (
            <span
              className={cn(
                'rounded-full px-2 py-1 text-xs font-medium',
                status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              )}
            >
              {status}
            </span>
          )
        },
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const user = row.original
          return (
            <button
              onClick={() => deleteUserMutation.mutate(user.id)}
              disabled={!user.canDelete || deleteUserMutation.isLoading}
              className={cn(
                'text-red-600 hover:text-red-700',
                (!user.canDelete || deleteUserMutation.isLoading) && 'cursor-not-allowed opacity-50'
              )}
            >
              {deleteUserMutation.isLoading ? 'Deleting...' : 'Delete'}
            </button>
          )
        },
      },
    ],
    [deleteUserMutation]
  )
  // Table instance
  const table = useReactTable({
    data: data?.users ?? [],
    columns,
    state: {
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: (row) => row.original.canDelete,
  })
  // Handle bulk delete
  const handleBulkDelete = () => {
    const selectedIds = table
      .getFilteredSelectedRowModel()
      .rows.map((row) => row.original.id)
    bulkDeleteMutation.mutate(selectedIds)
  }
  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  if (isLoading) {
    return <div className="animate-pulse">Loading users...</div>
  }
  if (isError) {
    return <div className="text-red-600">Failed to load users</div>
  }
  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-4 rounded-lg bg-blue-50 p-4">
          <span className="text-sm font-medium text-blue-900">
            {selectedCount} user{selectedCount > 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isLoading}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {bulkDeleteMutation.isLoading ? 'Deleting...' : 'Delete Selected'}
          </button>
        </div>
      )}
      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="transition-colors hover:bg-gray-50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="whitespace-nowrap px-6 py-4 text-sm"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

### Key Patterns Demonstrated

**1. Effect.gen for Business Logic (Application Layer)**:

- Use `Effect.gen` for all business logic with type-safe error handling
- Explicit dependencies via Effect Context (UserRepository, AuthService)
- Pure functions in Domain layer called from Effect programs
  **2. async/await in Presentation Layer**:
- Hono routes use `async/await` to run Effect programs with `Effect.runPromise`
- React components use `async/await` with TanStack Query for data fetching
  **3. TanStack Query Integration**:
- `useQuery` for fetching data (caching, refetching, loading states)
- `useMutation` for mutations (optimistic updates, error handling)
- Automatic cache invalidation after mutations
  **4. Better Auth Integration**:
- AuthService provides current user via Effect Context
- Domain layer validates permissions (pure function)
- Unauthorized errors handled at API level
  **5. Drizzle ORM Integration**:
- UserRepository wraps Drizzle queries in Effect programs
- Type-safe database access with schema
- Error handling with DatabaseError type

### Benefits of This Architecture

- **Type Safety**: Errors are explicit in type signatures
- **Testability**: Pure functions and Effect programs are trivial to test
- **Separation of Concerns**: Each layer has a clear responsibility
- **Composability**: Business logic is composable via Effect
- **Maintainability**: Changes to one layer don't affect others
- **Performance**: TanStack Query handles caching and refetching

---

## Navigation

[← Part 21](./21-when-to-use-tanstack-table.md) | [Part 23 →](./23-references.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-why-tanstack-table-for-sovrium.md) | [Part 4](./04-core-concepts.md) | [Part 5](./05-installation.md) | [Part 6](./06-basic-table-setup.md) | [Part 7](./07-column-definitions.md) | [Part 8](./08-sorting.md) | [Part 9](./09-filtering.md) | [Part 10](./10-pagination.md) | [Part 11](./11-row-selection.md) | [Part 12](./12-column-visibility.md) | [Part 13](./13-integration-with-tanstack-query.md) | [Part 14](./14-integration-with-effectts.md) | [Part 15](./15-styling-with-tailwind-css.md) | [Part 16](./16-reusable-data-table-component-shadcnui-pattern.md) | [Part 17](./17-performance-optimization.md) | [Part 18](./18-testing.md) | [Part 19](./19-best-practices.md) | [Part 20](./20-common-pitfalls.md) | [Part 21](./21-when-to-use-tanstack-table.md) | **Part 22** | [Part 23](./23-references.md)
