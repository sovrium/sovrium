# TanStack Table - Headless Table Library

> **Note**: This is part 13 of the split documentation. See navigation links below.

## Integration with TanStack Query

### Server-Side Data Fetching

```typescript
import { useQuery } from '@tanstack/react-query'
import { useReactTable } from '@tanstack/react-table'
interface UsersResponse {
  users: User[]
  totalCount: number
  pageCount: number
}
function ServerTable() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  // Fetch data with TanStack Query
  const { data, isLoading, isError } = useQuery<UsersResponse>({
    queryKey: ['users', pagination, sorting, columnFilters],
    queryFn: async () => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: pagination.pageIndex,
          limit: pagination.pageSize,
          sortBy: sorting[0]?.id,
          sortOrder: sorting[0]?.desc ? 'desc' : 'asc',
          filters: columnFilters,
        }),
      })
      return response.json()
    },
    keepPreviousData: true, // Keep previous data while fetching
  })
  const table = useReactTable({
    data: data?.users ?? [],
    columns,
    pageCount: data?.pageCount ?? -1,
    state: {
      pagination,
      sorting,
      columnFilters,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  })
  if (isLoading) {
    return <TableSkeleton />
  }
  if (isError) {
    return <div className="text-red-600">Error loading data</div>
  }
  return (
    <div>
      {/* Render table */}
      <div className="mt-2 text-sm text-gray-600">
        Showing {table.getRowModel().rows.length} of {data?.totalCount} results
      </div>
    </div>
  )
}
```

### Optimistic Updates

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
function TableWithMutations() {
  const queryClient = useQueryClient()
  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) => fetch(`/api/users/${userId}`, { method: 'DELETE' }),
    onMutate: async (userId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['users'] })
      // Snapshot previous value
      const previousUsers = queryClient.getQueryData(['users'])
      // Optimistically update
      queryClient.setQueryData<UsersResponse>(['users'], (old) => ({
        ...old!,
        users: old!.users.filter((user) => user.id !== userId),
      }))
      return { previousUsers }
    },
    onError: (err, userId, context) => {
      // Rollback on error
      queryClient.setQueryData(['users'], context?.previousUsers)
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
  const columns: ColumnDef<User>[] = [
    // ... other columns
    {
      id: 'actions',
      cell: ({ row }) => (
        <button
          onClick={() => deleteUserMutation.mutate(row.original.id)}
          disabled={deleteUserMutation.isLoading}
          className="text-red-600 hover:text-red-700"
        >
          {deleteUserMutation.isLoading ? 'Deleting...' : 'Delete'}
        </button>
      ),
    },
  ]
  // ... table setup
}
```

---

## Navigation

[← Part 12](./12-column-visibility.md) | [Part 14 →](./14-integration-with-effectts.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-why-tanstack-table-for-sovrium.md) | [Part 4](./04-core-concepts.md) | [Part 5](./05-installation.md) | [Part 6](./06-basic-table-setup.md) | [Part 7](./07-column-definitions.md) | [Part 8](./08-sorting.md) | [Part 9](./09-filtering.md) | [Part 10](./10-pagination.md) | [Part 11](./11-row-selection.md) | [Part 12](./12-column-visibility.md) | **Part 13** | [Part 14](./14-integration-with-effectts.md) | [Part 15](./15-styling-with-tailwind-css.md) | [Part 16](./16-reusable-data-table-component.md) | [Part 17](./17-performance-optimization.md) | [Part 18](./18-testing.md) | [Part 19](./19-best-practices.md) | [Part 20](./20-common-pitfalls.md) | [Part 21](./21-when-to-use-tanstack-table.md) | [Part 22](./22-full-stack-integration-with-layered-architecture.md) | [Part 23](./23-references.md)
