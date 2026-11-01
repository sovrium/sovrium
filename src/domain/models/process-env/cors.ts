/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { parseOriginList, type OriginList } from './origin-list'

/**
 * Cross-origin browser access to the data API.
 *
 * Env var: SOVRIUM_CORS_ORIGINS
 *
 * Names the other sites whose browser code may call the instance with the
 * visitor's session: a front-end hosted on another origin (a static site, a
 * framework app on its own domain) that reads and writes records through
 * `/api/tables/*`, files through `/api/buckets/*`, and signs people in through
 * `/api/auth/*`. Each listed origin is answered with its own origin in
 * `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true`
 * (never `*`), its preflights are granted, and it joins the origins the
 * sign-in routes accept a cookie-bearing request from. An origin that is not
 * listed is answered exactly as today: no CORS header, no refusal.
 *
 * Unset (the default) changes nothing: the data API sends no CORS header at
 * all, and `/api/auth/*` keeps its own rule (the `BASE_URL` origin, plus
 * loopback origins on a loopback bind).
 *
 * ## Why env and NOT AppSchema
 *
 * Which sites may call an instance is a fact about where it is HOSTED and who
 * hosts the front-end: the same config runs behind `https://app.example.com`
 * in production and behind `http://localhost:5173` on a laptop. A config key
 * would ship one deployment's trust to every other.
 *
 * ## Grammar
 *
 * The entries are separated by commas, spaces or both. Each is an origin in
 * the grammar every Sovrium origin variable shares (`origin-list.ts`):
 * `https://host[:port]`, or `http://localhost` / `http://127.0.0.1` with an
 * optional port. Case is ignored, one trailing `/` is dropped and a default
 * port (`:443` on https, `:80` on http) is removed, so a value pasted from the
 * address bar matches the `Origin` header a browser sends. A wildcard, `*`, a
 * path, `http://` to another host, or a value naming nothing refuses the start
 * with one line naming the variable and the entry.
 */
export const CorsEnvSchema = Schema.Struct({
  origins: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Origins whose browser code may call the data API (/api/tables, /api/buckets) and the sign-in routes (/api/auth) with the visitor session (SOVRIUM_CORS_ORIGINS). Separated by commas or spaces; each is https://host or https://host:port, or http://localhost or http://127.0.0.1 with an optional port; no path, no wildcard. Unset, no other site may call the data API from a browser.',
        examples: ['https://app.example.com', 'https://app.example.com, http://localhost:5173'],
      })
    )
  ),
})

export type CorsEnvConfig = Schema.Schema.Type<typeof CorsEnvSchema>

/** The variable's name, as every refusal sentence and the manual spell it. */
export const CORS_ORIGINS_VARIABLE = 'SOVRIUM_CORS_ORIGINS'

/** Read the variable from an env snapshot . */
export const parseCorsEnvConfig = (
  processEnv: Readonly<Record<string, string | undefined>>
): CorsEnvConfig => Schema.decodeSync(CorsEnvSchema)({ origins: processEnv[CORS_ORIGINS_VARIABLE] })

/**
 * One entry in the form a browser writes it in the `Origin` header: lower
 * case, no trailing slash, no default port.
 */
const normaliseCorsEntry = (entry: string): string =>
  entry
    .toLowerCase()
    .replace(/\/$/, '')
    .replace(/^(https:\/\/[^/]+):443$/, '$1')
    .replace(/^(http:\/\/[^/]+):80$/, '$1')

/**
 * The origins `SOVRIUM_CORS_ORIGINS` names, normalised and without duplicates,
 * or the sentence that refuses the start. `undefined` (unset) is no list and
 * no refusal; a blank value refuses, so a variable set by mistake never
 * silently means "nobody".
 */
export const parseCorsOrigins = (value: string | undefined): OriginList => {
  const parsed = parseOriginList(CORS_ORIGINS_VARIABLE, value, /[\s,]+/, normaliseCorsEntry)
  return parsed._tag === 'Origins'
    ? { _tag: 'Origins', origins: [...new Set(parsed.origins)] }
    : parsed
}
