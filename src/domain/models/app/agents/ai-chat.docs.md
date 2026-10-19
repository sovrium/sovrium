# AI Chat

> A conversational interface over your data — what it may and may not do, why it works through tool calls, and the limits an operator sets.

Users ask questions and issue commands in natural language; the platform translates them into permitted queries, mutations and automation triggers, then returns a structured reply. It is available both as a REST endpoint and as an embeddable page component.

Chat is **native** once a provider is configured: every table and field is detected automatically, so nothing has to be declared per table. Everything done through chat is governed by the requesting user's roles and field permissions, and is written to the activity log. A create, update or delete asked through chat admits exactly the callers the records API admits: the user's role, her groups and, on a table with row-level rules, the roles her assignments give her.

An update or delete asked through chat reaches exactly the records the records API would let the same user change. Each record is checked against the table's row-level rules: the `read` rule and the `write` rule for an update (on the record as it stands and as the change would leave it), the `read` rule and the `delete` rule for a delete. A record either rule keeps from her, a record in the trash, and a record that does not exist are all answered the same way, as not found, and nothing is written. A delete through chat moves the records to the trash, exactly as the records API's delete does, so they can be restored.

A question asked through chat answers only what the records API would answer the same user. A record query (a list, a count, a total or an average) and a table the model looks up through a tool both read the tables the records API lets her read, with the same roles, groups and assignment roles, and only the rows the records API lists her: a row the table's row-level read rule hides from her, or one in which she may read no field, is not listed, not counted and not summed, and a table in which she may read no field at all is refused her as a table out of her reach. A count, a total, an average, a filter or a sort runs only over a field she may read. A row in the trash is left out the same way, as the records API leaves it out of a list — an agent declared in the app does not read it either. A table the records API would refuse her is neither offered to the model nor queried. An agent declared in the app reads under the role it declares instead.

## What it can and cannot do

| Chat can                                                          | Chat cannot                                  |
| ----------------------------------------------------------------- | -------------------------------------------- |
| Query records across tables in natural language                   | Modify table schemas                         |
| Create, update and delete records, with destructive ops confirmed | Create or modify automations                 |
| Trigger a manual automation the user may run                      | Reach records outside the user's permissions |
| Keep conversation context within a session                        | Bypass field-level permissions               |

"May run" is the manual trigger's own rule, the one the trigger endpoint and the MCP tool apply: the role the trigger declares in `requiredRole`, `admin` when it declares none, or an admin-equivalent role. A `permissions.trigger` on the automation narrows who may ask the chat on top of that, and never widens it: naming `member` there does not let a member start an automation whose trigger requires `admin`. A refused request runs nothing and is answered `404`, as for an automation the caller cannot see.

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

The chips appear in the order declared; nothing sorts, deduplicates or truncates the list, and a chat declaring none shows no strip at all. A prompt longer than the panel is wide is not cut either: its chip wraps onto further lines inside the panel. Each entry may be a translation key.

### Opening words from a link

`draftParam` names a URL query parameter the chat reads its opening words from. With `draftParam: q`, a page reached at `/ask?q=Which%20invoices%20are%20overdue` opens the chat with "Which invoices are overdue" in its message box and the box focused. **Nothing is sent**: like a chip, the words wait for the reader, because anyone can craft an address. A link carrying the parameter with nothing in it (`/ask?q=`) still focuses the box, empty. A chat that declares no `draftParam` reads nothing from the address. The words travel in the address, so they land in the browser's history like a search.

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

A turn is saved at the end of its conversation's current branch. A client showing an older version of a conversation (after an edit or a regeneration) sends `parentId`, the id of the last message it shows, and the turn is saved below it instead; an id that is not a message of the caller's conversation is ignored.

### Sending files

A chat that declares an `attachments` block uploads each file through `POST /api/ai/chat/attachments?chat=<chat id>`, which answers with an `attachmentId`. The message then names it by that id in `parts`, in place of (or beside) `message`; the client never sends the bytes:

```json
{
  "sessionId": "sess_abc123",
  "parts": [
    { "type": "text", "text": "Does this price list match our 2026 rates?" },
    { "type": "file", "attachmentId": "att_…" }
  ]
}
```

`parts` holds 1 to 20 parts: `text` parts, and `file` or `image` parts naming an upload. Every upload a message names must be one the caller made; one that is not answers `404`, and nothing reaches the model or is saved. A file reaches the model as the text read from it, quoted as a document under its name. A picture (PNG, JPEG, GIF or WebP) reaches it as an image only when you declare the model able to read images with `AI_VISION=1`; otherwise the message is refused with `422`. An SVG is markup, and is read as text.

**How much text a file gives.** Since every later turn of a conversation reads its files again, the text quoted from them is bounded: at most 20,000 characters of any one file (`AI_CHAT_MAX_FILE_CHARS`), and 50,000 of all the files one turn carries (`AI_CHAT_MAX_TURN_FILE_CHARS`), the newest message's files served first. A document cut short ends with `[…truncated, N more characters]`, so the model knows it did not read the whole file. Raise either limit for a model with a large context window; an unset or invalid value keeps the default.

**What is kept.** A message sent as parts is stored with them, as references to the uploads, never their bytes or their text. Each later turn of the conversation reads every file sent in it again from its bucket, so a follow-up question can refer to a file without attaching it again; once the upload is deleted, it reads as removed. Editing a question keeps the files it was sent with, and regenerating an answer reads them again. `GET /api/ai/conversations/<sessionId>` returns each message's `parts`, naming the uploads the caller still holds.

**Where files may go.** A file or a picture goes only to a provider `ECO_AI_PROVIDER_PRECEDENCE` allows for that turn, judged again on every turn. Under `local-only` it is read by the local model alone; a turn that would reach a cloud provider with one fails with `503` instead of answering as if it had read it.

`POST /api/ai/transcriptions` turns a recording into text for chat dictation. Send `multipart/form-data` with a `file` part and optional `language` and `quality` fields; the answer is `{ text, language?, durationSeconds?, model }`. It needs a signed-in user when the app declares `auth` (otherwise 404). It refuses a missing, non-audio or over-25 MB file with 400, answers 429 when rate-limited (under the same `AI_CHAT_RATE_LIMIT` settings as chat messages, counted separately) and 503 when no speech provider is configured, and never stores the recording.

The speech engine receives the recording under a file name whose extension comes from its audio type (`audio/webm` → `.webm`, `audio/mp4` → `.m4a`), so a browser recording named `.weba` is still accepted by engines that pick their decoder from the file name. A name that already matches its type is sent unchanged.

`POST /api/ai/transcriptions` is bounded by `STT_TIMEOUT_MS`, not `API_TIMEOUT_MS`; a speech engine that does not answer in time returns 504, and one that fails returns 502. On an app without `auth`, anonymous callers are limited to `AI_ANON_RATE_LIMIT` transcriptions and chat messages per `AI_ANON_RATE_WINDOW` seconds per client address (default 10 per 60 s); the next request gets 429 with `Retry-After`.

## Everything happens through tool calls

The model is presented with a set of tool definitions — query, mutate, trigger — and returns a call rather than prose containing data. Sovrium executes it **after a permission check** and feeds the result back, and the model then composes the final reply.

That structure is what keeps chat grounded and auditable. A model asked to answer from its own memory will produce a plausible number; a model that must ask for one produces either the real number or an error.

A destructive operation additionally requires confirmation before it executes. The number of records the confirmation says it will affect counts only the records the operation may reach for that user — her row-level rules apply, and records in the trash are left out — so the prompt never reveals that rows hidden from her exist. Confirming writes exactly those records.

## Streaming

Responses stream as server-sent events from `POST /api/ai/chat/stream`, so a reader sees progressive text rather than waiting for the whole answer. Each event names its type on its `event:` line and carries JSON:

| Event         | Carries                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| `content`     | `{ text }`, the next piece of the answer; now and then `html`, the answer so far rendered and sanitized         |
| `reasoning`   | `{ text }`, the model's thinking, apart from the answer (a reasoning model's `<think>` block too)               |
| `tool_call`   | `{ id, name, arguments, input }`, a tool the agent calls                                                        |
| `tool_result` | `{ id, name, ok, outcome, content, output }`, what the call did: `ok`, `denied`, `failed` or `pending-approval` |
| `elicit`      | `{ elicitationId, message, requestedSchema }`, a question the agent asks the person (below)                     |
| `done`        | `{ sessionId, messageId, questionId, stopReason, html, citations? }`, last (below)                              |

A final `data: [DONE]` follows `done`. `messageId` and `questionId` are the ids the answer and its question are saved under, so they can be edited or regenerated through the conversation routes once the stream has closed. `citations` lists the knowledge passages the answer cites, as on the buffered reply. A `tool_call` arrives as the call starts and its `tool_result` once it has run, both before the answer they lead to. `stopReason` is `end`, `stopped`, `awaiting_input` (a call waits for approval, or a question for its answer, below), `length`, `tool-limit` or `error`.

`input` and `output` are previews for the person reading the chat: the call's arguments and its result as indented JSON (a result that is not JSON as its text), at most 2,000 characters each, with `inputTruncated: true` or `outputTruncated: true` when one was cut. The model is still handed the whole result in `content`. Neither preview holds a value the reader may not read: the tools of a chat turn read as her, and a value the model wrote into a field she may not read, or into a filter condition on such a field, is left out of `input`, as is any argument a record action or a lookup does not read. The call's `arguments` on the stream carry the same projection: the model keeps what it wrote, the stream does not repeat it. A call refused because of her own permissions reads exactly like a call on a table the agent cannot reach, so the stream never tells her that a table she may not see exists. A write that runs and is refused by the database is handed back, to the model and to her alike, as one sentence naming the action and the table, and at most the field it could not hold: it never repeats the value, never carries the database's own words, and a value already taken reads exactly like any other refused write. Any other action that runs and fails is handed back the same way, naming the action; a request that fails says only the HTTP status the server answered with, or that it timed out, could not resolve its host, could not connect, did not trust the certificate, or was refused because the address is not one the server may reach. The full reason stays in the server log, and in the run history when an automation ran the agent. The `ai-chat` component draws each tool the agent called as a line that opens onto these previews, as two small code blocks titled Input and Output: the output of a failed call is drawn in the destructive colour, a call waiting for approval shows its input only, and a cut preview says so in its block's footer.

The answer's Markdown is rendered on the server — raw HTML in a reply is shown as text, and an image a reply names is never loaded — then cleaned by the same sanitizer as every rich-text value, and sent as `html`. The `ai-chat` component draws that, so the browser runs no Markdown renderer of its own.

Code in an answer is a small code block. A fenced block is highlighted on the server, its colours coming from the theme's classes rather than inline styles, and drawn in a frame titled by the language the fence names, exactly as written (`sql`), with a copy button that copies the code as written. A fence naming no language has no title and keeps its copy button. While the answer streams, a fence still being written is already framed, with the lines received so far, and gains its copy button once it closes, so half a block is never offered to copy. The reader's own message is never rendered as Markdown: a fence she types stays text.

| Behaviour            | Detail                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| Chunks               | Forwarded in real time as the provider emits them                      |
| Persistence          | The answer is persisted once the turn ends; reasoning is never saved   |
| Permissions          | Identical to the non-streaming path                                    |
| Time to first chunk  | A `504` when the provider sends nothing before the configured deadline |
| A dropped connection | Handled gracefully; a partial response is discarded rather than stored |

### Stopping a turn

`POST /api/ai/chat/stop` with `{ sessionId }` stops the caller's turn in progress on that session and answers `202`; with no turn in progress it answers `404`. The turn stops at its next step: a tool call already running finishes, so a stop never leaves half a write. The stream then ends with `done` and `stopReason: stopped`, and the conversation keeps exactly what was streamed before the stop.

### Approving a call from the chat

When the agent calls an action its `approval` rule covers, the turn pauses: the call arrives as `tool_result` with `outcome: pending-approval` and an `approvalId`, nothing is written, and the turn ends with `stopReason: awaiting_input`. The person the turn answered decides with `POST /api/ai/chat/approvals/{approvalId}` and `{ "decision": "approve" }` or `{ "decision": "reject" }`. The answer is the rest of the turn, as a new stream of the same events: approved, the call runs — as that person, within the agent's limits — and the agent goes on; rejected, nothing runs, the model is told the call was denied, and it answers. Nobody else can decide it: for any other account the approval does not exist (`404`). An approval already decided outside the chat, on the agent's own approval routes (`/api/agents/{agent}/approvals/{id}/approve` or `/reject`), or past its timeout, answers `409`. The paused turn is held in the server's memory and the first decision takes it, so a second decision on the same call, or one sent after the server restarted, finds nothing and answers `404`: send the message again for the agent to make the call anew. The `ai-chat` component shows the paused call with Approve and Deny buttons.

### When the agent asks a question

In a streamed chat with someone signed in, a declared agent can ask that person a short question rather than guess, with its built-in `ask_user` tool. The question is a `message` and a **flat** form, the shape of the form mode of MCP elicitation: each field is a string (a list of choices with `enum`, or a `format`: `date`, `date-time`, `email`, `uri`), a number, an integer or a boolean, with a `title`, and a `required` list names the fields that must be answered. A form with a nested object or a list is never shown: the model is told the fields must be flat, and it goes on, usually asking in prose instead. The form stays short: at most 12 fields and 50 choices per field, and a question of at most 2,000 characters; a longer one is refused the same way.

The turn pauses on the question: the stream carries `elicit` and ends with `stopReason: awaiting_input`. The person answers with `POST /api/ai/chat/elicitations/{elicitationId}`:

| Body                                               | Means                                                          |
| -------------------------------------------------- | -------------------------------------------------------------- |
| `{ "action": "accept", "content": { "date": … } }` | The answer, one value per field                                |
| `{ "action": "decline" }`                          | She skips the question                                         |
| `{ "action": "cancel" }`                           | She dismisses it, for example by sending a new message instead |

The answer is checked against the question before the model sees it: a required field left out, a value outside the choices, a value of the wrong type, or a text longer than 4,000 characters answers `400`, names the field, and the question stays open. Otherwise an accepted or declined answer is the rest of the turn, as a new stream: the model reads it as the result of its question, and goes on; a declined question reaches the model as such, with no content. A cancelled question is different: it closes **without** resuming the turn, so the model is not asked again and no tool runs. The answer is `{ "status": "cancelled" }` rather than a stream, and the paused turn is saved to the conversation as it stood: the person's message, then the agent's message carrying `elicitation: { message, state: "cancelled" }`, with `server`, the declared name of the MCP server that asked, for a question relayed from one. The `ai-chat` component shows a dismissed question as a line reading it, and who asked. The person's next message carries the conversation on. Only the person the turn answered can answer it; for anyone else it does not exist (`404`). A question already answered, or left unanswered for an hour, answers `409`. Like a paused approval, it is kept in the server's memory and does not survive a restart.

The `ai-chat` component draws the question inside the agent's answer as a questionnaire: the question above, one screen per field (choices as radio buttons, Yes and No for a boolean, a date or email box where the format asks for one), Skip on a field that is not required, Decline on every screen, and Send answer on the last. Once answered, it gives way to a line reading the answers, or Declined, and the agent's reply follows. Sending a new message while a question is open cancels it, and the new message is answered as usual.

`ask_user` is offered only where someone can answer: an agent run by an automation or on its schedule is never offered it, nor is a chat with a visitor signed in to nothing. On the buffered `POST /api/ai/chat`, which cannot show a form, the model is told to ask in prose.

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
