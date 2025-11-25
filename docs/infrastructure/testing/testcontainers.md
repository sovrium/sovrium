# Testcontainers - Docker-Based Test Database Isolation

## Overview

**Version**: 11.8.1 (`@testcontainers/postgresql`)
**Purpose**: Provides lightweight, disposable PostgreSQL database instances for E2E testing using Docker containers. Ensures complete test isolation with real database behavior without affecting local development databases.

## What Testcontainers Provides

1. **Real Database Testing** - Tests run against actual PostgreSQL (not mocks or in-memory DBs)
2. **Test Isolation** - Each test gets a fresh database copy from a pre-migrated template
3. **Docker-Based** - Automatically manages Docker containers (start/stop/cleanup)
4. **Zero Configuration** - Works with any Docker-compatible runtime (Colima, Docker Desktop, Podman)
5. **Fast Cloning** - Template-based approach: run migrations once, duplicate database per test
6. **Parallel Safe** - Tests can run in parallel with isolated databases
7. **Auto-Cleanup** - Containers and databases are automatically cleaned up after tests
8. **CI/CD Ready** - Works in GitHub Actions and other CI environments

## Why Testcontainers?

### The Problem Without Testcontainers

**Option 1: Shared test database**

- ❌ Tests interfere with each other (race conditions)
- ❌ Cannot run tests in parallel
- ❌ Test failures leave dirty data
- ❌ Hard to reproduce failures

**Option 2: In-memory database (SQLite)**

- ❌ Different SQL dialect than production (PostgreSQL)
- ❌ Missing PostgreSQL-specific features (arrays, JSONB, etc.)
- ❌ Doesn't catch database-specific bugs

**Option 3: Mock database calls**

- ❌ Not testing real database behavior
- ❌ Misses SQL syntax errors
- ❌ Doesn't validate migrations

### The Solution: Testcontainers + Template Pattern

✅ **Real PostgreSQL** - Same database as production
✅ **Isolated** - Each test gets fresh database from template
✅ **Fast** - Migrations run once, then duplicate database (10-50ms per test)
✅ **Parallel** - Tests run concurrently without conflicts
✅ **Reliable** - Auto-cleanup prevents leftover containers/data

## Architecture

### Template-Based Database Pattern

```
Global Setup (Once per test run)
├── Start PostgreSQL container (postgres:16-alpine)
├── Create template database with all migrations
└── Store connection URL in process.env

Test Fixture (Per test)
├── Duplicate template database → test_<test-name>_<timestamp>
├── Start server with DATABASE_URL pointing to test database
├── Run test against isolated database
└── Cleanup: Drop test database + stop server

Global Teardown (Once per test run)
└── Stop PostgreSQL container
```

### Why Template Pattern?

**Without template** (naive approach):

- Each test: Start container → Run migrations → Test → Stop container
- 20 tests × 5 seconds = 100 seconds

**With template** (current approach):

- Global setup: Start container → Run migrations (once) = 5 seconds
- Each test: Duplicate database → Test = 50ms
- 20 tests × 0.05 seconds + 5 seconds = 6 seconds

**Result**: 16x faster test execution

## Integration Architecture

### File Structure

```
specs/
├── global-setup.ts            # Playwright global setup
│   ├── Start PostgreSQL container
│   ├── Create template database with migrations
│   └── Export teardown function
├── fixtures.ts                # Playwright fixtures
│   ├── startServerWithSchema  # Start server with isolated database
│   ├── executeQuery           # Run raw SQL queries
│   └── generateStaticSite     # Static generation (no database)
├── database-utils.ts          # Database template management
│   ├── DatabaseTemplateManager
│   ├── createTemplate()       # Create template with migrations
│   ├── duplicateTemplate()    # Clone database for test
│   └── dropTestDatabase()     # Cleanup after test
└── docker-utils.ts            # Docker runtime detection
    ├── ensureDockerRunning()  # Auto-install/start Docker
    └── Colima integration     # macOS Docker alternative
```

### Global Setup (specs/global-setup.ts)

Runs once before all tests:

```typescript
export default async function globalSetup() {
  // 1. Ensure Docker is running (auto-install Colima on macOS if needed)
  await ensureDockerRunning()

  // 2. Configure Testcontainers for Colima (if using Colima)
  const currentContext = execSync('docker context show').trim()
  if (currentContext === 'colima') {
    process.env.DOCKER_HOST = `unix://${process.env.HOME}/.colima/docker.sock`
    process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = '/var/run/docker.sock'
  }

  // 3. Start PostgreSQL container
  const { PostgreSqlContainer } = await import('@testcontainers/postgresql')
  const container = await new PostgreSqlContainer('postgres:16-alpine').start()

  // 4. Store connection URL for test workers
  const connectionUrl = container.getConnectionUri()
  process.env.TEST_DATABASE_CONTAINER_URL = connectionUrl

  // 5. Create template database with all migrations applied
  const templateManager = new DatabaseTemplateManager(connectionUrl)
  await templateManager.createTemplate()

  // 6. Return teardown function (called after all tests)
  return async () => {
    await templateManager.cleanup()
    await container.stop()
  }
}
```

### Test Fixture (specs/fixtures.ts)

Provides isolated database per test:

```typescript
export const test = base.extend<ServerFixtures>({
  startServerWithSchema: async ({ page }, use, testInfo) => {
    await use(async (appSchema: object, options?: { useDatabase?: boolean }) => {
      // 1. Get template manager (initialized in global setup)
      const templateManager = await getTemplateManager()

      // 2. Duplicate template database for this test
      const testDbName = generateTestDatabaseName(testInfo)
      const databaseUrl = await templateManager.duplicateTemplate(testDbName)

      // 3. Start server with test database
      const server = await startCliServer(appSchema, databaseUrl)

      // 4. Configure page with server URL
      page._browserContext._options.baseURL = server.url
    })

    // Cleanup: Drop test database after test completes
    await templateManager.dropTestDatabase(testDbName)
  },
})
```

## Docker Runtime Compatibility

### Supported Runtimes

| Runtime        | Platform | Auto-Install | Status                               |
| -------------- | -------- | ------------ | ------------------------------------ |
| **Colima**     | macOS    | ✅ Yes       | ✅ Recommended (lightweight, free)   |
| Docker Desktop | All      | ❌ No        | ✅ Supported (if already installed)  |
| Docker Engine  | Linux    | ❌ No        | ✅ Supported                         |
| Podman         | All      | ❌ No        | ⚠️ Experimental (may require config) |

### Colima Integration (macOS)

**Why Colima?**

- Free and open source (vs Docker Desktop licensing)
- Lightweight (uses minimal resources)
- Zero configuration required
- Auto-installed by specs/docker-utils.ts

**Auto-Installation Flow**:

```bash
# specs/docker-utils.ts automatically:
1. Detects if Docker is running
2. If not found on macOS: Installs Colima via Homebrew
3. Starts Colima with PostgreSQL-compatible config
4. Configures Testcontainers socket paths
```

**Manual Colima Setup** (optional):

```bash
# Install Colima (macOS)
brew install colima

# Start Colima
colima start

# Verify
docker ps
```

## Usage in Tests

### Basic Test with Database

```typescript
import { test, expect } from './fixtures'

test('should create and retrieve user from database', async ({ startServerWithSchema, page }) => {
  // Start server with database enabled (default)
  await startServerWithSchema({
    name: 'Test App',
    pages: [{ name: 'home', path: '/', meta: { title: 'Home' }, sections: [] }],
  })

  // Navigate to page
  await page.goto('/')

  // Test creates data in isolated database
  await page.getByRole('button', { name: 'Create User' }).click()
  await page.getByLabel('Name').fill('John Doe')
  await page.getByRole('button', { name: 'Submit' }).click()

  // Assertions
  await expect(page.getByText('John Doe')).toBeVisible()
})
```

### Test with Direct SQL Queries

```typescript
import { test, expect } from './fixtures'

test('should verify database state directly', async ({
  startServerWithSchema,
  executeQuery,
  page,
}) => {
  await startServerWithSchema({
    name: 'Test App',
    pages: [{ name: 'home', path: '/', meta: { title: 'Home' }, sections: [] }],
  })

  // Interact with UI
  await page.goto('/')
  await page.getByRole('button', { name: 'Create User' }).click()

  // Verify database state directly
  const result = await executeQuery('SELECT * FROM users WHERE name = $1', ['John Doe'])
  expect(result.rowCount).toBe(1)
  expect(result.rows[0].name).toBe('John Doe')
})
```

### Test Without Database

```typescript
import { test, expect } from './fixtures'

test('static page rendering without database', async ({ startServerWithSchema, page }) => {
  // Disable database for static content tests
  await startServerWithSchema(
    {
      name: 'Test App',
      pages: [{ name: 'home', path: '/', meta: { title: 'Home' }, sections: [] }],
    },
    { useDatabase: false }
  )

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Home')
})
```

## Configuration

### PostgreSQL Version

```typescript
// specs/global-setup.ts
const container = await new PostgreSqlContainer('postgres:16-alpine').start()
```

**Why postgres:16-alpine?**

- PostgreSQL 16: Latest stable version (matches production)
- Alpine: Minimal image size (50MB vs 200MB for debian)
- Fast startup time (1-2 seconds)

**To use different version**:

```typescript
new PostgreSqlContainer('postgres:15-alpine') // PostgreSQL 15
new PostgreSqlContainer('postgres:16') // Debian-based (larger)
```

### Container Reuse (Development)

```typescript
// specs/fixtures.ts - initializeGlobalDatabase()
const container = await new PostgreSqlContainer('postgres:16-alpine')
  .withReuse() // ⚠️ Reuse container across test runs (development only)
  .start()
```

**When to enable reuse**:

- ✅ Local development (faster test iterations)
- ❌ CI/CD (always use fresh containers)

**Note**: Requires Testcontainers daemon running (`testcontainers-cli`)

### Environment Variables

```bash
# Connection URL (set by global-setup.ts)
TEST_DATABASE_CONTAINER_URL=postgresql://test:test@localhost:12345/test

# Docker configuration (auto-configured for Colima)
DOCKER_HOST=unix://$HOME/.colima/docker.sock
TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock

# Testcontainers debug logging
DEBUG=testcontainers*
```

## Performance Optimization

### Current Performance

| Operation             | Time        | Notes                               |
| --------------------- | ----------- | ----------------------------------- |
| Container startup     | 1-2 seconds | Once per test run (global setup)    |
| Template creation     | 2-3 seconds | Run all migrations once             |
| Database duplication  | 30-50ms     | Fast PostgreSQL template clone      |
| Test database cleanup | 10-20ms     | Drop database (non-blocking)        |
| Container shutdown    | 500ms       | Once per test run (global teardown) |

### Optimization Strategies

**1. Template Pattern (Current)**
✅ Migrations run once, not per test
✅ Fast database cloning (30-50ms)

**2. Parallel Test Execution**

```bash
# Run 4 tests concurrently (4 isolated databases)
bun test:e2e --workers 4
```

**3. Selective Database Usage**

```typescript
// Only enable database when needed
await startServerWithSchema(schema, { useDatabase: false })
```

**4. Container Reuse (Development)**

```typescript
// Reuse container across test runs
.withReuse()  // Saves 1-2 seconds per run
```

## Troubleshooting

### Common Issues

**Issue: Container fails to start**

```
Error: Failed to start PostgreSQL container
```

**Causes & Fixes**:

1. **Docker not running**

   ```bash
   # macOS (Colima)
   colima status
   colima start

   # Linux/Windows
   systemctl status docker
   sudo systemctl start docker
   ```

2. **Port conflict** (port 5432 already in use)
   - Testcontainers uses random ports by default
   - Check if manual port mapping is causing conflict

3. **Insufficient resources**
   ```bash
   # macOS (Colima) - increase resources
   colima stop
   colima start --cpu 4 --memory 8
   ```

**Issue: Colima socket not found**

```
Error: DOCKER_HOST points to non-existent socket
```

**Fix**:

```bash
# Verify Colima is running
colima status

# Check socket exists
ls -la ~/.colima/docker.sock

# Restart Colima
colima stop && colima start
```

**Issue: Tests hang during database creation**

```
Test timeout waiting for database duplication
```

**Causes & Fixes**:

1. **Connection pool exhaustion** - Too many parallel tests

   ```bash
   # Reduce workers
   bun test:e2e --workers 2
   ```

2. **Migrations failing** - Check template creation logs
   ```bash
   # Enable debug logging
   DEBUG=testcontainers* bun test:e2e
   ```

**Issue: Container not cleaned up**

```
Multiple PostgreSQL containers running after tests
```

**Fix**:

```bash
# List all containers
docker ps -a | grep postgres

# Manual cleanup
docker stop $(docker ps -q --filter ancestor=postgres:16-alpine)
docker rm $(docker ps -a -q --filter ancestor=postgres:16-alpine)
```

**Prevention**: Ensure global teardown runs properly (check Playwright config)

### Debug Mode

**Enable Testcontainers logging**:

```bash
DEBUG=testcontainers* bun test:e2e
```

**Enable Playwright debug mode**:

```bash
bun test:e2e --debug
```

**Inspect running containers**:

```bash
docker ps
docker logs <container-id>
docker exec -it <container-id> psql -U test -d test
```

## Best Practices

### ✅ Do

- **Use template pattern** - Duplicate databases, don't run migrations per test
- **Enable parallel execution** - Tests are isolated, safe to run concurrently
- **Clean up after tests** - Use fixtures to ensure cleanup (automatic with current setup)
- **Test with real PostgreSQL** - Don't use SQLite or mocks for integration tests
- **Use database selectively** - Disable for static content tests (faster)
- **Check Docker is running** - Use `ensureDockerRunning()` utility
- **Use specific PostgreSQL version** - Match production version (currently 16)

### ❌ Don't

- **Don't share databases** - Each test must have isolated database
- **Don't run migrations per test** - Use template pattern instead (16x faster)
- **Don't forget cleanup** - Always use fixtures (current setup handles this)
- **Don't hardcode connection strings** - Use `process.env.TEST_DATABASE_CONTAINER_URL`
- **Don't use Docker Desktop licensing** - Prefer Colima on macOS (free, lightweight)
- **Don't commit container IDs** - Containers are ephemeral
- **Don't reuse containers in CI** - Always fresh containers in CI/CD

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Install Playwright browsers
        run: bunx playwright install --with-deps chromium

      - name: Run E2E tests
        run: bun test:e2e
        # Testcontainers automatically detects Docker in GitHub Actions
        # No additional Docker setup required
```

**Why it works**:

- GitHub Actions runners have Docker pre-installed
- Testcontainers auto-detects GitHub Actions environment
- Uses `ubuntu-latest` which includes Docker Engine

## Related Documentation

- **Playwright E2E Testing**: `@docs/infrastructure/testing/playwright.md`
- **Database Migrations**: `@docs/infrastructure/database/drizzle.md`
- **Bun Test (Unit Tests)**: `@docs/infrastructure/testing/bun-test.md`
- **Docker Setup**: `@docs/infrastructure/runtime/docker.md` (if exists)

## External Resources

- [Testcontainers Documentation](https://testcontainers.com/)
- [Testcontainers Node](https://node.testcontainers.org/)
- [PostgreSQL Testcontainer](https://node.testcontainers.org/modules/postgresql/)
- [Colima (Docker for macOS)](https://github.com/abiosoft/colima)
- [Playwright Global Setup](https://playwright.dev/docs/test-global-setup-teardown)

## Version History

| Date       | Version | Change                                                       |
| ---------- | ------- | ------------------------------------------------------------ |
| 2025-01-25 | 11.8.1  | Initial integration with template pattern and Colima support |
