# AI Chat

> A conversational interface over your data — what it may and may not do, why it works through tool calls, and the limits an operator sets.

Users ask questions and issue commands in natural language; the platform translates them into permitted queries, mutations and automation triggers, then returns a structured reply. It is available both as a REST endpoint and as an embeddable page component.

Chat is **native** once a provider is configured: every table and field is detected automatically, so nothing has to be declared per table. Everything done through chat is governed by the requesting user's roles and field permissions, and is written to the activity log.

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
        props:
          agent: support-agent
          placeholder: Ask about your tickets...
          chatHeight: 600
          showHistory: true
          allowAttachments: false
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

## Everything happens through tool calls

The model is presented with a set of tool definitions — query, mutate, trigger — and returns a call rather than prose containing data. Sovrium executes it **after a permission check** and feeds the result back, and the model then composes the final reply.

That structure is what keeps chat grounded and auditable. A model asked to answer from its own memory will produce a plausible number; a model that must ask for one produces either the real number or an error.

A destructive operation additionally requires confirmation before it executes.

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

**Chat is not rate-limited until you set `AI_CHAT_RATE_LIMIT`.** There is no default cap: unset, empty, zero or non-numeric all disable the limiter entirely, and the window length then governs nothing. That is deliberate — a cap the operator did not choose would be wrong for most deployments in one direction or the other — but it means an instance exposing a public chat agent is exposing an uncapped path to a metered provider until this is set.

Once it is set, a limited request answers `429` with a retry header and the remaining quota. Each user has an independent counter, and an agent's calls respect the same limits as a person's.

## When the provider fails

Chat returns a readable error rather than leaking the provider's internals. With no provider configured at all it answers with a **disabled state** rather than an error, which is the same contract every other AI surface follows: dormant until configured is not the same as broken.
