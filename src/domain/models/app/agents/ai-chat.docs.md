# AI Chat

> A conversational interface over your data — what it may and may not do, why it works through tool calls, and the limits an operator sets.

Users ask questions and issue commands in natural language; the platform translates them into permitted queries, mutations and automation triggers, then returns a structured reply. It is available both as a REST endpoint and as an embeddable page component.

Chat is **native** once a provider is configured: every table and field is detected automatically, so nothing has to be declared per table. Everything done through chat is governed by the requesting user's roles and field permissions, and is written to the activity log. A create, update or delete asked through chat admits exactly the callers the records API admits: the user's role, her groups and, on a table with row-level rules, the roles her assignments give her.

An update or delete asked through chat reaches exactly the records the records API would let the same user change. Each record is checked against the table's row-level rules: the `read` rule and the `write` rule for an update (on the record as it stands and as the change would leave it), the `read` rule and the `delete` rule for a delete. A record either rule keeps from her, a record in the trash, and a record that does not exist are all answered the same way, as not found, and nothing is written. A delete through chat moves the records to the trash, exactly as the records API's delete does, so they can be restored.

A question asked through chat answers only what the records API would answer the same user. A record query (a list, a count, a total or an average) and a table the model looks up through a tool both read the tables the records API lets her read, with the same roles, groups and assignment roles, and only the rows the table's row-level read rule shows her: a row the rule hides from her is not listed, not counted and not summed. A row in the trash is left out the same way, as the records API leaves it out of a list — an agent declared in the app does not read it either. A table the records API would refuse her is neither offered to the model nor queried. An agent declared in the app reads under the role it declares instead.

## What it can and cannot do

| Chat can                                                          | Chat cannot                                  |
| ----------------------------------------------------------------- | -------------------------------------------- |
| Query records across tables in natural language                   | Modify table schemas                         |
| Create, update and delete records, with destructive ops confirmed | Create or modify automations                 |
| Trigger a manual automation the user may run                      | Reach records outside the user's permissions |
| Keep conversation context within a session                        | Bypass field-level permissions               |

## Embedding it in a page

```yaml
pages:
  - name: dashboard
    path: /dashboard
    components:
      - type: ai-chat
        agent: support-agent
        placeholder: Ask about your tickets...
        chatHeight: 600
        showHistory: true
        allowAttachments: false
        props:
          suggestions:
            - Which tickets are still open?
            - $t:chat.prompt.overdueInvoices
            - Show me the quotes waiting on a customer
```

`agent` names an entry in the agents block, and omitting it falls back to the default provider. The remaining properties are display concerns, documented in full with the other component types.

### Starter prompts

An empty composer is the hardest thing to answer: a reader who does not already know what the assistant can be asked gets a blinking cursor, and a placeholder carries exactly one example. `suggestions` carries several, as chips under the input.

**A chip fills the composer; it does not send.** Clicking one puts its text in the input and leaves the send to the reader, who can edit it first, and the chip's visible text _is_ the text inserted — so what a click will do is predictable.

The chips appear in the order declared; nothing sorts, deduplicates or truncates the list, and a chat declaring none shows no strip at all. Each entry may be a translation key.

## The REST endpoint

It authenticates like every other API route: a session cookie from a browser, or an API key header from a script. A bearer token is not a credential here and answers `401`.

```http
POST /api/ai/chat
Content-Type: application/json
x-api-key: <your-api-key>

{
  "message": "How many open tickets are there?",
  "context": { "table": "tickets" },
  "sessionId": "sess_abc123"
}
```

The reply carries the text, the actions taken, and the session id to continue with.

`POST /api/ai/transcriptions` turns a recording into text for chat dictation. Send `multipart/form-data` with a `file` part and optional `language` and `quality` fields; the answer is `{ text, language?, durationSeconds?, model }`. It needs a signed-in user when the app declares `auth` (otherwise 404). It refuses a missing, non-audio or over-25 MB file with 400, answers 429 when rate-limited (under the same `AI_CHAT_RATE_LIMIT` settings as chat messages, counted separately) and 503 when no speech provider is configured, and never stores the recording.

The speech engine receives the recording under a file name whose extension comes from its audio type (`audio/webm` → `.webm`, `audio/mp4` → `.m4a`), so a browser recording named `.weba` is still accepted by engines that pick their decoder from the file name. A name that already matches its type is sent unchanged.

`POST /api/ai/transcriptions` is bounded by `STT_TIMEOUT_MS`, not `API_TIMEOUT_MS`; a speech engine that does not answer in time returns 504, and one that fails returns 502. On an app without `auth`, anonymous callers are limited to `AI_ANON_RATE_LIMIT` transcriptions and chat messages per `AI_ANON_RATE_WINDOW` seconds per client address (default 10 per 60 s); the next request gets 429 with `Retry-After`.

## Everything happens through tool calls

The model is presented with a set of tool definitions — query, mutate, trigger — and returns a call rather than prose containing data. Sovrium executes it **after a permission check** and feeds the result back, and the model then composes the final reply.

That structure is what keeps chat grounded and auditable. A model asked to answer from its own memory will produce a plausible number; a model that must ask for one produces either the real number or an error.

A destructive operation additionally requires confirmation before it executes. The number of records the confirmation says it will affect counts only the records the operation may reach for that user — her row-level rules apply, and records in the trash are left out — so the prompt never reveals that rows hidden from her exist. Confirming writes exactly those records.

## Streaming

Responses stream as server-sent events, so a reader sees progressive text rather than waiting for the whole answer.

| Behaviour            | Detail                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| Chunks               | Forwarded in real time as the provider emits them                      |
| Completion           | A final marker event; the message is assembled from the chunks         |
| Persistence          | A streamed message is persisted once complete                          |
| Permissions          | Identical to the non-streaming path                                    |
| Time to first chunk  | A `504` when the provider sends nothing before the configured deadline |
| A dropped connection | Handled gracefully; a partial response is discarded rather than stored |

## Rate limits

Per-user limits protect the provider and cap cost. They are operator settings rather than schema.

| Variable                 | Controls                                  | Unset means         |
| ------------------------ | ----------------------------------------- | ------------------- |
| `AI_CHAT_RATE_LIMIT`     | Messages per window, per user             | **No limit at all** |
| `AI_CHAT_RATE_WINDOW`    | The window length, in seconds             | 60                  |
| `AI_CHAT_STREAM_TIMEOUT` | The deadline for the first streamed chunk | No deadline         |

**A user's chat is not rate-limited until you set `AI_CHAT_RATE_LIMIT`.** There is no default per-user cap: unset, empty, zero or non-numeric all disable the limiter entirely, and the window length then governs nothing. That is deliberate — a cap the operator did not choose would be wrong for most deployments in one direction or the other — but it means an app with `auth` exposing a chat agent to its users is exposing an uncapped path to a metered provider until this is set. An app without `auth` is different: every caller there is anonymous, and the anonymous limit described under the REST endpoint (`AI_ANON_RATE_LIMIT`, 10 per 60 s per client address by default) applies whether or not this is set.

Once it is set, a limited request answers `429` with a retry header and the remaining quota. Each user has an independent counter, and an agent's calls respect the same limits as a person's.

## When the provider fails

Chat returns a readable error rather than leaking the provider's internals. With no provider configured at all it answers with a **disabled state** rather than an error, which is the same contract every other AI surface follows: dormant until configured is not the same as broken.
