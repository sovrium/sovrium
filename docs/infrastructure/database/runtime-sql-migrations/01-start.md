# Runtime SQL Migrations - Documentation Hub

> **Quick Reference**: See [runtime-sql-migrations.md](../runtime-sql-migrations.md) for a concise overview
> **ADR**: See [003-runtime-sql-migrations.md](../../../architecture/decisions/003-runtime-sql-migrations.md) for architectural decision

---

## Navigation

This documentation is organized into 9 parts for deep technical understanding:

1. **[Start](01-start.md)** ← You are here (navigation hub)
2. **[Overview](02-overview.md)** - Big picture, architecture diagram, data flow
3. **[SQL Generator](03-sql-generator.md)** - JSON → PostgreSQL DDL conversion
4. **[Migration Executor](04-migration-executor.md)** - bun:sql execution, transaction handling
5. **[Orchestrator](05-orchestrator.md)** - Coordinating generation + execution
6. **[Checksum Optimization](06-checksum-optimization.md)** - Skip migrations when config unchanged
7. **[Field Type Mapping](07-field-type-mapping.md)** - 30+ Sovrium types → PostgreSQL columns
8. **[Effect Integration](08-effect-integration.md)** - Services, layers, error handling
9. **[Best Practices](09-best-practices.md)** - Performance, debugging, testing, production

---

## What You'll Learn

By reading through all 9 parts, you'll understand:

- How JSON table configurations are transformed into PostgreSQL DDL statements
- How migrations are executed safely with transactions and rollback
- How checksum optimization reduces startup time to < 100ms for unchanged configs
- How 30+ field types map to PostgreSQL column types with constraints
- How Effect.ts services coordinate the entire migration pipeline
- Best practices for debugging, testing, and deploying to production

---

## Recommended Reading Order

**For Implementers** (writing code):

1. Start with [Overview](02-overview.md) for architecture understanding
2. Read [SQL Generator](03-sql-generator.md) and [Field Type Mapping](07-field-type-mapping.md) together
3. Read [Migration Executor](04-migration-executor.md) for execution logic
4. Read [Effect Integration](08-effect-integration.md) for service composition
5. Reference [Best Practices](09-best-practices.md) while coding

**For Reviewers** (understanding design):

1. Read [Overview](02-overview.md) for high-level architecture
2. Skim [Orchestrator](05-orchestrator.md) for workflow coordination
3. Read [Best Practices](09-best-practices.md) for quality considerations
4. Dive into specific parts as needed

**For Troubleshooters** (debugging issues):

1. Start with [Best Practices](09-best-practices.md) troubleshooting section
2. Read [Migration Executor](04-migration-executor.md) for error handling
3. Check [SQL Generator](03-sql-generator.md) if SQL output is incorrect
4. Review [Checksum Optimization](06-checksum-optimization.md) if migrations run unexpectedly

---

## Key Concepts Quick Reference

- **SQL Generator**: Converts JSON field definitions to CREATE TABLE / ALTER TABLE SQL
- **Migration Executor**: Executes DDL via bun:sql in transactions, rolls back on error
- **Orchestrator**: Coordinates checksum check → SQL generation → migration execution
- **Checksum Optimization**: Hashes JSON config, skips migration if unchanged
- **Field Type Mapping**: Maps 30+ types (email, date, linked-record, etc.) to PostgreSQL
- **Effect Services**: SqlGeneratorService, MigrationExecutorService, ChecksumTrackerService
- **Fail-Fast**: Any error crashes app immediately (no partial migrations)
- **Virtual Fields**: formula, rollup, lookup skip column creation (computed at query time)

---

## Code Examples Throughout

Each part includes TypeScript/SQL code examples showing:

- How to implement each component
- How to use Effect.gen for orchestration
- How to handle errors with Effect error types
- How to write unit tests for each layer

---

## Related Documentation

**High-Level**:

- [Quick Reference](../runtime-sql-migrations.md) - 60-line developer overview
- [ADR 003](../../../architecture/decisions/003-runtime-sql-migrations.md) - Why raw SQL?
- [Architecture Pattern](../../../architecture/patterns/config-driven-schema-generation.md) - Design pattern

**Specifications**:

- [Field Type Specs](../../../../specs/app/tables/field-types/) - E2E tests for field mappings
- [Migration Specs](../../../../specs/app/tables/migrations/) - E2E tests for migration scenarios

**External**:

- [Bun SQL API](https://bun.sh/docs/api/sql) - Native PostgreSQL driver
- [PostgreSQL DDL](https://www.postgresql.org/docs/current/ddl.html) - CREATE/ALTER TABLE syntax
- [Effect Documentation](https://effect.website/) - Effect.ts functional programming

---

**Ready to dive in?** Start with [Overview](02-overview.md) →
