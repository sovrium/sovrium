/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// DEVELOPERS · Changelog — the boot ledger of this instance, and the
// configuration it is currently running.
//
// ─── WHAT THIS SURFACE IS FOR, AND WHAT IT REPLACES ────────────────────────
//
// It stands where `/schema` stood. Schema answered ONE question — what is this
// app configured to be, right now — and answered it well. What it could not
// answer is the question an operator actually arrives with: *when did that
// change, and to what?* A console that shows only the present tense makes every
// "it worked last week" into an archaeology exercise against git, on a machine
// that already holds the answer.
//
// So Schema's body is not deleted. It is re-homed as the HEAD of the ledger —
// `?view=current` — and the ledger itself becomes the page. The two are one
// subject read at two depths: what booted, and what has booted.
//
// ─── READ-ONLY, AND STRUCTURALLY SO ────────────────────────────────────────
//
// [internal ref] amendment **A6** (ratified 2026-09-16), surface 8. A6 extends A1's
// invariant — reading the running configuration is observability, mutating it
// is authoring — with the one question A1 could not state, because A1 had no
// ledger to reason about:
//
//   has what this surface describes already happened?
//
// Every row here describes a boot that already ran. That is what separates this
// from D1's refused "version ledger, history, diff", whose referent is [internal ref]'s
// *draft* store: a ledger of boots holds no candidate configuration and stages
// nothing. Both sides of every diff are boots that happened — never an uploaded
// file, never a working copy, never a configuration typed into the console.
//
// There is no revert, no rollback and no re-deploy here, and their absence is
// A6's ruling rather than an unfinished feature: restoring a previous
// configuration CHANGES what the instance runs, and the way to do that is
// `git revert` and redeploy. This ledger records that channel; it does not
// replace it.
//
// ─── SIX THINGS THE CANVAS DRAWS THAT CONFIG CANNOT SAY ────────────────────
//
// Recorded rather than silently dropped, because each is a platform bound with a
// shipped substitute rather than a decision taken on this surface.
//
//  1. `?release=<hash>` AS A VIEW SWITCH. Planned that way, and not expressible:
//     `page.query` REQUIRES a closed `enum` (`PageQueryPropSchema`), an
//     out-of-list URL value clamps to the default, and `visibility.query` values
//     are checked at DECODE against that same enum. A ledger address belongs to
//     the HOST instance and a platform-owned preset compiled into the binary
//     cannot enumerate one. A path segment carries no allow-list, so one boot is
//     `/changelog/:hash` — the shape `/decisions/:id`, `/links/:slug` and
//     `/tables/:table` already take. `?view=current` IS enumerable (two values)
//     and stays a query, which is what keeps the founder's address for it exact.
//
//  2. THE CHROME-BAR TOTALS. The canvas prints `N releases since <date> · N
//     engine migrations · N schema changes` as bar facts. The endpoint publishes
//     all of them flat for exactly that, and no config path renders a
//     system-bound scalar as bar text — the `chromeEnd` gap the decisions
//     register already records. They are NOT relocated to a `kpi` strip: a `kpi`
//     is a lazy island, the canvas draws no tiles on this surface, and the oldest
//     row's own date IS `since`, which the timeline already prints.
//
//  3. THE CONFIG DIFF, INLINE. The canvas draws it as the climax of a release.
//     `diff` is an ARRAY OF STRINGS, and a component rows binding returns `[]`
//     for anything that is not an array of objects (`system-rows-fetcher.ts`),
//     so a diff line has no field to address. The deeper bound is that the array
//     has no ceiling: measured on this console's own ledger, one row carried
//     **70,255** lines. A page that renders it is a page that sometimes does not
//     load. The shipped substitute is the shape of the diff — `+added −removed`,
//     the generated summary, and the derived DDL and engine migrations as real
//     lists — plus `Export diff`, which is the canvas's own affordance and hands
//     the operator the whole thing without rendering it. Those two ARE the
//     substantive answer in any case: what an operator needs from a boot is what
//     it did to their database, and the textual diff is how they check it.
//
//  4. A NEWEST-FIRST SORT CONTROL. The read is already newest-first by contract
//     and there is nothing to ask for; a control that redraws and reorders
//     nothing is worse than no control.
//
//  5. A READABLE TIMESTAMP — now said by the engine. A `text` takes no
//     `format`, so the row printed the ISO instant whole. A system record's ISO
//     dates now carry their text in the page language and the operator zone
//     (`systemRecordWithText`), so `$record.bootedAt` prints a date and a time
//     and `$record.bootedAt.raw` keeps the stamp.
//
//  6. THE VERTICAL FAMILY COLUMN. `?view=current` keeps Schema's family
//     navigation, as the wrapping chip RAIL Schema shipped for widths below
//     `lg` — at every width. `withShell`'s nav column is one static array for the
//     whole page, so a column that belongs to one of two views would render an
//     empty 224px gutter beside the timeline. Same links, same `activeWhen`,
//     laid out horizontally.
//
// ─── WHAT THE `current` VIEW KEEPS FROM SCHEMA, AND WHY ────────────────────
//
// Two things a preset page cannot compute: the declaration TREE over seven
// families, and the whole redacted config as a JSON string (config has no
// `JSON.stringify`). `/api/admin/config/declarations` publishes the first as
// rows, one family at a time; `/api/admin/config/reflection` publishes the
// second as `appJson` — admitted although endpoints publish facts rather than
// words, because a pretty-printed
// serialization of an object the platform already publishes carries no word, no
// label and no ordering meant to be read, and a caller could recompute it
// byte-for-byte while this console cannot.
//
// The family HEADINGS are this page's words and stay here, gated on the flat
// counts the reflection record publishes. That is what keeps the retired
// builder's promise that a family the config does not declare is OMITTED rather
// than rendered as a heading over an empty box — an operator reading this page
// wants their instance, not a catalogue of everything Sovrium could have been
// configured to do.
//
// Redaction happens SERVER-side, before serialisation, on BOTH halves of this
// page. A1 rules that a config-reflection endpoint leaking a secret "is not a
// defective implementation of an authorised surface, it is an unauthorised
// surface", so masking in this config would not be redaction: the payload is the
// boundary the browser, any intermediary proxy and the error tracker all see.
// A6 moves that boundary one step earlier for the ledger, because the ledger
// PERSISTS: a row redacted on the way out is a plaintext credential at rest.
//
// ─── WHY THE PAGE RECORD IS THE REFLECTION AND NOT THE LEDGER ──────────────
//
// A page binds exactly ONE record, and the reflection envelope is flat with no
// array in it — so `appJson` and the seven counts are reachable only as the page
// record. The ledger, being an array under a key, is reachable as a ROWS binding
// from inside the timeline, and a page may carry a record and a rows binding at
// once. The other way round does not work at all.
//
// It costs the list view one in-process read of the reflection envelope it does
// not render (~20ms, measured). It does NOT cost any view that envelope's
// bytes: no node binds `appJson` — the overview summarises the counts and hands
// the document over through `Export JSON`, so it reaches the wire nowhere.
//
// ─── A LIVE DATA DEFECT THIS PAGE DISPLAYS FAITHFULLY ──────────────────────
//
// Measured on this console's own preview, 2026-09-17: two consecutive boots of a
// BYTE-IDENTICAL config alternate between two config hashes and write a row each
// time, with a ~35,000-line diff in each direction. The diff's content names the
// cause — one snapshot carries `$t:` tokens and the next carries their resolved
// English strings, so the capture races the translation-resolution pass. That is
// a platform defect in the capture, reported to `[internal ref]`; it is
// NOT compensated for here. A console that hid noisy rows would be a console
// that hides rows.

import dashboardChangelogRelease from './dashboard-changelog-release.page.json'
import dashboardChangelog from './dashboard-changelog.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export const changelogPages: readonly PageConfig[] = [
  dashboardChangelog as PageConfig,
  dashboardChangelogRelease as PageConfig,
]
