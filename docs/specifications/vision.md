# Sovrium Vision & Mission

> **⚠️ Vision Document**: This document describes the **purpose, vision, and target state** for Sovrium. Most features described here are **not yet implemented**. For current capabilities, see [ROADMAP.md](../../ROADMAP.md).

---

## Mission Statement

**To make every organization sovereign in their information systems—free from SaaS lock-in, in complete control of their data, and empowered to build business applications through simple JSON configuration.**

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

Sovrium is a **source-available runtime** that interprets JSON configuration files to build and serve full-featured web applications—without code generation, without vendor lock-in, without loss of control.

```typescript
// Your entire business application in one JSON file
{
  "name": "Company CRM",
  "tables": [ /* your data structures */ ],
  "pages": [ /* your web interfaces */ ],
  "automations": [ /* your workflows */ ],
  "connections": [ /* your integrations */ ]
}
```

**One command to run:**

```bash
bun run sovrium start config.json
```

**Result**: A complete web application with database, authentication, API, and UI—running on your infrastructure, under your control.

### How It Works

```
JSON Configuration → Sovrium Runtime → Live Application
     (Your business logic)  (Our engine)    (Your infrastructure)
```

1. **You write**: JSON configuration describing your business needs
2. **Sovrium interprets**: Configuration at runtime (no code generation)
3. **You own**: Full application running on your servers
4. **You control**: Data, features, deployment, everything

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

- **JSON/TypeScript** instead of visual drag-and-drop
- **Version control** (Git) for all configuration
- **Type safety** with compile-time validation
- **Reusable templates** as organizational knowledge

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

JSON templates become **organizational assets** that accelerate development.

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

- **Alternative to**: Airtable, Retool, Notion, Webflow, Zapier (self-hosted, config-driven)
- **Installation**: Bun package (`npm install sovrium`)
- **Deployment**: Your infrastructure (AWS, Vercel, Docker, bare metal)
- **Configuration**: JSON/TypeScript files (version-controlled)
- **Source**: Source-available, fair-code model
- **Target users**: Developers, DevOps teams, technical organizations
- **Best for**: Internal tools, customer portals, business applications, APIs

### ❌ Sovrium IS NOT

- **Not a SaaS**: No cloud hosting, no vendor servers
- **Not visual**: No drag-and-drop GUI (configuration-as-code)
- **Not a framework**: No code generation, runtime interpretation only
- **Not proprietary**: Source-available, audit and modify freely
- **Not suitable for**: Real-time gaming, high-frequency trading, native mobile apps

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
| **Version Control** | ✅ Git-native JSON             | ⚠️ Limited or none            |
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

**Phase 2**: Business application essentials

- Workflows and automations
- External service integrations
- Advanced permissions
- Data visualization
- Template marketplace

### Long-term (2027+)

**Phase 3**: Ecosystem maturity

- **Template marketplace**: Community-contributed application templates
- **Plugin system**: Extend Sovrium with custom modules
- **Multi-tenancy**: One Sovrium instance, multiple organizations
- **Enterprise features**: SSO, compliance, advanced RBAC
- **Developer tools**: CLI, IDE plugins, testing frameworks

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

### Use Cases

1. **Internal Tools**: Admin dashboards, employee portals, data management
2. **Customer Portals**: Self-service interfaces, account management, support systems
3. **Business Applications**: CRM, inventory management, project tracking
4. **API Platforms**: REST endpoints, webhooks, third-party integrations
5. **Static Websites**: Marketing sites, landing pages, documentation

### When to Choose Sovrium

✅ **Choose Sovrium if you**:

- Value data ownership and privacy
- Have engineering resources (can write JSON)
- Want to minimize SaaS subscriptions
- Need to build multiple internal tools
- Require customization beyond vendor offerings

❌ **Don't choose Sovrium if you**:

- Prefer visual drag-and-drop interfaces
- Don't have technical staff
- Need real-time gaming or mobile apps
- Want zero infrastructure management

---

## Technical Architecture (High-Level)

### The Stack

- **Runtime**: Bun 1.3+ (fast JavaScript runtime)
- **Server**: Hono (lightweight web framework)
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Better Auth (session management, OAuth, SSO)
- **Frontend**: React 19 + Tailwind CSS
- **API**: Auto-generated REST endpoints

### Configuration Schema

All features are defined in `src/domain/models/app/` using Effect Schema:

- **Tables**: Database schemas (fields, relationships, validations)
- **Pages**: Web interfaces (routes, components, layouts)
- **Automations**: Workflows (triggers, actions, conditions)
- **Connections**: External services (APIs, webhooks, integrations)

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

**The Solution**: Sovrium gives organizations **digital sovereignty**—own your data, define your features, build your tools, all through simple JSON configuration.

**The Vision**: A world where every organization can build the software they need, without surrendering control to SaaS vendors or drowning in infrastructure complexity.

**The Result**: Organizations become **agile, independent, and focused**—building tools that serve their business, not adapting their business to fit available tools.

---

> **"Own your data. Own your tools. Own your future."**
> — The Sovrium Mission
