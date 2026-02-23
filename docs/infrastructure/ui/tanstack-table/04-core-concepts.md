# TanStack Table - Headless Table Library

> **Note**: This is part 4 of the split documentation. See navigation links below.

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
import { useReactTable } from '@tanstack/react-table'
const table = useReactTable({
  data,
  columns,
  // Feature options
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
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
    header: 'Name', // Header text
    cell: (info) => info.getValue(), // Custom cell rendering
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

### 5. Row Model

TanStack Table uses "row models" to process data:

- **Core Row Model**: Base rows from your data (always required)
- **Sorted Row Model**: Rows after sorting
- **Filtered Row Model**: Rows after filtering
- **Paginated Row Model**: Current page rows
- **Grouped Row Model**: Rows after grouping

```typescript
import {
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
} from '@tanstack/react-table'
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(), // Required
  getSortedRowModel: getSortedRowModel(), // Enable sorting
  getFilteredRowModel: getFilteredRowModel(), // Enable filtering
  getPaginationRowModel: getPaginationRowModel(), // Enable pagination
})
```

---

## Navigation

[← Part 3](./03-why-tanstack-table-for-sovrium.md) | [Part 5 →](./05-installation.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-why-tanstack-table-for-sovrium.md) | **Part 4** | [Part 5](./05-installation.md) | [Part 6](./06-basic-table-setup.md) | [Part 7](./07-column-definitions.md) | [Part 8](./08-sorting.md) | [Part 9](./09-filtering.md) | [Part 10](./10-pagination.md) | [Part 11](./11-row-selection.md) | [Part 12](./12-column-visibility.md) | [Part 13](./13-integration-with-tanstack-query.md) | [Part 14](./14-integration-with-effectts.md) | [Part 15](./15-styling-with-tailwind-css.md) | [Part 16](./16-reusable-data-table-component.md) | [Part 17](./17-performance-optimization.md) | [Part 18](./18-testing.md) | [Part 19](./19-best-practices.md) | [Part 20](./20-common-pitfalls.md) | [Part 21](./21-when-to-use-tanstack-table.md) | [Part 22](./22-full-stack-integration-with-layered-architecture.md) | [Part 23](./23-references.md)
