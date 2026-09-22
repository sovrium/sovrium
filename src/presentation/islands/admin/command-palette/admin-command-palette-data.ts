/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Data helpers for the `admin-command-palette` island
 *.
 *
 * [internal ref] broadened the palette from a fixed client-side page-jump list
 * into a CROSS-ENTITY GLOBAL SEARCH: typing queries `GET /api/admin/search?q=`
 * (debounced) and renders the matches GROUPED BY TYPE, each result carrying a
 * per-type badge and a deep-link the palette navigates to (via the SPA path).
 * The seven entity kinds and their French operator labels are defined here.
 */

/**
 * The closed set of admin entity kinds the global search spans — mirrors the
 * server `adminSearchEntityTypeSchema` enum.
 */
export type AdminSearchEntityType =
  | 'record'
  | 'submission'
  | 'run'
  | 'user'
  | 'file'
  | 'conversation'
  | 'connection'
  // The design-system kinds. Added HERE as well as in the domain enum and the
  // label record below, because this union is a hand-written MIRROR of the
  // server's — the island is client-bundle code, and importing the domain
  // module would pull zod into every page that mounts the palette.
  //
  // That mirror is why a missing kind is a live defect rather than a build
  // error: TypeScript keeps this union and `ENTITY_TYPE_LABELS` consistent with
  // EACH OTHER, but neither of them against the server. A kind the server emits
  // and this file has not heard of indexes `ENTITY_TYPE_LABELS` at a key it
  // does not hold, and the group renders with an undefined heading.
  | 'design-console'
  | 'component-type'

/**
 * One search result (the S4 allow-list shape the endpoint returns).
 *
 * `type` is a plain string rather than {@link AdminSearchEntityType}: the
 * palette is now a generic component an app points at ITS OWN endpoint, whose
 * kinds this file has never heard of. The union survives as the set of kinds
 * the console emits — see {@link groupLabel} for how an unknown one is named.
 */
export interface AdminSearchResult {
  readonly type: string
  readonly entityId: string
  readonly title: string
  readonly href: string
  readonly updatedAt: string
}

/** One per-type result group. */
export interface AdminSearchGroup {
  readonly type: string
  readonly results: ReadonlyArray<AdminSearchResult>
}

/** The `GET /api/admin/search` response body. */
export interface AdminSearchResponse {
  readonly query: string
  readonly groups: ReadonlyArray<AdminSearchGroup>
}

/**
 * The GROUP label per entity kind — the section heading, and the listbox's
 * accessible name. Plural, because it names a set.
 *
 * The per-RESULT chip is {@link ENTITY_TYPE_BADGES} and not this map. They were
 * one map until the design-system kinds arrived and made the cost visible; see
 * that map's note for why a group's name is the wrong thing to pin on one of
 * its members.
 */
export const ENTITY_TYPE_LABELS: Readonly<Record<AdminSearchEntityType, string>> = {
  record: 'Records',
  submission: 'Submissions',
  run: 'Runs',
  user: 'Users',
  file: 'Files',
  conversation: 'Conversations',
  connection: 'Connections',
  // Moved in the SAME change as the kinds themselves, because they cannot move
  // apart: this record is `Record<AdminSearchEntityType, string>`, so a kind
  // added without its label is a TS2741 build failure, not a blank heading.
  // What the compiler CANNOT catch is a label that is present and wrong, which
  // is what `-DESIGN-003` asserts by reading the rendered group heading.
  'design-console': 'Design system',
  'component-type': 'Component types',
}

/**
 * The per-RESULT badge — one row's kind, in the singular.
 *
 * ─── A SECOND MAP, BECAUSE THE FIRST ANSWERS A DIFFERENT QUESTION ──────────
 *
 * {@link ENTITY_TYPE_LABELS} names a GROUP. Every row inside that group used to
 * carry the identical plural as its badge, which was wrong twice over. It is
 * wrong as COPY — a single record badged "Records" is a set's name pinned to one
 * of its members — and it is wrong as MARKUP, because the heading and every row
 * beneath it then render the same string, so nothing on the page can point at
 * the heading unambiguously and a reader scanning for the section name meets it
 * N+1 times.
 *
 * The badge itself stays: the story contracts a per-result type badge, and a row
 * reached by keyboard, read out of the flow of its heading, still has to say
 * what kind of thing it is. Only its number changes.
 *
 * `design-console` reads "Console page" rather than a de-pluralised "Design
 * system", because a row in that group IS one page of the console — and reusing
 * the section's own name would recreate the collision this map exists to remove.
 *
 * A `Record<AdminSearchEntityType, string>` like its sibling, so a kind added to
 * the union without a badge is a TS2741 build failure rather than a blank chip.
 */
export const ENTITY_TYPE_BADGES: Readonly<Record<AdminSearchEntityType, string>> = {
  record: 'Record',
  submission: 'Submission',
  run: 'Run',
  user: 'User',
  file: 'File',
  conversation: 'Conversation',
  connection: 'Connection',
  'design-console': 'Console page',
  'component-type': 'Component type',
}

/**
 * The group heading for a result kind.
 *
 * Three sources, in order: the app's own `kindLabels` map, the console's
 * built-in labels, and — for a kind neither names — the token itself. Printing
 * the token is deliberate: it is an internal name leaking into the UI, which is
 * visible and fixable, where a blank heading is neither.
 */
export const groupLabel = (
  type: string,
  overrides: Readonly<Record<string, string>> | undefined
): string =>
  overrides?.[type] ?? (ENTITY_TYPE_LABELS as Readonly<Record<string, string>>)[type] ?? type

/** The per-result chip for a kind, falling back to the kind itself. */
export const resultBadge = (type: string): string =>
  (ENTITY_TYPE_BADGES as Readonly<Record<string, string>>)[type] ?? type

/**
 * Fetch the search for `query` from `endpoint`. Returns the parsed response, or
 * `undefined` on any non-OK / network / parse failure (the caller renders the
 * no-results state). A blank query never reaches here (the island short-circuits
 * to the empty prompt).
 */
export async function fetchAdminSearch(
  query: string,
  endpoint: string
): Promise<AdminSearchResponse | undefined> {
  try {
    const separator = endpoint.includes('?') ? '&' : '?'
    const response = await fetch(`${endpoint}${separator}q=${encodeURIComponent(query)}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return undefined
    return (await response.json()) as AdminSearchResponse
  } catch {
    return undefined
  }
}
