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
import _a3 from '../../../drizzle/sqlite/meta/_journal.json' with { type: 'file' }
import _a4 from '../../../drizzle/sqlite/0000_marvelous_rage.sql' with { type: 'file' }
import _a5 from '../../../drizzle/sqlite/0001_eager_shockwave.sql' with { type: 'file' }
import _a6 from '../../../agents/README.md' with { type: 'file' }
import _a7 from '../../../agents/api-editor.md' with { type: 'file' }
import _a8 from '../../../agents/crud-editor.md' with { type: 'file' }
import _a9 from '../../../agents/website-editor.md' with { type: 'file' }
import _a10 from '../../../examples/CLAUDE.md.template' with { type: 'file' }
import _a11 from '../../../examples/README.md' with { type: 'file' }
import _a12 from '../../../examples/api-only.yaml' with { type: 'file' }
import _a13 from '../../../examples/crud-app.yaml' with { type: 'file' }
import _a14 from '../../../examples/hello-world.yaml' with { type: 'file' }
import _a15 from '../../../examples/landing-page.yaml' with { type: 'file' }

export const MIGRATION_FILES = {
  pg: {
    journal: _a0,
    migrations: {
      "0000_swift_the_stranger.sql": _a1,
      "0001_brave_gauntlet.sql": _a2,
    },
  },
  sqlite: {
    journal: _a3,
    migrations: {
      "0000_marvelous_rage.sql": _a4,
      "0001_eager_shockwave.sql": _a5,
    },
  },
}

export const AGENT_FILES = {
  "README.md": _a6,
  "api-editor.md": _a7,
  "crud-editor.md": _a8,
  "website-editor.md": _a9,
}

export const EXAMPLE_FILES = {
  "CLAUDE.md.template": _a10,
  "README.md": _a11,
  "api-only.yaml": _a12,
  "crud-app.yaml": _a13,
  "hello-world.yaml": _a14,
  "landing-page.yaml": _a15,
}
