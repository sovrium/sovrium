/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The Developers section, as ONE area module.
 *
 * The four rows of that sidebar section are `api`, `mcp`, `changelog` and `env`
 * (`DEVELOPER_NAV_PAGES`). `env` is not re-exported here — it migrated first
 * and `app.ts` already names it — so this module carries the three that landed
 * together, for the reason the data area module next door records: several
 * migrations are in flight at once, and a per-page list in `app.ts` makes every
 * landing a diff on those lines.
 *
 * `changelog` contributes TWO pages — the ledger and one boot — which is the
 * second reason the module earns its place: `app.ts` spreads it and never has to
 * learn how many routes a Developers surface takes.
 */

import api from './api'
import { changelogPages } from './changelog'
import mcp from './mcp'
import type { Page as PageConfig } from '@/domain/models/app'

/** The Developers docs surfaces, in sidebar order. */
export const developerPages: readonly PageConfig[] = [api, mcp, ...changelogPages]
