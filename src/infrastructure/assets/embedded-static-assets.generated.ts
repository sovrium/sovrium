/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// @ts-nocheck

import _a0 from '../../../drizzle/meta/_journal.json' with { type: 'file' }
import _a1 from '../../../drizzle/0000_lying_mandrill.sql' with { type: 'file' }
import _a2 from '../../../drizzle/sqlite/meta/_journal.json' with { type: 'file' }
import _a3 from '../../../drizzle/sqlite/0000_graceful_tombstone.sql' with { type: 'file' }
import _a4 from '../../../agents/README.md' with { type: 'file' }
import _a5 from '../../../agents/api-editor.md' with { type: 'file' }
import _a6 from '../../../agents/blog-editor.md' with { type: 'file' }
import _a7 from '../../../agents/crud-editor.md' with { type: 'file' }
import _a8 from '../../../agents/mcp-editor.md' with { type: 'file' }
import _a9 from '../../../agents/portal-editor.md' with { type: 'file' }
import _a10 from '../../../agents/website-editor.md' with { type: 'file' }
import _a11 from '../../../examples/api-only/app.yaml' with { type: 'file' }
import _a12 from '../../../examples/api-only/config/auth.yaml' with { type: 'file' }
import _a13 from '../../../examples/api-only/config/tables/projects.yaml' with { type: 'file' }
import _a14 from '../../../examples/api-only/config/tables/tasks.yaml' with { type: 'file' }
import _a15 from '../../../examples/blog/.env.example' with { type: 'file' }
import _a16 from '../../../examples/blog/app.yaml' with { type: 'file' }
import _a17 from '../../../examples/blog/config/agents/blog-editor.yaml' with { type: 'file' }
import _a18 from '../../../examples/blog/config/auth.yaml' with { type: 'file' }
import _a19 from '../../../examples/blog/config/pages/admin-ai-editor.yaml' with { type: 'file' }
import _a20 from '../../../examples/blog/config/pages/admin-authors.yaml' with { type: 'file' }
import _a21 from '../../../examples/blog/config/pages/admin-dashboard.yaml' with { type: 'file' }
import _a22 from '../../../examples/blog/config/pages/admin-login.yaml' with { type: 'file' }
import _a23 from '../../../examples/blog/config/pages/admin-post-edit.yaml' with { type: 'file' }
import _a24 from '../../../examples/blog/config/pages/admin-post-new.yaml' with { type: 'file' }
import _a25 from '../../../examples/blog/config/pages/admin-register.yaml' with { type: 'file' }
import _a26 from '../../../examples/blog/config/pages/admin-tags.yaml' with { type: 'file' }
import _a27 from '../../../examples/blog/config/pages/index.yaml' with { type: 'file' }
import _a28 from '../../../examples/blog/config/pages/post-detail.yaml' with { type: 'file' }
import _a29 from '../../../examples/blog/config/tables/authors.yaml' with { type: 'file' }
import _a30 from '../../../examples/blog/config/tables/posts.yaml' with { type: 'file' }
import _a31 from '../../../examples/blog/config/tables/tags.yaml' with { type: 'file' }
import _a32 from '../../../examples/blog/public/.gitkeep' with { type: 'file' }
import _a33 from '../../../examples/blog/public/README.md' with { type: 'file' }
import _a34 from '../../../examples/crud-app/app.yaml' with { type: 'file' }
import _a35 from '../../../examples/crud-app/config/agents/records-assistant.yaml' with { type: 'file' }
import _a36 from '../../../examples/crud-app/config/auth.yaml' with { type: 'file' }
import _a37 from '../../../examples/crud-app/config/pages/_nav.yaml' with { type: 'file' }
import _a38 from '../../../examples/crud-app/config/pages/assistant.yaml' with { type: 'file' }
import _a39 from '../../../examples/crud-app/config/pages/companies.yaml' with { type: 'file' }
import _a40 from '../../../examples/crud-app/config/pages/contacts.yaml' with { type: 'file' }
import _a41 from '../../../examples/crud-app/config/pages/deals.yaml' with { type: 'file' }
import _a42 from '../../../examples/crud-app/config/pages/sign-in.yaml' with { type: 'file' }
import _a43 from '../../../examples/crud-app/config/pages/tasks.yaml' with { type: 'file' }
import _a44 from '../../../examples/crud-app/config/tables/companies.yaml' with { type: 'file' }
import _a45 from '../../../examples/crud-app/config/tables/contacts.yaml' with { type: 'file' }
import _a46 from '../../../examples/crud-app/config/tables/deals.yaml' with { type: 'file' }
import _a47 from '../../../examples/crud-app/config/tables/tasks.yaml' with { type: 'file' }
import _a48 from '../../../examples/crud-app/config/theme.yaml' with { type: 'file' }
import _a49 from '../../../examples/crud-app/public/.gitkeep' with { type: 'file' }
import _a50 from '../../../examples/crud-app/public/README.md' with { type: 'file' }
import _a51 from '../../../examples/docs-site/.env.example' with { type: 'file' }
import _a52 from '../../../examples/docs-site/app.yaml' with { type: 'file' }
import _a53 from '../../../examples/docs-site/config/pages/docs.yaml' with { type: 'file' }
import _a54 from '../../../examples/docs-site/config/pages/home.yaml' with { type: 'file' }
import _a55 from '../../../examples/docs-site/config/theme.yaml' with { type: 'file' }
import _a56 from '../../../examples/docs-site/content/docs/guides/configuration.md' with { type: 'file' }
import _a57 from '../../../examples/docs-site/content/docs/guides/deployment.md' with { type: 'file' }
import _a58 from '../../../examples/docs-site/content/docs/installation.md' with { type: 'file' }
import _a59 from '../../../examples/docs-site/content/docs/introduction.md' with { type: 'file' }
import _a60 from '../../../examples/docs-site/content/docs/quick-start.md' with { type: 'file' }
import _a61 from '../../../examples/docs-site/public/.gitkeep' with { type: 'file' }
import _a62 from '../../../examples/docs-site/public/README.md' with { type: 'file' }
import _a63 from '../../../examples/hello-world/app.yaml' with { type: 'file' }
import _a64 from '../../../examples/hello-world/public/.gitkeep' with { type: 'file' }
import _a65 from '../../../examples/hello-world/public/README.md' with { type: 'file' }
import _a66 from '../../../examples/landing-page/app.yaml' with { type: 'file' }
import _a67 from '../../../examples/landing-page/config/components/cta-button.yaml' with { type: 'file' }
import _a68 from '../../../examples/landing-page/config/components/feature-card.yaml' with { type: 'file' }
import _a69 from '../../../examples/landing-page/config/components/hero-section.yaml' with { type: 'file' }
import _a70 from '../../../examples/landing-page/config/components/language-switcher.yaml' with { type: 'file' }
import _a71 from '../../../examples/landing-page/config/components/step-card.yaml' with { type: 'file' }
import _a72 from '../../../examples/landing-page/config/languages.yaml' with { type: 'file' }
import _a73 from '../../../examples/landing-page/config/pages/home.yaml' with { type: 'file' }
import _a74 from '../../../examples/landing-page/config/theme.yaml' with { type: 'file' }
import _a75 from '../../../examples/landing-page/public/.gitkeep' with { type: 'file' }
import _a76 from '../../../examples/landing-page/public/README.md' with { type: 'file' }
import _a77 from '../../../examples/mcp-server/app.yaml' with { type: 'file' }
import _a78 from '../../../examples/mcp-server/config/auth.yaml' with { type: 'file' }
import _a79 from '../../../examples/mcp-server/config/mcp.yaml' with { type: 'file' }
import _a80 from '../../../examples/mcp-server/config/tables/documents.yaml' with { type: 'file' }
import _a81 from '../../../examples/mcp-server/config/tables/tags.yaml' with { type: 'file' }
import _a82 from '../../../examples/member-portal/app.yaml' with { type: 'file' }
import _a83 from '../../../examples/member-portal/config/auth.yaml' with { type: 'file' }
import _a84 from '../../../examples/member-portal/config/pages/home.yaml' with { type: 'file' }
import _a85 from '../../../examples/member-portal/config/pages/portal.yaml' with { type: 'file' }
import _a86 from '../../../examples/member-portal/config/pages/sign-in.yaml' with { type: 'file' }
import _a87 from '../../../examples/member-portal/config/tables/members.yaml' with { type: 'file' }
import _a88 from '../../../examples/member-portal/config/tables/posts.yaml' with { type: 'file' }
import _a89 from '../../../examples/member-portal/config/theme.yaml' with { type: 'file' }
import _a90 from '../../../examples/member-portal/public/.gitkeep' with { type: 'file' }
import _a91 from '../../../examples/member-portal/public/README.md' with { type: 'file' }
import _a92 from '../../../examples/README.md' with { type: 'file' }
import _a93 from './dashboard/dashboard-app.yaml' with { type: 'file' }

export const MIGRATION_FILES = {
  pg: {
    journal: _a0,
    migrations: {
      "0000_lying_mandrill.sql": _a1,
    },
  },
  sqlite: {
    journal: _a2,
    migrations: {
      "0000_graceful_tombstone.sql": _a3,
    },
  },
}

export const AGENT_FILES = {
  "README.md": _a4,
  "api-editor.md": _a5,
  "blog-editor.md": _a6,
  "crud-editor.md": _a7,
  "mcp-editor.md": _a8,
  "portal-editor.md": _a9,
  "website-editor.md": _a10,
}

export const EXAMPLE_FILES = {
  "api-only/app.yaml": _a11,
  "api-only/config/auth.yaml": _a12,
  "api-only/config/tables/projects.yaml": _a13,
  "api-only/config/tables/tasks.yaml": _a14,
  "blog/.env.example": _a15,
  "blog/app.yaml": _a16,
  "blog/config/agents/blog-editor.yaml": _a17,
  "blog/config/auth.yaml": _a18,
  "blog/config/pages/admin-ai-editor.yaml": _a19,
  "blog/config/pages/admin-authors.yaml": _a20,
  "blog/config/pages/admin-dashboard.yaml": _a21,
  "blog/config/pages/admin-login.yaml": _a22,
  "blog/config/pages/admin-post-edit.yaml": _a23,
  "blog/config/pages/admin-post-new.yaml": _a24,
  "blog/config/pages/admin-register.yaml": _a25,
  "blog/config/pages/admin-tags.yaml": _a26,
  "blog/config/pages/index.yaml": _a27,
  "blog/config/pages/post-detail.yaml": _a28,
  "blog/config/tables/authors.yaml": _a29,
  "blog/config/tables/posts.yaml": _a30,
  "blog/config/tables/tags.yaml": _a31,
  "blog/public/.gitkeep": _a32,
  "blog/public/README.md": _a33,
  "crud-app/app.yaml": _a34,
  "crud-app/config/agents/records-assistant.yaml": _a35,
  "crud-app/config/auth.yaml": _a36,
  "crud-app/config/pages/_nav.yaml": _a37,
  "crud-app/config/pages/assistant.yaml": _a38,
  "crud-app/config/pages/companies.yaml": _a39,
  "crud-app/config/pages/contacts.yaml": _a40,
  "crud-app/config/pages/deals.yaml": _a41,
  "crud-app/config/pages/sign-in.yaml": _a42,
  "crud-app/config/pages/tasks.yaml": _a43,
  "crud-app/config/tables/companies.yaml": _a44,
  "crud-app/config/tables/contacts.yaml": _a45,
  "crud-app/config/tables/deals.yaml": _a46,
  "crud-app/config/tables/tasks.yaml": _a47,
  "crud-app/config/theme.yaml": _a48,
  "crud-app/public/.gitkeep": _a49,
  "crud-app/public/README.md": _a50,
  "docs-site/.env.example": _a51,
  "docs-site/app.yaml": _a52,
  "docs-site/config/pages/docs.yaml": _a53,
  "docs-site/config/pages/home.yaml": _a54,
  "docs-site/config/theme.yaml": _a55,
  "docs-site/content/docs/guides/configuration.md": _a56,
  "docs-site/content/docs/guides/deployment.md": _a57,
  "docs-site/content/docs/installation.md": _a58,
  "docs-site/content/docs/introduction.md": _a59,
  "docs-site/content/docs/quick-start.md": _a60,
  "docs-site/public/.gitkeep": _a61,
  "docs-site/public/README.md": _a62,
  "hello-world/app.yaml": _a63,
  "hello-world/public/.gitkeep": _a64,
  "hello-world/public/README.md": _a65,
  "landing-page/app.yaml": _a66,
  "landing-page/config/components/cta-button.yaml": _a67,
  "landing-page/config/components/feature-card.yaml": _a68,
  "landing-page/config/components/hero-section.yaml": _a69,
  "landing-page/config/components/language-switcher.yaml": _a70,
  "landing-page/config/components/step-card.yaml": _a71,
  "landing-page/config/languages.yaml": _a72,
  "landing-page/config/pages/home.yaml": _a73,
  "landing-page/config/theme.yaml": _a74,
  "landing-page/public/.gitkeep": _a75,
  "landing-page/public/README.md": _a76,
  "mcp-server/app.yaml": _a77,
  "mcp-server/config/auth.yaml": _a78,
  "mcp-server/config/mcp.yaml": _a79,
  "mcp-server/config/tables/documents.yaml": _a80,
  "mcp-server/config/tables/tags.yaml": _a81,
  "member-portal/app.yaml": _a82,
  "member-portal/config/auth.yaml": _a83,
  "member-portal/config/pages/home.yaml": _a84,
  "member-portal/config/pages/portal.yaml": _a85,
  "member-portal/config/pages/sign-in.yaml": _a86,
  "member-portal/config/tables/members.yaml": _a87,
  "member-portal/config/tables/posts.yaml": _a88,
  "member-portal/config/theme.yaml": _a89,
  "member-portal/public/.gitkeep": _a90,
  "member-portal/public/README.md": _a91,
  "README.md": _a92,
}

export const DASHBOARD_FILES = {
  "dashboard-app.yaml": _a93,
}
