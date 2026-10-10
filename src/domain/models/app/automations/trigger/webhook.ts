/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../template'
import { TriggerHistorySchema } from './trigger-history'
import { TriggerNameSchema } from './trigger-name'

/**
 * Webhook Trigger
 *
 * Receives external HTTP calls at a generated endpoint.
 * URL format: /api/automations/{automationName}/webhook
 */
/**
 * Webhook authentication configuration.
 *
 * Supports bearer tokens, API keys, HMAC signature verification, a signed-in
 * caller (`session`) and a per-sender key looked up in a table (`projectKey`).
 */
/**
 * The header layouts `scheme: hmac-timestamp` reads. Each names where the
 * timestamp and the signature sit and which string was signed; the signature
 * is always the lowercase hex HMAC-SHA256 of that string under `secret`.
 *
 * - `t=<ts>,v1=<sig>` — signed string `<ts>.<raw body>`. The Stripe layout,
 *   used by Calendly in `Calendly-Webhook-Signature`. Several `v1=` entries
 *   may appear (a rotated secret); one matching is enough.
 * - `ts=<ts>;h1=<sig>` — signed string `<ts>:<raw body>`. The layout Paddle
 *   Billing writes in `Paddle-Signature`.
 * - `t=<ts>,v0=<sig>` — signed string `<ts>.<raw body>`, the signature under
 *   a `v0` tag.
 *
 * A layout no preset names is spelled out with `timestampKey`,
 * `signatureKey`, `separator` and `join` instead.
 */
const WebhookSignatureFormatSchema = Schema.Literals([
  't=<ts>,v1=<sig>',
  'ts=<ts>;h1=<sig>',
  't=<ts>,v0=<sig>',
]).pipe(
  Schema.annotate({
    description:
      "How the `hmac-timestamp` header lays out its timestamp and signature. 't=<ts>,v1=<sig>': the signature is the hex HMAC-SHA256 of `<ts>.<raw body>`, and any of several v1 entries may match (Stripe's layout, used by Calendly). 'ts=<ts>;h1=<sig>': the hex HMAC-SHA256 of `<ts>:<raw body>` (Paddle Billing). 't=<ts>,v0=<sig>': the hex HMAC-SHA256 of `<ts>.<raw body>` under a v0 tag. With `hmac-timestamp`, give either `format` or `timestampKey` and `signatureKey`, never both; refused with any other scheme.",
    examples: ['t=<ts>,v1=<sig>'],
  })
)

/** A field name inside a signature header: `t`, `ts`, `v0`, `v1`, `h1`… */
const signatureHeaderKey = (description: string, example: string) =>
  Schema.String.pipe(
    Schema.annotate({ description, examples: [example] }),
    Schema.check(Schema.isPattern(/^[A-Za-z0-9_-]{1,32}$/))
  )

const WebhookAuthSchema = Schema.Struct({
  /**
   * Authentication type. `bearer`, `apiKey`, `hmac` and `basic` check a STATIC
   * secret the operator shares with one sender. `session` checks an IDENTITY:
   * the caller must present a Sovrium session cookie or an `x-api-key` minted
   * through `auth.apiKeys`, and the run knows who called (`trigger.user`).
   * A caller without one is answered 404, as if the webhook did not exist.
   */
  type: Schema.Literals(['bearer', 'apiKey', 'hmac', 'basic', 'session', 'projectKey']).pipe(
    Schema.annotate({
      description:
        "Authentication mechanism for incoming webhooks. 'bearer', 'apiKey', 'hmac' and 'basic' check a shared secret. 'session': the caller must present a Sovrium session cookie or a user's API key in the x-api-key header (auth.apiKeys); the run sees the caller as trigger.user, and an anonymous caller is answered 404 with no run. 'projectKey': only with a `protocol`; each sender presents its own key, looked up in `keyField` of `table`, and the run sees the matching row as trigger.project. A missing or unknown key is answered 401 with no run.",
    })
  ),

  /**
   * The role a `session` caller must hold, read exactly as a manual trigger's
   * `requiredRole` is (an admin-equivalent role satisfies any requirement).
   * Omitted, any signed-in user may call. Refused with any other `type`.
   */
  requiredRole: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "With type 'session': the role the caller must hold, judged as for a manual trigger's requiredRole (an admin satisfies any role). A caller without it is answered 404 with no run. Omitted, any signed-in user may call. Only for the session type.",
        examples: ['admin', 'member'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /**
   * `projectKey`: the table holding one row per sender (an app, a project, a
   * customer). The presented key is looked up in its `keyField`.
   */
  table: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "With type 'projectKey': the table holding one row per sender. Must be a table of the app. Only for the projectKey type.",
        examples: ['apps'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /** `projectKey`: the field of `table` holding each sender's key. */
  keyField: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "With type 'projectKey': the field of `table` holding each sender's key. The key the client presents (the public key of a Sentry DSN, or the bearer token of an OTLP exporter) is looked up in it by equality. Must be a field of that table. Only for the projectKey type.",
        examples: ['ingest_key'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /**
   * `projectKey` with `protocol: sentry`: the field the `<project>` segment of
   * `/api/<project>/envelope/` must match. Omitted, it must match the row id.
   */
  projectField: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        defaultNote: 'id',
        description:
          "With type 'projectKey' and protocol 'sentry': the field of `table` the project segment of the envelope path must equal. Omitted, the segment must equal the row id. A key whose row does not match the path is answered 401. Must be a field of that table.",
        examples: ['slug'],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  /** Token or secret value (supports template references like $env.SECRET) */
  token: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Bearer token or API key value (e.g., $env.WEBHOOK_TOKEN)',
      })
    )
  ),

  /** API key value (alternative to token for apiKey auth) */
  key: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({ description: 'API key value (e.g., $env.API_KEY)' })
    )
  ),

  /** Secret for HMAC signature verification */
  secret: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({ description: 'Secret for HMAC signature verification' })
    )
  ),

  /** HMAC algorithm (default: sha256) */
  algorithm: Schema.optional(
    Schema.String.pipe(Schema.annotate({ description: 'HMAC algorithm (e.g., sha256, sha512)' }))
  ),

  /** Header name for API key authentication, or the signature header of an hmac scheme */
  header: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          "Header name: the API key header (default: X-API-Key), the digest header of an `hex` or `base64` hmac, or the signature header an `hmac-timestamp` sender writes (required there, e.g. 'Calendly-Webhook-Signature')",
      })
    )
  ),

  /** Username for basic auth */
  username: Schema.optional(
    TemplateStringSchema.pipe(Schema.annotate({ description: 'Username for basic authentication' }))
  ),

  /** Password for basic auth */
  password: Schema.optional(
    TemplateStringSchema.pipe(Schema.annotate({ description: 'Password for basic authentication' }))
  ),

  /** Bearer token prefix (e.g., 'Bot' for 'Bot <token>') */
  prefix: Schema.optional(
    Schema.String.pipe(Schema.annotate({ description: 'Bearer token prefix (default: Bearer)' }))
  ),

  /**
   * How an `hmac` signature is written. `hex` and `base64` sign the raw body
   * and read the digest from `header` (after `prefix`); the three named
   * schemes sign a timestamped string and fix their own headers;
   * `hmac-timestamp` signs a timestamped string in the header and the
   * {@link WebhookSignatureFormatSchema format} the operator names — the
   * Stripe shape under another sender's header, without a scheme per sender.
   */
  scheme: Schema.optional(
    Schema.Literals(['hex', 'base64', 'stripe', 'slack', 'svix', 'hmac-timestamp']).pipe(
      Schema.annotate({
        defaultNote: 'hex',
        description:
          "How an hmac signature is written. 'hex' or 'base64': a digest of the raw body in `header`, after `prefix` (Shopify signs base64). 'stripe': the Stripe-Signature header (t=, v1=). 'slack': X-Slack-Signature (v0=) over v0:<timestamp>:<body>. 'svix': svix-id, svix-timestamp and svix-signature, with a whsec_ secret (Clerk, Resend and other Svix senders). The three named schemes are always SHA-256 and fix their own headers. 'hmac-timestamp': a timestamp and a SHA-256 hex signature carried together in the header you name, laid out as `format` says or as `timestampKey` and `signatureKey` spell out (Calendly and Paddle sign this way).",
      })
    )
  ),

  /**
   * How an `hmac-timestamp` header lays out its timestamp and signature, and
   * so which string was signed. An enum of documented layouts rather than a
   * template the server would have to parse: each value fixes the separators,
   * the field names and the signed string together, and a layout no sender
   * documents cannot be written.
   */
  format: Schema.optional(WebhookSignatureFormatSchema),

  /**
   * The `hmac-timestamp` layout spelled out, for a sender no `format` preset
   * names: the timestamp's and the signature's field names, the character
   * between entries and the character between `<ts>` and the raw body in the
   * signed string. An alternative to `format`, never beside it.
   */
  timestampKey: Schema.optional(
    signatureHeaderKey(
      'Name of the timestamp entry in an `hmac-timestamp` header (the `t` of `t=1712345678`). Given with `signatureKey`, instead of `format`, for a layout no format names. Only for the hmac-timestamp scheme.',
      't'
    )
  ),
  signatureKey: Schema.optional(
    signatureHeaderKey(
      'Name of the signature entry in an `hmac-timestamp` header (the `v0` of `v0=5257a8…`). Several entries of that name may appear; one matching is enough. Given with `timestampKey`, instead of `format`. Only for the hmac-timestamp scheme.',
      'v0'
    )
  ),
  separator: Schema.optional(
    Schema.Literals([',', ';']).pipe(
      Schema.annotate({
        defaultNote: ',',
        description:
          'The character between the entries of an `hmac-timestamp` header, when the layout is spelled out with `timestampKey` and `signatureKey`.',
      })
    )
  ),
  join: Schema.optional(
    Schema.Literals(['.', ':']).pipe(
      Schema.annotate({
        defaultNote: '.',
        description:
          'The character between the timestamp and the raw body in the string an `hmac-timestamp` sender signs (`<ts>.<raw body>` or `<ts>:<raw body>`), when the layout is spelled out with `timestampKey` and `signatureKey`.',
      })
    )
  ),

  /** Maximum age of a signed timestamp, for the timestamped schemes */
  tolerance: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        defaultNote: '300',
        description:
          'Seconds a signed timestamp may differ from the server clock before the request is refused as a replay. Only for the stripe, slack, svix and hmac-timestamp schemes.',
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
}).pipe(
  Schema.annotate({
    // Distinct from the OUTGOING webhook auth union's `WebhookAuth` identifier
    // (`src/domain/models/app/tables/webhooks/auth.ts`). A shared identifier
    // collapses both into one JSON Schema `$def`, erasing this one from the
    // public schema — see the collision test in
    // `src/domain/models/app/app-json-schema.test.ts`.
    identifier: 'IncomingWebhookAuth',
    title: 'Incoming Webhook Authentication',
    description: 'Authentication configuration for incoming webhook requests',
  })
)

/**
 * Webhook custom response configuration.
 */
const WebhookResponseSchema = Schema.Struct({
  /** HTTP status code to return */
  statusCode: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'HTTP status code to return' }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 100, maximum: 599 }))
    )
  ),

  /** HTTP status code (alias for statusCode) */
  status: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'HTTP status code to return (alias for statusCode)' }),
      Schema.check(Schema.isInt(), Schema.isBetween({ minimum: 100, maximum: 599 }))
    )
  ),

  /** Response body (string, template, or object) */
  body: Schema.optional(
    Schema.Union([TemplateStringSchema, Schema.Record(Schema.String, Schema.Unknown)]).pipe(
      Schema.annotate({ description: 'Response body content (string template or JSON object)' })
    )
  ),

  /** Additional response headers */
  headers: Schema.optional(
    Schema.Record(Schema.String, Schema.String).pipe(
      Schema.annotate({ description: 'Additional response headers' })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'WebhookResponse',
    title: 'Webhook Response',
    description: 'Custom response configuration for webhook endpoints',
  })
)

/**
 * Webhook rate limiting configuration.
 */
const WebhookRateLimitSchema = Schema.Struct({
  /** Maximum number of requests in the window */
  maxRequests: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Maximum requests per window' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),

  /** Time window in seconds */
  windowSeconds: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Rate limit window in seconds' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),

  /** Time window in seconds (alias for windowSeconds) */
  window: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({ description: 'Rate limit window in seconds (alias)' }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),

  /**
   * What the budget is counted per. `ip`: per client address, the behaviour
   * every webhook has always had. `project`: per sender row matched by a
   * `projectKey`, so senders sharing one outbound address (every app on a
   * shared host) never spend each other's budget.
   */
  per: Schema.optional(
    Schema.Literals(['ip', 'project']).pipe(
      Schema.annotate({
        defaultNote: "'project' on a trigger with a protocol, 'ip' otherwise",
        description:
          "What the budget is counted per. 'ip': per client address. 'project': per sender matched by a projectKey auth, so senders sharing one outbound address never spend each other's budget; needs auth type 'projectKey'.",
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'WebhookRateLimit',
    title: 'Webhook Rate Limit',
    description: 'Rate limiting configuration for webhook endpoints',
  })
)

/**
 * Subscription handshake a provider performs before it delivers events.
 *
 * Meta (Facebook Pages, Lead Ads, Instagram, WhatsApp Cloud) verifies a
 * webhook with a GET carrying `hub.mode=subscribe`, `hub.verify_token` and
 * `hub.challenge`, and only subscribes an endpoint that answers the challenge
 * back. The handshake is answered before authentication and creates no run:
 * the verify token IS its credential.
 */
const WebhookVerificationSchema = Schema.Struct({
  style: Schema.Literal('meta').pipe(
    Schema.annotate({
      description:
        "The handshake to answer. 'meta': a GET with hub.mode=subscribe, hub.verify_token and hub.challenge, answered with the challenge when the token matches.",
    })
  ),
  verifyToken: TemplateStringSchema.pipe(
    Schema.annotate({
      description:
        'The token entered in the provider console when subscribing the webhook (use $env.VAR). A handshake presenting another token is answered 404.',
      examples: ['$env.META_VERIFY_TOKEN'],
    })
  ),
}).pipe(
  Schema.annotate({
    identifier: 'WebhookVerification',
    title: 'Webhook Verification Handshake',
    description:
      'Answer the verification request a provider sends before delivering events, without running the automation.',
  })
)

export const WebhookTriggerSchema = Schema.Struct({
  type: Schema.Literal('webhook').pipe(
    Schema.annotate({
      description: "Constant value 'webhook' for type discrimination in discriminated unions",
    })
  ),

  /** Name of this trigger within its automation (defaults to its type) */
  name: Schema.optional(TriggerNameSchema),

  /** How much of a run this trigger starts is kept once it ends (defaults to `full`) */
  history: Schema.optional(TriggerHistorySchema),
  /**
   * The telemetry protocol this webhook receives. Declaring one mounts the
   * protocol's standard paths instead of `/api/automations/{name}/webhook`:
   * `sentry` serves `POST /api/<project>/envelope/` (with and without the
   * trailing slash), `otlp-logs` serves `POST /v1/logs`. Every automation
   * declaring the same protocol runs for what arrives there.
   */
  protocol: Schema.optional(
    Schema.Literals(['sentry', 'otlp-logs']).pipe(
      Schema.annotate({
        description:
          "Receive a telemetry protocol at its standard paths instead of /api/automations/{name}/webhook. 'sentry': envelopes from any Sentry-compatible client at POST /api/<project>/envelope/ (with or without the trailing slash), plain, gzip or deflate; each event or transaction item starts a run with the decoded item as trigger.data. 'otlp-logs': OTLP/HTTP JSON logs at POST /v1/logs; each request starts one run with trigger.data.records. Requires auth type 'projectKey' and method POST. Every automation declaring the same protocol runs; requests served here are never reported to the app's own error tracking.",
        examples: ['sentry'],
      })
    )
  ),

  /**
   * With `protocol: sentry`, which envelope items start a run for this
   * automation. Omitted, both kinds do.
   */
  items: Schema.optional(
    Schema.Array(
      Schema.Literals(['event', 'transaction']).pipe(
        Schema.annotate({ description: 'A Sentry envelope item kind' })
      )
    ).pipe(
      Schema.annotate({
        defaultNote: '[event, transaction]',
        description:
          "With protocol 'sentry': which envelope items start a run for this automation. 'event': errors and messages. 'transaction': performance transactions. Other item types (attachments, sessions, client reports) never start a run.",
        examples: [['event']],
      }),
      Schema.check(Schema.isMinLength(1))
    )
  ),

  method: Schema.Union([
    Schema.Literals(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    Schema.Array(Schema.Literals(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])).pipe(
      Schema.check(Schema.isMinLength(1))
    ),
  ]).pipe(
    Schema.annotate({
      description: 'HTTP method(s) to accept (single or array). Required for webhook triggers.',
    })
  ),

  secret: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Secret for HMAC signature verification (e.g., $env.WEBHOOK_SECRET)',
      })
    )
  ),
  /**
   * The default is FALSE, and the read site is what decides it: the async
   * dispatcher is entered only on `respondImmediately === true`
   * (`webhook-handler.ts`), so an omitted value takes the synchronous path and
   * the caller waits for the run. The annotation below said "default: true"
   * for as long as this property existed, which is the opposite of what ships.
   */
  respondImmediately: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotate({
        defaultNote: 'false',
        description:
          'Answer 202 as soon as the run is queued instead of holding the request open until it finishes. Omitted, the caller waits for the run to complete.',
      })
    )
  ),

  /** Authentication configuration for incoming requests */
  auth: Schema.optional(WebhookAuthSchema),

  /** Subscription handshake answered before events are delivered */
  verification: Schema.optional(WebhookVerificationSchema),

  /** Custom response configuration */
  response: Schema.optional(WebhookResponseSchema),

  /** JSON Schema for request body validation */
  requestSchema: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown).pipe(
      Schema.annotate({ description: 'JSON Schema for validating the request body' })
    )
  ),

  /** JSON Schema for query parameter validation */
  querySchema: Schema.optional(
    Schema.Record(Schema.String, Schema.Unknown).pipe(
      Schema.annotate({ description: 'JSON Schema for validating query parameters' })
    )
  ),

  /** Rate limiting configuration */
  rateLimit: Schema.optional(WebhookRateLimitSchema),

  /**
   * Template expression resolved against the request body to produce a
   * dedup key (e.g. `'{{body.orderId}}'`). When two requests within the
   * dedup window resolve to the same key, the second is silently dropped
   * — no run row, no side effects. Following Zapier's trigger dedup
   * pattern.
   */
  deduplicationKey: Schema.optional(
    TemplateStringSchema.pipe(
      Schema.annotate({
        description: 'Template expression to compute a dedup key (e.g. "{{body.orderId}}")',
      })
    )
  ),

  /**
   * Window (in seconds) during which a previously-seen dedup key blocks
   * fresh requests. Defaults to 300 (5 minutes) when `deduplicationKey`
   * is set but no explicit window is provided.
   */
  deduplicationWindow: Schema.optional(
    Schema.Finite.pipe(
      Schema.annotate({
        defaultNote: '300',
        description: 'Dedup window in seconds (default: 300)',
      }),
      Schema.check(Schema.isInt(), Schema.isGreaterThan(0))
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'WebhookTrigger',
    title: 'Webhook Trigger',
    description: 'Trigger automation via incoming HTTP webhook',
  })
)

/** @public */
export type WebhookTrigger = Schema.Schema.Type<typeof WebhookTriggerSchema>
