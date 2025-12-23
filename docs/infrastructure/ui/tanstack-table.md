# TanStack Table - Headless Table Library

> **Note**: This document provides a high-level summary with essential patterns for building data tables in Sovrium. For comprehensive coverage including advanced features (grouping, column pinning, expanding rows, faceted filters, column resizing) and detailed integration patterns, see the full TanStack Table documentation at https://tanstack.com/table/latest.

## Overview

**Version**: ^8.21.3
**Purpose**: Framework-agnostic headless table library for building powerful data tables and data grids with complete control over markup and styling

TanStack Table (formerly React Table) is a headless UI library for building feature-rich data tables. Unlike traditional component libraries that provide pre-styled tables, TanStack Table focuses solely on state management and table logic, giving you 100% control over markup, styling, and rendering.

## Why TanStack Table for Sovrium?

### Perfect Fit for Our Stack

- **Headless Architecture**: Integrates seamlessly with Tailwind CSS and shadcn/ui's design philosophy
- **TypeScript First**: Fully typed API with excellent inference and autocomplete
- **React 19 Compatible**: Works perfectly with modern React patterns and hooks
- **Composable**: Build complex tables from simple, reusable pieces
- **Performance**: Optimized for large datasets with virtualization support
- **Feature-Rich**: Sorting, filtering, pagination, row selection, and more built-in
- **Framework Agnostic**: Core logic works across frameworks (React, Vue, Solid, etc.)

### Integration with Sovrium Stack

| Technology         | Integration                                          |
| ------------------ | ---------------------------------------------------- |
| **React 19**       | Full support for modern hooks and patterns           |
| **TypeScript**     | Complete type inference for columns, rows, and state |
| **Tailwind CSS**   | 100% control over styling with utility classes       |
| **shadcn/ui**      | Follows same headless philosophy, perfect synergy    |
| **TanStack Query** | Server-side data fetching, caching, and mutations    |
| **Effect.ts**      | Type-safe business logic in table actions            |
| **Better Auth**    | Permission-based row selection and actions           |
| **Drizzle ORM**    | Database queries for server-side features            |

## Core Concepts

### 1. Headless UI Philosophy

TanStack Table doesn't render any DOM elements. Instead, it provides:

- **State management** for table features (sorting, filtering, pagination)
- **API methods** to interact with table state
- **Computed values** for rendering (rows, columns, headers)

**You control**:

- HTML markup structure
- CSS styling (with Tailwind CSS)
- Component architecture
- Event handlers
- Accessibility attributes

```typescript
// ❌ Traditional component library
<DataTable data={data} columns={columns} /> // Fixed markup, limited customization

// ✅ TanStack Table (headless)
const table = useReactTable({ data, columns })
<table>
  <thead>
    {table.getHeaderGroups().map(headerGroup => (
      <tr key={headerGroup.id}>
        {headerGroup.headers.map(header => (
          <th key={header.id}>{/* Custom markup */}</th>
        ))}
      </tr>
    ))}
  </thead>
  {/* Full control over rendering */}
</table>
```

### 2. Table Instance

The table instance is the central object containing all state and APIs:

```typescript
import { useReactTable, getCoreRowModel } from '@tanstack/react-table'

const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(), // Required
  getSortedRowModel: getSortedRowModel(), // Optional features
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
})

// Access state
table.getState() // { sorting: [], pagination: { pageIndex: 0, pageSize: 10 } }

// Access APIs
table.getRowModel().rows // Get current rows
table.getAllColumns() // Get all columns
table.getHeaderGroups() // Get header groups for rendering
```

### 3. Column Definitions

Columns define how data is accessed, displayed, and interacted with:

```typescript
import { ColumnDef } from '@tanstack/react-table'

interface User {
  id: number
  name: string
  email: string
  status: 'active' | 'inactive'
}

const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'name', // Access data by key
    header: 'Name',
    cell: (info) => info.getValue(),
  },
  {
    accessorFn: (row) => row.email, // Access with function
    id: 'email',
    header: 'Email',
  },
  {
    id: 'actions', // Display column (no data)
    header: 'Actions',
    cell: (props) => <button>Delete</button>,
  },
]
```

### 4. Data Model

Data must be an array of objects with stable references:

```typescript
// ✅ CORRECT: Stable reference with useState or useMemo
const [data, setData] = useState<User[]>([
  { id: 1, name: 'Alice', email: 'alice@example.com', status: 'active' },
  { id: 2, name: 'Bob', email: 'bob@example.com', status: 'inactive' },
])

// ✅ CORRECT: Stable reference with useMemo
const data = useMemo(
  () => [
    { id: 1, name: 'Alice', email: 'alice@example.com', status: 'active' },
    { id: 2, name: 'Bob', email: 'bob@example.com', status: 'inactive' },
  ],
  []
)

// ❌ INCORRECT: New reference on every render
const data = [{ id: 1, name: 'Alice', email: 'alice@example.com', status: 'active' }] // Will cause infinite re-renders!
```

## Basic Table Setup

```typescript
import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
} from '@tanstack/react-table'

interface User {
  id: number
  name: string
  email: string
}

function UserTable() {
  const [data] = useState<User[]>([
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com' },
    { id: 2, name: 'Bob Smith', email: 'bob@example.com' },
    { id: 3, name: 'Charlie Brown', email: 'charlie@example.com' },
  ])

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: (info) => info.getValue(),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: (info) => info.getValue(),
      },
    ],
    []
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="overflow-x-auto">
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
            <tr key={row.id} className="hover:bg-gray-50">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="whitespace-nowrap px-6 py-4">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

**Key Components**:

1. **flexRender**: Utility to render cells/headers (supports JSX, strings, or functions)
2. **getHeaderGroups()**: Returns header rows (supports nested headers)
3. **getRowModel().rows**: Returns current rows (after sorting, filtering, pagination)
4. **getVisibleCells()**: Returns cells respecting column visibility

## Sorting

```typescript
import { useReactTable, getSortedRowModel, SortingState } from '@tanstack/react-table'

function SortableTable() {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => {
        return (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-2"
          >
            Name
            {column.getIsSorted() === 'asc' && <ChevronUp className="h-4 w-4" />}
            {column.getIsSorted() === 'desc' && <ChevronDown className="h-4 w-4" />}
          </button>
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(), // Enable sorting
  })

  return <>{/* Render table */}</>
}
```

**Server-Side Sorting**:

```typescript
const table = useReactTable({
  data,
  columns,
  state: { sorting },
  onSortingChange: setSorting,
  manualSorting: true, // Disable client-side sorting
  getCoreRowModel: getCoreRowModel(),
  // Don't provide getSortedRowModel for server-side sorting
})

// Use sorting state to fetch sorted data
useEffect(() => {
  fetchUsers({
    sortBy: sorting[0]?.id,
    sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
  })
}, [sorting])
```

## Filtering

```typescript
import { useReactTable, getFilteredRowModel, ColumnFiltersState } from '@tanstack/react-table'

function FilterableTable() {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
    },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(), // Enable filtering
  })

  return (
    <div>
      <input
        type="text"
        value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
        onChange={(e) => table.getColumn('name')?.setFilterValue(e.target.value)}
        placeholder="Filter by name..."
        className="mb-4 w-full rounded border px-3 py-2"
      />
      {/* Render table */}
    </div>
  )
}
```

**Global Filtering**:

```typescript
const [globalFilter, setGlobalFilter] = useState('')

const table = useReactTable({
  data,
  columns,
  state: {
    globalFilter,
  },
  onGlobalFilterChange: setGlobalFilter,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
})
```

## Pagination

```typescript
import { useReactTable, getPaginationRowModel, PaginationState } from '@tanstack/react-table'

function PaginatedTable() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const table = useReactTable({
    data,
    columns,
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(), // Enable pagination
  })

  return (
    <div>
      {/* Render table */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="rounded border px-3 py-1 disabled:opacity-50"
        >
          Previous
        </button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="rounded border px-3 py-1 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}
```

**Server-Side Pagination**:

```typescript
const table = useReactTable({
  data: queryData?.users ?? [],
  columns,
  pageCount: queryData?.pageCount ?? -1, // Total page count from server
  state: { pagination },
  onPaginationChange: setPagination,
  manualPagination: true, // Disable client-side pagination
  getCoreRowModel: getCoreRowModel(),
})
```

## Row Selection

```typescript
import { useReactTable, RowSelectionState } from '@tanstack/react-table'

function SelectableTable() {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const columns: ColumnDef<User>[] = [
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
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          className="cursor-pointer"
        />
      ),
    },
    // ... other columns
  ]

  const table = useReactTable({
    data,
    columns,
    state: {
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true, // Enable row selection
  })

  const selectedRows = table.getFilteredSelectedRowModel().rows

  return (
    <div>
      {selectedRows.length > 0 && (
        <div className="mb-4">
          <span>{selectedRows.length} row(s) selected</span>
          <button
            onClick={() => console.log(selectedRows.map((row) => row.original))}
            className="ml-2 rounded bg-red-600 px-3 py-1 text-white"
          >
            Delete Selected
          </button>
        </div>
      )}
      {/* Render table */}
    </div>
  )
}
```

## Integration with TanStack Query

```typescript
import { useQuery } from '@tanstack/react-query'

function ServerTable() {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [sorting, setSorting] = useState<SortingState>([])

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', pagination, sorting],
    queryFn: async () => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: pagination.pageIndex,
          limit: pagination.pageSize,
          sortBy: sorting[0]?.id,
          sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
        }),
      })
      return response.json()
    },
    keepPreviousData: true,
  })

  const table = useReactTable({
    data: data?.users ?? [],
    columns,
    pageCount: data?.pageCount ?? -1,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  })

  if (isLoading) return <div>Loading...</div>
  if (isError) return <div>Error loading data</div>

  return <>{/* Render table */}</>
}
```

## Integration with Effect.ts

```typescript
import { Effect } from 'effect'

function TableWithEffectActions() {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
  })

  const handleDeleteSelected = () => {
    const selectedIds = table
      .getFilteredSelectedRowModel()
      .rows.map((row) => row.original.id)

    const program = Effect.gen(function* () {
      const userService = yield* UserService
      yield* userService.bulkDelete(selectedIds)
    }).pipe(
      Effect.provide(UserServiceLive),
      Effect.catchAll((error) => {
        console.error('Delete failed:', error)
        return Effect.succeed(undefined)
      })
    )

    Effect.runPromise(program).then(() => {
      setRowSelection({})
      // Refetch data
    })
  }

  return <>{/* Render table */}</>
}
```

## Reusable Data Table Component (shadcn/ui Pattern)

```typescript
// src/components/ui/data-table.tsx
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  ColumnFiltersState,
  SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  pagination?: boolean
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  pagination = true,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="space-y-4">
      {searchKey && (
        <input
          type="text"
          placeholder={`Search ${searchKey}...`}
          value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? ''}
          onChange={(e) => table.getColumn(searchKey)?.setFilterValue(e.target.value)}
          className="max-w-sm rounded border px-3 py-2"
        />
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-6 py-3 text-left text-xs font-medium uppercase">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y bg-background">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-muted/50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center">
                  No results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {table.getFilteredRowModel().rows.length} row(s) total
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className={cn('rounded border px-3 py-1', !table.getCanPreviousPage() && 'opacity-50')}
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className={cn('rounded border px-3 py-1', !table.getCanNextPage() && 'opacity-50')}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Usage**:

```typescript
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'

const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
]

function UsersPage() {
  const [users] = useState<User[]>([
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ])

  return (
    <div className="container mx-auto py-10">
      <h1 className="mb-8 text-3xl font-bold">Users</h1>
      <DataTable columns={columns} data={users} searchKey="name" />
    </div>
  )
}
```

## Layered Architecture Integration

TanStack Table fits perfectly into Sovrium's layered architecture:

```
┌─────────────────────────────────────────────┐
│ PRESENTATION LAYER                          │
│  - React component with TanStack Table     │
│  - Hono API route                           │
└─────────┬───────────────────────────────────┘
          │ async/await
┌─────────▼───────────────────────────────────┐
│ APPLICATION LAYER                            │
│  - Effect.gen programs                      │
│  - Business logic orchestration             │
└─────────┬───────────────────────────────────┘
          │ Effect.gen
┌─────────▼───────────────────────────────────┐
│ DOMAIN LAYER                                 │
│  - Pure validation functions                │
│  - Business rules                           │
└─────────┬───────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────┐
│ INFRASTRUCTURE LAYER                         │
│  - UserRepository (Drizzle ORM)             │
│  - Effect services                          │
└─────────────────────────────────────────────┘
```

**Key Pattern**:

- Domain Layer: Pure validation functions
- Application Layer: Effect.gen programs for business logic
- Infrastructure Layer: Drizzle ORM wrapped in Effect
- Presentation Layer: React + TanStack Table + TanStack Query

For a complete full-stack example with authentication, permissions, and database integration, see the full TanStack Table documentation.

## Performance Optimization

### Memoize Columns

```typescript
const columns = useMemo<ColumnDef<User>[]>(
  () => [
    { accessorKey: 'name', header: 'Name' },
    // ... other columns
  ],
  [] // Only create columns once
)
```

### Virtualization for Large Datasets

Use `@tanstack/react-virtual` for tables with 1000+ rows:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50, // Row height
  overscan: 10,
})
```

## Testing

```typescript
import { test, expect } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { UserTable } from './UserTable'

test('renders table with user data', () => {
  const mockUsers = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ]

  const html = renderToString(<UserTable users={mockUsers} />)

  expect(html).toContain('Alice')
  expect(html).toContain('alice@example.com')
  expect(html).toContain('Bob')
  expect(html).toContain('bob@example.com')
})
```

## Best Practices

1. **Memoize columns and data** - Prevent unnecessary re-renders
2. **Use TypeScript generics** - Type-safe columns and data access
3. **Stable row IDs** - Use `getRowId` for stable row identity (UUIDs, not array indices)
4. **Separate concerns** - Keep table logic separate from business logic
5. **Server-side features** - Use server-side pagination/sorting/filtering for large datasets
6. **Optimize rendering** - Use virtualization for tables with 1000+ rows
7. **Accessible markup** - Use semantic HTML (table, thead, tbody, tr, th, td)
8. **Loading states** - Show skeletons or spinners during data fetching
9. **Error handling** - Display friendly error messages when data fails to load
10. **Responsive design** - Consider card layout on mobile, table on desktop

## Common Pitfalls

- ❌ **Unstable data reference** - Creates infinite re-renders
- ❌ **Not memoizing columns** - Columns recreated on every render
- ❌ **Mixing client and server features** - Don't provide row models for server-side features
- ❌ **Forgetting row IDs** - Array indices break selection when data changes
- ❌ **Not handling empty states** - Poor UX when table is empty
- ❌ **Overusing client-side features** - Server-side is better for large datasets
- ❌ **Ignoring accessibility** - Use semantic HTML and ARIA attributes
- ❌ **Not optimizing large tables** - Use virtualization for 1000+ rows

## When to Use TanStack Table

✅ **Use TanStack Table when:**

- Building data-heavy applications (admin panels, dashboards)
- Need full control over table markup and styling
- Require advanced features (sorting, filtering, pagination, selection)
- Working with large datasets that need optimization
- Want type-safe table implementation
- Building reusable table components

❌ **Consider alternatives when:**

- Simple list rendering (use `map()` directly)
- Pre-styled tables are acceptable (component library tables)
- No advanced features needed (basic HTML table sufficient)

## References

- TanStack Table documentation: https://tanstack.com/table/latest/docs/introduction
- TanStack Table API reference: https://tanstack.com/table/latest/docs/api/core/table
- TanStack Query integration: https://tanstack.com/query/latest
- React Virtual (virtualization): https://tanstack.com/virtual/latest
- Examples and demos: https://tanstack.com/table/latest/docs/framework/react/examples/basic
- Sovrium Layer-Based Architecture: [../../architecture/layer-based-architecture.md](../../architecture/layer-based-architecture.md)
