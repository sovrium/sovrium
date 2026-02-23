# TanStack Table - Headless Table Library

> **Note**: This is part 15 of the split documentation. See navigation links below.

## Styling with Tailwind CSS

### Basic Table Styles

```typescript
function StyledTable() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 shadow">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-gray-50 transition-colors"
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="whitespace-nowrap px-6 py-4 text-sm text-gray-900"
                >
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

### Zebra Striping

```typescript
{
  table.getRowModel().rows.map((row, index) => (
    <tr
      key={row.id}
      className={`transition-colors hover:bg-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
    >
      {/* cells */}
    </tr>
  ))
}
```

### Sticky Headers

```typescript
<div className="overflow-auto max-h-96">
  <table className="min-w-full">
    <thead className="sticky top-0 bg-gray-50 z-10">
      {/* headers */}
    </thead>
    <tbody>{/* rows */}</tbody>
  </table>
</div>
```

### Responsive Tables

```typescript
// Horizontal scroll on mobile
<div className="overflow-x-auto">
  <table className="min-w-full">
    {/* table content */}
  </table>
</div>
// Card layout on mobile, table on desktop
<div className="md:hidden">
  {/* Card layout for mobile */}
  {table.getRowModel().rows.map((row) => (
    <div key={row.id} className="mb-4 rounded border p-4">
      {row.getVisibleCells().map((cell) => (
        <div key={cell.id} className="mb-2">
          <span className="font-medium">{cell.column.id}: </span>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </div>
      ))}
    </div>
  ))}
</div>
<div className="hidden md:block">
  {/* Standard table for desktop */}
  <table className="min-w-full">
    {/* table content */}
  </table>
</div>
```

### Loading States

```typescript
function TableWithLoading({ isLoading }: { isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="mb-4 h-10 bg-gray-200 rounded"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="mb-2 h-16 bg-gray-100 rounded"></div>
        ))}
      </div>
    )
  }
  return <>{/* Render table */}</>
}
```

### Empty States

```typescript
function TableWithEmptyState() {
  const rows = table.getRowModel().rows
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <svg
          className="h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No data</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by adding a new item.
        </p>
      </div>
    )
  }
  return <>{/* Render table */}</>
}
```

---

## Navigation

[← Part 14](./14-integration-with-effectts.md) | [Part 16 →](./16-reusable-data-table-component.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-why-tanstack-table-for-sovrium.md) | [Part 4](./04-core-concepts.md) | [Part 5](./05-installation.md) | [Part 6](./06-basic-table-setup.md) | [Part 7](./07-column-definitions.md) | [Part 8](./08-sorting.md) | [Part 9](./09-filtering.md) | [Part 10](./10-pagination.md) | [Part 11](./11-row-selection.md) | [Part 12](./12-column-visibility.md) | [Part 13](./13-integration-with-tanstack-query.md) | [Part 14](./14-integration-with-effectts.md) | **Part 15** | [Part 16](./16-reusable-data-table-component.md) | [Part 17](./17-performance-optimization.md) | [Part 18](./18-testing.md) | [Part 19](./19-best-practices.md) | [Part 20](./20-common-pitfalls.md) | [Part 21](./21-when-to-use-tanstack-table.md) | [Part 22](./22-full-stack-integration-with-layered-architecture.md) | [Part 23](./23-references.md)
