/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console's own 404: an address inside the console that matches no page.
//
// A signed-in operator who follows a stale link — a section the app no longer
// declares, a typo, a bookmark from an older release — stays INSIDE the console:
// the sidebar is still there, the page says what happened, and the ways on are
// the Overview and the search. The status stays 404.
//
// A caller who is not signed in never sees this page. Every console address
// answers them the bare 404 any unknown path gets, so the page cannot be used
// to learn that a console is mounted here.

import dashboardNotFound from './dashboard-not-found.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardNotFound as PageConfig
