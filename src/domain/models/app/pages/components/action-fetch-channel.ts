/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SharedFilterBindingSchema } from './data-source'

/**
 * The two keys that let a fetch action read a filter channel, spread into
 * `FetchActionSchema`. Split from `action-fetch.ts` to keep that file under
 * the per-file ceiling.
 *
 * `bindTo` and `sharedFilter` mean exactly what they mean on a subscriber
 * (`dataSource.bindTo`, `dataSource.system.bindTo`): when the button is
 * pressed, the channel's current params are merged into the action's `url`
 * query as a subscriber merges them into its own request. A channel param
 * replaces the url's param of the same name; a control the reader cleared
 * contributes nothing, so the url's own param stands.
 *
 * Only `mode: download` and `mode: navigate` take them: those are the two
 * modes whose request is a GET to an address. On `mode: fetch` or
 * `mode: oauth` the app refuses to start, naming the button. That refusal
 * lives with the page checks, which know the button's label; the schema
 * accepts the key on every mode so that check can name it.
 *
 * @example
 * ```yaml
 * - type: button
 *   content: Export CSV
 *   action:
 *     type: fetch
 *     mode: download
 *     url: /api/admin/audit-log?format=csv&reads=false
 *     bindTo: audit-log-filter      # the channel the toolbar publishes on
 * ```
 */
export const fetchChannelFields = {
  /**
   * The channel whose current params are merged into the `url` query when
   * the button is pressed.
   */
  bindTo: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "Channel whose current params are added to the url's query when the button is pressed, as a data source bound to the same channel adds them to its own read. A channel param replaces the url's param of the same name; a control the reader cleared adds nothing, so the url's own param stands. Only for `mode: download` and `mode: navigate`: on any other mode the app refuses to start. A channel nothing on the page publishes on is a load warning.",
        examples: ['audit-log-filter', 'invoice-filter'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),
  /**
   * Which of the channel's params the action carries (companion to
   * `bindTo`). Inert without `bindTo`.
   */
  sharedFilter: Schema.optional(
    SharedFilterBindingSchema.annotate({
      description:
        "Companion to bindTo: `params` names the channel's params the request carries; omitted, the action carries every param the channel publishes. Inert without bindTo.",
    })
  ),
} as const
