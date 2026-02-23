# TanStack Table - Headless Table Library

> **Note**: This is part 11 of the split documentation. See navigation links below.

## Row Selection

### Enabling Row Selection

```typescript
import { useReactTable, RowSelectionState } from '@tanstack/react-table'
function SelectableTable() {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
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
  return <>{/* Render table */}</>
}
```

### Checkbox Column

```typescript
const columns: ColumnDef<User>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllRowsSelected()}
        indeterminate={table.getIsSomeRowsSelected()}
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
```

### Using Selected Rows

```typescript
function TableWithActions() {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const table = useReactTable({
    data,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
  })
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const handleDeleteSelected = () => {
    const selectedUsers = selectedRows.map((row) => row.original)
    console.log('Deleting:', selectedUsers)
    // Delete users via API
  }
  return (
    <div>
      {selectedRows.length > 0 && (
        <div className="mb-4">
          <span>{selectedRows.length} row(s) selected</span>
          <button
            onClick={handleDeleteSelected}
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

### Conditional Row Selection

```typescript
const table = useReactTable({
  data,
  columns,
  enableRowSelection: (row) => row.original.status === 'active', // Only active users can be selected
  getCoreRowModel: getCoreRowModel(),
})
```

### Single Row Selection

```typescript
const table = useReactTable({
  data,
  columns,
  enableMultiRowSelection: false, // Only one row at a time
  getCoreRowModel: getCoreRowModel(),
})
```

---

## Navigation

[← Part 10](./10-pagination.md) | [Part 12 →](./12-column-visibility.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-why-tanstack-table-for-sovrium.md) | [Part 4](./04-core-concepts.md) | [Part 5](./05-installation.md) | [Part 6](./06-basic-table-setup.md) | [Part 7](./07-column-definitions.md) | [Part 8](./08-sorting.md) | [Part 9](./09-filtering.md) | [Part 10](./10-pagination.md) | **Part 11** | [Part 12](./12-column-visibility.md) | [Part 13](./13-integration-with-tanstack-query.md) | [Part 14](./14-integration-with-effectts.md) | [Part 15](./15-styling-with-tailwind-css.md) | [Part 16](./16-reusable-data-table-component.md) | [Part 17](./17-performance-optimization.md) | [Part 18](./18-testing.md) | [Part 19](./19-best-practices.md) | [Part 20](./20-common-pitfalls.md) | [Part 21](./21-when-to-use-tanstack-table.md) | [Part 22](./22-full-stack-integration-with-layered-architecture.md) | [Part 23](./23-references.md)
