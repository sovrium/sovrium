# Sovrium Vision & Mission

> **⚠️ Vision Document**: This document describes the **purpose, vision, and target state** for Sovrium. Most features described here are **not yet implemented**. For current capabilities, see [SPEC-PROGRESS.md](SPEC-PROGRESS.md).

---

## Mission Statement

**To make every organization sovereign in their information systems—free from SaaS lock-in, in complete control of their data, and empowered to build business applications through configuration-as-code.**

_Own your data. Own your tools. Own your future._

---

## The Problem: SaaS Dependency Crisis

Modern organizations are drowning in technological dependencies:

### The Cost of Fragmentation

- **20+ SaaS subscriptions** per company on average
- **$10,000+/month** in recurring fees for mid-sized teams
- **Data scattered** across incompatible platforms (Airtable, Notion, Retool, Zapier, Webflow)
- **Vendor lock-in** preventing migration or customization
- **Privacy concerns** with data stored on third-party servers

### The Hidden Costs

1. **Loss of Sovereignty**: Your business logic lives in someone else's platform
2. **Compounding Expenses**: Per-user pricing scales exponentially with growth
3. **Feature Dependency**: Can't build what you need—only what vendors provide
4. **Engineering Distraction**: Teams waste time integrating incompatible tools
5. **Strategic Risk**: Business continuity depends on external companies

### The Paradox

No-code tools promised to make software development accessible, but instead created **a new form of dependency**:

- You escape coding complexity but gain **vendor complexity**
- You avoid infrastructure but lose **control and ownership**
- You get quick setup but face **long-term lock-in**

---

## The Solution: Sovrium

**Sovrium breaks the SaaS dependency cycle** by providing a **self-hosted, configuration-driven platform** that puts organizations back in control.

### What Sovrium Does

Sovrium is a **self-hosted web application** with two complementary interfaces:

1. **Configuration Files**: JSON, YAML, or TypeScript files that define your entire application
2. **Admin Space**: A comprehensive management interface with multiple editing modes, data management, analytics, and deployment workflows

Think of it like **WordPress for business applications**—WordPress has an admin panel for managing content, themes, and plugins. Sovrium has an admin space for managing Tables, Pages, Automations, Users, Permissions, Theme, and more—with features like AI-assisted editing, schema versioning, staging environments, and analytics.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SOVRIUM APPLICATION                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────┐       ┌─────────────────────────────────────┐  │
│  │   CONFIG FILES      │       │           ADMIN SPACE               │  │
│  │                     │       │                                     │  │
│  │  • JSON/YAML/TS     │◄─────►│  ┌─────────────────────────────┐   │  │
│  │  • Version Control  │       │  │ APP EDITOR (3 Modes)        │   │  │
│  │  • CI/CD Friendly   │       │  │ • JSON Editor (syntax HL)   │   │  │
│  │  • Code Review      │       │  │ • Form Editor (visual)      │   │  │
│  └─────────────────────┘       │  │ • AI Agent (natural lang)   │   │  │
│           │                    │  └─────────────────────────────┘   │  │
│           │                    │  ┌─────────────────────────────┐   │  │
│           │                    │  │ MANAGEMENT                  │   │  │
│           │                    │  │ • Data Browser (CRUD)       │   │  │
│           │                    │  │ • User Management           │   │  │
│           │                    │  │ • Automations Dashboard     │   │  │
│           │                    │  │ • Forms Responses           │   │  │
│           │                    │  │ • Connected Accounts        │   │  │
│           │                    │  └─────────────────────────────┘   │  │
│           │                    │  ┌─────────────────────────────┐   │  │
│           │                    │  │ DEPLOYMENT                  │   │  │
│           │                    │  │ • Schema Versioning         │   │  │
│           │                    │  │ • Test Environment          │   │  │
│           │                    │  │ • Draft → Test → Production │   │  │
│           │                    │  │ • Rollback Capability       │   │  │
│           │                    │  └─────────────────────────────┘   │  │
│           │                    │  ┌─────────────────────────────┐   │  │
│           │                    │  │ ANALYTICS                   │   │  │
│           │                    │  │ • Page Views & Traffic      │   │  │
│           │                    │  │ • User Activity             │   │  │
│           │                    │  │ • System Health             │   │  │
│           │                    │  └─────────────────────────────┘   │  │
│           │                    └─────────────────────────────────────┘  │
│           │                                      │                      │
│           ▼                                      ▼                      │
│    ┌─────────────────────────────────────────────────────────────┐     │
│    │              YOUR LIVE APPLICATION                           │     │
│    │              (Tables, Pages, API, Auth)                      │     │
│    └─────────────────────────────────────────────────────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Choose your workflow**:

- **Developers**: Write configuration in JSON/YAML/TypeScript, commit to Git, deploy via CI/CD
- **Non-technical users**: Use the Admin Space to visually configure the same features
- **Hybrid teams**: Developers define architecture in code, business users customize via Admin

**Choose your format**—JSON, YAML, or TypeScript:

```json
// sovrium.json — Universal, simple
{
  "name": "Company CRM",
  "tables": [{ "id": 1, "name": "contacts", "fields": [...] }],
  "pages": [{ "id": 1, "path": "/", "title": "Dashboard" }]
}
```

```yaml
# sovrium.yaml — Readable, with comments
name: Company CRM
tables:
  - id: 1
    name: contacts
    fields: [...] # Your data structures
pages:
  - id: 1
    path: /
    title: Dashboard
```

```typescript
// app.ts — Type-safe, with IDE completion
import { start } from 'sovrium'

await start({
  name: 'Company CRM',
  tables: [{ id: 1, name: 'contacts', fields: [...] }],
  pages: [{ id: 1, path: '/', title: 'Dashboard' }],
})
```

**One command to run:**

```bash
sovrium start config.json    # or config.yaml
bun run app.ts               # for TypeScript
```

**Result**: A complete web application with database, authentication, API, and UI—running on your infrastructure, under your control.

### How It Works

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  CONFIG FILES    │     │  SOVRIUM RUNTIME │     │ LIVE APPLICATION │
│  (JSON/YAML/TS)  │────►│    (Engine)      │────►│ (Your Servers)   │
└──────────────────┘     └──────────────────┘     └──────────────────┘
        ▲                         │                        │
        │                         ▼                        │
        │                ┌──────────────────┐              │
        └────────────────│   ADMIN SPACE    │◄─────────────┘
                         │  (Visual Editor) │
                         └──────────────────┘
```

1. **You write**: Configuration in your preferred format (JSON, YAML, or TypeScript)
2. **Or you click**: Use the Admin Space to visually configure the same features
3. **Sovrium interprets**: Configuration at runtime (no code generation)
4. **You own**: Full application running on your servers
5. **You control**: Data, features, deployment, users—everything

### The Admin Space

The Admin Space is your **command center** for managing your Sovrium application. It provides a comprehensive suite of tools organized into logical sections:

#### App Editor (Multiple Editing Modes)

The centerpiece of the Admin Space is the **App Editor**, which offers three distinct ways to modify your application configuration:

| Mode            | Best For                          | Description                                                                                                         |
| --------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **JSON Editor** | Developers, precise control       | Direct JSON/YAML editing with syntax highlighting, validation, and autocomplete                                     |
| **Form Editor** | Business users, guided changes    | Visual forms with field validation, dropdowns, and contextual help                                                  |
| **AI Agent**    | Rapid iteration, natural language | Describe changes in plain English: "Add a status field to the tasks table with options: pending, in-progress, done" |

All three modes provide **real-time preview** so you can see changes before publishing.

```
┌─────────────────────────────────────────────────────────────────┐
│                        APP EDITOR                                │
├─────────────────┬──────────────────┬────────────────────────────┤
│   JSON EDITOR   │   FORM EDITOR    │      AI AGENT              │
│                 │                  │                            │
│  {              │  ┌────────────┐  │  "Add a priority field     │
│    "tables": [  │  │ Table Name │  │   to the tasks table       │
│      {          │  ├────────────┤  │   with values: low,        │
│        "name":  │  │ contacts   │  │   medium, high, urgent"    │
│        ...      │  └────────────┘  │                            │
│      }          │  ┌────────────┐  │  ┌──────────────────────┐  │
│    ]            │  │ Fields     │  │  │ ✓ Understood. Adding │  │
│  }              │  ├────────────┤  │  │   single_select field│  │
│                 │  │ + Add Field│  │  │   with 4 options...  │  │
│                 │  └────────────┘  │  └──────────────────────┘  │
├─────────────────┴──────────────────┴────────────────────────────┤
│                    LIVE PREVIEW                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Your application with changes applied (read-only)        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

#### Schema Versioning & History

Every configuration change is tracked with full version history:

| Feature             | Description                                                         |
| ------------------- | ------------------------------------------------------------------- |
| **Version History** | Complete timeline of all configuration changes                      |
| **Rollback**        | Restore any previous version with one click                         |
| **Diff View**       | Compare any two versions to see exactly what changed                |
| **Audit Trail**     | Track who made what changes and when (user, timestamp, description) |
| **Auto-Save**       | Draft changes are automatically saved to prevent data loss          |

#### Test Environment (Staging)

Test changes safely before deploying to production:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    DRAFT     │────►│    TEST      │────►│  PRODUCTION  │
│              │     │  (Staging)   │     │              │
│  Work on     │     │  Preview with│     │  Live app    │
│  changes     │     │  sample data │     │  for users   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                      ◄─ ROLLBACK ─►
                    (if issues detected)
```

| Feature              | Description                                                  |
| -------------------- | ------------------------------------------------------------ |
| **Staging Mode**     | Isolated environment to test changes before production       |
| **Sample Data**      | Preview with realistic data without affecting production     |
| **Publish Workflow** | Draft → Test → Production with approval gates                |
| **Instant Rollback** | Revert to previous production version if issues are detected |

#### Admin Space Features (Complete)

| Section                   | Capabilities                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------- |
| **Dashboard**             | Overview of app health, recent activity, quick actions, system alerts              |
| **App Editor**            | JSON/Form/AI editing modes, real-time preview, validation                          |
| **Schema Versions**       | Version history, rollback, diff view, audit trail                                  |
| **Test Environment**      | Staging mode, sample data preview, publish workflow                                |
| **Tables (Data Manager)** | Full CRUD operations, filtering, sorting, searching, bulk import/export (CSV/JSON) |
| **Pages**                 | Visual page builder, routing configuration, layout management                      |
| **Automations**           | Execution history, logs, retry failed runs, performance metrics                    |
| **Forms Responses**       | View submissions, export (CSV/JSON), analytics, spam filtering                     |
| **Users**                 | User list, role assignment, permission management, activity logs                   |
| **Connected Accounts**    | OAuth integrations, connection status, re-authorization, usage stats               |
| **Pages Analytics**       | Page views, unique visitors, traffic sources, user journey, performance            |
| **Theme**                 | Visual theme editor, color picker, font selection, live preview                    |
| **Settings**              | App configuration, environment variables, backup/restore                           |
| **Export/Import**         | Download config as JSON/YAML, import from other environments                       |

#### Data Manager (CRUD Operations)

Manage your table data directly from the Admin Space:

| Feature             | Description                                                |
| ------------------- | ---------------------------------------------------------- |
| **View Records**    | Browse data with filtering, sorting, and full-text search  |
| **Create/Edit**     | Add new records or modify existing ones with validation    |
| **Bulk Operations** | Import from CSV/JSON, bulk edit, bulk delete               |
| **Export**          | Export data to CSV, JSON, or Excel                         |
| **Validation**      | Real-time validation against field constraints before save |

#### Automations Dashboard

Monitor and manage your workflow automations:

| Feature               | Description                                               |
| --------------------- | --------------------------------------------------------- |
| **Execution History** | Complete log of all automation runs                       |
| **Status Tracking**   | Success, failure, and pending states with detailed logs   |
| **Retry Failed**      | Re-run failed automations with one click                  |
| **Performance**       | Execution time, success rate, and error frequency metrics |

#### Forms Responses

Centralized management of all form submissions:

| Feature              | Description                                        |
| -------------------- | -------------------------------------------------- |
| **Submissions List** | View all form responses with filtering and sorting |
| **Export**           | Download responses as CSV, JSON, or Excel          |
| **Analytics**        | Submission rate, completion rate, drop-off points  |
| **Moderation**       | Spam filtering, flagging, and approval workflows   |

#### Connected Accounts (Integrations)

Manage OAuth connections to external services:

| Feature               | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| **Connection Status** | View all integrations: connected, expired, or error states |
| **Re-authorize**      | Refresh expired OAuth tokens with one click                |
| **Usage Stats**       | API calls made per integration, rate limit status          |
| **Disconnect**        | Safely remove integrations with data retention options     |

#### Pages Analytics

Understand how users interact with your application:

| Feature              | Description                                            |
| -------------------- | ------------------------------------------------------ |
| **Traffic Overview** | Page views, unique visitors, sessions                  |
| **Traffic Sources**  | Where users come from (direct, referral, search)       |
| **User Journey**     | Flow visualization of how users navigate through pages |
| **Performance**      | Page load times, Core Web Vitals, error rates          |

**Key Insight**: The Admin Space and configuration files are **two views of the same data**. Changes in one are reflected in the other. This means:

- Developers can review Admin changes in version control
- Business users can customize apps without touching code
- Configuration remains the **single source of truth**
- All changes are versioned with full rollback capability

---

## Core Principles: Why We Build Sovrium This Way

### 1. **Digital Sovereignty**

Organizations should **own** their information systems, not **rent** them.

- **Your data** lives on your infrastructure
- **Your features** defined by your business needs
- **Your control** over deployment, security, and access
- **Your independence** from vendor decisions

### 2. **Configuration Over Coding**

Business applications should be **configured**, not **programmed**.

- **Dual interface**: Text files for developers, visual Admin Space for business users
- **Configuration as source of truth**: JSON/YAML/TypeScript files define everything
- **Version control** (Git) for all configuration changes
- **Type safety** with compile-time validation
- **Format flexibility** — choose what fits your team (JSON for simplicity, YAML for readability, TypeScript for type safety)
- **Reusable templates** as organizational knowledge
- **Admin Space sync**: Visual changes automatically reflected in configuration files

### 3. **Minimal Dependencies**

Reduce technical dependencies to **only essential infrastructure**.

- **Depend on**: Commodity compute (AWS/Vercel) + storage (PostgreSQL/S3)
- **Don't depend on**: Proprietary SaaS platforms, vendor APIs, closed ecosystems
- **Source-available**: Audit, modify, extend the platform yourself
- **Self-hosted**: No external service calls, no vendor outages

### 4. **Business Focus**

Engineering teams should focus on **business logic**, not **infrastructure complexity**.

- **No DevOps overhead**: Sovrium handles server, database, auth, APIs
- **No integration hell**: One platform, one configuration, one deployment
- **No vendor research**: Stop evaluating SaaS tools, start building
- **Instant iteration**: Change configuration, refresh browser, done

### 5. **Configuration Reusability**

Configuration templates become **organizational assets** that accelerate development.

```typescript
// Base template: CRM
const crmTemplate = { /* customer management logic */ }

// Reuse for different departments
const salesCRM = { ...crmTemplate, customFields: [...] }
const supportCRM = { ...crmTemplate, workflows: [...] }
const partnerCRM = { ...crmTemplate, permissions: [...] }

// Build 3 applications in minutes, not months
```

**Templates evolve with your organization**, capturing institutional knowledge in version-controlled code.

---

## What Sovrium Is (and Isn't)

### ✅ Sovrium IS

- **Self-hosted application**: Runs on your infrastructure with built-in Admin Space
- **Alternative to**: Airtable, Retool, Notion, Webflow, Zapier (self-hosted, config-driven)
- **Installation**: Bun package (`npm install sovrium`)
- **Deployment**: Your infrastructure (AWS, Vercel, Docker, bare metal)
- **Configuration**: JSON, YAML, or TypeScript files (version-controlled, your choice)
- **Admin interface**: Visual management for configuration, users, and monitoring
- **Source**: Source-available, fair-code model
- **Target users**: Developers, DevOps teams, technical organizations, and their business stakeholders
- **Best for**: Internal tools, customer portals, business applications, APIs

### ❌ Sovrium IS NOT

- **Not a SaaS**: No cloud hosting, no vendor servers—you own everything
- **Not code-only**: Has visual Admin Space for non-technical users
- **Not a framework**: No code generation, runtime interpretation only
- **Not proprietary**: Source-available, audit and modify freely
- **Not suitable for**: Real-time gaming, high-frequency trading, native mobile apps

### The WordPress Analogy

| Aspect              | WordPress                          | Sovrium                                    |
| ------------------- | ---------------------------------- | ------------------------------------------ |
| **Core Purpose**    | Content Management System          | Business Application Platform              |
| **Admin Interface** | `/wp-admin` for content & settings | `/admin` for config, users & monitoring    |
| **Configuration**   | Themes + Plugins + Settings        | Tables + Pages + Automations + Auth        |
| **Data Storage**    | Posts, Pages, Media                | Tables with custom fields & relationships  |
| **Extensibility**   | PHP plugins and themes             | JSON/YAML/TS configuration + templates     |
| **Self-Hosted**     | Yes, on any PHP server             | Yes, on any server with Bun/Node           |
| **Version Control** | Database + files (complex)         | JSON/YAML/TS files (Git-native)            |
| **Target Users**    | Content creators, bloggers         | Developers + business users building tools |

**Key Difference**: WordPress is for **content websites**. Sovrium is for **business applications** (internal tools, customer portals, data management, APIs).

---

## The Sovrium Advantage

### vs. Traditional No-Code SaaS

| Aspect              | Sovrium                        | Airtable/Retool/Notion        |
| ------------------- | ------------------------------ | ----------------------------- |
| **Data Ownership**  | ✅ Your servers                | ❌ Vendor cloud               |
| **Source Code**     | ✅ Available (fair-code)       | ❌ Proprietary                |
| **Monthly Cost**    | $0 (infra only)                | $20-50/user/month             |
| **Vendor Lock-in**  | ✅ None (self-hosted)          | ❌ Complete                   |
| **Customization**   | ✅ Unlimited (source access)   | ⚠️ Limited to vendor features |
| **Version Control** | ✅ Git-native config files     | ⚠️ Limited or none            |
| **Privacy**         | ✅ 100% your control           | ❌ Third-party servers        |
| **Dependencies**    | ✅ Minimal (compute + storage) | ❌ Full vendor dependency     |

### vs. Traditional Development

| Aspect               | Sovrium                  | Custom Development   |
| -------------------- | ------------------------ | -------------------- |
| **Development Time** | Days                     | Months               |
| **Infrastructure**   | ✅ Included              | Build from scratch   |
| **Authentication**   | ✅ Included              | Build from scratch   |
| **Database**         | ✅ Included              | Build from scratch   |
| **API**              | ✅ Included              | Build from scratch   |
| **UI**               | ✅ Included              | Build from scratch   |
| **Maintenance**      | ✅ Zero (config changes) | Ongoing code updates |
| **Flexibility**      | ⚠️ Config-limited        | ✅ Unlimited         |

**Sovrium hits the sweet spot**: **80% faster than custom development**, **100% more control than SaaS**.

---

## Vision: The Future We're Building

### Short-term (2025-2026)

**Phase 1**: Core platform foundation

- Tables, fields, relationships
- Pages with dynamic routing
- Basic authentication
- REST API generation
- Configuration validation
- **Admin Space MVP**: User management, Data browser, basic CRUD operations

**Phase 2**: Business application essentials

- Workflows and automations
- External service integrations
- Advanced permissions
- Data visualization
- Template marketplace
- **Admin Space Enhanced**:
  - App Editor with JSON/Form modes
  - Schema versioning with rollback
  - Test environment (staging)
  - Forms responses management
  - Automations dashboard with execution history
  - Connected accounts management
  - Basic analytics

**Phase 3**: Advanced Admin Capabilities

- **AI Agent Editor**: Natural language configuration changes
- **Advanced Analytics**: User journey, traffic sources, performance metrics
- **Publishing Workflow**: Draft → Test → Production with approval gates
- **Bulk Operations**: Import/export CSV/JSON, bulk edit, bulk delete
- **Audit Trail**: Complete history of who changed what and when

### Long-term (2027+)

**Phase 4**: Ecosystem maturity

- **Template marketplace**: Community-contributed application templates
- **Plugin system**: Extend Sovrium with custom modules
- **Multi-tenancy**: One Sovrium instance, multiple organizations
- **Enterprise features**: SSO, compliance, advanced RBAC
- **Developer tools**: CLI, IDE plugins, testing frameworks
- **Advanced AI capabilities**: AI-powered data insights, automated optimization suggestions

### The Ultimate Goal

**Make Sovrium the default choice for organizations seeking digital sovereignty.**

When businesses need internal tools, customer portals, or business applications, they should think:

> "Instead of buying another SaaS subscription, let's configure it in Sovrium."

---

## Who Sovrium Is For

### Primary Audience

- **Technical organizations** with in-house engineering teams
- **Startups** seeking to minimize SaaS costs
- **Enterprises** with data sovereignty requirements
- **DevOps teams** managing internal tools
- **Consultancies** building client applications
- **Business teams** who need to manage apps via Admin Space (with developer support for initial setup)

### Use Cases

1. **Internal Tools**: Admin dashboards, employee portals, data management
2. **Customer Portals**: Self-service interfaces, account management, support systems
3. **Business Applications**: CRM, inventory management, project tracking
4. **API Platforms**: REST endpoints, webhooks, third-party integrations
5. **Static Websites**: Marketing sites, landing pages, documentation

### When to Choose Sovrium

✅ **Choose Sovrium if you**:

- Value data ownership and privacy
- Have engineering resources (can write configuration files)
- Want to minimize SaaS subscriptions
- Need to build multiple internal tools
- Require customization beyond vendor offerings
- Want both developer workflow (code) AND business user workflow (Admin Space)

❌ **Don't choose Sovrium if you**:

- Have zero technical staff (initial setup requires developers)
- Need real-time gaming or mobile apps
- Want fully managed cloud service (Sovrium is self-hosted)
- Prefer purely visual no-code without any configuration files

---

## Technical Architecture (High-Level)

### The Stack

- **Runtime**: Bun 1.3+ (fast JavaScript runtime)
- **Server**: Hono (lightweight web framework)
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Better Auth (session management, OAuth, SSO)
- **Frontend**: React 19 + Tailwind CSS
- **API**: Auto-generated REST endpoints
- **Admin Space**: Built-in visual management interface

### Application Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SOVRIUM INSTANCE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐  ┌──────────────────────────┐  ┌─────────────────┐│
│  │  PUBLIC APP     │  │      ADMIN SPACE         │  │   REST API      ││
│  │  /              │  │      /admin              │  │   /api          ││
│  │                 │  │                          │  │                 ││
│  │  Your Pages     │  │  ┌────────────────────┐  │  │  Auto-generated ││
│  │  Your Theme     │  │  │ App Editor         │  │  │  CRUD endpoints ││
│  │  Your Content   │  │  │ (JSON/Form/AI)     │  │  │  Auth endpoints ││
│  │  Your Forms     │  │  └────────────────────┘  │  │  Webhooks       ││
│  └─────────────────┘  │  ┌────────────────────┐  │  └─────────────────┘│
│           │           │  │ Schema Versions    │  │           │         │
│           │           │  │ Test Environment   │  │           │         │
│           │           │  └────────────────────┘  │           │         │
│           │           │  ┌────────────────────┐  │           │         │
│           │           │  │ Data Manager       │  │           │         │
│           │           │  │ Automations        │  │           │         │
│           │           │  │ Forms Responses    │  │           │         │
│           │           │  │ Analytics          │  │           │         │
│           │           │  └────────────────────┘  │           │         │
│           │           │  ┌────────────────────┐  │           │         │
│           │           │  │ Users & Access     │  │           │         │
│           │           │  │ Connected Accounts │  │           │         │
│           │           │  │ Settings           │  │           │         │
│           │           │  └────────────────────┘  │           │         │
│           │           └──────────────────────────┘           │         │
│           │                        │                         │         │
│           ▼                        ▼                         ▼         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    SOVRIUM RUNTIME ENGINE                        │   │
│  │  • Configuration Interpreter    • Schema Versioning              │   │
│  │  • Database Management          • Test/Production Environments   │   │
│  │  • Authentication & Auth        • Analytics Collection           │   │
│  │  • API Generation               • Automation Executor            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                CONFIGURATION (Source of Truth)                   │   │
│  │  JSON / YAML / TypeScript files                                  │   │
│  │  Version controlled in Git with full history                     │   │
│  │  Draft → Test → Production deployment workflow                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Configuration Schema

All features are defined in `src/domain/models/app/` using Effect Schema:

- **Tables**: Database schemas (fields, relationships, validations)
- **Pages**: Web interfaces (routes, components, layouts)
- **Automations**: Workflows (triggers, actions, conditions)
- **Connections**: External services (APIs, webhooks, integrations)
- **Auth**: Authentication methods, roles, permissions
- **Theme**: Colors, fonts, branding, styling

### Admin Space Features

The Admin Space provides a comprehensive management interface organized into logical sections:

#### Core Features

| Section              | Capabilities                                                                       |
| -------------------- | ---------------------------------------------------------------------------------- |
| **Dashboard**        | Overview of app health, recent activity, quick actions, system alerts              |
| **App Editor**       | Three editing modes: JSON Editor, Form Editor, AI Agent with real-time preview     |
| **Schema Versions**  | Version history, rollback, diff view, audit trail of all configuration changes     |
| **Test Environment** | Staging mode to test changes before production, publish workflow, instant rollback |

#### Data Management

| Section             | Capabilities                                                                       |
| ------------------- | ---------------------------------------------------------------------------------- |
| **Tables (CRUD)**   | Full CRUD operations, filtering, sorting, searching, bulk import/export (CSV/JSON) |
| **Forms Responses** | View submissions, export (CSV/JSON), submission analytics, spam filtering          |

#### Application Building

| Section           | Capabilities                                                                      |
| ----------------- | --------------------------------------------------------------------------------- |
| **Tables Schema** | Create/edit tables, manage fields, relationships, validation rules                |
| **Pages**         | Visual page builder, routing configuration, layout management                     |
| **Automations**   | Workflow builder, execution history, logs, retry failed runs, performance metrics |
| **Theme**         | Visual theme editor, color picker, font selection, live preview                   |

#### Users & Access

| Section                | Capabilities                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- |
| **Users**              | User list, role assignment, permission management, activity logs              |
| **Connected Accounts** | OAuth integrations status, re-authorization, usage statistics per integration |

#### Analytics & Monitoring

| Section             | Capabilities                                                                    |
| ------------------- | ------------------------------------------------------------------------------- |
| **Pages Analytics** | Page views, unique visitors, traffic sources, user journey, performance metrics |
| **Activity Logs**   | Track user activity, API usage, system events                                   |

#### Settings & Configuration

| Section           | Capabilities                                                 |
| ----------------- | ------------------------------------------------------------ |
| **Settings**      | App configuration, environment variables, backup/restore     |
| **Export/Import** | Download config as JSON/YAML, import from other environments |

---

## Get Involved

### How to Contribute

- **GitHub**: [github.com/sovrium/sovrium](https://github.com/sovrium/sovrium)
- **Documentation**: Improve docs, write guides, create templates
- **Code**: Submit PRs for features or bug fixes
- **Feedback**: Share use cases, report issues, suggest improvements

### Contact

- **Website**: sovrium.com
- **License inquiries**: license@sovrium.com
- **General questions**: GitHub Issues

---

## Summary: Why Sovrium Exists

**The Problem**: Organizations are trapped in SaaS dependency—paying monthly fees, losing data control, and adapting their business to vendor limitations.

**The Solution**: Sovrium gives organizations **digital sovereignty**—a self-hosted platform with both configuration files (for developers) and a comprehensive Admin Space (for business users), all running on your infrastructure.

**The Admin Space** provides:

- **Multiple Editing Modes**: JSON, Form, and AI Agent editors with real-time preview
- **Schema Versioning**: Full history, diff view, and instant rollback
- **Test Environment**: Draft → Test → Production workflow with staging
- **Data Management**: CRUD operations, bulk import/export, form responses
- **Analytics**: Page views, traffic sources, user journey, performance metrics
- **Integrations**: Connected accounts management with OAuth support

**The Vision**: A world where every organization can build the software they need, without surrendering control to SaaS vendors or drowning in infrastructure complexity.

**The Approach**: Like WordPress revolutionized content management with self-hosted software and an admin panel, Sovrium revolutionizes business applications with self-hosted configuration and a visual Admin Space—complete with AI-assisted editing, staging environments, and enterprise-grade analytics.

**The Result**: Organizations become **agile, independent, and focused**—building tools that serve their business, not adapting their business to fit available tools.

---

> **"Own your data. Own your tools. Own your future."**
> — The Sovrium Mission
