# Placing the AI: chat, fields and automation actions

## Contents

- The `ai-chat` component
- Files and pictures
- Voice
- What chat may do
- The seven AI fields
- AI automation actions
- Checks

Manual: `sovrium docs components/ai-chat-component`, `sovrium docs ai/ai-chat`, `sovrium docs fields/ai-fields`, `sovrium docs automation-integrations/automation-ai-actions`, `sovrium docs components/message-component`, `sovrium docs components/attachment-component`, `sovrium docs components/questionnaire-component`.

## The `ai-chat` component

```yaml
- type: ai-chat
  agent: support-assistant
  placeholder: Ask about your tickets…
  conversations: true
  showUsage: true
  visibility: { runtime: ai }
```

- `agent` names an entry of `agents`; the agent's tools, memory and approval live there, not here. Options sit beside `type`.
- The panel is built from the conversation components: a `message-scroller`, a `message` per turn, `marker` lines, `attachment` chips, a `questionnaire` when the agent asks a question. Answers are Markdown rendered and sanitised on the server.
- A held call shows Approve and Deny in the chat; a decision runs the call as the person.
- `conversations: true` lists the person's past conversations with this agent; edits and regenerations keep earlier versions.
- `suggestions` (under `props`) are starter chips that fill the composer and never send. `draftParam` reads opening words from the address, also without sending.
- With no provider on the instance, the component draws a status line instead. Pair it with an alternative under `visibility: { unlessRuntime: ai }`.
- Gate the page with `access` and the agent with `permissions.trigger`: the first decides whether the panel is drawn, the second whether the agent answers.

## Files and pictures

`attachments: { bucket, accept, maxSizeMb }`, with an `id` on the chat and the bucket declared under `buckets`. By default a chat accepts PDF, Word, CSV, Markdown and plain text. A file's type is read from its content, not its name. Pictures reach the model only with `AI_VISION=1`; otherwise they are refused. A stored file opens only for the person who uploaded it, is re-read on each later turn up to `AI_CHAT_MAX_FILE_CHARS`, and is deleted with its conversation or her account.

## Voice

`voiceInput: { mode: draft | send, language, quality, maxDurationSeconds }` adds push-to-talk. The recording is transcribed by the operator's `STT_*` endpoint and never stored. `draft` (the default) puts the text in the box for review; `send` sends it at once.

## What chat may do

Through tool calls, checked before they run: query records, count and total them, create and update them, delete them after a confirmation (a delete moves records to the trash), trigger a manual automation the person may run. It cannot change the schema, create automations, or reach records or fields outside the person's permissions. A table she may not read is answered as one that does not exist.

## The seven AI fields

`ai-generate` (a prompt over `sourceFields`), `ai-summary`, `ai-categorize` (one of a closed `categories` list), `ai-extract` (a JSON Schema), `ai-sentiment`, `ai-tag` (several from a `tags` list), `ai-translate` (exactly one source field). Every one first stores a deterministic local value, then a model refines it in the background, so a value is never proof that a model produced it: check its refinement status before an automation acts on it. Without a provider, the fields keep their local value.

## AI automation actions

`type: ai` with an `operator`:

| Operator     | Use                                                                              |
| ------------ | -------------------------------------------------------------------------------- |
| `generate`   | free text, or `responseFormat: json`                                             |
| `classify`   | one label from `categories`; the right input for a branch                        |
| `extract`    | an object matching a full JSON Schema; feed it text (extract a PDF's text first) |
| `transcribe` | a stored recording to text, on the `STT_*` endpoint                              |
| `agent`      | runs a declared agent on a `task`, with `maxSteps`                               |

- An `agent` step's tool calls really run, through the agent's gates (allowlist, role, limits, approval); a covered call leaves the step with its id in `pendingApprovals`. Set `maxSteps`: a loop that ends only when a model says so is not an automation.
- A run nobody started by hand (a record event, a webhook, a cron) uses the agent's declared reach; a run someone started by hand grounds knowledge only on what she may read.
- A failed AI step reports a code (`rate_limit_exceeded`, `ai_not_configured`, `parse_error`, `invalid_tool`…); a `retry` policy retries only what another attempt can fix.
- Put an approval step between a model's answer and any action with consequences somebody should own (a refund, a message to a customer). Retries, idempotency and loops: `sovrium-automations`.

## Checks

```
- [ ] The ai-chat names an agent that exists; the page and the trigger admit the intended people
- [ ] A held action shows Approve and Deny, and nothing is written before approval
- [ ] A picture sent without AI_VISION → refused, as designed
- [ ] An AI field driving a branch → the automation checks the refinement status
- [ ] Every agent step has maxSteps; every irreversible action after a model has an approval
```
