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

With auditing on — the default — every tool call is recorded to the system tool-call table and to the activity stream. Admins can read that table back through MCP itself.

Turning auditing off is permitted for compliance edge cases and is a bad default. An AI actor is precisely the one whose calls you will later want to reconstruct, because it is the one whose reasons you did not write down.

## Rate limiting

| Variable                    | Default | Scope          |
| --------------------------- | ------- | -------------- |
| `MCP_RATE_LIMIT_PER_MINUTE` | `60`    | Per credential |
| `MCP_RATE_LIMIT_PER_DAY`    | `5000`  | Per credential |

Over-limit requests answer HTTP `429`, carrying `Retry-After` and the `X-RateLimit-Limit` / `-Remaining` / `-Reset` trio, with a JSON-RPC `-32603` error in the body — so a client reading the transport and a client reading the envelope both learn the same thing. The per-day ceiling is the one that matters most: a model in a retry loop can burn a minute's budget and keep going, but it cannot quietly run all night against your database.

Ahead of these, every MCP request also counts against the instance's per-address ceiling (`API_IP_RATE_LIMIT`), shared with the HTTP API, before its credential is looked up; past it the request is refused with the platform's shared `429` answer rather than the JSON-RPC envelope.

## Admin internals

Internal exposure defaults to on, giving the admin role read-only tools over the auth and system tables, with secret columns denylisted. That is what makes "which users signed up this week?" answerable without a database client.

Set it to `false` to remove those tools from the listing entirely, admins included — the right choice when the MCP surface is meant for business data and platform internals are out of scope for whoever is connecting.
