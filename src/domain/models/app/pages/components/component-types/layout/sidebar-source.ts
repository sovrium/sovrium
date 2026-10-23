/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The sidebar's FETCHED sources: how a group, an entry's disclosure and a
 * fetched entry's own disclosure turn the rows of a read endpoint into
 * navigation entries.
 *
 * Kept beside `sidebar.ts` rather than inside it: that file holds the authored
 * tree (entries, groups, rail, drawer), and this one holds the three shapes
 * that project a row into an entry. They share one set of fields on purpose, so
 * a fetched entry is addressed, labelled, linked and marked the same way at
 * every level it can appear.
 */

import { Schema } from 'effect'
import { ComponentPropsSchema } from '../../props'
import { SystemSourceSchema } from '../../system-source'
import { SidebarSourceLoadingSchema } from './sidebar-shell'

/** Whether `value` is a kebab-case Lucide icon name (`folder`, `message-circle`). */
const isLucideName = (value: string): boolean => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)

/** Whether `value` is exactly one emoji grapheme (`🎨`, `👩‍💻`, `🇫🇷`). */
const isSingleEmoji = (value: string): boolean => {
  const graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)]
  return (
    graphemes.length === 1 &&
    /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(graphemes[0]?.segment ?? '')
  )
}

/**
 * A fetched source's `icon`: a `{field}` template is judged per row when it is
 * drawn, so it passes here; a value written out must already be a Lucide name
 * or one emoji, because it is the same for every row and nothing later could
 * make it right.
 */
const sidebarSourceIconCheck = (value: string): string | true =>
  /\{[^{}]+\}/.test(value) || isLucideName(value) || isSingleEmoji(value)
    ? true
    : `icon "${value}" is neither a Lucide icon name (such as "folder") nor one emoji, and holds no {field} placeholder to fill from the row`

/**
 * The fields every fetched sidebar source has: the shared rows-envelope system
 * source plus the projections that turn an arbitrary row into an entry.
 *
 * Reusing `SystemSourceSchema` rather than inventing a second endpoint shape is
 * what makes a data-driven sidebar speak the binding a `table` already
 * speaks — including `param` (a group listing whichever collection the route
 * names) and `query` (a statically filtered group).
 */
const sidebarSourceFields = {
  ...SystemSourceSchema.fields,
  /** Row key whose value becomes the entry label */
  labelKey: Schema.String.pipe(
    Schema.annotate({
      description: "Row key whose value becomes each entry's label",
      examples: ['name', 'title'],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
  /** Entry href with `{field}` placeholders filled from the row */
  hrefTemplate: Schema.String.pipe(
    Schema.annotate({
      description: 'Entry href with {field} placeholders filled from the row',
      examples: ['/tables/{name}', '/_admin/data/forms/{slug}'],
    }),
    Schema.check(
      Schema.isMinLength(1),
      Schema.isPattern(/\{[^{}]+\}/, {
        message:
          'hrefTemplate must carry at least one {field} placeholder — without one every fetched entry would link to the same path',
      })
    )
  ),
  /**
   * Attributes rendered on EACH fetched entry, with `{field}` placeholders
   * filled from the row exactly as `hrefTemplate`'s are.
   *
   * The placeholder grammar is `hrefTemplate`'s on purpose. A fetched row is
   * already addressed with `{name}` two fields above; giving the same row a
   * second spelling here would make the sidebar the one place in the config
   * where one value is written two ways.
   */
  itemProps: Schema.optional(
    ComponentPropsSchema.annotate({
      description:
        'Attributes rendered on each fetched entry; values may carry {field} placeholders filled from the row',
    })
  ),
  /**
   * The icon drawn before each fetched entry's label: a Lucide name or one
   * emoji, either written out or filled from the row with `hrefTemplate`'s
   * `{field}` grammar (`'{emoji}'`).
   *
   * A first-class key rather than an `itemProps` attribute, because an icon is
   * drawn content, not an HTML attribute. A value written out is judged when
   * the config is read; a value filled from a row is judged per row, and one
   * that names neither a Lucide icon nor a single emoji draws no icon for that
   * row rather than refusing the sidebar, since no check can see row data.
   */
  icon: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "Icon drawn before each fetched entry's label: a Lucide name (`folder`) or one emoji (`🎨`), written out or filled from the row with {field} placeholders (`{emoji}`). A row whose value is neither draws no icon; a value written out that is neither is refused when the config is read.",
        examples: ['{emoji}', '{icon}', 'folder', '🎨'],
      }),
      Schema.check(Schema.makeFilter(sidebarSourceIconCheck))
    )
  ),
  /**
   * The badge drawn after each fetched entry's label, filled from the row with
   * the `{field}` grammar — a field of the row, or the reader's own unread
   * count a `readState` relationship gives the row (`'{unreadCount}'`).
   *
   * A row whose value resolves to empty or to `0` draws no badge, so an entry
   * with nothing new stays quiet. An authored entry's count keeps its own
   * `badge: { endpoint, valuePath }` source; this key is the fetched rows'.
   */
  badge: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "Badge drawn after each fetched entry's label, filled from the row with {field} placeholders: a field of the row, or the reader's own unread count (`{unreadCount}`). A value that resolves to empty or 0 draws no badge.",
        examples: ['{unreadCount}', '{openTickets}', '{count} new'],
      }),
      Schema.check(
        Schema.isPattern(/\{[^{}]+\}/, {
          message:
            'a fetched source badge must carry at least one {field} placeholder — without one every fetched entry would show the same badge',
        })
      )
    )
  ),
  /**
   * How each fetched entry decides it is the current page — the authored
   * entry's `activeMatch`, applied to every row this source yields.
   *
   * A fetched entry is matched against the request path exactly like an
   * authored one: `exact` (the default) when the path equals its filled
   * `hrefTemplate`, `prefix` when the path is that href or lies below it. When
   * a fetched entry and an authored one both match, the LONGER href wins, so a
   * section entry such as `{ href: /projects, activeMatch: prefix }` gives the
   * mark up to the project page the reader is actually on.
   */
  activeMatch: Schema.optional(
    Schema.Literals(['exact', 'prefix']).annotate({
      description:
        "How each fetched entry matches the request path to mark itself current: 'exact' (default) or 'prefix'. When several entries match, the one with the longest href is current",
    })
  ),
} as const

/**
 * The copy for the three states a lazily-loaded child list passes through.
 *
 * A group's fetched entries render nothing until they arrive, which is right for
 * a list the reader never asked for. A disclosure is the opposite: the reader
 * has just clicked it open, so silence reads as a broken control. The labels are
 * therefore part of a DISCLOSURE's source and not of a group's.
 *
 * They default to the operator console's own wording, and each accepts a `$t:`
 * key so an app shipping in another language is not stuck with it.
 */
const sidebarDisclosureCopyFields = {
  /** Line shown while the children are being fetched (default: `Loading…`) */
  loadingLabel: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description: 'Line shown while the children load; accepts a $t: key (default: "Loading…")',
        examples: ['Loading…', '$t:nav.loading'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /** Line shown when the fetch failed (default: `Couldn't load the list.`) */
  errorLabel: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Line shown when the children could not be loaded; accepts a $t: key (default: "Couldn\'t load the list.")',
        examples: ["Couldn't load the list.", '$t:nav.error'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  loading: Schema.optional(SidebarSourceLoadingSchema),
  /** Line shown when the endpoint returned no rows (default: `No items.`) */
  emptyLabel: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Line shown when the endpoint returned no rows; accepts a $t: key (default: "No items.")',
        examples: ['No items.', '$t:nav.empty'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
} as const

/**
 * An ENTRY's fetched source: the shared source fields plus the copy for the
 * three states its disclosure passes through.
 */
export const SidebarItemSourceSchema = Schema.Struct({
  ...sidebarSourceFields,
  ...sidebarDisclosureCopyFields,
}).annotate({
  identifier: 'SidebarItemSource',
  title: 'Sidebar Item Source',
  description:
    "Rows source for an entry's disclosure, with the copy for its loading, error and empty states",
})

/** @public */
export type SidebarItemSource = Schema.Schema.Type<typeof SidebarItemSourceSchema>

/**
 * The children of EACH entry a group fetches: a second fetched level, filled
 * from the parent row.
 *
 * ─── WHY BOTH LEVELS COME FROM DATA ────────────────────────────────────────
 *
 * A group's `source` yields flat entries, and an authored entry's `source`
 * fetches the children of ONE entry someone wrote down. Neither declares the
 * navigation most client work needs — every client, each opening onto its own
 * projects — because the parents are not known when the config is written.
 * `childrenSource` is that second level: each fetched entry becomes a
 * disclosure whose list is fetched from this source on first expand.
 *
 * ─── THE PARENT ROW FILLS THE QUERY ────────────────────────────────────────
 *
 * The values of `query` take the `{field}` grammar `hrefTemplate` already
 * speaks, filled from the PARENT row, so `filter: company:{name}` lists only
 * the projects of the client being opened. `hrefTemplate`, `labelKey` and
 * `itemProps` read the CHILD row, as they do everywhere else.
 *
 * ─── AND IT STOPS THERE ────────────────────────────────────────────────────
 *
 * The children take no `childrenSource` of their own. A sidebar is a section,
 * a page and that page's parts; a fetched third level is a tree browser
 * wearing the app's chrome, and the `tree` component is the right home for it.
 *
 * @example
 * ```yaml
 * source:
 *   endpoint: /api/tables/companies/records
 *   rowsKey: records
 *   labelKey: name
 *   hrefTemplate: /clients/{name}
 *   childrenSource:
 *     endpoint: /api/tables/projects/records
 *     rowsKey: records
 *     query: { filter: 'company:{name}' }
 *     labelKey: name
 *     hrefTemplate: /projects/{name}
 * ```
 */
export const SidebarChildrenSourceSchema = Schema.Struct({
  ...sidebarSourceFields,
  ...sidebarDisclosureCopyFields,
  /** Query params merged into each request, filled from the parent row */
  query: Schema.optional(
    Schema.Record(
      Schema.String,
      Schema.Union([Schema.String, Schema.Finite, Schema.Boolean])
    ).annotate({
      description:
        "Query params merged into each request; string values may carry {field} placeholders filled from the parent entry's row",
    })
  ),
}).annotate({
  identifier: 'SidebarChildrenSource',
  title: 'Sidebar Children Source',
  description:
    "Rows source for the children of each fetched entry, its query filled from the parent entry's row; the entry becomes a disclosure loaded on first expand",
})

/** @public */
export type SidebarChildrenSource = Schema.Schema.Type<typeof SidebarChildrenSourceSchema>

/**
 * A group's FETCHED source: the shared source fields, plus an optional second
 * fetched level under each entry.
 *
 * @example
 * ```yaml
 * source:
 *   endpoint: /api/admin/tables
 *   rowsKey: items
 *   labelKey: name
 *   hrefTemplate: /tables/{name}
 *   itemProps:
 *     data-testid: data-nav-tables-{name}
 * ```
 */
export const SidebarGroupSourceSchema = Schema.Struct({
  ...sidebarSourceFields,
  childrenSource: Schema.optional(SidebarChildrenSourceSchema),
}).annotate({
  identifier: 'SidebarGroupSource',
  title: 'Sidebar Group Source',
  description:
    'Rows-envelope system source for a sidebar group, projected to entries via labelKey + hrefTemplate',
})

/** @public */
export type SidebarGroupSource = Schema.Schema.Type<typeof SidebarGroupSourceSchema>
