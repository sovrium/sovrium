# TanStack Table - Headless Table Library

> **Note**: This is part 18 of the split documentation. See navigation links below.

## Testing

### Testing Table Components

```typescript
import { test, expect, describe } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { UserTable } from './UserTable'
describe('UserTable', () => {
  const mockUsers = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ]
  test('renders table with user data', () => {
    const html = renderToString(<UserTable users={mockUsers} />)
    expect(html).toContain('Alice')
    expect(html).toContain('alice@example.com')
    expect(html).toContain('Bob')
    expect(html).toContain('bob@example.com')
  })
  test('renders empty state when no users', () => {
    const html = renderToString(<UserTable users={[]} />)
    expect(html).toContain('No data')
  })
})
```

### Testing Sorting Logic

```typescript
test('sorts users by name', () => {
  const users = [
    { id: 1, name: 'Charlie', email: 'charlie@example.com' },
    { id: 2, name: 'Alice', email: 'alice@example.com' },
    { id: 3, name: 'Bob', email: 'bob@example.com' },
  ]
  const sorted = users.sort((a, b) => a.name.localeCompare(b.name))
  expect(sorted[0].name).toBe('Alice')
  expect(sorted[1].name).toBe('Bob')
  expect(sorted[2].name).toBe('Charlie')
})
```

---

## Navigation

[← Part 17](./17-performance-optimization.md) | [Part 19 →](./19-best-practices.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-why-tanstack-table-for-sovrium.md) | [Part 4](./04-core-concepts.md) | [Part 5](./05-installation.md) | [Part 6](./06-basic-table-setup.md) | [Part 7](./07-column-definitions.md) | [Part 8](./08-sorting.md) | [Part 9](./09-filtering.md) | [Part 10](./10-pagination.md) | [Part 11](./11-row-selection.md) | [Part 12](./12-column-visibility.md) | [Part 13](./13-integration-with-tanstack-query.md) | [Part 14](./14-integration-with-effectts.md) | [Part 15](./15-styling-with-tailwind-css.md) | [Part 16](./16-reusable-data-table-component.md) | [Part 17](./17-performance-optimization.md) | **Part 18** | [Part 19](./19-best-practices.md) | [Part 20](./20-common-pitfalls.md) | [Part 21](./21-when-to-use-tanstack-table.md) | [Part 22](./22-full-stack-integration-with-layered-architecture.md) | [Part 23](./23-references.md)
