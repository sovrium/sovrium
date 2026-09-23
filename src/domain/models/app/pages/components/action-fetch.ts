/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Fetch Toast Response Schema
 *
 * Shape used by `FetchActionSchema.onSuccess` / `.onError` to describe a
 * toast notification rendered after a `fetch` action completes. Distinct from
 * the standalone `ToastActionSchema` because the fetch-response variant
 * supports an action button (`actionLabel` + `actionUrl`) and a broader
 * variant set (`default`/`destructive` in addition to the standard
 * `success`/`error`/`warning`/`info`) used by component-library toast UIs.
 */
export const FetchToastResponseSchema = Schema.Struct({
  type: Schema.Literal('toast').annotate({
    description:
      'What the component does once the action returns — navigate away, reset the form, show a message or a success page, send the reader to their role landing, or raise a toast.',
  }),
  /** Message to display. Supports $variable references. */
  message: Schema.String.annotate({
    description: 'Toast notification message. Supports $variable references.',
  }),
  /** Visual variant */
  variant: Schema.optional(
    Schema.Literals(['default', 'success', 'destructive', 'error', 'warning', 'info']).annotate({
      description: 'Visual style of the toast notification',
    })
  ),
  /** Auto-dismiss duration in milliseconds */
  duration: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        description: 'Auto-dismiss duration in milliseconds (default: 5000)',
        examples: [2000, 5000, 10_000],
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
  /** Label of an optional action button rendered inside the toast */
  actionLabel: Schema.optional(
    Schema.String.annotate({
      description: 'Label of an optional action button rendered inside the toast',
      examples: ['Undo', 'Retry'],
    })
  ),
  /** URL invoked (POST) when the toast action button is clicked */
  actionUrl: Schema.optional(
    Schema.String.annotate({
      description:
        'URL invoked (POST) when the toast action button is clicked. Required with actionLabel.',
    })
  ),
}).annotate({
  title: 'Fetch Toast Response',
  description: 'Toast notification rendered after a fetch action completes',
})

/**
 * Inline status region populated on a fetch action's success.
 *
 * Distinct from the TRANSIENT `toast`: a status writes a PERSISTENT inline message
 * into a sibling element (announced as a `role="status"` ARIA live region) that
 * stays on screen — the "Export généré" badge that confirms an export completed,
 * rather than a toast that auto-dismisses.
 *
 * `target` names a sibling component's `props.id`; on success the client fills that
 * element with `message` and promotes it to a `role="status"` live region.
 *
 * ─── `$response.<field>`: THE ONE PLACE CONFIG CAN READ WHAT CAME BACK ─────
 *
 * `message` interpolates `$response.<field>` against the JSON body the action's
 * own request returned, addressed by DOT PATH (`$response.token`,
 * `$response.record.id`). It is the only token family here that reads the
 * RESPONSE rather than the request: `redirectKey` navigates to a body field and
 * renders nothing, and every other slot was write-only, so a server value an
 * operator asked for could be produced and never shown. The minting case is the
 * shape of it — a token emitted exactly once, in the one response the operator
 * asked for by clicking, with nowhere to put it.
 *
 * Three properties the author should be able to rely on:
 *  - a path that resolves to nothing substitutes to the EMPTY STRING, never the
 *    literal token — the same rule a form's `$record.<column>` already follows;
 *  - the value is written as TEXT, never as markup, so a body field carrying
 *    `<b>x</b>` shows those characters (the region is filled with a text node);
 *  - a `mode: download` action runs the same success effects with no body at
 *    all, so every `$response.` reference there resolves empty by construction.
 */
const FetchSuccessStatusSchema = Schema.Struct({
  /** `props.id` of the sibling element the status message is written into. */
  target: Schema.String.annotate({
    description:
      'props.id of the sibling element the status message is written into (promoted to role=status).',
    examples: ['export-status', 'save-indicator'],
  }),
  /**
   * The status message. Supports `$variable` / `$session.<field>` references, and
   * `$response.<field>` — a dot path into the JSON body this action's request
   * returned, substituted as text, resolving to the empty string when absent.
   */
  message: Schema.String.annotate({
    description:
      'Persistent status message written into the target region. Supports $variable references, and $response.<field> — a dot path into the JSON body the action returned (rendered as text; an absent path resolves to the empty string).',
    examples: ['Export généré', 'Saved', 'Your link: $response.token'],
  }),
}).annotate({
  title: 'Fetch Success Status',
  description:
    'A persistent inline role="status" region populated on success (the persistent counterpart to a transient toast).',
})

/**
 * Sibling data-bound component(s) to re-query after a fetch action succeeds — by
 * `props.id`. The named component(s) re-issue their read (a DB-table `dataSource`
 * OR a `dataSource.system` read endpoint), so a freshly-mutated list reflects the
 * change without a full reload (e.g. a pending-erasure table re-fetching after the
 * erase POST). Accepts a single id or an array.
 */
const FetchSuccessRefetchSchema = Schema.Union([
  Schema.String,
  Schema.Array(Schema.String).pipe(Schema.check(Schema.isMinLength(1))),
]).annotate({
  title: 'Fetch Success Refetch',
  description:
    'props.id (or array of ids) of sibling data-bound component(s) to re-query on success. Works for both a DB-table dataSource and a dataSource.system read endpoint.',
})

/**
 * Full-page reload on success — the effect a same-page refresh cannot express.
 *
 * ─── WHY `refetch` IS NOT ENOUGH ───────────────────────────────────────────
 *
 * `refetch` re-queries ONE named region, and a region holding a mounted island
 * is skipped by `refreshServerRenderedRegions` on purpose. So a setting the
 * SERVER read at render time — the page's own language, the operator's display
 * name in the chrome, anything resolved before a single byte was composed —
 * cannot be refreshed by the page that changes it: the write succeeds, the
 * toast says so, and the page keeps showing the value it was composed with.
 * The console's language row is the shape of it, and the honest workaround it
 * shipped with was a status line reading "switches on the next page".
 *
 * `reload` closes that: on a 2xx the browser reloads the document and the
 * server recomposes it, so every server-read value is re-read at once. It is
 * the blunt effect, and deliberately so — the narrow one already exists.
 *
 * ─── WHAT IT COSTS, STATED RATHER THAN HIDDEN ──────────────────────────────
 *
 * A reload destroys the document the success effects would have written into,
 * so `reload` cannot be combined with a same-page effect:
 *
 *  - `status` and `refetch` are REFUSED AT DECODE beside it (see the check on
 *    {@link FetchSuccessResponseSchema}). Both are same-page effects the reload
 *    subsumes, and silently dropping one of two declared effects is how an
 *    author's key becomes inert with nothing reporting it.
 *  - The TOAST is not refused and is NOT SHOWN. `type` and `message` are
 *    REQUIRED members of the shared success shape — inherited by the `fetch`
 *    action, the endpoint form and `file-upload` alike — so making them
 *    conditional would re-key the published property universe of all three for
 *    one key's sake. The rule is stated here instead: a `reload: true` response
 *    performs the reload, and its `message` stays as the config's own record of
 *    what succeeded rather than as text anyone reads. An author who needs the
 *    confirmation to survive wants `status` on a page that does not reload.
 *
 * Under `mode: navigate` / `mode: oauth` the whole `onSuccess` slot is already
 * inert (the document is replaced before any effect runs) and a toast there is
 * legal today — so `reload` is NOT additionally refused against `mode`;
 * singling out one member of a wholly-inert slot would be an inconsistency
 * rather than a guard.
 */
const FetchSuccessReloadSchema = Schema.Boolean.annotate({
  title: 'Fetch Success Reload',
  description:
    'When true, the browser reloads the page after a successful request so the SERVER recomposes it — the effect refetch cannot express, because refetch re-queries one region and skips any region holding a mounted island. Use it when the request changes something the server read at render time (the active language, the chrome). Refused at decode alongside status or refetch (both are same-page effects the reload subsumes); the required toast message is NOT displayed, because the reload replaces the document that would have shown it.',
  examples: [true],
})

/**
 * Success response for a `fetch` action — the toast slot PLUS the additive
 * client-state effects (`status`, `refetch`, `reload`).
 *
 * Re-uses every `FetchToastResponseSchema` field (so existing toast-only `onSuccess`
 * configs validate unchanged), then layers three effects on top:
 *  - `status`: write a PERSISTENT inline `role="status"` region (distinct from the
 *    transient toast) — the "Export généré" badge;
 *  - `refetch`: re-query sibling data-bound component(s) by `props.id` — so a
 *    sibling `dataSource.system` (or DB-table) list reflects a just-made mutation.
 *  - `reload`: recompose the WHOLE page server-side — see
 *    {@link FetchSuccessReloadSchema} for why the narrow effect above does not
 *    cover a server-read value, and for what the reload costs.
 *
 * `type` + `message` stay required (the toast slot is unchanged); `status` / `refetch`
 * ride ALONGSIDE the toast (a brief success toast can coexist with the persistent
 * status badge and the list refresh).
 *
 * ─── THE ONE COMBINATION THAT IS REFUSED ───────────────────────────────────
 *
 * `reload` XOR (`status` | `refetch`). Both of those write into, or re-read part
 * of, the document the reload is about to replace, so declaring either beside it
 * is two answers to one question with no defensible precedence — the same shape
 * as the `options` / `optionsSource` refusal one file over, and the same shape as
 * `link.to` / `link.targets`.
 *
 * The check is piped AFTER the annotation and never before it: a trailing
 * `.annotate(...)` on a checked node lands on the CHECK rather than on the node,
 * and the struct's `title` / `description` then vanish from `app.json` and from
 * the design-system console's Configuration table with nothing reporting it.
 * Measured on `effect@4.0.0-rc.108`, 2026-09-19.
 */
export const FetchSuccessResponseSchema = Schema.Struct({
  ...FetchToastResponseSchema.fields,
  /** Persistent inline `role="status"` region populated on success. */
  status: Schema.optional(FetchSuccessStatusSchema),
  /** Sibling data-bound component id(s) to re-query on success. */
  refetch: Schema.optional(FetchSuccessRefetchSchema),
  /** Reload the whole page on success so the server recomposes it. */
  reload: Schema.optional(FetchSuccessReloadSchema),
}).pipe(
  Schema.annotate({
    title: 'Fetch Success Response',
    description:
      'Success handler for a fetch action: the toast slot plus optional client-state effects — a persistent inline status region (status), a sibling data-bound refetch (refetch), and a full-page reload (reload) that recomposes the page server-side. reload is mutually exclusive with status and refetch.',
  }),
  Schema.check(
    Schema.makeFilter((response) => {
      if (response.reload !== true) return true
      if (response.status !== undefined) {
        return "onSuccess declares both 'reload' and 'status' — the reload replaces the document the status region lives in, so the message would be destroyed before anyone read it. Keep one: 'reload' to recompose the page server-side, or 'status' to write a persistent inline message into the page that stays."
      }
      if (response.refetch !== undefined) {
        return "onSuccess declares both 'reload' and 'refetch' — a reload re-reads the whole page, so the narrower per-region re-query is subsumed and its read would run twice. Keep one: 'reload' when a server-read value changed, or 'refetch' when only one named region needs re-querying."
      }
      return true
    })
  )
)

/**
 * Fetch dispatch mode — how the client carries out a fetch action.
 *
 * Controls whether the action is a `fetch()` (the default fire-and-display
 * interaction), a browser navigation, a native file download, or an OAuth
 * authorize round-trip. The non-`fetch` modes are what let a single config
 * `action` express the admin dashboard's bespoke operate gestures (CSV export,
 * file download, connection authorize) — the "Consoles-as-Config" CAP-3b
 * action-mode extensions.
 *
 * - `fetch` (default): client `fetch()` to `url`, then dispatch the
 *   `onSuccess` / `onError` toast based on the response.
 * - `navigate`: navigate the browser to `url` instead of fetching — for server
 *   responses that drive the browser directly (a CSV export at `?format=csv`
 *   returned with `Content-Disposition: attachment`, or a server-issued
 *   redirect). No client toast.
 * - `download`: save `url` as a native file. The client issues a credentialed
 *   `fetch` of `url` (so the page-level GET is observable and reaches
 *   session-bound endpoints — a bare `<a download>` would route through the
 *   browser's download manager and bypass the page network), then saves the
 *   response blob through a transient `download`-attributed anchor (optionally
 *   named by `filename`) — for binary objects such as a bucket file or the GDPR
 *   archive. No client toast.
 * - `oauth`: initiate an OAuth authorize → provider → callback round-trip:
 *   request `url` (an authorize endpoint returning the provider consent URL as
 *   DATA at `redirectKey`, default `url`), navigate the browser to that URL, and
 *   let the provider return to `callbackPath`. For a connection `authorize`.
 */
export const FetchActionModeSchema = Schema.Literals([
  'fetch',
  'navigate',
  'download',
  'oauth',
]).annotate({
  title: 'Fetch Action Mode',
  description:
    'Dispatch mode: fetch (default, client fetch + toast), navigate (browser navigation, e.g. ?format=csv export), download (native file download), oauth (authorize → provider → callback round-trip)',
})

/**
 * Response-envelope interpretation — how the success/error decision reads the
 * response body. Lets a fetch action target a NON-Sovrium endpoint whose body
 * is not the Sovrium `{ items }` / Zod shape (the CAP-3b envelope tolerance).
 *
 * - `sovrium` (default): success keyed on a 2xx status; messages read from the
 *   Sovrium error shape.
 * - `better-auth`: the target is a Better-Auth admin endpoint (`/api/auth/admin/*`)
 *   whose envelope is always-200 and enumeration-safe — success/error is decided
 *   from the body's `error` field, not purely from the HTTP status.
 * - `raw`: make no body-shape assumptions; success = any 2xx, error = any
 *   non-2xx, with no message extraction.
 */
export const FetchResponseEnvelopeSchema = Schema.Literals([
  'sovrium',
  'better-auth',
  'raw',
]).annotate({
  defaultNote: 'sovrium',
  title: 'Fetch Response Envelope',
  description:
    'Response-envelope interpretation: sovrium (default), better-auth (always-200 enumeration-safe envelope at /api/auth/admin/*), raw (status-only, no body assumptions)',
})

/**
 * Fetch action - generic HTTP fetch / navigate / download / oauth operate action
 *
 * Triggers a client-side `fetch()` call to an arbitrary URL (typically a
 * Sovrium API endpoint such as `/api/tables/<name>/records`) and dispatches
 * an `onSuccess` / `onError` toast based on the HTTP response status.
 *
 * Useful for thin "fire-and-display" interactions where a full `crud`
 * variant (with structured operation/table validation) is overkill — for
 * example a "Save quick note" button or a "Mark as read" toggle that just
 * pings an endpoint and surfaces a transient toast.
 *
 * Beyond the default `fetch`, the `mode` field carries the admin dashboard's
 * bespoke operate gestures into config: a confirm-gated mutate (`confirm`) to
 * any path (`url` is unrestricted — `/api/auth/admin/*`, the public
 * `/api/buckets/*`, …), a `navigate` CSV export, a `download` of a bucket file,
 * and an `oauth` connection authorize. `responseEnvelope` makes the success
 * decision tolerant of a non-Sovrium body (Better-Auth's always-200 envelope).
 *
 * @example
 * ```yaml
 * # Fire-and-display (default mode)
 * action:
 *   type: fetch
 *   url: /api/tables/contacts/records
 *   method: POST
 *   body: { name: 'Alice', email: 'alice@example.com' }
 *   onSuccess:
 *     type: toast
 *     variant: success
 *     message: Contact saved!
 *   onError:
 *     type: toast
 *     variant: destructive
 *     message: Save failed
 *
 * # Confirm-gated mutate against the Better-Auth admin plugin (envelope-tolerant)
 * action:
 *   type: fetch
 *   url: /api/auth/admin/ban-user
 *   method: POST
 *   body: { userId: '$record.id' }
 *   confirm: true
 *   confirmMessage: Bannir ce compte ?
 *   responseEnvelope: better-auth
 *
 * # CSV export — navigate the browser to the export endpoint
 * action:
 *   type: fetch
 *   mode: navigate
 *   url: /api/tables/contacts/export?format=csv
 *
 * # File download of a bucket object
 * action:
 *   type: fetch
 *   mode: download
 *   url: /api/buckets/default/files/$record.key
 *   filename: $record.name
 *
 * # Connection authorize — OAuth round-trip
 * action:
 *   type: fetch
 *   mode: oauth
 *   url: /api/admin/connections/$record.id/authorize
 *   method: POST
 *   redirectKey: authorizationUrl
 *   callbackPath: /api/admin/connections/$record.name/callback
 * ```
 */
export const FetchActionSchema = Schema.Struct({
  type: Schema.Literal('fetch').annotate({
    description: 'Which kind of action this is. It decides which of the other keys apply.',
  }),
  /**
   * Target URL for the action (any absolute path or fully-qualified URL). Not
   * restricted to a `/api/admin/*` prefix — may target the Better-Auth admin
   * plugin (`/api/auth/admin/*`) or the public buckets API (`/api/buckets/*`).
   */
  url: Schema.String.annotate({
    description:
      'Target URL (any absolute path or fully-qualified URL; not prefix-restricted). e.g. /api/tables/contacts/records, /api/auth/admin/ban-user, /api/buckets/default/files/<key>',
  }),
  /**
   * Dispatch mode (defaults to `fetch`). See `FetchActionModeSchema` — selects
   * client fetch vs browser navigate / native download / OAuth round-trip.
   */
  mode: Schema.optional(FetchActionModeSchema),
  /** HTTP method (defaults to GET) */
  method: Schema.optional(
    Schema.Literals(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).annotate({
      description:
        'What the action performs: the authentication operation under `type: auth`, or the HTTP verb under `type: fetch` (default GET).',
    })
  ),
  /** Optional request headers */
  headers: Schema.optional(
    Schema.Record(Schema.String, Schema.String).annotate({
      description: 'Request headers. Content-Type defaults to application/json when body is set.',
    })
  ),
  /** Optional JSON request body (serialized with JSON.stringify) */
  body: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description:
        'JSON request body (serialized with JSON.stringify). String values support $record.<field> and the $session.<field> token (resolved client-side from the caller session, e.g. { confirm: "$session.email" }).',
    })
  ),
  /**
   * Show a confirmation prompt before executing the action. Mirrors
   * `CrudActionSchema.confirm` — the minimal gate that turns a fetch action
   * into a confirm-gated operate action (ban, erase, …).
   */
  confirm: Schema.optional(
    Schema.Boolean.annotate({
      description: 'If true, shows a confirmation prompt before executing the action',
    })
  ),
  /** Custom confirmation message to display (requires confirm: true) */
  confirmMessage: Schema.optional(
    Schema.String.annotate({
      description: 'Custom confirmation message. Defaults to a generic confirmation prompt.',
      examples: ['Bannir ce compte ?', "L'effacement est définitif et irréversible."],
    })
  ),
  /**
   * Suggested download filename — only meaningful when `mode` is `download`.
   * Sets the anchor `download` attribute so the saved file is named regardless
   * of the server's `Content-Disposition`.
   */
  filename: Schema.optional(
    Schema.String.annotate({
      description: 'Suggested download filename. Only meaningful when mode is "download".',
      examples: ['mon-compte.json', 'export.csv', '$record.name'],
    })
  ),
  /**
   * Response field holding the provider redirect URL — only meaningful when
   * `mode` is `oauth` (default `url`). The authorize endpoint returns the
   * provider consent URL as DATA (e.g. `{ authorizationUrl }`), which the client
   * navigates to; `redirectKey` names that field.
   */
  redirectKey: Schema.optional(
    Schema.String.annotate({
      description:
        'Response field holding the OAuth provider redirect URL (default "url"). Only meaningful when mode is "oauth".',
      examples: ['authorizationUrl', 'url'],
    })
  ),
  /**
   * Path the OAuth provider returns to after consent — only meaningful when
   * `mode` is `oauth`. The provider's registered `redirect_uri` must resolve to
   * this callback path (e.g. `/api/admin/connections/:name/callback`).
   */
  callbackPath: Schema.optional(
    Schema.String.annotate({
      description:
        'OAuth provider return path (the registered redirect_uri). Only meaningful when mode is "oauth".',
      examples: ['/api/admin/connections/slack/callback'],
    })
  ),
  /**
   * How to interpret the response body when deciding success/error (default
   * `sovrium`). See `FetchResponseEnvelopeSchema` — set `better-auth` for the
   * `/api/auth/admin/*` always-200 enumeration-safe envelope.
   */
  responseEnvelope: Schema.optional(FetchResponseEnvelopeSchema),
  /**
   * Success handler when the fetch resolves with a 2xx response. The toast slot
   * (back-compat) PLUS optional client-state effects: a persistent inline
   * `role="status"` region (`status`) and a sibling data-bound `refetch`.
   */
  onSuccess: Schema.optional(FetchSuccessResponseSchema),
  /** Toast displayed when the fetch resolves with a non-2xx response or rejects */
  onError: Schema.optional(FetchToastResponseSchema),
}).annotate({
  title: 'Fetch Action',
  description:
    'Client-side operate action: fetch (default) / navigate / download / oauth, with optional confirm gating, arbitrary target path, and non-Sovrium response-envelope tolerance',
})

/** @public */
export type FetchAction = Schema.Schema.Type<typeof FetchActionSchema>
/** @public */
export type FetchSuccessResponse = Schema.Schema.Type<typeof FetchSuccessResponseSchema>
/** @public */
export type FetchToastResponse = Schema.Schema.Type<typeof FetchToastResponseSchema>
/** @public */
export type FetchActionMode = Schema.Schema.Type<typeof FetchActionModeSchema>
/** @public */
export type FetchResponseEnvelope = Schema.Schema.Type<typeof FetchResponseEnvelopeSchema>
