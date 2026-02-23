# Islands Architecture with React.lazy

## Overview

**Status**: 🔮 **Future Implementation** (not yet built)
**Purpose**: Hybrid SSR approach with selective hydration for optimal performance and minimal JavaScript bundle size
**Integration**: React 19, Hono SSR, Bun.build(), Effect.ts
**Approach**: Server renders everything, client hydrates only interactive "islands"

The Islands Architecture in Sovrium uses schema-driven configuration to determine which components need client-side JavaScript. Most components remain static HTML (server-rendered), while interactive components ("islands") are selectively hydrated on the client with code-split bundles.

## Architecture Decision: Islands vs Full Hydration vs HTMX

### Why Islands Architecture for Sovrium?

**Sovrium's Core Philosophy**: Configuration-driven applications where each app schema declares which features are interactive.

| Aspect                  | Islands (Chosen)                     | Full React Hydration         | HTMX                              |
| ----------------------- | ------------------------------------ | ---------------------------- | --------------------------------- |
| **JavaScript Bundle**   | Only interactive components          | Entire React tree            | Minimal JS, server-driven         |
| **Schema Integration**  | ✅ Natural fit (`interactive: true`) | ❌ All-or-nothing            | ⚠️ Requires different server arch |
| **Progressive**         | ✅ Works without JS                  | ❌ Requires full hydration   | ✅ Works without JS               |
| **Complex UI**          | ✅ Full React capabilities           | ✅ Full React capabilities   | ⚠️ Limited client-side logic      |
| **Developer DX**        | ✅ Standard React components         | ✅ Standard React components | ❌ Different paradigm             |
| **Multi-Tenancy Ready** | ✅ Per-app island configuration      | ❌ Same bundle for all apps  | ⚠️ Different routing model        |
| **Existing Stack**      | ✅ Extends current architecture      | ❌ Status quo (optimization) | ❌ Requires architectural shift   |
| **TanStack Query**      | ✅ Works seamlessly in islands       | ✅ Works everywhere          | ❌ Not compatible                 |
| **TanStack Table**      | ✅ Works as island component         | ✅ Works everywhere          | ❌ Requires server-side rendering |

### Architectural Rationale

**Sovrium's Vision** (from `VISION.md`):

> "Configuration-driven platform where business logic lives in app schema, not in code."

Islands Architecture aligns perfectly:

1. **Schema-Driven**: `interactive: true` in app schema declaratively marks islands
2. **Multi-Tenancy**: Each app can have different interactive components
3. **Progressive Enhancement**: Works without JavaScript (accessibility, SEO)
4. **Performance**: Only loads JavaScript for components that need it
5. **React-First**: Leverages existing React 19 + SSR infrastructure

### When Components Are Interactive vs Static

```typescript
// App Schema (sovrium.json)
{
  "pages": [
    {
      "path": "/",
      "components": [
        {
          "type": "hero",
          "interactive": false  // Static HTML (no JS)
        },
        {
          "type": "data-table",
          "interactive": true   // Island (client-side JS)
        }
      ]
    }
  ]
}
```

**Result**:

- **Hero section**: Server-rendered HTML, zero JavaScript
- **Data table**: Server-rendered HTML + hydrated with TanStack Table (sort/filter)

## How It Works

### Compilation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. App Schema → Domain Models                               │
│    Schema declares: interactive: true/false per component   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼ Schema validation (Effect Schema)
┌─────────────────────────────────────────────────────────────┐
│ 2. Server-Side Rendering (Hono + React.renderToString)     │
│    - Renders ENTIRE page to HTML                           │
│    - Adds data-island attributes to interactive components │
│    - Embeds component props in data-props attributes       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼ HTML response
┌─────────────────────────────────────────────────────────────┐
│ 3. Client Receives HTML                                     │
│    - Static components: No JavaScript needed               │
│    - Island components: Marked with data-island="DataTable"│
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼ Tiny bootstrap.js executes
┌─────────────────────────────────────────────────────────────┐
│ 4. Client-Side Hydration (bootstrap.js)                    │
│    - Finds all [data-island] elements                      │
│    - Uses React.lazy() to load only needed components      │
│    - Hydrates islands with hydrateRoot()                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼ Dynamic import
┌─────────────────────────────────────────────────────────────┐
│ 5. Code Splitting (Bun.build with splitting: true)         │
│    - DataTable.island.tsx → data-table.chunk.js            │
│    - ChartWidget.island.tsx → chart-widget.chunk.js        │
│    - Only loads chunks for islands present on page         │
└─────────────────────────────────────────────────────────────┘
```

### Server-Side: Island Markers

**Component Wrapper** (`src/presentation/ui/Island.tsx`):

```typescript
import type { ReactNode } from 'react'

interface IslandProps {
  readonly name: string // Component name for dynamic import
  readonly props: Record<string, unknown> // Component props
  readonly children: ReactNode
}

export function Island({ name, props, children }: IslandProps) {
  // Server-side: Render with data attributes for client hydration
  return (
    <div
      data-island={name}
      data-props={JSON.stringify(props)}
      suppressHydrationWarning
    >
      {children}
    </div>
  )
}
```

**Usage in Page Rendering**:

```typescript
// src/presentation/pages/HomePage.tsx
import { Island } from '@/presentation/ui/Island'
import { DataTable } from '@/presentation/ui/DataTable'
import { Hero } from '@/presentation/ui/Hero'

export function HomePage({ tableData, heroContent }) {
  return (
    <div>
      {/* Static component - no island wrapper */}
      <Hero title={heroContent.title} subtitle={heroContent.subtitle} />

      {/* Interactive component - wrapped in Island */}
      <Island name="DataTable" props={{ data: tableData }}>
        <DataTable data={tableData} />
      </Island>
    </div>
  )
}
```

**Server Output** (HTML):

```html
<div>
  <!-- Static HTML (no hydration) -->
  <section class="hero">
    <h1>Welcome to Sovrium</h1>
    <p>Configuration-driven platform</p>
  </section>

  <!-- Island marker (hydrated on client) -->
  <div
    data-island="DataTable"
    data-props='{"data":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]}'
  >
    <!-- Pre-rendered table HTML -->
    <table>
      ...
    </table>
  </div>
</div>
```

### Client-Side: Bootstrap and Hydration

**Tiny Bootstrap Script** (`public/bootstrap.js`):

```typescript
// bootstrap.js - Loaded once, minimal size (~2KB)
import { hydrateRoot } from 'react-dom/client'
import { lazy } from 'react'

// Island component registry (generated from schema)
const ISLANDS = {
  DataTable: lazy(() => import('./islands/DataTable.island')),
  ChartWidget: lazy(() => import('./islands/ChartWidget.island')),
  SearchForm: lazy(() => import('./islands/SearchForm.island')),
  // ... other interactive components
}

// Find all island markers in DOM
function hydrateIslands() {
  const islands = document.querySelectorAll('[data-island]')

  islands.forEach((element) => {
    const componentName = element.getAttribute('data-island')
    const propsJson = element.getAttribute('data-props')

    if (!componentName || !ISLANDS[componentName]) {
      console.warn(`Unknown island component: ${componentName}`)
      return
    }

    const props = propsJson ? JSON.parse(propsJson) : {}
    const Component = ISLANDS[componentName]

    // Hydrate this island only
    hydrateRoot(
      element,
      <Component {...props} />
    )
  })
}

// Execute on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hydrateIslands)
} else {
  hydrateIslands()
}
```

**How It Works**:

1. **Browser loads page** → HTML already rendered by server
2. **bootstrap.js executes** → Finds all `[data-island]` elements
3. **React.lazy imports** → Dynamically loads only needed component chunks
4. **hydrateRoot per island** → Hydrates individual islands (not entire page)
5. **Static components** → Never touched by JavaScript (zero overhead)

### Code Splitting with Bun.build

**Build Configuration** (`build.config.ts`):

```typescript
import type { BuildConfig } from 'bun'

export const clientBuildConfig: BuildConfig = {
  entrypoints: [
    './public/bootstrap.ts',
    // Island components auto-discovered from schema
    './src/presentation/islands/DataTable.island.tsx',
    './src/presentation/islands/ChartWidget.island.tsx',
    './src/presentation/islands/SearchForm.island.tsx',
  ],
  outdir: './dist/client',
  splitting: true, // Enable code splitting
  format: 'esm',
  target: 'browser',
  minify: true,
  sourcemap: 'external',
}
```

**Output Structure**:

```
dist/client/
├── bootstrap.js           # 2KB - Initial loader
├── data-table.chunk.js    # 15KB - TanStack Table + logic
├── chart-widget.chunk.js  # 20KB - Chart library + component
└── search-form.chunk.js   # 5KB - Form + validation
```

**Loading Strategy**:

- **Initial load**: Only `bootstrap.js` (~2KB)
- **On hydration**: Loads chunks for islands present on page
- **Result**: Page with DataTable loads 2KB + 15KB = 17KB total (vs 42KB with full hydration)

## Schema-Driven Islands

### App Schema Configuration

**Domain Model** (`src/domain/models/app/component/component.ts`):

```typescript
import { Schema } from 'effect/Schema'

export const ComponentTemplateSchema = Schema.Struct({
  id: Schema.Number,
  type: Schema.Literal('hero', 'data-table', 'chart', 'form'),
  interactive: Schema.Boolean, // Declares if component needs client-side JS
  props: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})

export type ComponentTemplate = Schema.Schema.Type<typeof ComponentTemplateSchema>
```

**App Configuration** (JSON):

```json
{
  "name": "Dashboard App",
  "pages": [
    {
      "id": 1,
      "path": "/",
      "components": [
        {
          "id": 1,
          "type": "hero",
          "interactive": false,
          "props": {
            "title": "Welcome",
            "subtitle": "Your dashboard"
          }
        },
        {
          "id": 2,
          "type": "data-table",
          "interactive": true,
          "props": {
            "tableId": 1,
            "enableSort": true,
            "enableFilter": true
          }
        },
        {
          "id": 3,
          "type": "chart",
          "interactive": true,
          "props": {
            "chartType": "line",
            "dataSource": "sales"
          }
        }
      ]
    }
  ]
}
```

**Result**:

- **Hero component** (`interactive: false`) → Static HTML, 0KB JS
- **Data table** (`interactive: true`) → Island, 15KB chunk
- **Chart** (`interactive: true`) → Island, 20KB chunk
- **Total JS**: 2KB bootstrap + 15KB + 20KB = 37KB (vs 60KB+ full hydration)

### Component Guidelines

**Static Components** (no `interactive` flag or `interactive: false`):

```typescript
// src/presentation/ui/Hero.tsx
interface HeroProps {
  readonly title: string
  readonly subtitle: string
}

export function Hero({ title, subtitle }: HeroProps) {
  return (
    <section className="bg-primary p-section text-white">
      <h1 className="text-4xl font-bold">{title}</h1>
      <p className="text-xl">{subtitle}</p>
    </section>
  )
}
```

**Island Components** (`interactive: true`):

```typescript
// src/presentation/islands/DataTable.island.tsx
import { useState } from 'react'
import { useReactTable, getCoreRowModel } from '@tanstack/react-table'

interface DataTableProps {
  readonly tableId: number
  readonly enableSort?: boolean
  readonly enableFilter?: boolean
}

export function DataTable({ tableId, enableSort, enableFilter }: DataTableProps) {
  const [data, setData] = useState([])

  // Client-side interactivity
  const table = useReactTable({
    data,
    columns: [...],
    getCoreRowModel: getCoreRowModel(),
  })

  return <table>{/* Interactive table */}</table>
}
```

**Naming Convention**:

- Static: `ComponentName.tsx` (anywhere in `src/presentation/ui/`)
- Islands: `ComponentName.island.tsx` (in `src/presentation/islands/`)

**File Structure**:

```
src/presentation/
├── components/          # Static components (server-rendered only)
│   ├── Hero.tsx
│   ├── Footer.tsx
│   └── Navigation.tsx
├── islands/             # Interactive components (hydrated on client)
│   ├── DataTable.island.tsx
│   ├── ChartWidget.island.tsx
│   └── SearchForm.island.tsx
└── pages/               # Page templates (mix static + islands)
    └── HomePage.tsx
```

## Implementation Pattern

### JS Compiler Design

**Parallel to CSS Compiler** (`src/infrastructure/js/compiler.ts`):

```typescript
import { Effect } from 'effect'
import { build } from 'bun'
import type { App } from '@/domain/models/app'

interface CompiledJS {
  readonly bootstrap: string // bootstrap.js content
  readonly chunks: ReadonlyArray<{
    readonly name: string
    readonly content: string
  }>
  readonly timestamp: number
}

class JSCompilationError {
  readonly _tag = 'JSCompilationError'
  constructor(readonly cause: unknown) {}
}

// Extract interactive components from app schema
function extractIslandComponents(app: App): ReadonlyArray<string> {
  const islands: string[] = []

  for (const page of app.pages) {
    for (const component of page.components) {
      if (component.interactive) {
        islands.push(component.type) // e.g., "data-table"
      }
    }
  }

  return [...new Set(islands)] // Deduplicate
}

// Compile JavaScript for app
export const compileJS = (app: App): Effect.Effect<CompiledJS, JSCompilationError> =>
  Effect.gen(function* () {
    const islands = extractIslandComponents(app)

    // Generate entry points
    const entrypoints = [
      './public/bootstrap.ts',
      ...islands.map((name) => `./src/presentation/islands/${name}.island.tsx`),
    ]

    // Build with Bun
    const result = yield* Effect.tryPromise({
      try: () =>
        build({
          entrypoints,
          outdir: './dist/client',
          splitting: true,
          format: 'esm',
          target: 'browser',
          minify: true,
        }),
      catch: (error) => new JSCompilationError(error),
    })

    // Read compiled files
    const bootstrap = yield* Effect.tryPromise({
      try: () => Bun.file('./dist/client/bootstrap.js').text(),
      catch: (error) => new JSCompilationError(error),
    })

    const chunks = yield* Effect.all(
      islands.map((name) =>
        Effect.tryPromise({
          try: async () => ({
            name,
            content: await Bun.file(`./dist/client/${name}.chunk.js`).text(),
          }),
          catch: (error) => new JSCompilationError(error),
        })
      )
    )

    return {
      bootstrap,
      chunks,
      timestamp: Date.now(),
    }
  })
```

**Integration with Hono**:

```typescript
// src/presentation/api/assets.ts
import { Hono } from 'hono'
import { compileJS } from '@/infrastructure/js'
import { Effect } from 'effect'

const app = new Hono()

// Serve bootstrap.js
app.get('/assets/bootstrap.js', async (c) => {
  const program = Effect.gen(function* () {
    const compiled = yield* compileJS(appConfig)
    return compiled.bootstrap
  })

  const result = await Effect.runPromise(program)

  return c.text(result, 200, {
    'Content-Type': 'application/javascript',
    'Cache-Control': 'public, max-age=31536000',
  })
})

// Serve island chunks
app.get('/assets/:chunk.chunk.js', async (c) => {
  const chunkName = c.req.param('chunk')

  const program = Effect.gen(function* () {
    const compiled = yield* compileJS(appConfig)
    const chunk = compiled.chunks.find((ch) => ch.name === chunkName)

    if (!chunk) {
      return yield* Effect.fail(new Error('Chunk not found'))
    }

    return chunk.content
  })

  const result = await Effect.runPromise(program.pipe(Effect.either))

  if (result._tag === 'Left') {
    return c.notFound()
  }

  return c.text(result.right, 200, {
    'Content-Type': 'application/javascript',
    'Cache-Control': 'public, max-age=31536000',
  })
})

export default app
```

### Caching Strategy

**Similar to CSS Caching** (schema hash-based):

```typescript
import { Ref, Effect } from 'effect'

const jsCache = Ref.unsafeMake<Map<string, CompiledJS>>(new Map())

function getAppCacheKey(app: App): string {
  // Hash based on interactive components configuration
  return JSON.stringify({
    islands: extractIslandComponents(app),
    version: app.version,
  })
}

export const compileJS = (app: App): Effect.Effect<CompiledJS, JSCompilationError> =>
  Effect.gen(function* () {
    const cacheKey = getAppCacheKey(app)
    const cache = yield* Ref.get(jsCache)

    // Check cache
    const cached = cache.get(cacheKey)
    if (cached) {
      return cached
    }

    // Compile
    const compiled = yield* compileJSInternal(app)

    // Store in cache
    yield* Ref.update(jsCache, (map) => new Map(map).set(cacheKey, compiled))

    return compiled
  })
```

**Cache Invalidation**:

- **Automatic**: Cache key changes when island configuration changes
- **Per-app**: Each app schema has independent cache entry
- **In-memory**: Resets on server restart (same as CSS)

## Bundle Size Comparison

### Example Application: Dashboard with 3 Pages

**Components**:

- Static: Header, Footer, Hero, About, Contact (5 components)
- Interactive: DataTable, ChartWidget, SearchForm (3 components)

**Bundle Size Analysis**:

| Approach            | Initial JS | Interactive Page | Static Page | Total (3 pages) |
| ------------------- | ---------- | ---------------- | ----------- | --------------- |
| **Full Hydration**  | 85KB       | 85KB             | 85KB        | 255KB           |
| **Islands**         | 2KB        | 37KB             | 2KB         | 76KB            |
| **HTMX**            | 14KB       | 14KB             | 14KB        | 42KB            |
| **Islands Savings** | **-98%**   | **-56%**         | **-98%**    | **-70%**        |

**Detailed Breakdown** (Islands Architecture):

| Component            | Size  | When Loaded               |
| -------------------- | ----- | ------------------------- |
| bootstrap.js         | 2KB   | Always (all pages)        |
| DataTable chunk      | 15KB  | Only on pages with tables |
| ChartWidget chunk    | 20KB  | Only on pages with charts |
| SearchForm chunk     | 5KB   | Only on pages with search |
| Static components    | 0KB   | Server-rendered HTML only |
| React core (lazy)    | Split | Loaded with first island  |
| TanStack Query       | Split | Loaded with data-fetching |
| Total (worst case)   | 42KB  | Page with all 3 islands   |
| Total (average case) | 22KB  | Page with 1-2 islands     |
| Total (best case)    | 2KB   | Static page (no islands)  |

### Real-World Impact

**Scenario 1**: Marketing Site + Admin Dashboard

```
Homepage (static):        2KB JS   ← Islands wins
Blog Post (static):       2KB JS   ← Islands wins
Contact Form (1 island):  7KB JS   ← Islands wins
Admin Table (3 islands):  42KB JS  ← Still better than 85KB full hydration
```

**Scenario 2**: Multi-Tenant SaaS

```
Tenant A (simple CRM):    22KB average ← Islands shines
Tenant B (data platform): 42KB average ← Islands still better
Tenant C (static site):   2KB average  ← Islands perfect
```

**Performance Metrics**:

- **First Contentful Paint (FCP)**: Faster (less JS to parse)
- **Time to Interactive (TTI)**: Much faster (islands load progressively)
- **Total Blocking Time (TBT)**: Minimal (small initial bundle)
- **Largest Contentful Paint (LCP)**: Faster (content visible before JS)

## Integration with Existing Stack

### How Islands Fit with Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: Presentation Layer                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Server-Side (Hono + React.renderToString)             │ │
│  │  - Renders ALL components to HTML                     │ │
│  │  - Adds <Island> wrappers for interactive components  │ │
│  │  - Serves HTML + bootstrap.js                         │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Client-Side (bootstrap.js + React.lazy)               │ │
│  │  - Hydrates ONLY islands (not entire page)            │ │
│  │  - Loads chunks dynamically per island                │ │
│  │  - Static components: zero JavaScript                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼ Uses Application Layer via async/await
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: Application Layer (Effect.gen programs)            │
│  - Use cases orchestrate business logic                     │
│  - Effect programs run server-side for SSR                  │
│  - Same programs callable from island components            │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼ Uses Domain Layer (pure functions)
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: Domain Layer (Pure validation)                     │
│  - Pure functions for business rules                        │
│  - Used in both server render and client islands            │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼ Implemented by Infrastructure Layer
┌─────────────────────────────────────────────────────────────┐
│ LAYER 4: Infrastructure Layer (Effect services)             │
│  - Drizzle ORM for database access                          │
│  - Better Auth for authentication                           │
│  - CSS Compiler for theming                                 │
│  - JS Compiler for island bundling (NEW)                    │
└─────────────────────────────────────────────────────────────┘
```

### CSS Compiler Parallel

| Aspect            | CSS Compiler                  | JS Compiler (Islands)             |
| ----------------- | ----------------------------- | --------------------------------- |
| **Input**         | App theme config              | App interactive components config |
| **Processing**    | PostCSS + Tailwind            | Bun.build + code splitting        |
| **Output**        | Compiled CSS                  | Bootstrap + island chunks         |
| **Caching**       | Theme hash                    | Island config hash                |
| **Serving**       | `/assets/output.css`          | `/assets/bootstrap.js` + chunks   |
| **Effect.ts**     | `compileCSS()` Effect program | `compileJS()` Effect program      |
| **Schema-Driven** | `theme` object in app schema  | `interactive` flags in app schema |
| **Multi-Tenant**  | Different CSS per app         | Different JS per app              |

### TanStack Query/Table as Islands

**TanStack Query** (data fetching island):

```typescript
// src/presentation/islands/UserList.island.tsx
import { useQuery } from '@tanstack/react-query'
import { Effect } from 'effect'

export function UserList() {
  const { data, isPending } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const program = GetUsers().pipe(Effect.provide(AppLayer))
      return Effect.runPromise(program)
    },
  })

  if (isPending) return <div>Loading...</div>

  return <ul>{data.map((user) => <li key={user.id}>{user.name}</li>)}</ul>
}
```

**TanStack Table** (interactive table island):

```typescript
// src/presentation/islands/DataTable.island.tsx
import { useReactTable, getCoreRowModel } from '@tanstack/react-table'

export function DataTable({ tableId }: { tableId: number }) {
  const table = useReactTable({
    data: [...],
    columns: [...],
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <table>
      {/* Interactive table with sort/filter */}
    </table>
  )
}
```

**Key Integration Points**:

- Islands can use TanStack Query for data fetching
- Islands can use TanStack Table for interactive tables
- Effect programs called from island components via `Effect.runPromise`
- Application Layer use cases shared between SSR and islands

## Best Practices

### For Schema Design

1. **Default to Static**: Only mark `interactive: true` when needed
2. **Granular Islands**: Wrap smallest interactive units, not entire sections
3. **Progressive Enhancement**: Ensure content works without JavaScript
4. **Test Both Modes**: Verify components work server-rendered and hydrated
5. **Document Interactive Need**: Comment why `interactive: true` is required

### For Component Development

1. **Naming Convention**: Use `.island.tsx` suffix for interactive components
2. **Pure Props**: Island components receive JSON-serializable props only
3. **No Server Deps**: Island components can't access Node.js/Bun APIs
4. **Lazy Loading**: Use `React.lazy()` for heavy dependencies in islands
5. **Error Boundaries**: Wrap islands in error boundaries for graceful degradation

### For Performance

1. **Code Splitting**: Each island should be independently loadable
2. **Shared Chunks**: Bun.build automatically extracts common dependencies
3. **Preload Critical Islands**: Use `<link rel="modulepreload">` for above-fold islands
4. **Monitor Bundle Size**: Track island chunk sizes in build output
5. **Defer Non-Critical**: Use `loading="lazy"` attributes where appropriate

## Common Pitfalls

❌ **Marking Everything Interactive**: Defeats purpose of islands

```typescript
// ❌ BAD: Entire page is one giant island
{
  "components": [
    { "type": "page", "interactive": true }
  ]
}

// ✅ GOOD: Only interactive components are islands
{
  "components": [
    { "type": "hero", "interactive": false },
    { "type": "data-table", "interactive": true },
    { "type": "footer", "interactive": false }
  ]
}
```

❌ **Server-Only Code in Islands**: Island components run on client

```typescript
// ❌ BAD: Bun API in island component
import { Database } from 'bun:sqlite'

export function DataTable() {
  const db = new Database() // Fails on client!
  // ...
}

// ✅ GOOD: Fetch data via Effect program
import { useQuery } from '@tanstack/react-query'

export function DataTable() {
  const { data } = useQuery({
    queryKey: ['data'],
    queryFn: () => Effect.runPromise(GetData()), // Server-side Effect
  })
}
```

❌ **Non-Serializable Props**: Island props passed via JSON

```typescript
// ❌ BAD: Function as prop
<Island name="DataTable" props={{ onSort: (col) => {...} }} />

// ✅ GOOD: JSON-serializable props only
<Island name="DataTable" props={{ tableId: 1, sortColumn: 'name' }} />
```

❌ **Forgetting Static Fallback**: Islands should work without JS

```typescript
// ❌ BAD: Empty div until hydration
export function SearchForm() {
  return <form>{/* client-only content */}</form>
}

// ✅ GOOD: Server renders full HTML
export function SearchForm({ initialQuery }: { initialQuery: string }) {
  return (
    <form method="GET" action="/search">
      <input name="q" defaultValue={initialQuery} />
      <button type="submit">Search</button>
    </form>
  )
}
```

## Future Enhancements

### Phase 1: Basic Islands (MVP)

- ✅ Server-side island markers
- ✅ Client-side selective hydration
- ✅ Code splitting with Bun.build
- ✅ Schema-driven island configuration

### Phase 2: Advanced Features

- [ ] **Partial Hydration**: Hydrate islands on interaction (not immediately)
- [ ] **Streaming SSR**: Stream islands as they become ready
- [ ] **Island Preloading**: Predict and preload likely-needed islands
- [ ] **Island Analytics**: Track which islands are actually used
- [ ] **Island Composition**: Nested islands with independent lifecycles

### Phase 3: Developer Experience

- [ ] **Island DevTools**: Visualize islands in browser
- [ ] **Hot Module Replacement**: Update islands without full reload
- [ ] **Bundle Analysis**: Per-island size reporting
- [ ] **Island Templates**: Reusable island patterns
- [ ] **Island Testing**: Test islands in isolation

## References

- **Islands Architecture**: https://jasonformat.com/islands-architecture/
- **Partial Hydration**: https://github.com/google/eleventy-high-performance-blog
- **React.lazy**: https://react.dev/reference/react/lazy
- **Bun.build**: https://bun.sh/docs/bundler
- **CSS Compiler Pattern**: `@docs/architecture/patterns/css-compilation-strategy.md`
- **Layer-Based Architecture**: `@docs/architecture/layer-based-architecture.md`
- **React Integration**: `@docs/infrastructure/ui/react.md`
- **Hono SSR**: `@docs/infrastructure/framework/hono.md`

## Summary

Islands Architecture in Sovrium provides:

1. **Schema-Driven Interactivity**: `interactive: true` declaratively marks islands
2. **Minimal JavaScript**: Only interactive components load JS (2KB bootstrap + island chunks)
3. **Progressive Enhancement**: Works without JavaScript for static content
4. **Multi-Tenancy Ready**: Each app can have different island configurations
5. **Performance**: 70% smaller bundles vs full React hydration
6. **Developer Experience**: Standard React components with `.island.tsx` convention
7. **Stack Integration**: Extends existing CSS compilation pattern with JS compilation

By following Islands Architecture principles, Sovrium achieves optimal performance while maintaining the flexibility and power of React for interactive components.

---

**Status**: 🔮 **Future Implementation**
**Next Steps**: Implement JS compiler, bootstrap.js generation, island hydration logic
**Dependencies**: Requires CSS compiler pattern (already implemented)
**Timeline**: Post-MVP, after core features stabilize
