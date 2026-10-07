/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { BreadcrumbItemSchema } from '../../shared-schemas'
import { coreFields } from '../modules/core'
import { i18nFields } from '../modules/i18n'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const BreadcrumbTypeLiteral = Schema.Literal('breadcrumb')

export const breadcrumbFields = {
  ...coreFields,
  ...responsiveFields,
  ...visibilityFields,
  ...i18nFields,
  breadcrumbItems: Schema.optional(
    Schema.Array(BreadcrumbItemSchema).pipe(
      Schema.annotate({
        description: 'Ordered breadcrumb segments from root to current page',
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Derive the trail from the request path instead of enumerating it.
   *
   * `derive: path` builds one crumb per path segment, linking each to its own
   * prefix and leaving the last as the current page. That is what stops a
   * breadcrumb being copy-pasted per page: a page reached at
   * `/data/tables/customers` renders Data › Tables › Customers without the
   * author restating a hierarchy `path` already expresses, and a dynamic
   * `:param` route gets a correct trail per URL rather than one frozen at
   * config time.
   *
   * Mutually exclusive with `breadcrumbItems` (decode error) — declaring both
   * leaves no defensible precedence between an authored trail and a derived one.
   */
  derive: Schema.optional(
    Schema.Literal('path').annotate({
      description: 'Derive the trail from the request path (one crumb per segment)',
    })
  ),
  /**
   * Per-segment relabelling for a derived trail: `{ <segment>: <label> }`.
   *
   * A URL segment is a slug, not a label — `data-tables` reads badly in page
   * chrome. A value may be a `$t:` key, so a derived trail stays translatable.
   * Any segment with no entry falls back to the segment itself.
   *
   * Inert without `derive`, so declaring it on an enumerated trail is a decode
   * error rather than a silently ignored key.
   */
  labels: Schema.optional(
    Schema.Record(Schema.String, Schema.String).annotate({
      description:
        'Segment to label map for a derived trail; values accept $t: keys. Requires derive.',
    })
  ),
  /**
   * Segments of a derived trail rendered as plain text rather than a link.
   *
   * A derived crumb links to its own path prefix, and not every prefix has a
   * page: `/automations/runs/:id` has no page at `/automations/runs`, so its
   * middle crumb would link to a 404. Naming the segment here keeps it in the
   * trail, where it still tells the reader where they are, without the link.
   * `labels` still applies to it.
   *
   * Requires `derive`, like `labels`: an enumerated trail omits `href` on an
   * item instead.
   */
  unlinked: Schema.optional(
    Schema.Array(Schema.String)
      .annotate({
        description:
          'Segments of a derived trail rendered as plain text instead of a link, for a path prefix with no page of its own. Requires derive.',
      })
      .pipe(Schema.check(Schema.isMinLength(1)))
  ),
  /**
   * Prepend a crumb linking to the app root, ahead of the derived segments.
   *
   * A derived trail starts at the first path segment, so a page at
   * `/tables/customers` renders `Tables › customers` with no way back to the
   * root — the one destination every trail should offer. Enumerating a home
   * crumb per page is the copy-paste `derive` exists to end, so it is declared
   * once, here.
   *
   * `label` accepts a `$t:` key and `$app.name`, which is what lets one preset
   * page print the OPERATOR's own app name in the crumb rather than a constant
   * baked at config time.
   *
   * The href is always the app root and is never authored: a mounted app's root
   * is its MOUNT (`/_admin`, `/ops`), which the config cannot know and the
   * renderer resolves per request. An authored `/` would link every mounted
   * console out of the mount the operator was browsing.
   *
   * Requires `derive` — on an enumerated trail the author writes the first item
   * instead, so declaring both is a decode error rather than a silently
   * duplicated crumb.
   */
  home: Schema.optional(
    Schema.Struct({
      /** Crumb label; accepts a `$t:` key and `$app.name` */
      label: Schema.String.pipe(
        Schema.annotate({
          description: 'Root-crumb label; accepts a $t: translation key and $app.name',
          examples: ['Home', '$app.name', '$t:nav.home'],
        }),
        Schema.check(Schema.isMinLength(1))
      ),
    }).annotate({
      identifier: 'BreadcrumbHome',
      title: 'Breadcrumb Home Crumb',
      description: 'Root crumb prepended to a derived trail, linking to the app (or mount) root',
    })
  ),
  separator: Schema.optional(
    Schema.String.annotate({
      description: 'Separator character between breadcrumb items (default: "/")',
    })
  ),
  /**
   * The label of the LAST crumb of a derived trail — the page the reader is on.
   *
   * A record page's last segment is an id (`/orders/42`), and `labels` maps
   * segments, which an id is not. This names the current crumb directly, so a
   * record page reads `Orders / Order 42 — Acme` with `currentLabel:
   * $record.title`. Requires `derive`, like `labels` and `home`.
   */
  currentLabel: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Label of the last crumb of a derived trail — the current page. Accepts $record.<field> (a record page names its record) and $t: keys. Requires derive.',
        examples: ['$record.title', '$t:nav.current'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
} as const
