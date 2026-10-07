# Auth, RBAC and Rate Limiting

> An MCP connection is an authenticated actor calling your data, and is treated as one — the two credentials, the five layers a call passes through, and what auditing and limits catch.

There is no AI-specific bypass anywhere in this path: a tool call runs through the same role permissions and row-level rules as the equivalent HTTP request from a human session.

## Two credentials, selected by header

There is no strategy to configure. The endpoint decides which verifier to use from the header the request actually carries, so **both credentials are live at the same time** — a desktop user on OAuth and a CI job holding an API key are the same instance's callers, and neither has to be switched on.

| Header                  | Verified as                                  | Best for                                   |
| ----------------------- | -------------------------------------------- | ------------------------------------------ |
| `x-api-key`             | A self-service API key                       | Scripts, CI jobs, anything non-interactive |
| `Authorization: Bearer` | An OAuth 2.1 access token, verified upstream | Desktop and IDE clients that can sign in   |

Because header dispatch is decided per request, there is no fallback chain in which one verifier's failure can quietly mask the other's.

Both credentials come from the auth layer, which is why enabling the server **requires an `auth` block**: an app with none gives nobody a way in, so the boot refuses rather than mounting a route that is either unreachable or unguarded.

**The key rides on `x-api-key`, never `Authorization: Bearer`.** That is the same rule the rest of the API enforces, and keeping it product-wide is what stops a leaked `Authorization` header from meaning one thing on one path and something else on another.

**When administrators must use a passkey, only OAuth reaches the admin tools.** With `auth.passkeys.requireForAdmin` on, an administrator's credential is offered the admin-only tools only when it is an OAuth access token authorised from a session opened with a passkey. An API key never qualifies, whichever session created it, exactly as the admin API turns keys away under the same setting. The key keeps every table, action and automation tool its owner's role allows; only the admin-only tools are withheld.

## Every caller is a user

Both credentials name a **real user**, and that user's role is resolved live on every call rather than baked into the credential.

- **Demote someone and every key they hold narrows with them** — nothing to re-issue, nothing to restart.
- **Ban them and their keys stop working** on the next request.
- **Signing out deactivates an OAuth access token at once**, because every token is re-checked against the live session rather than trusted until it expires.
- **Keys are hashed at rest**, shown once at creation, and individually revocable.
- **Row-level record rules apply.** A rule scoped to "records this user owns" needs a user to scope to.

That last point is why the static `MCP_TOKEN_*` variables were removed rather than deprecated. A static token carried no user, so the row-level tier never ran for a token-authenticated caller at all: the model saw every row the _role_ could see rather than every row the _person_ could. They were not merely coarse — they silently skipped a permission tier the equivalent human request went through.

A leftover static token **refuses the boot** when the server is enabled. That is deliberate: the failure lands where the change was made rather than in someone's CI a week later. Unset `MCP_TOKEN_ADMIN`, `MCP_TOKEN_MEMBER`, `MCP_TOKEN_VIEWER` and `MCP_AUTH_STRATEGY`; make sure the app has an `auth` block with API keys enabled; then mint a key as the user whose role the client should inherit. Where you would once have issued a viewer token, create a user holding the viewer role and mint that user's key — replace a role with a person.

## Five layers, all of which must pass

| Layer                    | Answers                                            |
| ------------------------ | -------------------------------------------------- |
| `aiAccess` on the entity | Is this eligible to appear as a tool at all?       |
| `MCP_ENABLED`            | Is the server running?                             |
| Role permissions         | May this actor perform this operation?             |
| Field-level permissions  | Which columns appear in the schema and the result? |
| Row-level rules          | Which records are visible?                         |

The role of the user behind the credential bounds everything downstream: a key owned by a viewer can only read and list, even against a table whose `aiAccess` allows writes. **`aiAccess` widens what is offered, never what is permitted.**

Role permissions include the table's own `permissions`: `read` for the read and list tools, `create`, `update` and `delete` for the write tools. A tool called by a role the table does not admit is refused exactly as the records API refuses it — `Resource not found` — and nothing is read or written. Hiding a tool from `tools/list` is a convenience; this check is the gate, because a client can name any tool by hand.

A write tool applies the table's row-level rules the way the records API does: a row outside them answers `Resource not found`, and a failure answers the records API's own message. An update or delete of a row the caller cannot read, or cannot write, is refused before anything is touched, and the refusal echoes nothing of the row; a create whose values fall outside the `create` rule — a record filed under someone else's name — writes nothing. Every value rule the records API applies runs on the write tools too — required fields, formats such as a malformed email, choice and link limits, attachment rules — and a value it rejects is refused as invalid params with the sentence the records API gives; an update of a record a field condition has made read-only is refused the same way. A failure in the database (a duplicate, an id that cannot exist) answers the records API's fixed sentence, never the database's own text.

On a table the caller may not read, an update or delete tool answers exactly as for a record that does not exist — an update `Resource not found`, a delete `"success": false` — whether or not the record is stored, hands back nothing of it, and writes nothing.

An action template carries no role gate of its own, so a viewer is refused one outright: it is withheld from a viewer's `tools/list`, and a call that names it by hand is refused too.

An action template or a manual automation writes as the caller: the table's rules apply inside the run, and a record they exclude fails the step without being touched.

Every one of those checks — table permissions, field `read` and `write` grants, row-level scopes, a manual automation's `requiredRole` — sees the account's role exactly as the records API does, custom roles included; a table permission naming a `group:` is matched against the groups the account belongs to, and on a table with row-level rules the roles an assignment gives the account count too, exactly as on the records API. A key owned by an `editor` is an `editor` to your tables, not a generic member.

A manual automation is listed to a role exactly when that role may run it; the same `requiredRole` check decides both. An automation an operator has paused is not listed until it is resumed.

The practical consequence is that writing `aiAccess: true` on a table cannot over-expose it. The worst case is that a role sees, through a tool, exactly what it could already have fetched over the API.

## Audit

With auditing on — the default — every tool call is recorded to the system tool-call table and to the activity stream, failed calls included. Admins can read that table back through MCP itself; that one read is not recorded, so reading the trail does not grow it.

That read is a raw list like the others (see Admin internals below): newest first, with `limit`, `since`, `where` and `after`, so "the calls to this tool in the last hour" is `where: { "tool_name": "…" }` with `since` set to an hour ago, and paging continues from the last row's `id`. It answers a fixed set of columns that leaves out the client's session id and the request id, and `where` can name only the columns it answers: filtering on either withheld id is refused exactly like a column that does not exist.

For a tool over your own tables, a row records the arguments the assistant sent and the answer it got. For the admin read tools and the raw internal tools it records the call, never its answer: those answers can carry a revealed submission body, an export, a person's account row, and the trail is readable by every admin with no reveal step of its own. Such a row keeps every argument's name, a number or a true/false value as sent (`limit`, `reveal`), and `"[withheld]"` in place of every other value, so a form name, a record id or a `where` filter on an email address is not copied. A successful call's output is `{ "withheld": true, "bytes": … }`, the size of the answer in UTF-8 bytes; a failed call keeps its error as any other. This holds whether or not `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED` is on: that setting governs the reveal, not what the trail keeps of it.

When a person's account is erased, the rows of the calls they made themselves are deleted with it. Rows of calls other people made about them stay, and keep no value that names them when those calls went through the admin or internal tools.

The admin read tools leave a second trail. A run-history list, a run read or an automations overview read over MCP writes the same entry to the admin audit log as the same read over the admin API — once per call, not once per page, attributed to the person who owns the credential — and a read that answers not-found writes none. The two trails are independent: turning off `MCP_AUDIT_ENABLED` silences the tool-call table, never the admin audit log.

Turning auditing off is permitted for compliance edge cases and is a bad default. An AI actor is precisely the one whose calls you will later want to reconstruct, because it is the one whose reasons you did not write down.

## Rate limiting

| Variable                    | Default | Scope          |
| --------------------------- | ------- | -------------- |
| `MCP_RATE_LIMIT_PER_MINUTE` | `60`    | Per credential |
| `MCP_RATE_LIMIT_PER_DAY`    | `5000`  | Per credential |

Over-limit requests answer HTTP `429`, carrying `Retry-After` and the `X-RateLimit-Limit` / `-Remaining` / `-Reset` trio, with a JSON-RPC `-32603` error in the body — so a client reading the transport and a client reading the envelope both learn the same thing. The per-day ceiling is the one that matters most: a model in a retry loop can burn a minute's budget and keep going, but it cannot quietly run all night against your database.

Ahead of these, every MCP request also counts against the instance's per-address ceiling (`API_IP_RATE_LIMIT`), shared with the HTTP API, before its credential is looked up; past it the request is refused with the platform's shared `429` answer rather than the JSON-RPC envelope.

## Admin internals

Internal exposure defaults to on, giving the admin role read-only tools over the auth and system tables, with secret columns denylisted, and the admin read tools that answer what the admin API answers. That is what makes "which users signed up this week?" or "which runs failed in the last hour?" answerable without a database client.

Both families are admin-only twice over: a member or viewer credential is never offered them, and calling one by name is refused without a single row in the answer. Hiding a tool is not what protects it.

Where an admin read answers the same data — run history above all — prefer it: it answers the admin API's own shaped, redacted body and writes its audit event. The raw table tools stay for everything no admin read covers, and a raw list's description names the admin tool when one exists.

A raw list answers newest first, by the table's time column (its creation time, or its own event time — when a form was submitted, when an automation was paused), and by id, highest first, when the table has none. It takes four optional arguments, which combine freely:

| Argument | Meaning                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `limit`  | Rows per page, `1` to `1000`, default `50`.                                                                                                            |
| `since`  | An ISO 8601 instant: keep the rows whose time column is at or after it. Refused on a table with no time column, and refused when it is not an instant. |
| `where`  | An object of `column: value` pairs, each an equality, all of which must hold.                                                                          |
| `after`  | The `id` of the last row of the previous page: the next page continues the same order strictly after it. An empty page is the end.                     |

"Which runs failed in the last hour?" is `where: { "status": "failed" }` with `since` set to an hour ago. The answer is still a plain list of rows, so the cursor is the last row's `id`, not a token returned beside them.

`where` may only name a column the rows answer. A withheld column is refused with exactly the message a column that does not exist gets, whatever the value: an equality filter on a withheld value would otherwise confirm or deny a guess at it.

Each `where` value must also be one its column can hold, judged from the column's type before any query runs, so a value that cannot match is refused rather than answered with no rows: a flag takes `true` or `false` (on SQLite, where a flag is stored as an integer, `0` or `1` too), a number column a number or a numeric string, a text column a string or a number, and `null` matches an empty value on any column. A time column takes an ISO 8601 instant on both engines, exactly as `since` does: a date-time carrying its zone (`Z` or an offset such as `+02:00`), or a bare date read as midnight UTC. A date-time without a zone, a raw epoch number or its text is refused, even on SQLite, where the time is stored as epoch milliseconds. `where` on a time column is an exact match to the millisecond, so a time window is best asked with `since`. A JSON column cannot be filtered by equality. A value that does not fit — `"yes-please"` for a flag, `"last tuesday"` for a time — is refused as invalid arguments with one fixed message that repeats neither the value nor the column, so the assistant knows to fix its argument rather than retry.

Time columns are answered the same way on both engines: as an ISO 8601 instant in UTC with milliseconds (`2026-03-14T09:30:00.125Z`), in a raw list, a raw read and the tool-call ledger alike. On SQLite, where a time is stored as epoch milliseconds, the answer is that instant written out; an integer that is not a time — a duration such as `duration_ms`, a flag stored as `0` or `1` — stays a number. Because the comparison is made to the millisecond, even on PostgreSQL where a time column keeps microseconds the answer does not show, a time value copied from an answer and pasted unchanged into `where` finds the row it came from.

Secret columns never reach the assistant: session tokens, IP addresses and user agents, account credentials, verification codes, two-factor secrets, webhook secrets, a form submission's share token and its submitter's IP address, IP hash and user agent, and a link's password hash. Personal values are withheld the same way: a form submission's body (the form's submitted data, or a share link's) and a guest's email address, and the record write an agent proposed on an approval request — its message, written for the approver, stays. A submission body is read through the admin submission read with `reveal`, behind its own setting and its own audit event. The tables holding a connection's OAuth tokens get no tool at all; connections are read through the admin read tools, which never carry a token.

A run whose values were erased with a person's account reads back marked as erased, without the values — through the admin read tools as everywhere else.

Set `MCP_EXPOSE_INTERNALS` to `false` to remove both families from the listing and refuse them by name, admins included — the right choice when the MCP surface is meant for business data and platform internals are out of scope for whoever is connecting.

When the app requires administrators to sign in with a passkey (`auth.passkeys.requireForAdmin`), these tools and the configuration reads are offered only to an OAuth access token authorised from a passkey session. Any other administrator credential, an API key above all, is not offered them, and a call by name is refused before anything is read, with a message naming the tool and the passkey requirement, and writes no audit entry. That refusal comes before `MCP_EXPOSE_INTERNALS` is consulted, so a credential that has not proven a passkey never learns how the switch is set. A passkey-authorised token then meets the switch as usual: the configuration reads stay answered, since the switch never governed them.
