/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// @ts-nocheck

import _a0 from '../../../drizzle/meta/_journal.json' with { type: 'file' }
import _a1 from '../../../drizzle/0000_icy_northstar.sql' with { type: 'file' }
import _a2 from '../../../drizzle/0001_glossy_squadron_supreme.sql' with { type: 'file' }
import _a3 from '../../../drizzle/0002_bitter_calypso.sql' with { type: 'file' }
import _a4 from '../../../drizzle/0003_magenta_the_anarchist.sql' with { type: 'file' }
import _a5 from '../../../drizzle/0004_absurd_zaran.sql' with { type: 'file' }
import _a6 from '../../../drizzle/sqlite/meta/_journal.json' with { type: 'file' }
import _a7 from '../../../drizzle/sqlite/0000_mute_cassandra_nova.sql' with { type: 'file' }
import _a8 from '../../../drizzle/sqlite/0001_famous_leper_queen.sql' with { type: 'file' }
import _a9 from '../../../drizzle/sqlite/0002_quick_texas_twister.sql' with { type: 'file' }
import _a10 from '../../../drizzle/sqlite/0003_absent_dakota_north.sql' with { type: 'file' }
import _a11 from '../../../drizzle/sqlite/0004_shocking_lyja.sql' with { type: 'file' }
import _a12 from '../../../agents/README.md' with { type: 'file' }
import _a13 from '../../../agents/api-editor.md' with { type: 'file' }
import _a14 from '../../../agents/blog-editor.md' with { type: 'file' }
import _a15 from '../../../agents/crud-editor.md' with { type: 'file' }
import _a16 from '../../../agents/mcp-editor.md' with { type: 'file' }
import _a17 from '../../../agents/portal-editor.md' with { type: 'file' }
import _a18 from '../../../agents/website-editor.md' with { type: 'file' }
import _a19 from '../../../examples/api-only/app.yaml' with { type: 'file' }
import _a20 from '../../../examples/api-only/config/auth.yaml' with { type: 'file' }
import _a21 from '../../../examples/api-only/config/tables/projects.yaml' with { type: 'file' }
import _a22 from '../../../examples/api-only/config/tables/tasks.yaml' with { type: 'file' }
import _a23 from '../../../examples/blog/.env.example' with { type: 'file' }
import _a24 from '../../../examples/blog/app.yaml' with { type: 'file' }
import _a25 from '../../../examples/blog/config/agents/blog-editor.yaml' with { type: 'file' }
import _a26 from '../../../examples/blog/config/auth.yaml' with { type: 'file' }
import _a27 from '../../../examples/blog/config/pages/admin-ai-editor.yaml' with { type: 'file' }
import _a28 from '../../../examples/blog/config/pages/admin-authors.yaml' with { type: 'file' }
import _a29 from '../../../examples/blog/config/pages/admin-dashboard.yaml' with { type: 'file' }
import _a30 from '../../../examples/blog/config/pages/admin-login.yaml' with { type: 'file' }
import _a31 from '../../../examples/blog/config/pages/admin-post-edit.yaml' with { type: 'file' }
import _a32 from '../../../examples/blog/config/pages/admin-post-new.yaml' with { type: 'file' }
import _a33 from '../../../examples/blog/config/pages/admin-register.yaml' with { type: 'file' }
import _a34 from '../../../examples/blog/config/pages/admin-tags.yaml' with { type: 'file' }
import _a35 from '../../../examples/blog/config/pages/index.yaml' with { type: 'file' }
import _a36 from '../../../examples/blog/config/pages/post-detail.yaml' with { type: 'file' }
import _a37 from '../../../examples/blog/config/tables/authors.yaml' with { type: 'file' }
import _a38 from '../../../examples/blog/config/tables/posts.yaml' with { type: 'file' }
import _a39 from '../../../examples/blog/config/tables/tags.yaml' with { type: 'file' }
import _a40 from '../../../examples/blog/public/.gitkeep' with { type: 'file' }
import _a41 from '../../../examples/blog/public/README.md' with { type: 'file' }
import _a42 from '../../../examples/crud-app/app.yaml' with { type: 'file' }
import _a43 from '../../../examples/crud-app/config/agents/records-assistant.yaml' with { type: 'file' }
import _a44 from '../../../examples/crud-app/config/auth.yaml' with { type: 'file' }
import _a45 from '../../../examples/crud-app/config/pages/_nav.yaml' with { type: 'file' }
import _a46 from '../../../examples/crud-app/config/pages/assistant.yaml' with { type: 'file' }
import _a47 from '../../../examples/crud-app/config/pages/companies.yaml' with { type: 'file' }
import _a48 from '../../../examples/crud-app/config/pages/contacts.yaml' with { type: 'file' }
import _a49 from '../../../examples/crud-app/config/pages/deals.yaml' with { type: 'file' }
import _a50 from '../../../examples/crud-app/config/pages/sign-in.yaml' with { type: 'file' }
import _a51 from '../../../examples/crud-app/config/pages/tasks.yaml' with { type: 'file' }
import _a52 from '../../../examples/crud-app/config/tables/companies.yaml' with { type: 'file' }
import _a53 from '../../../examples/crud-app/config/tables/contacts.yaml' with { type: 'file' }
import _a54 from '../../../examples/crud-app/config/tables/deals.yaml' with { type: 'file' }
import _a55 from '../../../examples/crud-app/config/tables/tasks.yaml' with { type: 'file' }
import _a56 from '../../../examples/crud-app/config/theme.yaml' with { type: 'file' }
import _a57 from '../../../examples/crud-app/public/.gitkeep' with { type: 'file' }
import _a58 from '../../../examples/crud-app/public/README.md' with { type: 'file' }
import _a59 from '../../../examples/docs-site/.env.example' with { type: 'file' }
import _a60 from '../../../examples/docs-site/app.yaml' with { type: 'file' }
import _a61 from '../../../examples/docs-site/config/pages/docs.yaml' with { type: 'file' }
import _a62 from '../../../examples/docs-site/config/pages/home.yaml' with { type: 'file' }
import _a63 from '../../../examples/docs-site/config/theme.yaml' with { type: 'file' }
import _a64 from '../../../examples/docs-site/content/docs/guides/configuration.md' with { type: 'file' }
import _a65 from '../../../examples/docs-site/content/docs/guides/deployment.md' with { type: 'file' }
import _a66 from '../../../examples/docs-site/content/docs/installation.md' with { type: 'file' }
import _a67 from '../../../examples/docs-site/content/docs/introduction.md' with { type: 'file' }
import _a68 from '../../../examples/docs-site/content/docs/quick-start.md' with { type: 'file' }
import _a69 from '../../../examples/docs-site/public/.gitkeep' with { type: 'file' }
import _a70 from '../../../examples/docs-site/public/README.md' with { type: 'file' }
import _a71 from '../../../examples/hello-world/app.yaml' with { type: 'file' }
import _a72 from '../../../examples/hello-world/public/.gitkeep' with { type: 'file' }
import _a73 from '../../../examples/hello-world/public/README.md' with { type: 'file' }
import _a74 from '../../../examples/landing-page/app.yaml' with { type: 'file' }
import _a75 from '../../../examples/landing-page/config/components/cta-button.yaml' with { type: 'file' }
import _a76 from '../../../examples/landing-page/config/components/feature-card.yaml' with { type: 'file' }
import _a77 from '../../../examples/landing-page/config/components/hero-section.yaml' with { type: 'file' }
import _a78 from '../../../examples/landing-page/config/components/language-switcher.yaml' with { type: 'file' }
import _a79 from '../../../examples/landing-page/config/components/step-card.yaml' with { type: 'file' }
import _a80 from '../../../examples/landing-page/config/languages.yaml' with { type: 'file' }
import _a81 from '../../../examples/landing-page/config/pages/home.yaml' with { type: 'file' }
import _a82 from '../../../examples/landing-page/config/theme.yaml' with { type: 'file' }
import _a83 from '../../../examples/landing-page/public/.gitkeep' with { type: 'file' }
import _a84 from '../../../examples/landing-page/public/README.md' with { type: 'file' }
import _a85 from '../../../examples/mcp-server/app.yaml' with { type: 'file' }
import _a86 from '../../../examples/mcp-server/config/auth.yaml' with { type: 'file' }
import _a87 from '../../../examples/mcp-server/config/mcp.yaml' with { type: 'file' }
import _a88 from '../../../examples/mcp-server/config/tables/documents.yaml' with { type: 'file' }
import _a89 from '../../../examples/mcp-server/config/tables/tags.yaml' with { type: 'file' }
import _a90 from '../../../examples/member-portal/app.yaml' with { type: 'file' }
import _a91 from '../../../examples/member-portal/config/auth.yaml' with { type: 'file' }
import _a92 from '../../../examples/member-portal/config/pages/home.yaml' with { type: 'file' }
import _a93 from '../../../examples/member-portal/config/pages/portal.yaml' with { type: 'file' }
import _a94 from '../../../examples/member-portal/config/pages/sign-in.yaml' with { type: 'file' }
import _a95 from '../../../examples/member-portal/config/tables/members.yaml' with { type: 'file' }
import _a96 from '../../../examples/member-portal/config/tables/posts.yaml' with { type: 'file' }
import _a97 from '../../../examples/member-portal/config/theme.yaml' with { type: 'file' }
import _a98 from '../../../examples/member-portal/public/.gitkeep' with { type: 'file' }
import _a99 from '../../../examples/member-portal/public/README.md' with { type: 'file' }
import _a100 from '../../../examples/README.md' with { type: 'file' }
import _a101 from './dashboard/dashboard-app.yaml' with { type: 'file' }

export const MIGRATION_FILES = {
  pg: {
    journal: _a0,
    migrations: {
      "0000_icy_northstar.sql": _a1,
      "0001_glossy_squadron_supreme.sql": _a2,
      "0002_bitter_calypso.sql": _a3,
      "0003_magenta_the_anarchist.sql": _a4,
      "0004_absurd_zaran.sql": _a5,
    },
  },
  sqlite: {
    journal: _a6,
    migrations: {
      "0000_mute_cassandra_nova.sql": _a7,
      "0001_famous_leper_queen.sql": _a8,
      "0002_quick_texas_twister.sql": _a9,
      "0003_absent_dakota_north.sql": _a10,
      "0004_shocking_lyja.sql": _a11,
    },
  },
}

export const AGENT_FILES = {
  "README.md": _a12,
  "api-editor.md": _a13,
  "blog-editor.md": _a14,
  "crud-editor.md": _a15,
  "mcp-editor.md": _a16,
  "portal-editor.md": _a17,
  "website-editor.md": _a18,
}

export const EXAMPLE_FILES = {
  "api-only/app.yaml": _a19,
  "api-only/config/auth.yaml": _a20,
  "api-only/config/tables/projects.yaml": _a21,
  "api-only/config/tables/tasks.yaml": _a22,
  "blog/.env.example": _a23,
  "blog/app.yaml": _a24,
  "blog/config/agents/blog-editor.yaml": _a25,
  "blog/config/auth.yaml": _a26,
  "blog/config/pages/admin-ai-editor.yaml": _a27,
  "blog/config/pages/admin-authors.yaml": _a28,
  "blog/config/pages/admin-dashboard.yaml": _a29,
  "blog/config/pages/admin-login.yaml": _a30,
  "blog/config/pages/admin-post-edit.yaml": _a31,
  "blog/config/pages/admin-post-new.yaml": _a32,
  "blog/config/pages/admin-register.yaml": _a33,
  "blog/config/pages/admin-tags.yaml": _a34,
  "blog/config/pages/index.yaml": _a35,
  "blog/config/pages/post-detail.yaml": _a36,
  "blog/config/tables/authors.yaml": _a37,
  "blog/config/tables/posts.yaml": _a38,
  "blog/config/tables/tags.yaml": _a39,
  "blog/public/.gitkeep": _a40,
  "blog/public/README.md": _a41,
  "crud-app/app.yaml": _a42,
  "crud-app/config/agents/records-assistant.yaml": _a43,
  "crud-app/config/auth.yaml": _a44,
  "crud-app/config/pages/_nav.yaml": _a45,
  "crud-app/config/pages/assistant.yaml": _a46,
  "crud-app/config/pages/companies.yaml": _a47,
  "crud-app/config/pages/contacts.yaml": _a48,
  "crud-app/config/pages/deals.yaml": _a49,
  "crud-app/config/pages/sign-in.yaml": _a50,
  "crud-app/config/pages/tasks.yaml": _a51,
  "crud-app/config/tables/companies.yaml": _a52,
  "crud-app/config/tables/contacts.yaml": _a53,
  "crud-app/config/tables/deals.yaml": _a54,
  "crud-app/config/tables/tasks.yaml": _a55,
  "crud-app/config/theme.yaml": _a56,
  "crud-app/public/.gitkeep": _a57,
  "crud-app/public/README.md": _a58,
  "docs-site/.env.example": _a59,
  "docs-site/app.yaml": _a60,
  "docs-site/config/pages/docs.yaml": _a61,
  "docs-site/config/pages/home.yaml": _a62,
  "docs-site/config/theme.yaml": _a63,
  "docs-site/content/docs/guides/configuration.md": _a64,
  "docs-site/content/docs/guides/deployment.md": _a65,
  "docs-site/content/docs/installation.md": _a66,
  "docs-site/content/docs/introduction.md": _a67,
  "docs-site/content/docs/quick-start.md": _a68,
  "docs-site/public/.gitkeep": _a69,
  "docs-site/public/README.md": _a70,
  "hello-world/app.yaml": _a71,
  "hello-world/public/.gitkeep": _a72,
  "hello-world/public/README.md": _a73,
  "landing-page/app.yaml": _a74,
  "landing-page/config/components/cta-button.yaml": _a75,
  "landing-page/config/components/feature-card.yaml": _a76,
  "landing-page/config/components/hero-section.yaml": _a77,
  "landing-page/config/components/language-switcher.yaml": _a78,
  "landing-page/config/components/step-card.yaml": _a79,
  "landing-page/config/languages.yaml": _a80,
  "landing-page/config/pages/home.yaml": _a81,
  "landing-page/config/theme.yaml": _a82,
  "landing-page/public/.gitkeep": _a83,
  "landing-page/public/README.md": _a84,
  "mcp-server/app.yaml": _a85,
  "mcp-server/config/auth.yaml": _a86,
  "mcp-server/config/mcp.yaml": _a87,
  "mcp-server/config/tables/documents.yaml": _a88,
  "mcp-server/config/tables/tags.yaml": _a89,
  "member-portal/app.yaml": _a90,
  "member-portal/config/auth.yaml": _a91,
  "member-portal/config/pages/home.yaml": _a92,
  "member-portal/config/pages/portal.yaml": _a93,
  "member-portal/config/pages/sign-in.yaml": _a94,
  "member-portal/config/tables/members.yaml": _a95,
  "member-portal/config/tables/posts.yaml": _a96,
  "member-portal/config/theme.yaml": _a97,
  "member-portal/public/.gitkeep": _a98,
  "member-portal/public/README.md": _a99,
  "README.md": _a100,
}

export const DASHBOARD_FILES = {
  "dashboard-app.yaml": _a101,
}
