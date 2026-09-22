/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rows every `data` catalog specimen draws, and the window a caller takes
 * out of them.
 *
 * ─── PLATFORM FIXTURE CONTENT, AND THAT IS THE WHOLE POINT ─────────────────
 *
 * A `table` over no rows is an empty state, and an empty state documents
 * nothing — so the specimen has to show real rows. It must NOT show the
 * operator's: [internal ref] A2 bounds a preview frame to "fixture text the platform
 * ships, not the operator's rows", and the leak would be in the WIRING as much
 * as in the bytes — a specimen bound to an operator table would fetch their
 * records on the next hydration even if this render happened to be empty.
 *
 * Hence platform-authored rows. They name no table, read no database, and
 * cannot be made to: there is no parameter to point them anywhere.
 *
 * ─── ONE CONSTANT, TWO TRANSPORTS ──────────────────────────────────────────
 *
 * The fixture is reachable two ways and lives here so it cannot differ between
 * them. `GET /api/admin/design-system/specimen-rows` reads it as an
 * `{ items, total }` envelope, and the reserved table name
 * {@link SPECIMEN_TABLE_NAME} reads it through the records API, because
 * `record-picker` and `comments` can bind a TABLE and nothing else.
 *
 * The endpoint is not made redundant by the binding, and the reason is the
 * EMPTY state: `paginationSchema` floors a page's `limit` at one row and the
 * request guard beside it answers `limit=0` with a 400 rather than inventing an
 * intent, so no bound table can serve no rows above a tally that agrees with
 * them. `?rows=0` can, and a kit that cannot draw an empty state documents a
 * component it has only ever seen full.
 *
 * ─── WHY THE DATES ARE COMPUTED AND NOT LITERAL ────────────────────────────
 *
 * `calendar` and `data-timeline` place a record by a DATE, and both drop any
 * row whose date field will not parse. A literal date would therefore document
 * the calendar for as long as the month it names, and draw an empty grid ever
 * after — a specimen that silently stops being one. Anchoring on the current
 * month keeps every view populated on any instance, on any day.
 *
 * ─── THE VALUES ARE REAL TYPES, NOT STRINGS THAT LOOK LIKE THEM ────────────
 *
 * A row of strings makes every column a kit page could draw over it a TEXT
 * column, and a specimen that cannot demonstrate what it documents is not one.
 * `amount: '1240.5'` would satisfy a shape check and format as nothing: a
 * currency column has to be handed a NUMBER to align or separate it, and a
 * boolean column handed `'false'` draws the same check it draws for `'true'`.
 *
 * ─── AND THE SET IS CHOSEN SO EVERY RENDERING IS DISTINGUISHABLE ───────────
 *
 * Every column carries a deliberately VARIED series rather than a repeated
 * value: a fixture where two rows agreed on a field would let a column that
 * dropped that field pass unnoticed. Three `priority` values so an
 * option-coloured chip has three colours to draw; `active` both ways; three
 * `category` values so a kanban grouped by it has three swimlanes; amounts,
 * shares, view counts and byte sizes spanning several magnitudes with
 * fractional values among them, so alignment, separators, decimal places,
 * percentages and byte formatting are all exercised rather than merely present.
 *
 * The cycles are deliberately CO-PRIME with each other — `priority` turns every
 * 3 rows, `status` every 5, `active` every 2, the schedule every 6 — so no two
 * columns are the same column under a different name. `category` is authored
 * per row rather than cycled for exactly that reason: a three-cycle would have
 * made it indistinguishable from `priority`, and a kanban grouped by either
 * would have drawn the same board twice.
 *
 * The option COLOURS are deliberately not published here. They belong to the
 * column that renders the value, not to the row that carries it — a row that
 * shipped its own palette would decide how every surface draws it.
 *
 * ─── WHY THE ROWS ARE AUTHORED AS COLUMNS ──────────────────────────────────
 *
 * Thirty rows of fourteen named fields is a 540-line literal, over the 400-line
 * budget `max-lines` holds this layer to — and `bun run lint` runs at
 * `--max-warnings 0`, so that budget is a failure and not a suggestion. The
 * varying values are therefore authored as one compact tuple per row plus one
 * sentence per row, and the fields that are pure rhythm are derived from the
 * index.
 *
 * That costs one invariant a literal would have given for free: the two
 * authored lists must stay the same length and stay row-aligned. It is bought
 * back mechanically rather than by care — `specimen-fixture.test.ts` pins the
 * lengths against each other and against {@link SPECIMEN_ROW_COUNT}, so a seed
 * added without its sentence fails the unit suite rather than shipping a row
 * whose description belongs to its neighbour.
 */

/** A fixture row, as both transports serve it. */
export type SpecimenRow = Readonly<Record<string, string | number | boolean>>

/**
 * The reserved name the fixture is bindable under.
 *
 * Feature-prefixed so it cannot shadow an operator's own table: the console
 * must not become reachable by declaring a table that happens to be called the
 * right thing, and an operator who legitimately wants a table of this name gets
 * the platform's answer, which is a strictly better failure than a silent
 * merge of the two.
 */
export const SPECIMEN_TABLE_NAME = 'design_system_specimens'

/**
 * The authored half of each row: `[name, role, category, amount, share, views,
 * size, startDay]`.
 *
 * The first three entries are FROZEN. Several catalogue specimens and their
 * specs are pinned on `Ada Lovelace` reaching the page, so growth is
 * append-only at the head — a build that reordered or renamed them fails
 * `[internal ref]`.
 *
 * `startDay` is authored rather than stepped because the three frozen rows sit
 * on days 4, 11 and 18: any linear step reproducing those repeats every fourth
 * row, which would crowd thirty events onto four days and leave a month view
 * documenting a fixture rather than a calendar.
 */
type SpecimenSeed = readonly [
  name: string,
  role: string,
  category: string,
  amount: number,
  share: number,
  views: number,
  size: number,
  startDay: number,
]

const SPECIMEN_SEEDS: readonly SpecimenSeed[] = [
  ['Ada Lovelace', 'Analyst', 'Discovery', 1240.5, 40.3, 12_480, 2_411_724, 4],
  ['Grace Hopper', 'Engineer', 'Delivery', 87.25, 12.8, 940, 184_320, 11],
  ['Alan Turing', 'Researcher', 'Support', 15_320, 61.5, 1_240_000, 48_211_009, 18],
  ['Katherine Johnson', 'Mathematician', 'Delivery', 2480.75, 27.4, 33_150, 5_120_444, 2],
  ['Margaret Hamilton', 'Architect', 'Discovery', 640.1, 8.6, 7310, 921_600, 7],
  ['Barbara Liskov', 'Researcher', 'Delivery', 9875.4, 73.9, 58_020, 12_582_912, 14],
  ['Donald Knuth', 'Author', 'Support', 320.45, 3.2, 410, 65_536, 21],
  ['Radia Perlman', 'Engineer', 'Support', 4105, 35.7, 91_440, 7_340_032, 25],
  ['Edsger Dijkstra', 'Researcher', 'Discovery', 58.9, 19.1, 2260, 262_144, 1],
  ['Frances Allen', 'Compiler Lead', 'Delivery', 12_640.8, 55.2, 147_900, 26_214_400, 6],
  ['Tim Berners-Lee', 'Architect', 'Discovery', 730.6, 44.8, 620_500, 104_857_600, 9],
  ['Karen Sparck Jones', 'Researcher', 'Support', 1985.3, 22.6, 18_740, 3_145_728, 13],
  ['Vint Cerf', 'Engineer', 'Delivery', 275.15, 67.3, 5090, 786_432, 16],
  ['Jean Bartik', 'Analyst', 'Discovery', 8420, 15.9, 260_310, 41_943_040, 19],
  ['Shafi Goldwasser', 'Researcher', 'Support', 43.6, 88.1, 1180, 131_072, 23],
  ['Leslie Lamport', 'Architect', 'Delivery', 3670.2, 31.5, 74_600, 9_437_184, 26],
  ['Anita Borg', 'Programme Lead', 'Support', 156.4, 6.7, 3820, 393_216, 3],
  ['Ken Thompson', 'Engineer', 'Discovery', 21_450.9, 49.4, 405_270, 83_886_080, 8],
  ['Adele Goldberg', 'Designer', 'Discovery', 917.35, 25.8, 10_640, 1_572_864, 12],
  ['Bjarne Stroustrup', 'Author', 'Support', 5240.6, 58.6, 132_080, 20_971_520, 15],
  ['Evelyn Granville', 'Mathematician', 'Delivery', 68.7, 11.4, 1905, 229_376, 20],
  ['Alan Kay', 'Researcher', 'Delivery', 1432.05, 79.2, 24_360, 4_194_304, 24],
  ['Erna Hoover', 'Engineer', 'Support', 380.9, 17.3, 6075, 655_360, 5],
  ['Peter Naur', 'Author', 'Discovery', 11_208.4, 63.8, 216_490, 33_554_432, 10],
  ['Mary Allen Wilkes', 'Analyst', 'Support', 205.55, 9.9, 2740, 294_912, 17],
  ['Robert Kahn', 'Architect', 'Delivery', 6915.2, 41.6, 168_320, 16_777_216, 22],
  ['Sophie Wilson', 'Engineer', 'Discovery', 74.8, 29.7, 1460, 163_840, 27],
  ['Fred Brooks', 'Programme Lead', 'Delivery', 17_905.65, 52.1, 312_540, 67_108_864, 28],
  ['Jean Sammet', 'Compiler Lead', 'Support', 493.2, 36.9, 8905, 1_048_576, 7],
  ['Hedy Lamarr', 'Designer', 'Discovery', 2075.8, 71.7, 46_180, 10_485_760, 14],
]

/**
 * One sentence per row, row-aligned with {@link SPECIMEN_SEEDS}.
 *
 * The only long text in the set, and the `table` board's second column. Each is
 * distinct: a description column handed thirty copies of one sentence would
 * draw a convincing wall of text and prove nothing about wrapping, truncation
 * or line height.
 */
const SPECIMEN_DESCRIPTIONS: readonly string[] = [
  'Reworked the intake funnel and halved its abandonment rate.',
  'Migrated the billing exports off the nightly batch window.',
  'Traced a decoding fault that only surfaced under replay load.',
  'Rebuilt the forecast model against three years of archives.',
  'Split the deployment pipeline so a rollback stops at one stage.',
  'Specified the consistency rules the replica set now enforces.',
  'Documented the sort keys nobody could explain from the code.',
  'Collapsed four overlapping routing tables into one.',
  'Proved the queue drains under the worst arrival order we found.',
  'Cut the build graph so an untouched module is never recompiled.',
  'Published the link format the partner catalogues now resolve.',
  'Weighted the search index so rare terms stop being drowned out.',
  'Negotiated the handshake that survives a mid-session address change.',
  'Reconciled the ledger after a partial import left it uneven.',
  'Closed the proof gap in the challenge-response exchange.',
  'Ordered the event log so two readers never disagree about it.',
  'Ran the mentoring track that staffed three of these projects.',
  'Reduced the shell to a dozen primitives and kept every feature.',
  'Prototyped the editing surface the console still borrows from.',
  'Wrote the migration guide for the type-system change.',
  'Derived the trajectory corrections the mission plan assumed.',
  'Argued the object model that the component layer inherited.',
  'Automated the call-routing path that had been manual for years.',
  'Named the failure mode that the retry policy now anticipates.',
  'Hand-verified the boot sequence against the printed listing.',
  'Set the addressing scheme every downstream service assumes.',
  'Shrank the instruction set until it fit the power budget.',
  'Estimated the schedule honestly and then defended it.',
  'Standardised the vocabulary the automation grammar reuses.',
  'Patented the frequency-hopping scheme the radio layer uses.',
]

/** How many rows the fixture holds. Pinned by the unit suite. */
export const SPECIMEN_ROW_COUNT = SPECIMEN_SEEDS.length

/** Turns every 3 rows. Frozen head: High, Medium, Low. */
const PRIORITIES = ['High', 'Medium', 'Low'] as const

/**
 * Turns every 5 rows, so it cannot collapse onto the 3-cycle above.
 *
 * Two values rather than three, deliberately: `DRAWN_DATA_CONTENT.chart` in the
 * catalogue spec is pinned on the chart drawing `Active`, and the three-way
 * option this fixture owes a chip is `priority`.
 */
const STATUSES = ['Active', 'Active', 'Paused', 'Active', 'Paused'] as const

/** Turns every 3 rows. Frozen head: days 4-6, 11-12, 18-21. */
const END_OFFSETS = [2, 1, 3] as const

/**
 * Turns every 6 rows. A `calendar` week or day view places an event at an HOUR,
 * and a fixture whose every value fell on midnight leaves that gutter empty.
 *
 * Midnight is kept for one slot in six and paired with `allDay: true`, because
 * an all-day event that also claims an hour is a row no operator would write.
 */
const SCHEDULE = [
  [9, 0],
  [14, 30],
  [0, 0],
  [11, 15],
  [16, 45],
  [8, 0],
] as const

/** The first record number a `list` row is labelled with, e.g. `#1042`. */
const FIRST_RECORD_NUMBER = 1042

/** Co-prime with every cycle above, so no two record numbers collide. */
const RECORD_NUMBER_STEP = 13

/**
 * Build the fixture as of `now`.
 *
 * `now` is a parameter rather than a read, so the function stays pure and the
 * unit suite can place the fixture in a month of its choosing.
 */
export function specimenRows(now: Readonly<Date>): readonly SpecimenRow[] {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const onDay = (day: number): string =>
    new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10)

  return SPECIMEN_SEEDS.map(
    ([name, role, category, amount, share, views, size, startDay], index) => {
      const [hour, minute] = SCHEDULE[index % SCHEDULE.length] ?? [0, 0]
      return {
        id: `specimen-${index + 1}`,
        name,
        role,
        status: STATUSES[index % STATUSES.length] ?? 'Active',
        priority: PRIORITIES[index % PRIORITIES.length] ?? 'High',
        category,
        description: SPECIMEN_DESCRIPTIONS[index] ?? '',
        amount,
        share,
        views,
        size,
        recordNumber: FIRST_RECORD_NUMBER + index * RECORD_NUMBER_STEP,
        active: index % 2 === 0,
        startsAt: onDay(startDay),
        endsAt: onDay(startDay + (END_OFFSETS[index % END_OFFSETS.length] ?? 1)),
        scheduledAt: new Date(Date.UTC(year, month, startDay, hour, minute)).toISOString(),
        allDay: hour === 0,
      }
    }
  )
}

/** A window over the fixture, already parsed out of whatever carried it. */
export type SpecimenWindow = {
  /** Cap the fixture BEFORE the page is taken. `0` is the empty state. */
  readonly cap?: number | undefined
  /** 1-indexed page. Ignored without a `limit`. */
  readonly page?: number | undefined
  /** Page size. Absent, the whole capped fixture is served. */
  readonly limit?: number | undefined
}

/** A page of the fixture, above a tally of what the page was taken from. */
export type SpecimenPage = {
  readonly items: readonly SpecimenRow[]
  readonly total: number
}

/**
 * Cap the fixture, then take a page out of what survives.
 *
 * The ORDER is the contract, and it is the half a reader gets backwards:
 * `?rows=10&limit=5` is five rows out of a capped fixture of ten, never five
 * out of thirty. `total` is therefore the size of the CAPPED fixture and not
 * the length of the page — which is what lets a pager say `1-10 of 30` and be
 * telling the truth, and what leaves `?rows=0` answering no rows above a total
 * of zero.
 */
export function windowSpecimenRows(window: SpecimenWindow, now: Readonly<Date>): SpecimenPage {
  const fixture = specimenRows(now)
  const capped = window.cap === undefined ? fixture : fixture.slice(0, window.cap)
  if (window.limit === undefined) return { items: capped, total: capped.length }
  const offset = ((window.page ?? 1) - 1) * window.limit
  return { items: capped.slice(offset, offset + window.limit), total: capped.length }
}
