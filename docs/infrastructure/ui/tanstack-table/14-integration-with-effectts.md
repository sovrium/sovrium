# TanStack Table - Headless Table Library

> **Note**: This is part 14 of the split documentation. See navigation links below.

## Integration with Effect.ts

### Data Transformation with Effect

```typescript
import { Effect } from 'effect'
interface RawUser {
  id: number
  first_name: string
  last_name: string
  email_address: string
}
interface User {
  id: number
  name: string
  email: string
}
// Pure transformation function
function transformUser(raw: RawUser): User {
  return {
    id: raw.id,
    name: `${raw.first_name} ${raw.last_name}`,
    email: raw.email_address.toLowerCase(),
  }
}
function EffectTable() {
  const [data, setData] = useState<User[]>([])
  useEffect(() => {
    const program = Effect.gen(function* () {
      const response = yield* fetchRawUsers()
      const transformed = response.map(transformUser)
      return transformed
    })
    Effect.runPromise(program)
      .then(setData)
      .catch(console.error)
  }, [])
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })
  return <>{/* Render table */}</>
}
```

### Table Actions with Effect

```typescript
import { Effect } from 'effect'
class UserService extends Context.Tag('UserService')<
  UserService,
  {
    readonly delete: (id: number) => Effect.Effect<void, DeleteError>
    readonly bulkDelete: (ids: number[]) => Effect.Effect<void, DeleteError>
  }
>() {}
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
      // Refetch data or update local state
      setRowSelection({})
    })
  }
  return (
    <div>
      {Object.keys(rowSelection).length > 0 && (
        <button
          onClick={handleDeleteSelected}
          className="mb-4 rounded bg-red-600 px-4 py-2 text-white"
        >
          Delete {Object.keys(rowSelection).length} Selected
        </button>
      )}
      {/* Render table */}
    </div>
  )
}
```

---

## Navigation

[← Part 13](./13-integration-with-tanstack-query.md) | [Part 15 →](./15-styling-with-tailwind-css.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-why-tanstack-table-for-sovrium.md) | [Part 4](./04-core-concepts.md) | [Part 5](./05-installation.md) | [Part 6](./06-basic-table-setup.md) | [Part 7](./07-column-definitions.md) | [Part 8](./08-sorting.md) | [Part 9](./09-filtering.md) | [Part 10](./10-pagination.md) | [Part 11](./11-row-selection.md) | [Part 12](./12-column-visibility.md) | [Part 13](./13-integration-with-tanstack-query.md) | **Part 14** | [Part 15](./15-styling-with-tailwind-css.md) | [Part 16](./16-reusable-data-table-component.md) | [Part 17](./17-performance-optimization.md) | [Part 18](./18-testing.md) | [Part 19](./19-best-practices.md) | [Part 20](./20-common-pitfalls.md) | [Part 21](./21-when-to-use-tanstack-table.md) | [Part 22](./22-full-stack-integration-with-layered-architecture.md) | [Part 23](./23-references.md)
