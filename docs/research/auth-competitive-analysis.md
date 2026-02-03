# Auth & User Management Competitive Analysis

> **Research Date**: February 2026
> **Purpose**: Inform Sovrium Auth specification design by analyzing user management patterns across leading no-code/low-code platforms

## Executive Summary

### Key Findings

1. **Two-Tier Permission Model is Standard**: All platforms separate **workspace/account-level roles** from **resource-level roles**. Users have a global role (Owner, Admin, Member) AND resource-specific permissions (Can Edit, Can View).

2. **Member vs Guest Distinction is Universal**: Every platform differentiates between full workspace members (billable, full access) and guests (limited access, often free or reduced cost).

3. **Teams/Groups Enable Scalable Permissions**: Enterprise customers universally require group-based permission assignment rather than individual user management.

4. **Row-Level Security is Backend-Specific**: Only Supabase (as a BaaS) implements true database-level row security. Others achieve similar results through application-level filtering (Airtable Interfaces, Notion filtered views).

5. **Field-Level Permissions are Premium**: Granular field visibility/editability is typically an enterprise feature (Airtable, Retool).

6. **SSO/SAML is Table Stakes for Enterprise**: All platforms support SAML 2.0 SSO at Business/Enterprise tiers. SCIM provisioning is increasingly common.

7. **Billing Models Vary**: Per-seat (Notion, Webflow, Zapier Teams), per-collaborator-type (Airtable), or usage-based (Supabase).

### Common Patterns Identified

| Pattern                                  | Adoption | Examples                                          |
| ---------------------------------------- | -------- | ------------------------------------------------- |
| Owner > Admin > Member > Guest hierarchy | 7/7      | All platforms                                     |
| Workspace + Resource permission layers   | 6/7      | All except Memberstack (plan-based gating)        |
| Teams/Groups for bulk permissions        | 5/7      | Airtable, Retool, Zapier, Notion, Webflow         |
| Free guests / paid members split         | 5/7      | All except Supabase (usage-based), Memberstack    |
| SAML SSO at Enterprise tier              | 6/7      | All except Memberstack (OIDC only)                |
| Custom roles (Enterprise)                | 4/7      | Airtable, Retool, Zapier, Webflow                 |
| Field-level permissions                  | 3/7      | Airtable, Retool, Supabase (via RLS)              |
| Row-level security                       | 2/7      | Supabase (native), Airtable (via Interfaces)      |
| Plan-based content gating                | 1/7      | Memberstack (unique approach)                     |

### User Pain Points (from community discussions)

- **Airtable**: No true record-level permissions based on field values; workarounds via Interfaces
- **Notion**: Guest limitations frustrating for external collaboration at scale
- **Webflow**: No granular page-level permissions for Editors
- **Zapier**: Folder-level sharing insufficient for large organizations
- **Retool**: Complex RBAC setup required for fine-grained control
- **Memberstack**: No native 2FA for members; client-side security concerns; Stripe-only payments

---

## Per-Product Analysis

### 1. Airtable

**Sources**: [Airtable Permissions Overview](https://support.airtable.com/docs/airtable-permissions-overview), [Managing User Access](https://support.airtable.com/docs/managing-user-access-to-workspaces-and-bases), [Field & Table Editing Permissions](https://support.airtable.com/docs/using-field-and-table-editing-permissions), [Collaborator Billing](https://support.airtable.com/docs/how-collaborators-impact-billing), [Softr Permissions Guide](https://www.softr.io/blog/airtable-permissions)

#### Hierarchy Structure

```
Organization (Enterprise Hub)
    └── Org Unit (Enterprise only)
        └── Workspace
            └── Base
                └── Table
                    └── View
                    └── Interface
```

#### Role System

**Workspace Roles:**
| Role | Capabilities |
|------|-------------|
| **Owner** | Full control, delete workspace, manage all bases, transfer ownership |
| **Creator** | Create bases, manage workspace settings, invite users |
| **Editor** | Access all bases, invite Editors/Commenters/Read-only, rename workspace |
| **Commenter** | Comment on records, cannot edit data |
| **Read-only** | View-only access |

**Enterprise Admin Roles:**

- **Org Owner**: Full organization control
- **Org Unit Admin**: Manage assigned org units (Enterprise Hub)
- **User Admin**: Manage users, licenses, groups
- **Billing Admin**: Manage billing only

#### Permission Granularity

- **Base-level**: Full access, Editor, Commenter, Read-only
- **Table-level**: Lock table editing to Creators/Owners only
- **Field-level**: Lock specific fields to Creators/Owners only
- **Record-level**: Via Interfaces only - filter by user field, not native to base

**Key Limitation**: Cannot set permissions for specific sections of a base. Workaround is Airtable Interfaces which can filter records by logged-in user.

#### Teams/Groups

- User Groups for bulk permission assignment (Business/Enterprise)
- Groups can be assigned workspace-level or base-level access
- SCIM sync available for Enterprise

#### Authentication

- Email/password (default)
- Google OAuth
- SAML SSO (Business/Enterprise)
- 2FA supported

#### Billing Model

| Plan                   | Billable Users                          |
| ---------------------- | --------------------------------------- |
| Free                   | Up to 5 Creators/Editors, 50 Commenters |
| Team ($20/user/mo)     | Commenters and above                    |
| Business ($45/user/mo) | Editors and above (Commenters free)     |
| Enterprise             | Custom                                  |

**Guests**: Portals add-on ($120-150/mo for 15 seats) for external collaborators

---

### 2. Retool

**Sources**: [Retool RBAC Guide](https://retoolers.io/blog-posts/secure-role-based-access-in-retool-scalable-permission-layers), [Role-Based Permissions Docs](https://docs.retool.com/changelog/roles-permissions), [SAML SSO Configuration](https://docs.retool.com/sso/tutorials/custom/saml), [SCIM Group Sync](https://docs.retool.com/sso/guides/group-sync/saml-group-sync)

#### Hierarchy Structure

```
Organization
    └── Space (multi-space feature)
        └── Folder
            └── App / Workflow / Resource
```

#### Role System

**Built-in Roles:**
| Role | Capabilities |
|------|-------------|
| **Admin** | Full organization control, manage users, configure SSO |
| **Developer** | Build and edit apps, queries, resources |
| **Viewer** | Use apps, cannot modify |

**Custom Roles (Enterprise)**:

- Create roles with granular permissions
- Permissions include: View apps, Edit apps, Use resources, Manage resources, Admin settings

#### Permission Granularity

- **App-level**: View, Edit, Use
- **Query-level**: Restrict who can edit SQL queries
- **Resource-level**: Control database/API connection access
- **Row-level**: Via custom queries with user context (`retoolContext.user`)

**Key Strength**: `retoolContext.user.groups` enables dynamic, group-based row filtering in queries

#### Teams/Groups

- Permission Groups for bulk role assignment
- Groups sync from IdP via SAML/OIDC
- `retoolContext.user.groups` array accessible in app logic

#### User Types

| Type               | Description                              |
| ------------------ | ---------------------------------------- |
| **Standard Users** | Build and modify apps                    |
| **End Users**      | Interact with apps only                  |
| **External Users** | Access embedded apps (customers/clients) |

#### Authentication

- Email/password
- Google OAuth
- SAML 2.0 SSO (Business/Enterprise)
- OIDC SSO
- SCIM provisioning
- Multiple auth methods via separate Spaces

#### Billing Model

- Per-seat pricing
- Standard Users vs End Users priced differently
- External Users have separate pricing
- Enterprise: Custom pricing

---

### 3. Zapier

**Sources**: [User Roles and Permissions](https://help.zapier.com/hc/en-us/articles/39698983334797-User-roles-and-permissions-in-Team-and-Enterprise-accounts), [Manage Team Account](https://help.zapier.com/hc/en-us/articles/8496291989645-Manage-your-Zapier-Team-or-Enterprise-account), [Create Teams in Enterprise](https://help.zapier.com/hc/en-us/articles/8496280450189-Create-teams-in-your-Enterprise-account), [Pricing](https://zapier.com/pricing)

#### Hierarchy Structure

```
Account (Team/Enterprise)
    └── Team (Enterprise only)
        └── Folder
            └── Zap / Table / Interface / Canvas
```

#### Role System

**Account Roles (2025 Standardization):**
| Role | Capabilities |
|------|-------------|
| **Owner** | Full account control, billing, transfer ownership |
| **Admin** | Manage members, settings, cannot delete account |
| **Member** | Create and manage own Zaps, access shared resources |

**Asset Roles:**

- Owner, Editor, Viewer at Zap/Table/Interface level
- Folder-level sharing

#### Permission Granularity

- **Account-level**: Owner, Admin, Member
- **Asset-level**: Per Zap, Table, Interface, Canvas
- **Folder-level**: Share entire folders with teams
- **Connection-level**: Share app connections across team

**2025 Update**: Standardized permissions across all Zapier products (Zaps, Tables, Interfaces, Chatbots, Agents, Canvas)

#### Teams/Groups

- **Teams** (Enterprise): Subset of users who collaborate and share connections
- Team members only access what they need
- Account admins have full access across all teams

#### Authentication

- Email/password
- Google OAuth
- SAML 2.0 SSO (Team add-on, Enterprise included)
- SCIM provisioning (Enterprise)

#### Billing Model

| Plan         | Users     | Price     |
| ------------ | --------- | --------- |
| Free         | 1         | $0        |
| Professional | 1         | $29.99/mo |
| Team         | Up to 25  | $69/mo    |
| Enterprise   | Unlimited | Custom    |

**Key Feature**: Annual task limits on Enterprise (tasks don't expire monthly)

---

### 4. Notion

**Sources**: [Manage Members & Guests](https://www.notion.com/help/add-members-admins-guests-and-groups), [Sharing & Permissions](https://www.notion.com/help/sharing-and-permissions), [Who's Who in a Workspace](https://www.notion.com/help/whos-who-in-a-workspace), [Organization Setup Guide](https://www.notion.com/help/guides/everything-about-setting-up-and-managing-an-organization-in-notion), [Billing](https://www.notion.com/help/billing)

#### Hierarchy Structure

```
Organization (Enterprise)
    └── Workspace
        └── Teamspace
            └── Page
                └── Sub-page
                └── Database
```

#### Role System

**Organization Roles (Enterprise):**
| Role | Capabilities |
|------|-------------|
| **Organization Owner** | Super admin across all workspaces |
| **Workspace Owner** | Manage specific workspace |

**Workspace Roles:**
| Role | Capabilities |
|------|-------------|
| **Workspace Owner** | Full control, settings, billing, delete workspace |
| **Membership Admin** | Manage members/guests/groups (Enterprise) |
| **Member** | Access all team content, create pages |
| **Guest** | Access only invited pages |

**Teamspace Roles:**
| Role | Capabilities |
|------|-------------|
| **Teamspace Owner** | Manage teamspace settings, members |
| **Teamspace Member** | Access teamspace content |

#### Permission Granularity

- **Page-level**: Full Access, Can Edit, Can Comment, Can View
- **Teamspace-level**: Default, Open, Closed, Private settings
- **Database-level**: Permission inheritance from containing page
- **No field-level**: Cannot hide specific database properties per user

**Key Feature**: "Anyone with link" public sharing option

#### Teams/Groups

- **Groups**: Bulk permission assignment (Business/Enterprise)
- **Teamspaces**: Dedicated spaces for departments/teams
- Teamspace settings control join behavior (Open, Closed, Private)

#### Member vs Guest

| Aspect        | Member           | Guest                |
| ------------- | ---------------- | -------------------- |
| Access        | All team content | Invited pages only   |
| Private pages | Yes              | No                   |
| Billing       | Per-seat         | Free (limited count) |
| SSO           | Yes              | No                   |

Guest limits: Plus (100), Business (250), Enterprise (custom)

#### Authentication

- Email/password
- Google OAuth
- Apple Sign-in
- SAML 2.0 SSO (Business/Enterprise)
- 2FA (all plans)
- SCIM provisioning (Enterprise)

#### Billing Model

| Plan       | Price         | Guests |
| ---------- | ------------- | ------ |
| Free       | $0            | 10     |
| Plus       | $10/member/mo | 100    |
| Business   | $20/member/mo | 250    |
| Enterprise | Custom        | Custom |

**2025 Change**: AI bundled into Business/Enterprise only; Plus loses full AI access

---

### 5. Webflow

**Sources**: [Roles and Permissions Overview](https://help.webflow.com/hc/en-us/articles/33961273067411-Roles-and-permissions-overview), [Workspace Roles](https://help.webflow.com/hc/en-us/articles/41015530193811-Workspace-roles-and-permissions), [Site Roles](https://help.webflow.com/hc/en-us/articles/41015796747667-Site-roles-and-permissions), [Custom Roles](https://help.webflow.com/hc/en-us/articles/46651804072467-Create-and-manage-custom-roles), [SSO](https://help.webflow.com/hc/en-us/articles/46651862433683-Single-Sign-On-SSO-Login), [Pricing Updates 2024](https://help.webflow.com/hc/en-us/articles/36037948441363-Updates-to-our-pricing-and-product-strategy-for-December-2024)

#### Hierarchy Structure

```
Workspace
    └── Site
        └── Page (static)
        └── CMS Collection
            └── CMS Item
```

#### Role System

**Two-Tier System**: Each user has BOTH a Workspace role AND a Site role

**Workspace Roles:**
| Role | Capabilities |
|------|-------------|
| **Owner** | Full control, billing, delete workspace |
| **Admin** | Manage members, settings, site access |
| **Member** | Access assigned sites |
| **Guest** | Limited site access (SSO exempt) |
| **Commenter** | View and comment only |

**Site Roles:**
| Role | Capabilities |
|------|-------------|
| **Site Manager** | Full site control, publish, settings |
| **Designer** | Full design access, can publish |
| **Can Design (Limited)** | Design access, cannot publish site |
| **Content Editor** | CMS content only |
| **Reviewer** | View and comment only |

#### Permission Granularity

- **Site-level**: Full access per site
- **CMS Collection-level**: Restrict which collections Editors can manage
- **No page-level**: Cannot restrict specific static pages (2025)
- **Custom roles**: Up to 20 custom roles (Growth/Enterprise)

**Key Limitation**: Cannot grant "edit this page only" permissions

#### Seat Types (2025)

| Seat Type | Price  | Access                      |
| --------- | ------ | --------------------------- |
| Full      | $39/mo | Design + admin              |
| Limited   | $15/mo | Content editing, components |
| Free      | $0     | Review and comment          |

#### Teams/Groups

- Site-specific access controls who sees which sites
- No native "groups" feature - permissions per user
- SSO groups via SAML (Enterprise)

#### Authentication

- Email/password
- Google OAuth
- SAML SSO (Enterprise only)
- SCIM/JIT provisioning (Enterprise)

**Guest Exception**: Guests bypass SSO enforcement

#### Billing Model

| Plan       | Included Seats | Additional Seats      |
| ---------- | -------------- | --------------------- |
| Core       | 1 Full         | Full $39, Limited $15 |
| Growth     | 1 Full         | Full $39, Limited $15 |
| Enterprise | Custom         | Custom                |

---

### 6. Supabase

**Sources**: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Custom Roles](https://supabase.com/docs/guides/storage/schema/custom-roles), [RBAC Guide](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac), [Organization SSO](https://supabase.com/docs/guides/platform/sso), [Pricing](https://supabase.com/pricing)

#### Hierarchy Structure

```
Organization
    └── Project
        └── Database
            └── Table (with RLS policies)
        └── Storage Bucket
        └── Edge Functions
```

**Note**: Supabase is a BaaS, so "users" means both dashboard users AND application end-users

#### Role System

**Dashboard Roles (Organization):**
| Role | Capabilities |
|------|-------------|
| **Owner** | Full organization control |
| **Admin** | Manage projects, members |
| **Developer** | Access projects, cannot manage billing |

**Database Roles (for RLS):**
| Role | Description |
|------|-------------|
| `anon` | Unauthenticated users |
| `authenticated` | Logged-in users |
| Custom roles | e.g., `manager`, `admin`, `moderator` |

#### Permission Granularity (via RLS)

- **Table-level**: Enable/disable RLS per table
- **Row-level**: SQL policies filter by `auth.uid()`, `auth.jwt()`, custom claims
- **Column-level**: Via views or RLS policies with column checks
- **Operation-level**: Separate SELECT, INSERT, UPDATE, DELETE policies

**RLS Policy Example:**

```sql
CREATE POLICY "Users see own data" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Team members see team data" ON projects
  FOR SELECT USING (team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  ));
```

#### Teams/Groups (Application-Level)

Supabase doesn't provide built-in teams - you implement via:

1. **Custom claims in JWT**: Add `role`, `team_id` to token
2. **Membership tables**: `team_members` table with RLS
3. **RLS policies**: Filter by team membership

**Multi-Tenant Pattern:**

```sql
-- All tables have owner_id column
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON todos
  USING (owner_id = auth.uid());
```

#### Authentication (for End Users)

- Email/password
- Magic links
- Phone (SMS OTP)
- OAuth providers (Google, GitHub, Apple, etc.)
- SAML SSO (Pro+)
- Anonymous auth

#### Authentication (for Dashboard)

- Email/password
- GitHub OAuth
- SAML SSO (Team/Enterprise)

#### Billing Model

**Usage-Based** (not per-seat):

| Plan       | Base Price | MAU Included | SSO MAU    |
| ---------- | ---------- | ------------ | ---------- |
| Free       | $0         | 50,000       | N/A        |
| Pro        | $25/mo     | 100,000      | $0.015/MAU |
| Team       | $599/mo    | 100,000      | Included   |
| Enterprise | Custom     | Custom       | Custom     |

**Key Differentiator**: Supabase charges for usage (MAU, storage, egress), not seats

---

## Feature Comparison Matrix

| Feature                  | Airtable                     | Retool            | Zapier                  | Notion                           | Webflow            | Supabase              |
| ------------------------ | ---------------------------- | ----------------- | ----------------------- | -------------------------------- | ------------------ | --------------------- |
| **Hierarchy Levels**     | 4 (Org→Workspace→Base→Table) | 3 (Org→Space→App) | 3 (Account→Team→Folder) | 4 (Org→Workspace→Teamspace→Page) | 2 (Workspace→Site) | 3 (Org→Project→Table) |
| **Built-in Roles**       | 5                            | 3                 | 3                       | 4                                | 5                  | 3 (dashboard)         |
| **Custom Roles**         | No                           | Yes (Enterprise)  | No                      | No                               | Yes (20 max)       | N/A (custom claims)   |
| **Groups/Teams**         | Yes                          | Yes               | Yes (Enterprise)        | Yes (Teamspaces)                 | No (via SSO)       | DIY (tables)          |
| **Resource Permissions** | Yes                          | Yes               | Yes                     | Yes                              | Yes                | Yes (RLS)             |
| **Field-Level**          | Yes (lock fields)            | Yes               | No                      | No                               | No                 | Yes (RLS)             |
| **Row-Level**            | Via Interfaces               | Via queries       | No                      | No                               | No                 | Yes (native RLS)      |
| **Guest Access**         | Portals ($)                  | External Users    | No                      | Yes (free)                       | Yes (SSO exempt)   | N/A                   |
| **SSO (SAML)**           | Business+                    | Business+         | Team add-on             | Business+                        | Enterprise         | Team+                 |
| **SCIM**                 | Enterprise                   | Enterprise        | Enterprise              | Enterprise                       | Enterprise         | N/A                   |
| **2FA**                  | Yes                          | Yes               | Yes                     | Yes                              | Via SSO            | Via Auth providers    |
| **Billing Model**        | Per-collaborator-type        | Per-seat          | Per-seat + tasks        | Per-member                       | Per-seat-type      | Usage-based           |

---

## Best Practices Identified

### 1. Clear Role Hierarchy with Sensible Defaults

**What works well:**

- 4-tier hierarchy: Owner > Admin > Member > Viewer
- Owner is always singular (or very limited)
- Admin can do everything except delete/transfer ownership
- Member is the default for new users
- Guest/Viewer for external read-only access

### 2. Separation of Account/Workspace vs Resource Permissions

**What works well:**

- Users have TWO roles: organizational AND resource-specific
- Example (Webflow): Workspace role (Admin) + Site role (Designer)
- This enables: "Admin of workspace but only Viewer on sensitive site"

### 3. Group-Based Permission Assignment

**What works well:**

- Create groups: Engineering, Marketing, Finance
- Assign resources to groups (not individuals)
- Sync groups from IdP for enterprise

### 4. Progressive Permission Disclosure

**What works well:**

- Start with simple roles (Owner, Editor, Viewer)
- Unlock granular permissions at higher tiers
- Custom roles only for Enterprise

### 5. Guest vs Member Economics

**What works well:**

- Guests are free or discounted (incentivizes collaboration)
- Guests have clear limitations (no SSO, limited features)
- Upgrade path from Guest to Member

### 6. Audit Logging at Enterprise

**What works well:**

- Track: who accessed what, when, from where
- Export to SIEM tools
- Compliance reporting

---

## Recommendations for Sovrium

### 1. Hierarchy Design

**Recommended Structure:**

```
Organization (optional, for multi-workspace)
    └── Workspace (billing boundary)
        └── App (self-contained unit)
            └── Table
                └── Record (with owner_id)
            └── Page
            └── Automation
```

**Rationale:**

- Matches Sovrium's "configuration-driven application platform" vision
- App is the natural boundary (like Airtable Base)
- Workspace enables team collaboration and billing

### 2. Role System

**Workspace Roles:**
| Role | Description |
|------|-------------|
| **Owner** | Single owner, billing, can delete workspace |
| **Admin** | Manage members, apps, cannot delete workspace |
| **Member** | Create/access apps, standard user |
| **Guest** | Invited to specific apps, limited features |

**App Roles:**
| Role | Description |
|------|-------------|
| **Owner** | Full app control (auto-assigned to creator) |
| **Editor** | Modify schema, data, automations |
| **Contributor** | Add/edit records, cannot modify schema |
| **Viewer** | Read-only access |

### 3. Permission Granularity (Progressive)

**Phase 0 (MVP):**

- Workspace roles only
- App-level permissions (Owner, Editor, Viewer)
- `owner_id` filtering on all queries (multi-tenant isolation)

**Phase 1 (Post-MVP):**

- Table-level permissions (per-table Editor/Viewer)
- Field-level visibility (hide sensitive fields)
- Groups for bulk assignment

**Phase 2 (Enterprise):**

- Row-level security via conditions
- Custom roles
- Field-level edit permissions
- Audit logging

### 4. Groups/Teams

**Recommended Approach:**

- Groups are lists of users
- Assign groups to Apps/Tables with a role
- Sync groups from SAML IdP (enterprise)
- Built-in groups: "Everyone", "Admins"

### 5. Guest Access

**Recommended Approach:**

- Guests are free (to encourage collaboration)
- Guests can only access invited Apps
- Guests cannot create Apps or invite others
- Guests bypass SSO (like Webflow)
- Limit: 10 guests per workspace (Free), unlimited (Paid)

### 6. Authentication Methods

**Phase 0:**

- Email/password
- Magic link (passwordless)
- OAuth (Google, GitHub)
- 2FA via authenticator app

**Phase 1:**

- SAML 2.0 SSO (Business tier)
- SCIM provisioning (Enterprise)

### 7. Billing Model

**Recommended: Hybrid Per-Seat + Usage**

| User Type          | Billing              |
| ------------------ | -------------------- |
| Owner/Admin/Member | Per-seat             |
| Guest              | Free (limited count) |
| External API calls | Usage-based          |

**Tiers:**

- **Free**: 1 user, 3 apps, 1,000 records
- **Pro** ($15/user/mo): Unlimited apps, 100,000 records
- **Team** ($25/user/mo): Groups, SSO, audit logs
- **Enterprise**: Custom, SCIM, SLA

### 8. Multi-Tenant Data Isolation

**Implement like Supabase RLS:**

- Every table has `owner_id` column (user who created record)
- Optional `workspace_id` for workspace-level isolation
- All queries filtered by current user's ownership/access
- Return 404 (not 403) for unauthorized access attempts

### 9. Security Best Practices

- Never expose row existence via 403 errors
- Rate limit authentication endpoints
- Session management with refresh tokens
- Configurable session expiry
- Forced logout on password change
- IP allowlisting (Enterprise)

---

## Visual Hierarchy Diagrams

### Recommended Sovrium Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                    ORGANIZATION                          │
│  (Optional: for enterprises with multiple workspaces)    │
│  Roles: Org Owner, Org Admin                            │
└───────────────────────────┬─────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   WORKSPACE   │   │   WORKSPACE   │   │   WORKSPACE   │
│ (billing unit)│   │               │   │               │
│               │   │               │   │               │
│ Roles:        │   │               │   │               │
│ - Owner       │   │               │   │               │
│ - Admin       │   │               │   │               │
│ - Member      │   │               │   │               │
│ - Guest       │   │               │   │               │
└───────┬───────┘   └───────────────┘   └───────────────┘
        │
        │  ┌──────────────────────────────────────────┐
        ├──┤                   APP                     │
        │  │  (self-contained configuration unit)      │
        │  │                                           │
        │  │  App Roles: Owner, Editor, Contributor,   │
        │  │             Viewer                        │
        │  │                                           │
        │  │  ┌─────────┐  ┌─────────┐  ┌───────────┐ │
        │  │  │  TABLE  │  │  PAGE   │  │ AUTOMATION│ │
        │  │  │         │  │         │  │           │ │
        │  │  │ Records │  │ Blocks  │  │ Triggers  │ │
        │  │  │ Fields  │  │ Content │  │ Actions   │ │
        │  │  └─────────┘  └─────────┘  └───────────┘ │
        │  └──────────────────────────────────────────┘
        │
        └──┬── APP ──┬── APP ──┬── APP
           │         │         │
```

### Permission Inheritance Flow

```
User
  │
  ├── Has Workspace Role (Owner/Admin/Member/Guest)
  │         │
  │         └── Grants default access to Apps in Workspace
  │
  └── Has App Role (Owner/Editor/Contributor/Viewer)
            │
            ├── If App Role > Workspace default: App Role wins
            │
            └── If App Role not set: Workspace default applies

Examples:
- Workspace Admin + No App Role = App Editor (default)
- Workspace Member + App Viewer = App Viewer (explicit)
- Workspace Guest + App Editor = App Editor (elevated)
```

### Group Permission Assignment

```
┌─────────────────────────────────────────────────────────┐
│                       WORKSPACE                          │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                        GROUPS                            │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Engineering │  │  Marketing   │  │   Finance    │   │
│  │              │  │              │  │              │   │
│  │  - Alice     │  │  - Bob       │  │  - Charlie   │   │
│  │  - David     │  │  - Eve       │  │  - Eve       │   │
│  │  - Frank     │  │              │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                         APPS                             │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Product Tracker                                 │    │
│  │                                                  │    │
│  │  Group Permissions:                             │    │
│  │  - Engineering: Editor                          │    │
│  │  - Marketing: Viewer                            │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Budget Planner                                  │    │
│  │                                                  │    │
│  │  Group Permissions:                             │    │
│  │  - Finance: Editor                              │    │
│  │  - Engineering: Viewer                          │    │
│  │  - Marketing: No Access                         │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## References

### Airtable

- [Airtable Permissions Overview](https://support.airtable.com/docs/airtable-permissions-overview)
- [Managing User Access](https://support.airtable.com/docs/managing-user-access-to-workspaces-and-bases)
- [Admin Roles](https://support.airtable.com/docs/admin-roles-in-admin-panel-overview-and-management)
- [Field & Table Permissions](https://support.airtable.com/docs/using-field-and-table-editing-permissions)
- [Collaborator Billing](https://support.airtable.com/docs/how-collaborators-impact-billing)
- [Softr Permissions Guide](https://www.softr.io/blog/airtable-permissions)

### Retool

- [RBAC Guide](https://retoolers.io/blog-posts/secure-role-based-access-in-retool-scalable-permission-layers)
- [Role-Based Permissions](https://docs.retool.com/changelog/roles-permissions)
- [SAML SSO Configuration](https://docs.retool.com/sso/tutorials/custom/saml)
- [SAML Group Sync](https://docs.retool.com/sso/guides/group-sync/saml-group-sync)
- [OIDC Configuration](https://docs.retool.com/sso/tutorials/custom/oidc)

### Zapier

- [User Roles and Permissions](https://help.zapier.com/hc/en-us/articles/39698983334797-User-roles-and-permissions-in-Team-and-Enterprise-accounts)
- [Manage Team Account](https://help.zapier.com/hc/en-us/articles/8496291989645-Manage-your-Zapier-Team-or-Enterprise-account)
- [Enterprise Teams](https://help.zapier.com/hc/en-us/articles/8496280450189-Create-teams-in-your-Enterprise-account)
- [Tables Permissions](https://help.zapier.com/hc/en-us/articles/16021760381453-Manage-permissions-and-sharing-in-Zapier-Tables)
- [Pricing](https://zapier.com/pricing)

### Notion

- [Manage Members & Guests](https://www.notion.com/help/add-members-admins-guests-and-groups)
- [Sharing & Permissions](https://www.notion.com/help/sharing-and-permissions)
- [Who's Who in a Workspace](https://www.notion.com/help/whos-who-in-a-workspace)
- [Organization Guide](https://www.notion.com/help/guides/everything-about-setting-up-and-managing-an-organization-in-notion)
- [SAML SSO](https://www.notion.com/help/saml-sso-configuration)
- [Two-Step Verification](https://www.notion.com/help/two-step-verification)
- [Billing](https://www.notion.com/help/billing)

### Webflow

- [Roles and Permissions Overview](https://help.webflow.com/hc/en-us/articles/33961273067411-Roles-and-permissions-overview)
- [Workspace Roles](https://help.webflow.com/hc/en-us/articles/41015530193811-Workspace-roles-and-permissions)
- [Site Roles](https://help.webflow.com/hc/en-us/articles/41015796747667-Site-roles-and-permissions)
- [Custom Roles](https://help.webflow.com/hc/en-us/articles/46651804072467-Create-and-manage-custom-roles)
- [Site-Specific Access](https://help.webflow.com/hc/en-us/articles/33961263532435-Site-specific-access)
- [SSO Login](https://help.webflow.com/hc/en-us/articles/46651862433683-Single-Sign-On-SSO-Login)
- [2024 Pricing Updates](https://help.webflow.com/hc/en-us/articles/36037948441363-Updates-to-our-pricing-and-product-strategy-for-December-2024)

### Supabase

- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [RLS Feature](https://supabase.com/features/row-level-security)
- [Custom Roles](https://supabase.com/docs/guides/storage/schema/custom-roles)
- [Postgres Roles](https://supabase.com/docs/guides/database/postgres/roles)
- [RBAC with Custom Claims](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac)
- [Organization SSO](https://supabase.com/docs/guides/platform/sso)
- [SAML SSO for Projects](https://supabase.com/docs/guides/auth/enterprise-sso/auth-sso-saml)
- [Pricing](https://supabase.com/pricing)
