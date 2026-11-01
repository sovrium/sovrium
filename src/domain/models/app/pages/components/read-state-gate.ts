/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * A button that reacts to what a data component on its page last READ.
 *
 * ─── THE GAP IT CLOSES ─────────────────────────────────────────────────────
 *
 * Every `visibility` gate is decided on the server before a byte is sent, and
 * a button's `disabledWhen` is matched against the RECORD it is drawn on. None
 * of them can hear what a grid on the same page answered once it read: that its
 * read failed, or that it holds rows. So a toolbar kept offering New record
 * over a grid that could not be read, and a page kept offering a second
 * erasure request beside the pending one it was listing.
 *
 * ─── WHAT IT NAMES ─────────────────────────────────────────────────────────
 *
 * Exactly one source, by one of two keys, because they are two namespaces:
 *
 * - `component` — the `props.id` of one data component on the page, the same
 *   id `onSuccess.refetch` names. Only a `table` and a `kanban` announce a read
 *   state, so only they can be named.
 * - `channel` — a shared-filter channel: every `table` or `kanban` whose
 *   `dataSource.bindTo` names it counts. This is what a toolbar knows, since it
 *   publishes on the channel without knowing the grid's id.
 *
 * ─── THE FOUR STATES ───────────────────────────────────────────────────────
 *
 * | State      | Holds while                                                    |
 * | ---------- | -------------------------------------------------------------- |
 * | `loading`  | no read has settled yet since the page was drawn               |
 * | `failed`   | the latest settled read was refused (any non-2xx) or unanswered |
 * | `empty`    | the latest settled read succeeded with no row                   |
 * | `nonEmpty` | the latest settled read succeeded with at least one row         |
 *
 * A re-read in flight (a Retry, a search, a `refetch`) keeps the previous
 * settled state until it settles, so the button does not flicker on every
 * keystroke. Rows are counted under whatever narrowing the read carried.
 * Over a channel the subscribers combine: `failed` if any failed, else
 * `loading` if any has not settled, else `nonEmpty` if any holds a row, else
 * `empty`.
 *
 * ─── WHY TWO BUTTON KEYS AND NOT `disabledWhen: { read }` ──────────────────
 *
 * `disabledWhen` already means a record condition, valid only under a record
 * binding and checked again by the server. Admitting a second shape at its
 * value position would re-key a node the docs walker addresses, and would make
 * one key mean "judged on the server against a record" and "judged in the
 * browser against a read" depending on which keys it holds. The read gate is
 * a different question, so it takes its own keys, `hiddenWhenRead` and
 * `disabledWhenRead`, which share this one gate node.
 *
 * ─── NOT A PERMISSION ──────────────────────────────────────────────────────
 *
 * It is decided in the browser, after the read: a button it hides is still in
 * the page. Who may press a button is `visibility`'s question, decided on the
 * server, and a button the reader must never see belongs there.
 *
 * @example
 * ```yaml
 * hiddenWhenRead: { component: pending-erasures, state: [loading, nonEmpty] }
 * disabledWhenRead: { channel: quotes, state: failed }
 * ```
 */
export const READ_STATES = ['loading', 'failed', 'empty', 'nonEmpty'] as const

/** One state a data component's latest read can be in. */
export const ReadStateSchema = Schema.Literals([...READ_STATES]).annotate({
  title: 'Read State',
  description:
    'A state of a data component’s latest read: `loading` until its first read settles, `failed` when the latest read was refused or went unanswered, `empty` when it succeeded with no row, `nonEmpty` when it succeeded with at least one row. A re-read in flight keeps the previous state until it settles.',
})

/** @public */
export type ReadState = Schema.Schema.Type<typeof ReadStateSchema>

/** One state, or a list of states any of which holds the gate. */
const ReadStateListSchema = Schema.Union([
  ReadStateSchema,
  Schema.Array(ReadStateSchema).pipe(
    Schema.annotate({
      title: 'Read States',
      description: 'Several read states; the gate holds while the read is in any of them.',
      examples: [['loading', 'nonEmpty']],
    }),
    Schema.check(Schema.isMinLength(1))
  ),
]).annotate({
  description:
    'The read state, or the list of read states, during which the gate holds. Outside them the button is drawn and usable as if the gate were absent.',
  examples: ['failed', ['loading', 'nonEmpty']],
})

/** A non-empty name, annotated before its check so the description survives. */
const sourceName = (description: string, examples: readonly string[]) =>
  Schema.String.pipe(
    Schema.annotate({ description, examples: [...examples] }),
    Schema.check(Schema.isMinLength(1))
  )

/** The gate over ONE data component, named by its `props.id`. */
export const ComponentReadStateGateSchema = Schema.Struct({
  component: sourceName(
    'The `props.id` of a `table` or `kanban` on the same page whose latest read the gate follows: the id `onSuccess.refetch` would name. A name matching no table or kanban on the page is refused at startup.',
    ['pending-erasures', 'tasks-grid']
  ),
  state: ReadStateListSchema,
}).annotate({
  title: 'Component Read-State Gate',
  description: 'Follows the latest read of one `table` or `kanban`, named by its `props.id`.',
})

/** The gate over every data component subscribed to a shared-filter channel. */
export const ChannelReadStateGateSchema = Schema.Struct({
  channel: sourceName(
    'A shared-filter channel: every `table` or `kanban` on the same page whose `dataSource.bindTo` names it counts. A channel no table or kanban on the page subscribes to is refused at startup.',
    ['quotes', 'invoices']
  ),
  state: ReadStateListSchema,
}).annotate({
  title: 'Channel Read-State Gate',
  description:
    'Follows the latest reads of every `table` or `kanban` subscribed to one shared-filter channel: `failed` if any failed, else `loading` if any has not settled, else `nonEmpty` if any holds a row, else `empty`.',
})

/**
 * A read-state gate: exactly one of `component` or `channel`, and the states
 * during which it holds. Boot decodes with `onExcessProperty: 'error'`, so a
 * gate carrying both names matches neither member and is refused.
 */
export const ReadStateGateSchema = Schema.Union([
  ComponentReadStateGateSchema,
  ChannelReadStateGateSchema,
]).annotate({
  title: 'Read-State Gate',
  description:
    'Names one source, either one `table` or `kanban` on the page by `component` or every one subscribed to a shared-filter channel by `channel`, and the read states during which the gate holds. Decided in the browser after each read, so it is not a permission: use `visibility` for who may see the button.',
})

/** @public */
export type ReadStateGate = Schema.Schema.Type<typeof ReadStateGateSchema>
