# TanStack Table - Headless Table Library

> **Note**: This is part 10 of the split documentation. See navigation links below.

## Pagination

### Enabling Pagination

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
  return <>{/* Render table */}</>
}
```

### Pagination Controls

```typescript
function PaginationControls({ table }: { table: Table<User> }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <button
          onClick={() => table.firstPage()}
          disabled={!table.getCanPreviousPage()}
          className="rounded border px-2 py-1 disabled:opacity-50"
        >
          {'<<'}
        </button>
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="rounded border px-2 py-1 disabled:opacity-50"
        >
          {'<'}
        </button>
        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          className="rounded border px-2 py-1 disabled:opacity-50"
        >
          {'>'}
        </button>
        <button
          onClick={() => table.lastPage()}
          disabled={!table.getCanNextPage()}
          className="rounded border px-2 py-1 disabled:opacity-50"
        >
          {'>>'}
        </button>
      </div>
      <span className="flex items-center gap-1">
        <div>Page</div>
        <strong>
          {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </strong>
      </span>
      <select
        value={table.getState().pagination.pageSize}
        onChange={(e) => table.setPageSize(Number(e.target.value))}
        className="rounded border px-2 py-1"
      >
        {[10, 20, 30, 40, 50].map((pageSize) => (
          <option key={pageSize} value={pageSize}>
            Show {pageSize}
          </option>
        ))}
      </select>
    </div>
  )
}
```

### Server-Side Pagination

```typescript
function ServerPaginatedTable() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  // Fetch data with pagination parameters
  const { data: queryData, isLoading } = useQuery({
    queryKey: ['users', pagination.pageIndex, pagination.pageSize],
    queryFn: () =>
      fetchUsers({
        page: pagination.pageIndex,
        limit: pagination.pageSize,
      }),
  })
  const table = useReactTable({
    data: queryData?.users ?? [],
    columns,
    pageCount: queryData?.pageCount ?? -1, // Total page count from server
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true, // Disable client-side pagination
  })
  if (isLoading) return <div>Loading...</div>
  return (
    <div>
      {/* Render table */}
      <PaginationControls table={table} />
    </div>
  )
}
```

---

## Navigation

[← Part 9](./09-filtering.md) | [Part 11 →](./11-row-selection.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-why-tanstack-table-for-sovrium.md) | [Part 4](./04-core-concepts.md) | [Part 5](./05-installation.md) | [Part 6](./06-basic-table-setup.md) | [Part 7](./07-column-definitions.md) | [Part 8](./08-sorting.md) | [Part 9](./09-filtering.md) | **Part 10** | [Part 11](./11-row-selection.md) | [Part 12](./12-column-visibility.md) | [Part 13](./13-integration-with-tanstack-query.md) | [Part 14](./14-integration-with-effectts.md) | [Part 15](./15-styling-with-tailwind-css.md) | [Part 16](./16-reusable-data-table-component.md) | [Part 17](./17-performance-optimization.md) | [Part 18](./18-testing.md) | [Part 19](./19-best-practices.md) | [Part 20](./20-common-pitfalls.md) | [Part 21](./21-when-to-use-tanstack-table.md) | [Part 22](./22-full-stack-integration-with-layered-architecture.md) | [Part 23](./23-references.md)
