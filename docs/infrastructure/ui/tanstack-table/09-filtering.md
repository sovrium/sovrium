# TanStack Table - Headless Table Library

> **Note**: This is part 9 of the split documentation. See navigation links below.

## Filtering

### Column Filtering

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
  return <>{/* Render table */}</>
}
```

### Column Filter Input

```typescript
function ColumnFilter({ column }: { column: Column<any> }) {
  const filterValue = column.getFilterValue()
  return (
    <input
      type="text"
      value={(filterValue ?? '') as string}
      onChange={(e) => column.setFilterValue(e.target.value)}
      placeholder={`Filter ${column.id}...`}
      className="w-full rounded border px-2 py-1"
    />
  )
}
// Usage in header
const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <div>
        <div>Name</div>
        <ColumnFilter column={column} />
      </div>
    ),
  },
]
```

### Global Filtering

```typescript
import { useReactTable, getFilteredRowModel } from '@tanstack/react-table'
function GlobalFilterTable() {
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
    globalFilterFn: 'includesString', // Built-in: includesString, includesStringSensitive, equalsString, arrIncludes, arrIncludesAll, arrIncludesSome, equals, weakEquals, inNumberRange
  })
  return (
    <div>
      <input
        type="text"
        value={globalFilter ?? ''}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder="Search all columns..."
        className="mb-4 w-full rounded border px-3 py-2"
      />
      {/* Render table */}
    </div>
  )
}
```

### Custom Filter Functions

```typescript
const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'status',
    header: 'Status',
    filterFn: (row, columnId, filterValue) => {
      // Custom filter logic
      const status = row.getValue(columnId)
      return filterValue.includes(status)
    },
  },
]
```

### Fuzzy Search

```typescript
import { rankItem } from '@tanstack/match-sorter-utils'
import { FilterFn } from '@tanstack/react-table'
const fuzzyFilter: FilterFn<any> = (row, columnId, value, addMeta) => {
  // Rank the item
  const itemRank = rankItem(row.getValue(columnId), value)
  // Store the ranking info
  addMeta(itemRank)
  // Return if the item should be filtered in/out
  return itemRank.passed
}
const table = useReactTable({
  data,
  columns,
  filterFns: {
    fuzzy: fuzzyFilter,
  },
  globalFilterFn: 'fuzzy', // Use fuzzy filter for global search
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
})
```

### Debounced Filtering

```typescript
import { useEffect, useState } from 'react'
function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: {
  value: string | number
  onChange: (value: string | number) => void
  debounce?: number
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
  const [value, setValue] = useState(initialValue)
  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])
  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value)
    }, debounce)
    return () => clearTimeout(timeout)
  }, [value, debounce, onChange])
  return <input {...props} value={value} onChange={(e) => setValue(e.target.value)} />
}
// Usage
function GlobalFilter({ table }: { table: Table<User> }) {
  return (
    <DebouncedInput
      value={table.getState().globalFilter ?? ''}
      onChange={(value) => table.setGlobalFilter(String(value))}
      placeholder="Search..."
      className="w-full rounded border px-3 py-2"
    />
  )
}
```

---

## Navigation

[← Part 8](./08-sorting.md) | [Part 10 →](./10-pagination.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-why-tanstack-table-for-sovrium.md) | [Part 4](./04-core-concepts.md) | [Part 5](./05-installation.md) | [Part 6](./06-basic-table-setup.md) | [Part 7](./07-column-definitions.md) | [Part 8](./08-sorting.md) | **Part 9** | [Part 10](./10-pagination.md) | [Part 11](./11-row-selection.md) | [Part 12](./12-column-visibility.md) | [Part 13](./13-integration-with-tanstack-query.md) | [Part 14](./14-integration-with-effectts.md) | [Part 15](./15-styling-with-tailwind-css.md) | [Part 16](./16-reusable-data-table-component.md) | [Part 17](./17-performance-optimization.md) | [Part 18](./18-testing.md) | [Part 19](./19-best-practices.md) | [Part 20](./20-common-pitfalls.md) | [Part 21](./21-when-to-use-tanstack-table.md) | [Part 22](./22-full-stack-integration-with-layered-architecture.md) | [Part 23](./23-references.md)
