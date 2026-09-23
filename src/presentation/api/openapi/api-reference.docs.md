# REST API Overview

> The contract every endpoint obeys — the two credentials that authenticate, the one error envelope every failure uses, and the codes that say what to do about it.

Sovrium exposes a REST API over tables, records, views, activity, analytics and authentication. Every endpoint accepts and returns JSON, enforces role and field-level permissions, and emits a single canonical error envelope.

The API surface is still evolving and endpoints may change before v1.0.

All paths are relative to your instance's base URL, under `/api`.

## Authenticating

Authentication is session-based. A request touching a protected resource carries one of exactly **two** credential forms.

| Credential     | How it travels              | When it applies                                       |
| -------------- | --------------------------- | ----------------------------------------------------- |
| Session cookie | `better-auth.session_token` | Always, once auth is configured — the browser default |
| API key        | An `x-api-key` header       | When API keys are enabled for the app                 |

**`Authorization: Bearer` is not one of them.** A Bearer token — including a valid API key sent that way — resolves no session and answers `401`. The header is deliberately not a credential path here, so a long-lived key travels on exactly one audited route rather than two. When a request that should work is refused, check the header name before checking the key.

Access is governed by roles plus field-level permissions. Table permissions accept `all`, `authenticated`, or an arbitrary list of role names, so `admin`, `member` and `viewer` are the built-in defaults rather than a fixed set. An app with no auth block evaluates every request under a `guest` role.

An authenticated request that lacks access to a resource answers **404**, never `403`, so the caller cannot tell "not found" from "no access". This holds even for "the caller can read this record but may not modify it" — the write boundary is not discoverable by probing. The few genuine `403`s live on CSV export and the form bulk handlers.

## The error envelope

Every 4xx and 5xx response uses one JSON shape, so a single decoder covers all of them.

```json
{
  "success": false,
  "message": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

`code` is drawn from a stable enum of twenty-three values. Fifteen are general-purpose: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `BAD_REQUEST`, `METHOD_NOT_ALLOWED`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `RATE_LIMITED`, `INTERNAL_ERROR`, `BAD_GATEWAY`, `SERVICE_UNAVAILABLE`, `GATEWAY_TIMEOUT`, `DATABASE_ERROR` and `QUOTA_EXCEEDED`. Eight more name a situation whose repair differs from the nearest general code — which is the whole reason they exist.

| Code                         | Status | What it means, and what to do about it                                         |
| ---------------------------- | ------ | ------------------------------------------------------------------------------ |
| `STORAGE_ERROR`              | `5xx`  | The object store could not be reached. Retry                                   |
| `TRANSFORM_ERROR`            | `500`  | An image transform failed. The store is fine; the transform parameters are not |
| `AI_PROVIDER_NOT_CONFIGURED` | `503`  | No AI provider is configured. Retrying will never help                         |
| `TOO_MANY_CONNECTIONS`       | `429`  | Too many open realtime streams. Close one; sending more slowly frees nothing   |
| `NESTED_REPLY_REJECTED`      | `422`  | The comment replied to is itself a reply. Target the top-level comment instead |
| `EMAIL_ALREADY_REGISTERED`   | `422`  | The invitee already has an account. Sign them in rather than re-inviting       |
| `INVALID_TOKEN`              | `400`  | The invitation token is not one this server issued                             |
| `TOKEN_EXPIRED`              | `410`  | The invitation token has expired. Ask for a fresh invitation                   |

### When a field is named

Where the failure attaches to a field of the request, an `errors[]` array names each offending one.

```json
{
  "success": false,
  "message": "One or more fields failed validation",
  "code": "VALIDATION_ERROR",
  "errors": [{ "field": "id", "message": "Cannot write to readonly field 'id'" }]
}
```

A single-record create refused by the database populates the same array, naming the column the constraint was declared on. **Only a field you actually sent is ever named**, and the response never lists the values a field accepts: the column is recovered from the constraint that fired and reported only when it matches a key in your payload. An error response therefore cannot be used to discover a schema you could not otherwise read. When no submitted key matches, `field` and `errors[]` are omitted and the class-level message answers alone.

That attribution is limited to the single-record create path. A partial update, or a batch write refused by the same constraint, answers the identical status and code with the class-level message and no field.

### The status map

| Status | `code`                | Meaning                                                                       |
| ------ | --------------------- | ----------------------------------------------------------------------------- |
| `400`  | `VALIDATION_ERROR`    | Validation failure — `errors[]` only when a field is named                    |
| `400`  | `BAD_REQUEST`         | Malformed request                                                             |
| `401`  | `UNAUTHORIZED`        | No session, or an expired one                                                 |
| `403`  | `FORBIDDEN`           | Authenticated and denied — rare, see above                                    |
| `404`  | `NOT_FOUND`           | Absent, or an access denial wearing the same answer                           |
| `405`  | `METHOD_NOT_ALLOWED`  | The verb is not one this route accepts; `allowed` lists those that are        |
| `409`  | `CONFLICT`            | A unique collision, single or batch, or a stale optimistic write              |
| `413`  | `PAYLOAD_TOO_LARGE`   | The batch payload exceeds the hard limit                                      |
| `429`  | `RATE_LIMITED`        | Rate limit exceeded                                                           |
| `500`  | `INTERNAL_ERROR`      | Unexpected server error, details redacted                                     |
| `500`  | `DATABASE_ERROR`      | A query failed. Distinguished from the generic 500 so a client can retry once |
| `502`  | `BAD_GATEWAY`         | An upstream answered badly. Retrying may work                                 |
| `503`  | `SERVICE_UNAVAILABLE` | The service is temporarily down. Wait and retry                               |
| `504`  | `GATEWAY_TIMEOUT`     | An upstream did not answer in time                                            |
| `507`  | `QUOTA_EXCEEDED`      | Storing this would exceed the total-storage cap                               |

**`errors[]` is optional on a validation failure, not guaranteed.** It appears when the failure attaches to a field of the request and is omitted when the refusal is about a query parameter instead. On the record-list routes an out-of-range `limit` or `offset`, an unknown `timezone`, and an unrecognised `fields` or `groupBy` name all answer `400` with the message alone; `sort` is the one that does carry `errors[]`. The shape follows the handler rather than the status, so decode `errors[]` as optional everywhere and rely on `message`, which is always present.

Batch size failures split across two codes: exceeding the per-operation maximum is a `400`, while a payload over the hard 1000-id guard is a `413`.

**The three gateway codes are not interchangeable, and that is the point of having them.** `502` means an upstream replied and the reply was unusable, `504` that it never replied, and `503` that the service itself is down. All three used to ship as `SERVICE_UNAVAILABLE`, which told a client to wait when the repair was something else entirely. `AI_PROVIDER_NOT_CONFIGURED` shares the `503` status and is the one case where waiting never helps — an operator has to set a variable.

**How a request is framed never changes its code.** A unique collision answers `409` whether it arrives as a single write or inside a batch, because one handler covers both. The other constraint classes answer `400` on every path, since those reject the value that was sent rather than colliding with a row that already exists.

## Configuration is code-only

There is no runtime schema-editing API. Sovrium is a configuration-as-code interpreter: an app changes by editing its config file and re-deploying — the same file the CLI validates offline. The admin console reflects runtime **data**, never configuration, and schema changes apply on the next boot.

## What holds everywhere

List endpoints page their results. `DELETE` trashes by default, with hard delete on the same route behind a query parameter. Roles gate every protected route, with `guest` for auth-less apps, and field-level permissions narrow what each role reads and writes. Auth and admin endpoints are rate-limited. Every 4xx and 5xx shares the envelope above.
