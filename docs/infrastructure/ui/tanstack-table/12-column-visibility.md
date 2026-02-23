# TanStack Table - Headless Table Library

> **Note**: This is part 12 of the split documentation. See navigation links below.

## Column Visibility

### Toggling Column Visibility

```typescript
import { ColumnVisibilityState } from '@tanstack/react-table'
function TableWithColumnVisibility() {
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({})
  const table = useReactTable({
    data,
    columns,
    state: {
      columnVisibility,
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <div>
      <div className="mb-4">
        <label>Toggle Columns:</label>
        {table.getAllLeafColumns().map((column) => (
          <label key={column.id} className="ml-4">
            <input
              type="checkbox"
              checked={column.getIsVisible()}
              onChange={column.getToggleVisibilityHandler()}
            />
            {column.id}
          </label>
        ))}
      </div>
      {/* Render table */}
    </div>
  )
}
```

### Prevent Column Hiding

```typescript
const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    enableHiding: false, // Cannot be hidden
  },
  {
    accessorKey: 'name',
    header: 'Name',
    // Can be hidden (default)
  },
]
```

---

## Navigation

[← Part 11](./11-row-selection.md) | [Part 13 →](./13-integration-with-tanstack-query.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-why-tanstack-table-for-sovrium.md) | [Part 4](./04-core-concepts.md) | [Part 5](./05-installation.md) | [Part 6](./06-basic-table-setup.md) | [Part 7](./07-column-definitions.md) | [Part 8](./08-sorting.md) | [Part 9](./09-filtering.md) | [Part 10](./10-pagination.md) | [Part 11](./11-row-selection.md) | **Part 12** | [Part 13](./13-integration-with-tanstack-query.md) | [Part 14](./14-integration-with-effectts.md) | [Part 15](./15-styling-with-tailwind-css.md) | [Part 16](./16-reusable-data-table-component.md) | [Part 17](./17-performance-optimization.md) | [Part 18](./18-testing.md) | [Part 19](./19-best-practices.md) | [Part 20](./20-common-pitfalls.md) | [Part 21](./21-when-to-use-tanstack-table.md) | [Part 22](./22-full-stack-integration-with-layered-architecture.md) | [Part 23](./23-references.md)
