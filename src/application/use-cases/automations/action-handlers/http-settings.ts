/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema, Struct } from 'effect'
import {
  HttpDeleteActionSchema,
  HttpGetActionSchema,
  HttpPatchActionSchema,
  HttpPostActionSchema,
  HttpPutActionSchema,
  HttpRequestActionSchema,
} from '@/domain/models/app/automations/actions/http'
import type { DecodedAction } from './decoded-handler'

/**
 * The settings an `http/*` handler is dispatched with: each operator's
 * declared props, with the filled-in shape of the ones a template fills.
 *
 * Kept as declared, and so refused when outside it, whatever road the action
 * came by: `url` (text), `timeout` (a whole number of ms in 1000-120000),
 * `connection` (a connection name), `contentType` (one of four shorthands), and
 * the absence of a `body` on a GET. A code step's
 * `context.actions.http.get({ url, timeout: 200 })` is refused before anything
 * is sent, as the same step written in the config is refused when it loads.
 *
 * Accepted as filled in, because a template there may name a value of another
 * type and the request has always been sent with it:
 *
 * - `headers` — a whole `{{path}}` keeps the type of what it names (a record id
 *   is a number); each value is sent as its text.
 * - `query` — a value that is not a scalar, or a list of scalars, is left out
 *   of the address (`appendQueryObject`), as it always was.
 * - `body` — a list or a number is sent as JSON, as it always was.
 * - `method` (`http/request`) — a template may name any method; the declared
 *   check that it is a literal or a template applies to the config as written.
 */
const filledHeadersAndQuery = {
  headers: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  query: Schema.optional(Schema.Unknown),
}

const filledBody = { body: Schema.optional(Schema.Unknown) }

/** `http/get` — no body. */
export const HttpGetSettings = Schema.Struct({
  type: HttpGetActionSchema.fields.type,
  operator: HttpGetActionSchema.fields.operator,
  props: HttpGetActionSchema.fields.props.mapFields(Struct.assign(filledHeadersAndQuery)),
})

/** `http/delete` — an optional body, no `contentType`. */
export const HttpDeleteSettings = Schema.Struct({
  type: HttpDeleteActionSchema.fields.type,
  operator: HttpDeleteActionSchema.fields.operator,
  props: HttpDeleteActionSchema.fields.props.mapFields(
    Struct.assign({ ...filledHeadersAndQuery, ...filledBody })
  ),
})

/** `http/post`. */
export const HttpPostSettings = Schema.Struct({
  type: HttpPostActionSchema.fields.type,
  operator: HttpPostActionSchema.fields.operator,
  props: HttpPostActionSchema.fields.props.mapFields(
    Struct.assign({ ...filledHeadersAndQuery, ...filledBody })
  ),
})

/** `http/put`. */
export const HttpPutSettings = Schema.Struct({
  type: HttpPutActionSchema.fields.type,
  operator: HttpPutActionSchema.fields.operator,
  props: HttpPutActionSchema.fields.props.mapFields(
    Struct.assign({ ...filledHeadersAndQuery, ...filledBody })
  ),
})

/** `http/patch`. */
export const HttpPatchSettings = Schema.Struct({
  type: HttpPatchActionSchema.fields.type,
  operator: HttpPatchActionSchema.fields.operator,
  props: HttpPatchActionSchema.fields.props.mapFields(
    Struct.assign({ ...filledHeadersAndQuery, ...filledBody })
  ),
})

/** `http/request` — any method, which a template may name. */
export const HttpRequestSettings = Schema.Struct({
  type: HttpRequestActionSchema.fields.type,
  operator: HttpRequestActionSchema.fields.operator,
  props: HttpRequestActionSchema.fields.props.mapFields(
    Struct.assign({ ...filledHeadersAndQuery, ...filledBody, method: Schema.String })
  ),
})

/** The settings every `http/*` operator shares, as its handler reads them. */
export type HttpCommonProps = Omit<DecodedAction<typeof HttpGetSettings>['props'], 'body'>

/** A body-bearing operator's settings (`post`, `put`, `patch`). */
export type HttpBodyVerbAction =
  | DecodedAction<typeof HttpPostSettings>
  | DecodedAction<typeof HttpPutSettings>
  | DecodedAction<typeof HttpPatchSettings>
