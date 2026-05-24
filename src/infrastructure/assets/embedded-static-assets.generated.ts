/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// @ts-nocheck

import _a0 from '../../../drizzle/meta/_journal.json' with { type: 'file' }
import _a1 from '../../../drizzle/0000_swift_the_stranger.sql' with { type: 'file' }
import _a2 from '../../../drizzle/0001_brave_gauntlet.sql' with { type: 'file' }
import _a3 from '../../../drizzle/0002_normal_vermin.sql' with { type: 'file' }
import _a4 from '../../../drizzle/0003_safe_lake.sql' with { type: 'file' }
import _a5 from '../../../drizzle/0004_charming_power_pack.sql' with { type: 'file' }
import _a6 from '../../../drizzle/sqlite/meta/_journal.json' with { type: 'file' }
import _a7 from '../../../drizzle/sqlite/0000_marvelous_rage.sql' with { type: 'file' }
import _a8 from '../../../drizzle/sqlite/0001_eager_shockwave.sql' with { type: 'file' }
import _a9 from '../../../drizzle/sqlite/0002_reflective_senator_kelly.sql' with { type: 'file' }
import _a10 from '../../../drizzle/sqlite/0003_panoramic_vermin.sql' with { type: 'file' }
import _a11 from '../../../drizzle/sqlite/0004_parched_mojo.sql' with { type: 'file' }
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
import _a23 from '../../../examples/blog/app.yaml' with { type: 'file' }
import _a24 from '../../../examples/blog/config/pages/index.yaml' with { type: 'file' }
import _a25 from '../../../examples/blog/config/pages/post-detail.yaml' with { type: 'file' }
import _a26 from '../../../examples/blog/config/tables/authors.yaml' with { type: 'file' }
import _a27 from '../../../examples/blog/config/tables/posts.yaml' with { type: 'file' }
import _a28 from '../../../examples/blog/config/tables/tags.yaml' with { type: 'file' }
import _a29 from '../../../examples/blog/config/theme.yaml' with { type: 'file' }
import _a30 from '../../../examples/crud-app/app.yaml' with { type: 'file' }
import _a31 from '../../../examples/crud-app/config/auth.yaml' with { type: 'file' }
import _a32 from '../../../examples/crud-app/config/pages/home.yaml' with { type: 'file' }
import _a33 from '../../../examples/crud-app/config/pages/sign-in.yaml' with { type: 'file' }
import _a34 from '../../../examples/crud-app/config/tables/companies.yaml' with { type: 'file' }
import _a35 from '../../../examples/crud-app/config/tables/contacts.yaml' with { type: 'file' }
import _a36 from '../../../examples/crud-app/config/theme.yaml' with { type: 'file' }
import _a37 from '../../../examples/hello-world/app.yaml' with { type: 'file' }
import _a38 from '../../../examples/landing-page/app.yaml' with { type: 'file' }
import _a39 from '../../../examples/landing-page/config/components/cta-button.yaml' with { type: 'file' }
import _a40 from '../../../examples/landing-page/config/components/feature-card.yaml' with { type: 'file' }
import _a41 from '../../../examples/landing-page/config/components/hero-section.yaml' with { type: 'file' }
import _a42 from '../../../examples/landing-page/config/components/language-switcher.yaml' with { type: 'file' }
import _a43 from '../../../examples/landing-page/config/components/step-card.yaml' with { type: 'file' }
import _a44 from '../../../examples/landing-page/config/languages.yaml' with { type: 'file' }
import _a45 from '../../../examples/landing-page/config/pages/home.yaml' with { type: 'file' }
import _a46 from '../../../examples/landing-page/config/theme.yaml' with { type: 'file' }
import _a47 from '../../../examples/mcp-server/app.yaml' with { type: 'file' }
import _a48 from '../../../examples/mcp-server/config/auth.yaml' with { type: 'file' }
import _a49 from '../../../examples/mcp-server/config/mcp.yaml' with { type: 'file' }
import _a50 from '../../../examples/mcp-server/config/tables/documents.yaml' with { type: 'file' }
import _a51 from '../../../examples/mcp-server/config/tables/tags.yaml' with { type: 'file' }
import _a52 from '../../../examples/member-portal/app.yaml' with { type: 'file' }
import _a53 from '../../../examples/member-portal/config/auth.yaml' with { type: 'file' }
import _a54 from '../../../examples/member-portal/config/pages/home.yaml' with { type: 'file' }
import _a55 from '../../../examples/member-portal/config/pages/portal.yaml' with { type: 'file' }
import _a56 from '../../../examples/member-portal/config/pages/sign-in.yaml' with { type: 'file' }
import _a57 from '../../../examples/member-portal/config/tables/members.yaml' with { type: 'file' }
import _a58 from '../../../examples/member-portal/config/tables/posts.yaml' with { type: 'file' }
import _a59 from '../../../examples/member-portal/config/theme.yaml' with { type: 'file' }
import _a60 from '../../../examples/README.md' with { type: 'file' }

export const MIGRATION_FILES = {
  pg: {
    journal: _a0,
    migrations: {
      "0000_swift_the_stranger.sql": _a1,
      "0001_brave_gauntlet.sql": _a2,
      "0002_normal_vermin.sql": _a3,
      "0003_safe_lake.sql": _a4,
      "0004_charming_power_pack.sql": _a5,
    },
  },
  sqlite: {
    journal: _a6,
    migrations: {
      "0000_marvelous_rage.sql": _a7,
      "0001_eager_shockwave.sql": _a8,
      "0002_reflective_senator_kelly.sql": _a9,
      "0003_panoramic_vermin.sql": _a10,
      "0004_parched_mojo.sql": _a11,
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
  "blog/app.yaml": _a23,
  "blog/config/pages/index.yaml": _a24,
  "blog/config/pages/post-detail.yaml": _a25,
  "blog/config/tables/authors.yaml": _a26,
  "blog/config/tables/posts.yaml": _a27,
  "blog/config/tables/tags.yaml": _a28,
  "blog/config/theme.yaml": _a29,
  "crud-app/app.yaml": _a30,
  "crud-app/config/auth.yaml": _a31,
  "crud-app/config/pages/home.yaml": _a32,
  "crud-app/config/pages/sign-in.yaml": _a33,
  "crud-app/config/tables/companies.yaml": _a34,
  "crud-app/config/tables/contacts.yaml": _a35,
  "crud-app/config/theme.yaml": _a36,
  "hello-world/app.yaml": _a37,
  "landing-page/app.yaml": _a38,
  "landing-page/config/components/cta-button.yaml": _a39,
  "landing-page/config/components/feature-card.yaml": _a40,
  "landing-page/config/components/hero-section.yaml": _a41,
  "landing-page/config/components/language-switcher.yaml": _a42,
  "landing-page/config/components/step-card.yaml": _a43,
  "landing-page/config/languages.yaml": _a44,
  "landing-page/config/pages/home.yaml": _a45,
  "landing-page/config/theme.yaml": _a46,
  "mcp-server/app.yaml": _a47,
  "mcp-server/config/auth.yaml": _a48,
  "mcp-server/config/mcp.yaml": _a49,
  "mcp-server/config/tables/documents.yaml": _a50,
  "mcp-server/config/tables/tags.yaml": _a51,
  "member-portal/app.yaml": _a52,
  "member-portal/config/auth.yaml": _a53,
  "member-portal/config/pages/home.yaml": _a54,
  "member-portal/config/pages/portal.yaml": _a55,
  "member-portal/config/pages/sign-in.yaml": _a56,
  "member-portal/config/tables/members.yaml": _a57,
  "member-portal/config/tables/posts.yaml": _a58,
  "member-portal/config/theme.yaml": _a59,
  "README.md": _a60,
}
