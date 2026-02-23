# TanStack Table - Headless Table Library

> **Note**: This is part 8 of the split documentation. See navigation links below.

## Sorting

### Enabling Sorting

```typescript
import { useReactTable, getSortedRowModel, SortingState } from '@tanstack/react-table'
function SortableTable() {
  const [sorting, setSorting] = useState<SortingState>([])
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

### Sortable Headers

```typescript
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
```

### Multi-Column Sorting

Users can sort multiple columns by holding Shift while clicking headers:

```typescript
const table = useReactTable({
  data,
  columns,
  state: { sorting },
  onSortingChange: setSorting,
  enableMultiSort: true, // Enable multi-sorting (default)
  maxMultiSortColCount: 3, // Limit to 3 columns
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
})
```

### Custom Sort Functions

```typescript
const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    sortingFn: 'alphanumeric', // Built-in: alphanumeric, text, datetime, basic
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    sortingFn: (rowA, rowB, columnId) => {
      const dateA = new Date(rowA.getValue(columnId)).getTime()
      const dateB = new Date(rowB.getValue(columnId)).getTime()
      return dateA < dateB ? -1 : dateA > dateB ? 1 : 0
    },
  },
]
```

### Server-Side Sorting

```typescript
const [sorting, setSorting] = useState<SortingState>([])
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

---

## Navigation

[← Part 7](./07-column-definitions.md) | [Part 9 →](./09-filtering.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-why-tanstack-table-for-sovrium.md) | [Part 4](./04-core-concepts.md) | [Part 5](./05-installation.md) | [Part 6](./06-basic-table-setup.md) | [Part 7](./07-column-definitions.md) | **Part 8** | [Part 9](./09-filtering.md) | [Part 10](./10-pagination.md) | [Part 11](./11-row-selection.md) | [Part 12](./12-column-visibility.md) | [Part 13](./13-integration-with-tanstack-query.md) | [Part 14](./14-integration-with-effectts.md) | [Part 15](./15-styling-with-tailwind-css.md) | [Part 16](./16-reusable-data-table-component.md) | [Part 17](./17-performance-optimization.md) | [Part 18](./18-testing.md) | [Part 19](./19-best-practices.md) | [Part 20](./20-common-pitfalls.md) | [Part 21](./21-when-to-use-tanstack-table.md) | [Part 22](./22-full-stack-integration-with-layered-architecture.md) | [Part 23](./23-references.md)
