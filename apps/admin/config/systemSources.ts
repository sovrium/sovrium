/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Every read endpoint the console's own pages bind to, named once.
//
// ─── WHY THESE ARE NOT REWRITTEN BY THE MOUNT ──────────────────────────────
//
// A page's `href` is mount-relative and gets moved onto the serving mount's base
// at boot. An `endpoint` is NOT: the JSON API is mounted once for the whole
// server, outside the console's base, so `/api/admin/overview` is already the
// full address and must never gain the `/_admin` prefix. `mount-hrefs.ts` skips
// `endpoint` keys and anything already under `/api/` for exactly this reason —
// which is why these are absolute and must stay absolute.
//
// ─── WHY A MODULE RATHER THAN INLINE STRINGS ───────────────────────────────
//
// Several tiles on one page read the SAME envelope, and the system-value hook
// dedupes them into one fetch by keying its query on the endpoint string. Two
// spellings of the same address would silently become two fetches. Naming each
// once is what keeps that dedup a property of the config rather than of the
// author's care.

/** Cross-domain roll-up: every headline figure on the dashboard overview. */
export const OVERVIEW_ENDPOINT = '/api/admin/overview'

/**
 * Everything that needs an operator's attention, as ONE flat envelope of
 * scalars anchored on the process boot.
 *
 * Flat by design: Welcome reads it as its PAGE RECORD, and `$record.` addresses
 * a flat key. Twenty-three of them — six count/detail pairs for the pulse strip,
 * nine tile sub-line figures, the `since` anchor, `generatedAt`, and an optional
 * `degraded` naming any source whose figures are fallbacks.
 *
 * `since` is byte-identical to `GET /api/admin/config/version`.`startedAt`, so
 * "since this instance started" is exact rather than a rounding. Only the two
 * EVENT cells (`failedRuns`, `recentSubmissions`) are windowed by it; the other
 * four report what is true now.
 */
export const ATTENTION_ENDPOINT = '/api/admin/attention'

/** The canonical audit log, backing the overview's recent-activity panel. */
export const ACTIVITY_ENDPOINT = '/api/admin/audit-log'

/**
 * The declared `app.env[]` variables and their resolution status — key, whether
 * a value resolved, and from which rung. Never a value.
 *
 * Read for its ROWS by the Environment page's row template, which is the first
 * preset surface to expand an ARBITRARY per-row layout over a system source
 * rather than hand one to a fixed island shape.
 */
export const ENV_ENDPOINT = '/api/admin/env'

/** Cross-entity search, backing the shell's ⌘K palette. */
export const SEARCH_ENDPOINT = '/api/admin/search'

/**
 * The instance's own consumption: response grades, cache outcomes, process
 * usage, top storage consumers and the `ECO_*` levers — ONE envelope, read by
 * eight tiles and two grids on the Footprint page. The dedup argument above is
 * exactly why it is named once here rather than spelled ten times on that page.
 */
export const FOOTPRINT_ENDPOINT = '/api/admin/footprint/overview'

/**
 * The per-table roll-up: row counts, soft-deleted backlog and last write, keyed
 * under `by_table` and sorted alphabetically by name.
 *
 * Read for its LIST rather than its figures — it is what `/tables` resolves its
 * first-object redirect from, and the same endpoint and key the sidebar's
 * Records disclosure lazy-loads. Those two must agree, or the bare path lands on
 * a table the picker does not offer.
 */
export const TABLES_OVERVIEW_ENDPOINT = '/api/admin/tables/overview'

/**
 * The bucket index — every bucket the operator declared, plus the virtual
 * `default` that exists whether or not they declared anything.
 *
 * Read for its LIST: `/buckets` resolves its first-object redirect from it, and
 * it is the same endpoint and key the sidebar's Files disclosure lazy-loads.
 */
export const BUCKETS_ENDPOINT = '/api/admin/buckets'

/**
 * Instance-wide storage totals, read by the quota tile on a bucket browser.
 *
 * It takes NO bucket argument, so the figure is the whole instance's rather than
 * the open bucket's. That is what the retired builder showed too; narrowing it
 * would need an endpoint that does not exist.
 */
export const BUCKETS_OVERVIEW_ENDPOINT = '/api/admin/buckets/overview'

/**
 * The agent index — the reserved general-purpose `default` first, then every
 * declaration in order.
 *
 * Read for its LIST: `/agents` resolves its first-object redirect from it, and
 * it is the same endpoint, key and projection the sidebar's Conversations
 * disclosure lazy-loads. One projection, two consumers.
 */
export const AGENTS_ENDPOINT = '/api/admin/agents'

/**
 * The form index, cursor-paginated under `items`.
 *
 * Read for its LIST: `/forms` resolves its first-object redirect from it, and it
 * is the same endpoint and key the sidebar's Submissions disclosure lazy-loads.
 */
export const FORMS_ENDPOINT = '/api/admin/forms'

/**
 * The automations catalog: every declared automation, its effective state, and
 * who paused it.
 *
 * Read TWICE on one page, for two different things — as the catalog grid's rows,
 * and as the run filter's option list. That is the whole reason the filter bar
 * could become config: a preset page cannot read the OPERATOR's
 * `app.automations`, but it can read this.
 *
 * `idKey` is the config `name`, not a generated id: the catalog is a view of
 * config, and an `automation_definitions` row does not exist until an
 * automation's first run.
 */
export const AUTOMATIONS_ENDPOINT = '/api/admin/automations'

/**
 * The pre-computed run figures: how many automations are declared, how many
 * runs and failures landed in the last 24 hours, and the success rate.
 *
 * Shipped, and drawn by nothing until now. `success_rate` is a RATIO (`1`, not
 * `100`) where the analytics readers return an already-scaled percentage — the
 * two conventions meet at the formatter, and getting it backwards renders
 * `100 %` as `1 %`.
 */
export const AUTOMATIONS_OVERVIEW_ENDPOINT = '/api/admin/automations/overview'

/**
 * The run history, newest first, CURSOR-paginated under `items`.
 *
 * Deliberately bound with NO `pagination` block: the endpoint pages by opaque
 * cursor and reports no total, while the grid's pager speaks `page=N` and
 * derives its total from the rows it holds. A pager here summarised "1-25 of
 * 25", read "Page 1 of 1" with Next disabled, and sent a `page=2` the handler
 * drops — three wrong answers at once. The 25-row window is STATED in copy
 * beneath the grid instead.
 */
export const AUTOMATION_RUNS_ENDPOINT = '/api/admin/automations/runs'

/**
 * One run's per-step detail. `:runId` is the drawer's client-side id slot,
 * filled from the clicked row — so the GET fires on a row click, never on load.
 */
export const AUTOMATION_RUN_DETAIL_ENDPOINT = '/api/admin/automations/runs/:runId'

/**
 * The link catalog — definitions, never metrics.
 *
 * There is deliberately no `/api/admin/links/overview` and no per-link click
 * endpoint, however natural either looks: a second aggregation path over the
 * same click rows would eventually disagree with the first ([internal ref] D6). The
 * Links console asks the SAME analytics readers a narrower question, with
 * `event_type=link_click`.
 */
export const LINKS_ENDPOINT = '/api/admin/links'

/**
 * ONE link's full definition, bound at PAGE level by the deep-dive so the
 * heading is in the server-rendered document rather than patched in after a
 * fetch. `recordKey` is `link`; a slug naming nothing 404s, which is
 * what gives the deep-dive its own not-found.
 */
export const LINK_DETAIL_ENDPOINT = '/api/admin/links/:slug'

/**
 * The export ledger: what each design-system serialization weighs, measured from
 * the same builder the download serves.
 *
 * A rows envelope rather than a scalar, one row per format, so the For-agents
 * cards are a row template rather than two hand-written cards naming their own
 * figures — which is the drift this endpoint exists to remove.
 */
export const DESIGN_EXPORTS_ENDPOINT = '/api/admin/design-system/exports'

/**
 * The coverage ledger: per design layer, what it publishes and whether the
 * operator declared any of it.
 *
 * `count` and `declared` are different answers and the page shows both — twelve
 * colours ship whether or not anyone chose them, so a single number would make
 * an untouched palette read as a decision.
 *
 * Also read ROW-WISE and one layer at a time (`?key=color-roles`), because it is
 * the only thing that answers "this app declared none of this" for a block whose
 * content is a rows binding: zero rows render zero rows, and there is nothing
 * left to gate a disclosure on. `configPath` rides along so an empty state can
 * name the key an author would write rather than leaving them a blank panel.
 */
export const DESIGN_COVERAGE_ENDPOINT = '/api/admin/design-system/coverage'

/**
 * The account directory: every account this app has, `{ users, total }`.
 *
 * The admin-TIER endpoint, deliberately — NOT Better Auth's own
 * `/api/auth/admin/list-users`, which gates on the role being literally
 * `admin`. A partner-shaped app whose top operator role is a custom name got a
 * 404 there and an empty directory, while the sibling overview endpoint counted
 * the very same accounts correctly.
 *
 * Read for its ROWS and its `total`: the endpoint reports how many accounts
 * MATCH, which is the number the pager needs rather than the length of the page
 * it was handed. `?format=csv` on the same address is what the export
 * affordance navigates to.
 */
export const USERS_ENDPOINT = '/api/admin/users'

/** Account totals — the three figures of the Users KPI strip, in ONE envelope. */
export const USERS_OVERVIEW_ENDPOINT = '/api/admin/users/overview'

/**
 * The role names this app may ASSIGN: the built-ins, the admin-tier names, and
 * every name declared in `auth.roles[]`.
 *
 * Rows of `{ name }`, because a role name is its own identity and inventing a
 * numeric id would give a picker something to submit that no write endpoint
 * accepts. It exists because that set is computed from the auth config and
 * stored in no table, so a config picker cannot reach it any other way — and a
 * literal list was measured on a partner-shaped app to share ZERO members with
 * the roles that app declares.
 *
 * Offering a name here never grants it: whether a caller may assign a given
 * role is decided where the write happens (`admin-role-guards.ts`).
 */
export const ADMIN_ROLES_ENDPOINT = '/api/admin/roles'

// ─── The page-view analytics readers ────────────────────────────────────────
//
// Every metric on the Analytics and Links consoles comes from these six. There
// is deliberately no `/api/admin/links/overview` and no per-link click endpoint,
// however natural either looks: a second aggregation path over the same click
// rows would eventually disagree with the first ([internal ref] D6). Links asks the
// SAME readers a narrower question, with `event_type=link_click`.
//
// All six require ABSOLUTE ISO `from` / `to`, which is why both surfaces declare
// a `page.window` and substitute `$window.start` / `$window.end` rather than
// carrying a literal timestamp a config file could never keep current.

/**
 * Totals plus a TOP-LEVEL `timeSeries` — the KPI strip and the trend chart.
 *
 * The chart binds this endpoint specifically because of that top level: the
 * chart hook reads `json[rowsKey]` as a plain key and never a dotted path, so a
 * NESTED series block binds to nothing and renders an empty chart with no error
 * anywhere.
 */
export const ANALYTICS_OVERVIEW_ENDPOINT = '/api/analytics/overview'

/** The most-consulted paths over the window (`{ pages, total }`). */
export const ANALYTICS_PAGES_ENDPOINT = '/api/analytics/pages'

/** Top referring domains over the window (`{ referrers, total }`). */
export const ANALYTICS_REFERRERS_ENDPOINT = '/api/analytics/referrers'

/**
 * Device / browser / OS breakdown. ONE response carries THREE arrays
 * (`deviceTypes` / `browsers` / `operatingSystems`), so three grids bind the
 * same endpoint with different `rowsKey`s and share ONE fetch — the
 * system-source hook dedupes on endpoint + query.
 */
export const ANALYTICS_DEVICES_ENDPOINT = '/api/analytics/devices'

/** UTM campaign attribution over the window (`{ campaigns, total }`). */
export const ANALYTICS_CAMPAIGNS_ENDPOINT = '/api/analytics/campaigns'

/**
 * The raw event feed (`{ events, pagination }`), unfiltered by type.
 *
 * Its projection is `snake_case`, unlike every other endpoint the console binds.
 * A camelCase binding renders blank cells, which is exactly how that was found.
 */
export const ANALYTICS_EVENTS_ENDPOINT = '/api/analytics/events'

/**
 * The instance's own facts: resolved public origin, declared `app.version`, the
 * declared tables in declaration order, the RFC 8252 OAuth application type,
 * and the flat counts every heading on the API and MCP pages gates on.
 *
 * Bound as the PAGE RECORD by both Developers docs pages, which is what lets a
 * copy-pasteable block name `$record.origin` rather than a placeholder an
 * operator must hand-substitute into six blocks across two pages. It publishes
 * FACTS and never the composed strings — no curl, no `${origin}/api`, no
 * joined example list — so the words stay in this config and can be translated
 *.
 *
 * Read for its ROWS too: the API page's example block folds one
 * `GET /api/tables/$record.name/records` line per table out of `tables`.
 */
export const INSTANCE_ENDPOINT = '/api/admin/instance'

/**
 * The MCP tools this config exposes, `{ tools, total }`, narrowable by
 * `?category=`.
 *
 * Read for its ROWS by the MCP page's per-category row templates. The category
 * HEADINGS gate on the counts `INSTANCE_ENDPOINT` publishes rather than on this
 * response, so one page render asks one endpoint for its gates and another for
 * its rows and neither is fetched twice to answer the other's question.
 */
export const MCP_TOOLS_ENDPOINT = '/api/admin/mcp/tools'

/**
 * The architecture decision records the running app declares in `app.decisions[]`.
 *
 * `{ decisions, total, accepted, proposed, superseded }` — the register in the
 * order the config states it, plus one flat count per status. The counts are
 * SIBLINGS of the array rather than members of a `totals` object because a
 * console `kpi` and a `$record.` address are both flat: `$record.accepted`
 * resolves where `$record.totals.accepted` would print `[object Object].accepted`
 * at status 200.
 *
 * An app declaring no register answers 200 with an empty list and four zeroes,
 * never 404 — so this page's empty state is drawn from a real body rather than
 * from a failed request.
 *
 * Read-only, and there is no second address: nothing edits a decision, and
 * there is no per-id read either. The register lives in `app.ts` and is
 * redeployed — [internal ref] D2 for the config generally, and the whole of amendment
 * A6 for this surface.
 */
export const DECISIONS_ENDPOINT = '/api/admin/decisions'

/**
 * The BOOT LEDGER: every retained start whose `app.version` or config hash
 * differs from the row before it, newest first, with flat totals beside the
 * array for direct `$record.` binding.
 *
 * [internal ref] amendment A6, surface 8. A6 extends A1's invariant — reading the
 * running configuration is observability, mutating it is authoring — with the
 * question A1 had no ledger to ask: *has what this surface describes already
 * happened?* Every row here describes a boot that already ran, which is what
 * separates it from D1's refused "version ledger / history / diff", whose
 * referent is [internal ref]'s *draft* store.
 *
 * An instance whose ledger was pruned to nothing answers 200 with an empty list
 * and zeroes rather than 404, so the timeline's empty state is drawn from a real
 * body — the same contract the decisions register above states.
 */
export const RELEASES_ENDPOINT = '/api/admin/releases'

/**
 * ONE boot: its scalars, the engine migrations applied since the previous row,
 * the app-table DDL the engine derived from the config diff, and the unified
 * diff against the boot before it.
 *
 * `:hash` is the id slot the page RECORD injects its route segment into;
 * {@link RELEASE_DETAIL_ROWS_ENDPOINT} is the same address in the `$param.`
 * grammar a ROWS envelope substitutes. Two grammars, one address — the
 * component-type detail below states the same pair for the same reason, and the
 * system-value hook dedupes them into one fetch because the resolved strings
 * agree.
 *
 * The segment takes either a twelve-hex config hash or a row id, and the console
 * links the **hash**, which is this contract's own recommendation: it is what an
 * operator reads off a diff and what fits a breadcrumb. A hash resolves to the
 * NEWEST row carrying it — `A → B → A` is a legitimate sequence of three boots in
 * which two rows share one hash — while an id addresses one row exactly, which is
 * git's ref-or-sha shape and fails in the direction an operator recovers from.
 * Anything resolving to neither is 404, never 400 — a 400 would tell a prober the
 * shape was right.
 */
export const RELEASE_DETAIL_ENDPOINT = '/api/admin/releases/:hash'

/** The same address in the `$param.` grammar a rows envelope substitutes. */
export const RELEASE_DETAIL_ROWS_ENDPOINT = '/api/admin/releases/$param.hash'

/**
 * The Schema page's own record: the redacted running configuration serialized
 * with two-space indentation, plus one flat count per declaration family.
 *
 * The counts are what each family heading gates on — a heading over an empty
 * box is precisely what the retired builder's `groups.length > 0` filter
 * existed to prevent.
 */
export const CONFIG_REFLECTION_ENDPOINT = '/api/admin/config/reflection'

/**
 * The declaration tree's rows, narrowed one family at a time by `?family=`.
 *
 * One request per family rather than one walk filtered on the client: a family
 * the config does not declare then costs an empty array instead of a filtered
 * walk of the whole tree, and each family's heading and rows come from one
 * place.
 */
export const CONFIG_DECLARATIONS_ENDPOINT = '/api/admin/config/declarations'

/**
 * The decoded, redacted configuration ITSELF — the file an operator saves.
 *
 * Distinct from {@link CONFIG_REFLECTION_ENDPOINT}, which wraps the same object
 * in an envelope of per-family counts. Those counts belong to the Schema page's
 * navigation rather than to the document someone pastes into a bug report, so
 * the Export button downloads this one. Secrets are already `***` when it
 * answers: redaction is server-side, before serialisation ([internal ref] A1).
 *
 * Never bound as a page record — it is a DOWNLOAD target only, and the download
 * runs as a credentialed fetch because this path needs the operator's session.
 */
export const CONFIG_SCHEMA_ENDPOINT = '/api/admin/config/schema'

/**
 * The component-type catalogue: one row per type the engine can draw.
 *
 * `{ items, total }`, never paginated — the catalogue is bounded by the schema
 * rather than by data, so a page reads it whole. Each row carries what a card
 * needs and nothing a card would have to compute: the type's own literal, its
 * category and title, its own address, the five axis counts, and — for a type
 * the catalogue reports rather than draws — the state and the sentence that say
 * so. A config page has no arithmetic and no string operations, so every one of
 * those arrives already in the form the page prints.
 */
export const COMPONENT_TYPES_ENDPOINT = '/api/admin/schema/component-types'

/**
 * The FIELD-type catalogue: one row per column type a table may declare.
 *
 * A separate read from the component catalogue above, and not a mode of it. A
 * field type has no renderer, no variant axis, no state vocabulary and no props
 * table — none of the facts a component-type row publishes applies to one — so
 * folding the two behind a `?kind=` would produce rows whose every member but
 * `type` and `category` is optional, and a page binding it would have to know
 * which half it asked for in order to read the answer.
 *
 * It describes what a table MAY declare and never what this instance's tables
 * do, which is what makes it a build constant rather than a config read: the
 * composed form draws the same controls on every instance.
 */
export const FIELD_TYPES_ENDPOINT = '/api/admin/schema/field-types'

/**
 * Every sentence the operator's `design` block declares, split into the
 * register a reader obeys and the reason the same line gave for it.
 *
 * `?kind=` narrows to one declaration family. The split is SERVER-side and has
 * to be: a config page has no string operations at all, and the shipped
 * splitter is quote-aware precisely because a naive cut on the first period
 * falls inside a quoted mechanism.
 *
 * Read many times on one page — once per family — and deduped into one fetch
 * per distinct `kind`, which is the reason each family is a separate binding
 * rather than one read filtered in the page: a config page has no filter that
 * could narrow rows it already holds.
 */
export const DESIGN_GUIDANCE_ENDPOINT = '/api/admin/design-system/guidance'

/**
 * The declared zones: which route family reads in which register, and what
 * accent budget it may spend.
 *
 * `accentBudget` arrives RESOLVED — a zone declaring none is `product` — because
 * a page cannot apply a default. `hasVoiceOverride` is a boolean rather than the
 * override itself: the override's sentences are already rows on the guidance
 * facet under `zone.voice.*`, and publishing them twice would let the two drift.
 */
export const DESIGN_ZONES_ENDPOINT = '/api/admin/design-system/zones'

/**
 * The declared MARK: its renderings, its geometry, and which of the two states
 * the Brand page is in.
 *
 * THREE reads of one body, each by its own key. `declared` and `state` are read
 * as the page RECORD — the gate no rows binding can answer, since
 * `visibility.record` has neither a length nor a presence operator. `items` is
 * one row per DECLARED rendering, light before dark, each carrying the ground it
 * is designed to sit on. `facts` is the geometry as rows — always all three,
 * never filtered, each carrying its own `declared` gate — because a nested
 * `facts` object is unreachable from a page: `rowsKey` is a flat `body[key]`
 * lookup and `$record.` admits no dots.
 *
 * `alt` rides on the rendering row AND on a fact row, deliberately. An `img`
 * needs its own accessible name, a row template binds ONE rows source, and
 * nothing joins two arrays of one response body — so a mark published only on
 * the fact row would render with an EMPTY name on the very panel printing the
 * sentence that says what that name should be.
 */
export const DESIGN_BRAND_ENDPOINT = '/api/admin/design-system/brand'

/**
 * The resolved access graph — who holds which role or team, what each grant
 * source reaches, and what that exposes.
 *
 * ONE read behind the whole Organisation page. The five lenses the canvas draws
 * are five PROJECTIONS of this one graph rather than five reads, which is why
 * it takes no query parameter: the lens is a client concern.
 *
 * Read TWICE by `/organisation`, for two different things, and deduped into one
 * fetch by the system-value hook — as the page RECORD, for the two gates no
 * rows binding can answer, and as the findings list's ROWS (`rowsKey:
 * 'findings'`, `idKey: 'id'`).
 *
 * `findings[].message` arrives as one already-rendered SENTENCE rather than as
 * parts, because a config page can print a string but cannot format one. The
 * join, the truncation and the ordering therefore live server-side and the page
 * prints what it is handed. `subjects[]` carries the same facts structurally for
 * a consumer that wants to link them; this page does not, because the sentence
 * already names them and a second copy beside it is a word not doing work.
 *
 * ─── WHAT THIS PAGE CANNOT READ, AND WHY IT IS NAMED HERE ──────────────────
 *
 * `nodes`, `edges` and `degraded` are ARRAYS, and two of the three are arrays of
 * objects. A rows binding hands a template a RECORD and `$record.<field>` names
 * a field of one, so `degraded: string[]` expands into rows with no fields at
 * all — the same bare-`string[]` trap {@link DESIGN_USAGE_ENDPOINT} solved by
 * publishing `routeRows` beside `items`. `nodes` and `edges` are bindable but
 * are the LENSES, which are later slices.
 *
 * So this page reads `findings` as rows, and reads the rest only as the record
 * its two gates test. See the page's own note for the gate mechanism and the
 * scalar that would replace it.
 *
 * Derived per request and never stored: two reads a second apart may
 * legitimately differ, because the population they measure changed. Nothing
 * pages, nothing is acknowledged, nothing persists.
 */
export const ORGANISATION_GRAPH_ENDPOINT = '/api/admin/organisation/graph'

/**
 * Every token this app renders with, flat — one row per leaf of the DTCG
 * document, plus the two projections a page cannot compute.
 *
 * FOUR reads of one body, each by its own key. `items` is the token rows,
 * optionally narrowed to one group (`?group=color`); `summary` is the counters;
 * `discarded` is what the engine received and did NOT turn into a token, one
 * row per declaration carrying its own `kind`.
 *
 * Each row carries what a page cannot derive: `leaf` (a config page cannot split
 * `color.background`), the hex conversion and gamut verdict for BOTH schemes,
 * the two contrast measurements, and the `fontSize` / `lineHeight` members of a
 * typography composite, which `value` renders as one unsplittable string.
 *
 * `darkContrastLevel` is REQUIRED where its three siblings are optional: it is
 * the gate a dark badge is hidden behind, and `visibility.record` has no
 * presence operator to test an absence with. `unmeasured` is a value.
 */
export const DESIGN_TOKENS_ENDPOINT = '/api/admin/design-system/tokens'

/**
 * The PLATFORM type ladder — what Tailwind's own `text-*` utilities resolve to.
 *
 * A build constant: it takes no app, and two instances on one build answer
 * identically. Kept apart from the declared ladder (`?group=typography` on the
 * tokens facet) precisely so neither can be read as the other — an operator who
 * declared no type scale still has to be able to learn what their text renders
 * at, and telling them a borrowed ladder is their declaration is the defect
 * `[internal ref]` exists to prevent.
 */
export const DESIGN_TYPE_LADDER_ENDPOINT = '/api/admin/design-system/type-ladder'

/**
 * ONE component type, in full: its own fields, the shared modules it spreads,
 * both axes flat, the states its category draws, the flat variant × state
 * product, its usage routes and its category siblings.
 *
 * The rows envelope and the record envelope are the SAME address, read twice
 * per request and deduped by the system-value hook: the per-type page binds it
 * as its page RECORD (for the scalars every gate reads) and again as six
 * different `rowsKey` bindings (for the six lists it draws). A second spelling
 * of one address would silently become two fetches.
 *
 * `:type` is the id slot the page RECORD injects its route segment into;
 * `$param.type` is the substitution form the row bindings use, because a rows
 * envelope has no id slot. Two grammars, one address — see the page's own note.
 */
export const COMPONENT_TYPE_DETAIL_ENDPOINT = '/api/admin/schema/component-types/:type'

/** The same address in the `$param.` grammar a rows envelope substitutes. */
export const COMPONENT_TYPE_DETAIL_ROWS_ENDPOINT = '/api/admin/schema/component-types/$param.type'

/**
 * ONE component type's whole option surface — the Configuration section's two
 * nested lists, from one address read twice.
 *
 * The DETAIL route beside it answers `object` for `pagination` and stops, which
 * is the right answer for a props table and not enough for a section that has
 * to name `columns[].format` and list its twelve values. This is the same
 * schema walked to the bottom and flattened.
 *
 * ─── TWO READS, BECAUSE A GROUP CANNOT CARRY ITS OWN ROWS ──────────────────
 *
 *   outer   …/options                     rowsKey: groups
 *   inner   …/options?group=$record.key   rowsKey: items
 *
 * `rowsKey` is one flat `body[key]` lookup and `$record.` walks no path, so an
 * `items[]` published INSIDE a group would be data no config page could reach.
 * The engine's answer to a nested list is a second read per outer row, and the
 * inner binding's `query.group` is substituted from the outer row before it
 * runs — so the N reads are N different reads.
 *
 * `$param.type` and not `:type`: a rows envelope has no id slot, so the segment
 * arrives by substitution exactly as it does for the detail rows above.
 */
export const COMPONENT_TYPE_OPTIONS_ROWS_ENDPOINT =
  '/api/admin/schema/component-types/$param.type/options'

/**
 * Usage over the operator's own pages: one row per subject — catalogued TYPE or
 * declared TEMPLATE — carrying how many routes write it, whether it is too tall
 * to draw inline, and its own declaration serialised for copying.
 *
 * `routeRows` beside `items` is the same routes flattened to one row per pair,
 * because a bare `string[]` is unbindable from a config page: `rowsKey` hands a
 * template a RECORD and `$record.<field>` names a field of one, so strings
 * expand into rows with no fields at all.
 *
 * `?subject=` picks the question and `?name=` narrows to one row — which is
 * what makes ONE endpoint serve a card index, a card's own nested route chips,
 * and a sub-route drawing a single component.
 */
export const DESIGN_USAGE_ENDPOINT = '/api/admin/design-system/usage'

/**
 * Three rows the platform publishes so a data component can be DRAWN.
 *
 * The design system has to show what a table, a kanban board and a calendar do
 * with records, and the only records this console could otherwise reach are
 * yours — which is exactly what the specimen bound forbids. So the platform
 * serves its own three: `id`, `name`, `role`, `status`, `startsAt`, `endsAt`,
 * enough to group by, place on a date and summarise, and belonging to nobody.
 *
 * The envelope is `{ items, total }`, so a rows binding takes `rowsKey: 'items'`
 * and a scalar binding takes `valuePath: 'total'`.
 */
export const SPECIMEN_ROWS_ENDPOINT = '/api/admin/design-system/specimen-rows'

/**
 * The same fixture, reachable as a TABLE rather than as a read endpoint.
 *
 * Reserved and feature-prefixed by the platform, so declaring a table of this
 * name cannot shadow it, and read-only by omission: only a GET is registered,
 * so a write falls through to the ordinary record routes and meets the
 * undeclared-table 404.
 *
 * The literal is repeated here rather than imported: `apps/admin/**` value-
 * imports nothing from `src/` — the `Admin Config Only` gate enforces it — and
 * this config is frozen into the embedded preset, which must not carry an edge
 * back into the engine that built it.
 *
 * Bind this where a drawing needs ROWS: a trend line to plot, an aggregate to
 * reduce, candidates to pick from. Bind the endpoint above where it needs one
 * pre-computed number.
 */
export const SPECIMEN_TABLE_NAME = 'design_system_specimens'

/**
 * The share links that let someone read this system without an account.
 *
 * `GET` lists them as `{ items, total }` — id and creation date only, never the
 * token, because a listing that carried the secret would hand it to anyone who
 * could read the page it is drawn on. `POST` mints one and answers with the
 * token exactly once. `DELETE /:id` revokes, answers 404 for an unknown or
 * already-revoked id, and writes an audit row.
 */
export const SHARES_ENDPOINT = '/api/admin/design-system/shares'
