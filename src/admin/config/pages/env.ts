/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Environment — which declared `app.env[]` variables this instance resolved,
// and from which rung. Never a value, and never a `process.env` dump.
//
// ─── A TABLE, WITH SEARCH AND TWO FACETS ───────────────────────────────────
//
// One row per declared variable: its key, where the configuration uses it,
// whether it is required, whether this instance resolved a value, and from
// which rung — shadcn's data table with its search box. The list it replaced read as a
// stack of sentences an operator had to read one by one to find the unset one.

// ─── WHY THE ENDPOINT GREW A FIELD ─────────────────────────────────────────
//
// `visibility.record` evaluates ONE field against one operator. It has no
// conjunction and — measured, not assumed — no presence test: `exists` decodes
// and is then DROPPED (`visibility.test.ts`, "DROPS an operator outside the
// shared vocabulary"), leaving a predicate that matches everything. So
// "a default is declared AND its literal is withheld" — the row hint that earns
// this page for the credential-shaped majority — was not expressible over
// `hasDefault` x `defaultValue`.
//
// `defaultState` collapses the two into the one three-way fact a declarative
// reader can gate on. It is a derived FACT, not a label: no English crosses the
// wire, and the copy below stays here. `hasDefault` and `defaultValue` keep
// their exact meanings for every existing consumer.
//
// ─── STATUS IS QUIET, EXCEPT WHEN A REQUIRED VALUE IS MISSING ──────────────
//
// The set/unset indicator is weight and de-emphasis, never a green/amber pill.
// A console that paints "not set" amber implies the operator did something
// wrong; most unset variables are optional and unset on purpose. The one
// exception is the console-wide LOUD state (`STATUS_BADGE.loud`): a variable
// the app REQUIRES and does not have.
//
// ─── NO VALUE, NO CONTROL ([internal ref] A1) ─────────────────────────────────────
//
// No edit affordance, no write endpoint, no reveal. The page binds one READ and
// renders it. Values are configured in the deployment environment, and the
// sentence under the table says so, so an operator who came here to fix one knows where
// to go.

import dashboardConfigEnv from './dashboard-config-env.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default dashboardConfigEnv as PageConfig
