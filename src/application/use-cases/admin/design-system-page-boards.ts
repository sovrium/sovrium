/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The boards a page export draws for one page: the page at its default state,
 * then one more board per seeded record its route draws (`--seed`, up to
 * `--records`), then one per state asked for (`--state`), each with the state
 * it is drawn at, the address and the account it is drawn as, and its title on
 * the canvas.
 *
 * ─── THE DEFAULT BOARD ─────────────────────────────────────────────────────
 *
 * Every page has one board at its default state: drawn for an administrator
 * (the first seeded admin, else the sample one), each query at its default, a
 * routed record page at its first seeded record. It is the board a plain
 * export draws, and the one `pages/<name>.page.html` holds.
 *
 * ─── TITLES ────────────────────────────────────────────────────────────────
 *
 * A board is titled with the page's `meta.title` (its name when the title is
 * translated or absent), then the record it draws, then the role it is drawn
 * for when the page shows a role a different branch.
 */

import {
  evaluatePermission,
  OPEN_WHEN_UNDECLARED,
  permits,
} from '@/domain/models/app/auth/permission-evaluation'
import { SPECIMEN_PERSON } from '@/domain/models/app/pages/specimen-sample-service'
import { syntheticTitleOf } from '@/domain/models/app/pages/synthetic-seed-service'
import { sampleRouteValuesOf } from './design-system-page-seed'
import { appRolesOf, type PageStateRequest } from './design-system-page-states'
import type { BoardBranches } from './design-system-page-branches'
import type { PageSeed, PageSeedAccount, PageSeedRow } from './design-system-page-seed-folder'
import type { App } from '@/domain/models/app'
import type { PermissionValue } from '@/domain/models/app/auth/permissions'
import type { Page } from '@/domain/models/app/pages'
import type { SpecimenFieldShape } from '@/domain/models/app/pages/specimen-sample-service'

/** How a page export draws its pages beyond the synthetic sample. */
export interface PageDrawOptions {
  /** The seed folder `--seed` named, read and resolved. */
  readonly seed?: PageSeed | undefined
  /** The instant relative times are drawn against (`--now`). */
  readonly now?: Readonly<Date> | undefined
  /** How many boards a routed record page gets (`--records`); 5 by default. */
  readonly records?: number | undefined
  /** One more board per state asked for (`--state`). */
  readonly states?: readonly PageStateRequest[] | undefined
  /** Clickable boards (`board`), and a board whose changes carry across pages (`app`). */
  readonly prototype?: 'board' | 'app' | undefined
}

/** What a board draws in place of its page: the answer the app gives a reader there. */
export type PageBoardAnswer = 'not-found' | 'error' | 'sign-in'

/** One board of a page, as it is drawn. */
export interface PageBoardPlan {
  /** Its `<key>=<value>` label on the canvas; `undefined` on the page's default board. */
  readonly label: string | undefined
  /** What it is drawn at, by name, as the node map records it. */
  readonly state: Readonly<Record<string, string>>
  readonly title: string
  /** The value each route parameter of the page is drawn at. */
  readonly routeValues: Readonly<Record<string, string>>
  /** The seeded account it is drawn as; `undefined` for the sample administrator. */
  readonly viewer: PageSeedAccount | undefined
  /** Which branches it draws. */
  readonly branches: BoardBranches
  /** The query values it asks for beyond the defaults, handed to the renderer. */
  readonly query: Readonly<Record<string, string>>
  readonly theme?: 'light' | 'dark' | undefined
  readonly width?: number | undefined
  readonly answer?: PageBoardAnswer | undefined
  /** The form drawn as the server refused its submission. */
  readonly refusedForm?: string | undefined
}

/** How many record boards a routed record page gets when `--records` says nothing. */
export const DEFAULT_RECORD_BOARDS = 5

/** The role every page is drawn for by default: the one every gate opens to. */
const DEFAULT_ROLE = 'admin'

/** The widest board that still draws a phone layout, below a tablet's breakpoint. */
const NARROW_BELOW = 768

/** The page's own name for itself: its literal `meta.title`, else its name. */
const pageTitleOf = (page: Page): string => {
  const title = (page.meta as { readonly title?: unknown } | undefined)?.title
  return typeof title === 'string' && title !== '' && !title.startsWith('$t:') ? title : page.name
}

/** Whether a node of the page is shown or hidden by the reader's role. */
const hasRoleBranch = (page: Page): boolean =>
  JSON.stringify(page.components ?? []).includes('"roles":')

/** The first seeded account of a role. */
export const seededAccountOf = (
  seed: PageSeed | undefined,
  role: string
): PageSeedAccount | undefined => seed?.accounts.find((account) => account.role === role)

/**
 * The account a page is drawn as for a role: its first seeded account, else
 * the sample person in that role; `undefined` for the sample administrator.
 */
const viewerFor = (seed: PageSeed | undefined, role: string): PageSeedAccount | undefined =>
  seededAccountOf(seed, role) ??
  (role === DEFAULT_ROLE
    ? undefined
    : { id: 'specimen', name: SPECIMEN_PERSON.name, email: SPECIMEN_PERSON.email, role })

/** The default value of each query parameter the page declares. */
export const queryDefaultsOf = (page: Page): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(
      ((page as { readonly query?: unknown }).query ?? {}) as Readonly<
        Record<string, { readonly default?: unknown }>
      >
    ).flatMap(([name, spec]) =>
      spec.default === undefined ? [] : [[name, String(spec.default)] as const]
    )
  )

/** The roles a page admits: the ones its `access` names, else every role of the app. */
const admittedRolesOf = (app: App, page: Page): readonly string[] => {
  const required = (page as { readonly access?: { readonly require?: PermissionValue } }).access
    ?.require
  return appRolesOf(app).filter((role) =>
    permits(evaluatePermission(required, { role }, PAGE_ACCESS_POLICY))
  )
}

/** A page closed by no rule is open to every role; an admin is admitted where a rule names her. */
const PAGE_ACCESS_POLICY = {
  whenUndeclared: OPEN_WHEN_UNDECLARED,
  adminOverride: 'no-admin-override',
} as const

/** The routed record table of a page: a single-record data source read at a route parameter. */
export const recordSourceOf = (
  page: Page
): { readonly table: string; readonly param: string } | undefined => {
  const source = (page as { readonly dataSource?: unknown }).dataSource as
    { readonly table?: unknown; readonly mode?: unknown; readonly param?: unknown } | undefined
  return source?.mode === 'single' &&
    typeof source.table === 'string' &&
    typeof source.param === 'string'
    ? { table: source.table, param: source.param }
    : undefined
}

/** The seeded records a routed record page is drawn at, at most `limit`. */
const recordRowsOf = (
  page: Page,
  options: PageDrawOptions
): { readonly param: string; readonly table: string; readonly rows: readonly PageSeedRow[] } => {
  const source = recordSourceOf(page)
  const rows = source === undefined ? [] : (options.seed?.tables[source.table] ?? [])
  return {
    param: source?.param ?? '',
    table: source?.table ?? '',
    rows: rows.slice(0, options.records ?? DEFAULT_RECORD_BOARDS),
  }
}

/** The page's default board and one board per seeded record its route draws. */
const recordPlansOf = (
  app: App,
  page: Page,
  options: PageDrawOptions
): readonly PageBoardPlan[] => {
  const viewer = viewerFor(options.seed, DEFAULT_ROLE)
  const role = viewer?.role ?? DEFAULT_ROLE
  const query = queryDefaultsOf(page)
  const base = {
    viewer,
    query: {},
    routeValues: sampleRouteValuesOf(app, page),
    state: { ...query, role },
    branches: { query, role },
  }
  const roleTitle = hasRoleBranch(page) ? [role] : []
  const records = recordRowsOf(page, options)
  const fields = (app.tables?.find((table) => table.name === records.table)?.fields ??
    []) as readonly SpecimenFieldShape[]
  if (records.rows.length === 0) {
    return [{ ...base, label: undefined, title: [pageTitleOf(page), ...roleTitle].join(' · ') }]
  }
  return records.rows.map((row, at) => {
    const id = String(row['id'])
    return {
      ...base,
      label: at === 0 ? undefined : `record=${id}`,
      state: { ...base.state, record: id },
      title: [pageTitleOf(page), syntheticTitleOf(fields, row), ...roleTitle]
        .filter((part) => part !== '')
        .join(' · '),
      routeValues: { ...base.routeValues, [records.param]: id },
      branches: { ...base.branches, record: row },
    }
  })
}

/** What each answer a `page` or `session` state draws in place of the page. */
const ANSWERS: Readonly<Record<string, PageBoardAnswer>> = {
  'page=404': 'not-found',
  'page=403': 'not-found',
  'page=500': 'error',
  'session=expired': 'sign-in',
}

/** The default board, redrawn at one state. */
const statePlanOf = (
  defaultBoard: PageBoardPlan,
  options: PageDrawOptions,
  request: { readonly key: string; readonly value: string }
): PageBoardPlan => {
  const { key, value } = request
  const label = `${key}=${value}`
  const plan = {
    ...defaultBoard,
    label,
    state: { ...defaultBoard.state, [key]: value },
    title: `${defaultBoard.title.split(' · ')[0] ?? ''} · ${label}`,
  }
  if (key === 'role') {
    return {
      ...plan,
      viewer: viewerFor(options.seed, value),
      branches: { ...plan.branches, role: value },
    }
  }
  if (key === 'theme') return { ...plan, theme: value === 'dark' ? 'dark' : 'light' }
  if (key === 'width') {
    const width = Number(value)
    return { ...plan, width, branches: { ...plan.branches, narrow: width < NARROW_BELOW } }
  }
  if (key === 'data') {
    return {
      ...plan,
      branches: { ...plan.branches, data: value === 'loading' ? 'loading' : 'empty' },
    }
  }
  if (label in ANSWERS) return { ...plan, answer: ANSWERS[label] }
  if (key.startsWith('form.')) return { ...plan, refusedForm: key.slice('form.'.length) }
  return {
    ...plan,
    query: { ...plan.query, [key]: value },
    branches: { ...plan.branches, query: { ...plan.branches.query, [key]: value } },
  }
}

/**
 * Every board of one page, its default board first.
 *
 * @param app - the validated config.
 * @param page - one of its pages.
 * @param options - the seed, the clock, the record count and the states of the export.
 */
export const boardPlansOf = (
  app: App,
  page: Page,
  options: PageDrawOptions
): readonly PageBoardPlan[] => {
  const records = recordPlansOf(app, page, options)
  const [defaultBoard] = records
  if (defaultBoard === undefined) return records
  const states = (options.states ?? [])
    .filter((state) => state.page === page.name)
    .flatMap((state) =>
      state.key === 'role' && state.value === '*'
        ? admittedRolesOf(app, page).map((role) => ({ key: 'role', value: role }))
        : [state]
    )
  return [...records, ...states.map((state) => statePlanOf(defaultBoard, options, state))]
}

/** The section a page is in on the canvas: who may open it. */
export interface PageSection {
  readonly id: string
  readonly title: string
}

/** Every address a closed page sends a signed-out reader to: the app's sign-in pages. */
const signInPathsOf = (app: App): ReadonlySet<string> =>
  new Set(
    (app.pages ?? []).flatMap((page) => {
      const target = (page as { readonly access?: { readonly redirectTo?: unknown } }).access
        ?.redirectTo
      return typeof target === 'string' ? [target.split('?')[0] ?? target] : []
    })
  )

/**
 * The section of the canvas a page is in, from its access rule alone: the
 * pages a signed-out reader is sent to sign in on, the pages a few roles
 * open, the pages every signed-in reader opens, and the public ones.
 *
 * @param app - the validated config.
 * @param name - the page's name.
 */
export const pageSectionOf = (app: App, name: string): PageSection => {
  const page = (app.pages ?? []).find((candidate) => candidate.name === name)
  const required = (page as { readonly access?: { readonly require?: unknown } } | undefined)
    ?.access?.require
  if (page !== undefined && signInPathsOf(app).has(page.path)) {
    return { id: 'sign-in', title: 'Sign-in' }
  }
  if (Array.isArray(required)) {
    const roles = required.map(String)
    return { id: `only-${roles.join('-')}`, title: `Only for ${roles.join(', ')}` }
  }
  return required === undefined || required === 'all'
    ? { id: 'public', title: 'Public pages' }
    : { id: 'signed-in', title: 'Signed-in pages' }
}
