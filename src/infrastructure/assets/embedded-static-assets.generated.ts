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
import _a6 from '../../../drizzle/0005_panoramic_elektra.sql' with { type: 'file' }
import _a7 from '../../../drizzle/0006_narrow_tarantula.sql' with { type: 'file' }
import _a8 from '../../../drizzle/sqlite/meta/_journal.json' with { type: 'file' }
import _a9 from '../../../drizzle/sqlite/0000_marvelous_rage.sql' with { type: 'file' }
import _a10 from '../../../drizzle/sqlite/0001_eager_shockwave.sql' with { type: 'file' }
import _a11 from '../../../drizzle/sqlite/0002_reflective_senator_kelly.sql' with { type: 'file' }
import _a12 from '../../../drizzle/sqlite/0003_panoramic_vermin.sql' with { type: 'file' }
import _a13 from '../../../drizzle/sqlite/0004_parched_mojo.sql' with { type: 'file' }
import _a14 from '../../../drizzle/sqlite/0005_amusing_ulik.sql' with { type: 'file' }
import _a15 from '../../../drizzle/sqlite/0006_calm_layla_miller.sql' with { type: 'file' }
import _a16 from '../../../agents/README.md' with { type: 'file' }
import _a17 from '../../../agents/api-editor.md' with { type: 'file' }
import _a18 from '../../../agents/blog-editor.md' with { type: 'file' }
import _a19 from '../../../agents/crud-editor.md' with { type: 'file' }
import _a20 from '../../../agents/mcp-editor.md' with { type: 'file' }
import _a21 from '../../../agents/portal-editor.md' with { type: 'file' }
import _a22 from '../../../agents/website-editor.md' with { type: 'file' }
import _a23 from '../../../examples/api-only/app.yaml' with { type: 'file' }
import _a24 from '../../../examples/api-only/config/auth.yaml' with { type: 'file' }
import _a25 from '../../../examples/api-only/config/tables/projects.yaml' with { type: 'file' }
import _a26 from '../../../examples/api-only/config/tables/tasks.yaml' with { type: 'file' }
import _a27 from '../../../examples/blog/app.yaml' with { type: 'file' }
import _a28 from '../../../examples/blog/config/pages/index.yaml' with { type: 'file' }
import _a29 from '../../../examples/blog/config/pages/post-detail.yaml' with { type: 'file' }
import _a30 from '../../../examples/blog/config/tables/authors.yaml' with { type: 'file' }
import _a31 from '../../../examples/blog/config/tables/posts.yaml' with { type: 'file' }
import _a32 from '../../../examples/blog/config/tables/tags.yaml' with { type: 'file' }
import _a33 from '../../../examples/blog/config/theme.yaml' with { type: 'file' }
import _a34 from '../../../examples/blog/public/.gitkeep' with { type: 'file' }
import _a35 from '../../../examples/blog/public/README.md' with { type: 'file' }
import _a36 from '../../../examples/crud-app/app.yaml' with { type: 'file' }
import _a37 from '../../../examples/crud-app/config/auth.yaml' with { type: 'file' }
import _a38 from '../../../examples/crud-app/config/pages/home.yaml' with { type: 'file' }
import _a39 from '../../../examples/crud-app/config/pages/sign-in.yaml' with { type: 'file' }
import _a40 from '../../../examples/crud-app/config/tables/companies.yaml' with { type: 'file' }
import _a41 from '../../../examples/crud-app/config/tables/contacts.yaml' with { type: 'file' }
import _a42 from '../../../examples/crud-app/config/theme.yaml' with { type: 'file' }
import _a43 from '../../../examples/crud-app/public/.gitkeep' with { type: 'file' }
import _a44 from '../../../examples/crud-app/public/README.md' with { type: 'file' }
import _a45 from '../../../examples/hello-world/app.yaml' with { type: 'file' }
import _a46 from '../../../examples/hello-world/public/.gitkeep' with { type: 'file' }
import _a47 from '../../../examples/hello-world/public/README.md' with { type: 'file' }
import _a48 from '../../../examples/landing-page/app.yaml' with { type: 'file' }
import _a49 from '../../../examples/landing-page/config/components/cta-button.yaml' with { type: 'file' }
import _a50 from '../../../examples/landing-page/config/components/feature-card.yaml' with { type: 'file' }
import _a51 from '../../../examples/landing-page/config/components/hero-section.yaml' with { type: 'file' }
import _a52 from '../../../examples/landing-page/config/components/language-switcher.yaml' with { type: 'file' }
import _a53 from '../../../examples/landing-page/config/components/step-card.yaml' with { type: 'file' }
import _a54 from '../../../examples/landing-page/config/languages.yaml' with { type: 'file' }
import _a55 from '../../../examples/landing-page/config/pages/home.yaml' with { type: 'file' }
import _a56 from '../../../examples/landing-page/config/theme.yaml' with { type: 'file' }
import _a57 from '../../../examples/landing-page/public/.gitkeep' with { type: 'file' }
import _a58 from '../../../examples/landing-page/public/README.md' with { type: 'file' }
import _a59 from '../../../examples/mcp-server/app.yaml' with { type: 'file' }
import _a60 from '../../../examples/mcp-server/config/auth.yaml' with { type: 'file' }
import _a61 from '../../../examples/mcp-server/config/mcp.yaml' with { type: 'file' }
import _a62 from '../../../examples/mcp-server/config/tables/documents.yaml' with { type: 'file' }
import _a63 from '../../../examples/mcp-server/config/tables/tags.yaml' with { type: 'file' }
import _a64 from '../../../examples/member-portal/app.yaml' with { type: 'file' }
import _a65 from '../../../examples/member-portal/config/auth.yaml' with { type: 'file' }
import _a66 from '../../../examples/member-portal/config/pages/home.yaml' with { type: 'file' }
import _a67 from '../../../examples/member-portal/config/pages/portal.yaml' with { type: 'file' }
import _a68 from '../../../examples/member-portal/config/pages/sign-in.yaml' with { type: 'file' }
import _a69 from '../../../examples/member-portal/config/tables/members.yaml' with { type: 'file' }
import _a70 from '../../../examples/member-portal/config/tables/posts.yaml' with { type: 'file' }
import _a71 from '../../../examples/member-portal/config/theme.yaml' with { type: 'file' }
import _a72 from '../../../examples/member-portal/public/.gitkeep' with { type: 'file' }
import _a73 from '../../../examples/member-portal/public/README.md' with { type: 'file' }
import _a74 from '../../../examples/README.md' with { type: 'file' }

export const MIGRATION_FILES = {
  pg: {
    journal: _a0,
    migrations: {
      "0000_swift_the_stranger.sql": _a1,
      "0001_brave_gauntlet.sql": _a2,
      "0002_normal_vermin.sql": _a3,
      "0003_safe_lake.sql": _a4,
      "0004_charming_power_pack.sql": _a5,
      "0005_panoramic_elektra.sql": _a6,
      "0006_narrow_tarantula.sql": _a7,
    },
  },
  sqlite: {
    journal: _a8,
    migrations: {
      "0000_marvelous_rage.sql": _a9,
      "0001_eager_shockwave.sql": _a10,
      "0002_reflective_senator_kelly.sql": _a11,
      "0003_panoramic_vermin.sql": _a12,
      "0004_parched_mojo.sql": _a13,
      "0005_amusing_ulik.sql": _a14,
      "0006_calm_layla_miller.sql": _a15,
    },
  },
}

export const AGENT_FILES = {
  "README.md": _a16,
  "api-editor.md": _a17,
  "blog-editor.md": _a18,
  "crud-editor.md": _a19,
  "mcp-editor.md": _a20,
  "portal-editor.md": _a21,
  "website-editor.md": _a22,
}

export const EXAMPLE_FILES = {
  "api-only/app.yaml": _a23,
  "api-only/config/auth.yaml": _a24,
  "api-only/config/tables/projects.yaml": _a25,
  "api-only/config/tables/tasks.yaml": _a26,
  "blog/app.yaml": _a27,
  "blog/config/pages/index.yaml": _a28,
  "blog/config/pages/post-detail.yaml": _a29,
  "blog/config/tables/authors.yaml": _a30,
  "blog/config/tables/posts.yaml": _a31,
  "blog/config/tables/tags.yaml": _a32,
  "blog/config/theme.yaml": _a33,
  "blog/public/.gitkeep": _a34,
  "blog/public/README.md": _a35,
  "crud-app/app.yaml": _a36,
  "crud-app/config/auth.yaml": _a37,
  "crud-app/config/pages/home.yaml": _a38,
  "crud-app/config/pages/sign-in.yaml": _a39,
  "crud-app/config/tables/companies.yaml": _a40,
  "crud-app/config/tables/contacts.yaml": _a41,
  "crud-app/config/theme.yaml": _a42,
  "crud-app/public/.gitkeep": _a43,
  "crud-app/public/README.md": _a44,
  "hello-world/app.yaml": _a45,
  "hello-world/public/.gitkeep": _a46,
  "hello-world/public/README.md": _a47,
  "landing-page/app.yaml": _a48,
  "landing-page/config/components/cta-button.yaml": _a49,
  "landing-page/config/components/feature-card.yaml": _a50,
  "landing-page/config/components/hero-section.yaml": _a51,
  "landing-page/config/components/language-switcher.yaml": _a52,
  "landing-page/config/components/step-card.yaml": _a53,
  "landing-page/config/languages.yaml": _a54,
  "landing-page/config/pages/home.yaml": _a55,
  "landing-page/config/theme.yaml": _a56,
  "landing-page/public/.gitkeep": _a57,
  "landing-page/public/README.md": _a58,
  "mcp-server/app.yaml": _a59,
  "mcp-server/config/auth.yaml": _a60,
  "mcp-server/config/mcp.yaml": _a61,
  "mcp-server/config/tables/documents.yaml": _a62,
  "mcp-server/config/tables/tags.yaml": _a63,
  "member-portal/app.yaml": _a64,
  "member-portal/config/auth.yaml": _a65,
  "member-portal/config/pages/home.yaml": _a66,
  "member-portal/config/pages/portal.yaml": _a67,
  "member-portal/config/pages/sign-in.yaml": _a68,
  "member-portal/config/tables/members.yaml": _a69,
  "member-portal/config/tables/posts.yaml": _a70,
  "member-portal/config/theme.yaml": _a71,
  "member-portal/public/.gitkeep": _a72,
  "member-portal/public/README.md": _a73,
  "README.md": _a74,
}
