# TanStack Table - Headless Table Library

> **Note**: This is part 7 of the split documentation. See navigation links below.

## Column Definitions

### Column Types

**1. Accessor Columns** - Columns with underlying data:

```typescript
// Using accessorKey (string path)
{
  accessorKey: 'email',
  header: 'Email',
}
// Using accessorFn (custom function)
{
  accessorFn: (row) => `${row.firstName} ${row.lastName}`,
  id: 'fullName',
  header: 'Full Name',
}
```

**2. Display Columns** - Columns without data (actions, checkboxes):

```typescript
{
  id: 'actions',
  header: 'Actions',
  cell: (props) => (
    <button onClick={() => deleteUser(props.row.original)}>
      Delete
    </button>
  ),
}
```

**3. Grouping Columns** - Organize other columns:

```typescript
{
  id: 'name',
  header: 'Name',
  columns: [
    {
      accessorKey: 'firstName',
      header: 'First Name',
    },
    {
      accessorKey: 'lastName',
      header: 'Last Name',
    },
  ],
}
```

### Column Helper

Type-safe column creation:

```typescript
import { createColumnHelper } from '@tanstack/react-table'
const columnHelper = createColumnHelper<User>()
const columns = [
  // Accessor column
  columnHelper.accessor('name', {
    header: 'Name',
    cell: (info) => info.getValue(),
  }),
  // Accessor with function
  columnHelper.accessor((row) => row.email.toLowerCase(), {
    id: 'email',
    header: 'Email',
  }),
  // Display column
  columnHelper.display({
    id: 'actions',
    header: 'Actions',
    cell: (props) => <ActionsMenu row={props.row} />,
  }),
  // Grouping column
  columnHelper.group({
    id: 'info',
    header: 'User Information',
    columns: [
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('email', { header: 'Email' }),
    ],
  }),
]
```

### Custom Cell Rendering

```typescript
const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'status',
    header: 'Status',
    cell: (info) => {
      const status = info.getValue<'active' | 'inactive'>()
      return (
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            status === 'active'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {status}
        </span>
      )
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: (info) => {
      const date = info.getValue<Date>()
      return new Intl.DateTimeFormat('en-US').format(date)
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: (props) => {
      const user = props.row.original
      return (
        <div className="flex gap-2">
          <button
            onClick={() => editUser(user)}
            className="text-blue-600 hover:text-blue-700"
          >
            Edit
          </button>
          <button
            onClick={() => deleteUser(user)}
            className="text-red-600 hover:text-red-700"
          >
            Delete
          </button>
        </div>
      )
    },
  },
]
```

### Custom Header Rendering

```typescript
const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <button
        onClick={() => column.toggleSorting()}
        className="flex items-center gap-2"
      >
        Name
        {column.getIsSorted() === 'asc' ? <ChevronUp /> : <ChevronDown />}
      </button>
    ),
  },
  {
    accessorKey: 'email',
    header: () => (
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4" />
        <span>Email Address</span>
      </div>
    ),
  },
]
```

---

## Navigation

[← Part 6](./06-basic-table-setup.md) | [Part 8 →](./08-sorting.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-why-tanstack-table-for-sovrium.md) | [Part 4](./04-core-concepts.md) | [Part 5](./05-installation.md) | [Part 6](./06-basic-table-setup.md) | **Part 7** | [Part 8](./08-sorting.md) | [Part 9](./09-filtering.md) | [Part 10](./10-pagination.md) | [Part 11](./11-row-selection.md) | [Part 12](./12-column-visibility.md) | [Part 13](./13-integration-with-tanstack-query.md) | [Part 14](./14-integration-with-effectts.md) | [Part 15](./15-styling-with-tailwind-css.md) | [Part 16](./16-reusable-data-table-component.md) | [Part 17](./17-performance-optimization.md) | [Part 18](./18-testing.md) | [Part 19](./19-best-practices.md) | [Part 20](./20-common-pitfalls.md) | [Part 21](./21-when-to-use-tanstack-table.md) | [Part 22](./22-full-stack-integration-with-layered-architecture.md) | [Part 23](./23-references.md)
