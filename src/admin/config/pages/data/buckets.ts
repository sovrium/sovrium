/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Files — the objects stored in each bucket, one browser per bucket.
//
// THREE pages, like Conversations:
//
//   `/files`          the bare collection, which 302s to the first bucket.
//   `/files/system`   the built-in bucket's browser, which also lists every
//                       file a record attaches — whichever bucket holds it —
//                       with the bucket, table, record and field it belongs to.
//   `/files/:bucket`  a declared bucket's browser: usage, upload, file grid.
//
// ─── WHY `system` IS ITS OWN PAGE ──────────────────────────────────────────
//
// The same reason as `/agents/system`, plus one: the blurb has to say what the
// built-in bucket IS, AND its grid carries four provenance columns no declared
// bucket's listing fills. A declared bucket showing four always-empty columns
// would be four columns of noise. Config cannot branch a body on a route
// parameter, so route ORDER does it: the literal page is listed before the
// `:bucket` page, `findMatchingRoute` takes the first match, and reversing the
// two silently drops both the sentence and the columns.
//
// ─── THERE IS ALWAYS A FIRST BUCKET ────────────────────────────────────────
//
// The bucket list always leads with the built-in `system` bucket, then every
// bucket the operator declares.
// So the directory page below is not an empty state and does not pretend to be
// one: it is the honest DEGRADATION path the redirect resolver documents, shown
// only when the list read itself fails. A failed read must cost the redirect,
// never the page.
//
// ─── WHAT MADE THIS AUTHORABLE ─────────────────────────────────────────────
//
// Only one thing, and it is small: `$param` substitution reaching every string
// leaf rather than a rows endpoint alone. This surface WRITES — it interpolates
// the selected bucket into an upload target and into per-row download and delete
// URLs — and none of those is a data source, so each used to carry the literal
// text `$param.bucket` and the browser sent it back as a path segment.
//
// Every endpoint here is under `/api/`, which the mount's href walk leaves
// alone: the JSON API is mounted once for the whole server, outside the
// console's base, so these addresses are already full and must not gain
// `/_admin`.

import dashboardDataBucketsBucket from './dashboard-data-buckets-bucket.page.json'
import dashboardDataBucketsSystem from './dashboard-data-buckets-system.page.json'
import dashboardDataBuckets from './dashboard-data-buckets.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default [
  dashboardDataBuckets as PageConfig,
  dashboardDataBucketsSystem as PageConfig,
  dashboardDataBucketsBucket as PageConfig,
] satisfies readonly PageConfig[]
