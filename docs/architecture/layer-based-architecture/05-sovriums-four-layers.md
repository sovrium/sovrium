# Layer-Based Architecture in Sovrium

> **Note**: This is part 5 of the split documentation. See navigation links below.

## Sovrium's Four Layers

Sovrium's architecture consists of four distinct layers, each with specific responsibilities:

```
┌─────────────────────────────────────────────┐
│       PRESENTATION LAYER (UI/API)           │  ← User interaction, HTTP, rendering
│  React Components, Hono Routes, Tailwind   │
├─────────────────────────────────────────────┤
│       APPLICATION LAYER (Use Cases)         │  ← Business workflows, orchestration
│    Effect Programs, Use Case Logic          │
├─────────────────────────────────────────────┤
│       DOMAIN LAYER (Business Logic)         │  ← Pure business rules, core logic
│  Pure Functions, Domain Models, Validation  │
├─────────────────────────────────────────────┤
│    INFRASTRUCTURE LAYER (External)          │  ← I/O, databases, APIs, services
│  Database, HTTP Client, File System, Bun    │
└─────────────────────────────────────────────┘
```

### Dependency Direction (Critical Rule)

**Dependencies flow INWARD only** - outer layers depend on inner layers, NEVER the reverse:

```
Presentation → Application → Domain ← Infrastructure
```

- **Presentation** depends on **Application** and **Domain**
- **Application** depends on **Domain** and defines **Infrastructure interfaces**
- **Domain** depends on NOTHING (pure, self-contained)
- **Infrastructure** implements interfaces defined in **Application/Domain**

---

## Navigation

[← Part 4](./04-why-layer-based-architecture-for-sovrium.md) | [Part 6 →](./06-layer-1-presentation-layer-uiapi.md)

**Parts**: [Part 1](./01-start.md) | [Part 2](./02-overview.md) | [Part 3](./03-what-is-layer-based-architecture.md) | [Part 4](./04-why-layer-based-architecture-for-sovrium.md) | **Part 5** | [Part 6](./06-layer-1-presentation-layer-uiapi.md) | [Part 7](./07-layer-2-application-layer-use-casesorchestration.md) | [Part 8](./08-layer-3-domain-layer-business-logic.md) | [Part 9](./09-layer-4-infrastructure-layer-external-services.md) | [Part 10](./10-layer-communication-patterns.md) | [Part 11](./11-integration-with-functional-programming.md) | [Part 12](./12-testing-layer-based-architecture.md) | [Part 13](./13-file-structure.md) | [Part 14](./14-best-practices.md) | [Part 15](./15-common-pitfalls.md) | [Part 16](./16-resources-and-references.md) | [Part 17](./17-summary.md)
