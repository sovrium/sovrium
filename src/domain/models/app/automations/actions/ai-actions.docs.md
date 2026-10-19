# AI Actions

> Five operators running AI work as automation steps — free-form generation, classification, structured extraction, an autonomous agent, and audio transcription.

Provider and model are explicit per action, and credentials come from a stored connection. A self-hosted or custom endpoint is pointed at once through the `AI_BASE_URL` environment variable rather than per action, so moving a deployment between endpoints does not touch the configuration.

| Operator     | Does                                                             |
| ------------ | ---------------------------------------------------------------- |
| `generate`   | Produces free-form text, or JSON, from a prompt                  |
| `classify`   | Assigns an input to one of a fixed set of categories             |
| `extract`    | Pulls structured data matching a schema out of unstructured text |
| `agent`      | Invokes a configured agent to perform a multi-step task          |
| `transcribe` | Turns a stored audio recording into text                         |

<!-- sovrium:options AiActionSchema -->

`provider` is `openai`, `anthropic`, `ollama` or `custom`; `model` is the model id; `connection` names the stored credentials.

## `generate`

```yaml
- name: draftReply
  type: ai
  operator: generate
  props:
    provider: anthropic
    model: claude-sonnet
    systemPrompt: 'You are a concise support agent.'
    prompt: 'Draft a reply to: {{trigger.comment.body}}'
    responseFormat: text
    connection: anthropic-key
```

`responseFormat` is `text` by default, or `json`.

## `classify`

```yaml
- name: triage
  type: ai
  operator: classify
  props:
    provider: openai
    model: gpt-4o-mini
    input: '{{trigger.data.message}}'
    categories: [bug, billing, feature-request, spam]
    connection: openai-key
```

Classifying into a **closed** list is what makes the result usable in a branch: the answer is one of the labels you wrote, so a downstream condition can be written against it. Free-form generation asked to "say which category" gives you a sentence.

## `extract`

```yaml
- name: parseInvoice
  type: ai
  operator: extract
  props:
    provider: openai
    model: gpt-4o
    input: '{{extractText.result}}'
    schema:
      type: object
      properties:
        total: { type: number }
        due_date: { type: string }
        vendor: { type: string }
        lines:
          type: array
          items:
            type: object
            properties:
              label: { type: string }
              amount: { type: number }
      required: [total, vendor]
    connection: openai-key
```

`schema` is a JSON Schema object — `type: object`, its `properties`, and the `required` ones. A list is `type: array` with `items`, and `items` can be an object schema of its own, as `lines` is above. It is sent to the provider unchanged, as a named JSON Schema constraint, which providers with strict structured output (Mistral, OpenAI strict mode) require. A bare property map such as `total: { type: number }` at the top level is not a JSON Schema: write the full form. Pair the action with a file action that turns a PDF into text first — extraction reads text, not documents.

The step's output is the extracted object itself: `{{steps.parseInvoice.total}}` reads the total, and `{{steps.parseInvoice.lines}}` the list, which a `loop/each` walks with `items: '{{steps.parseInvoice.lines}}'`. The `.result` alias every step carries reads the same object (`{{steps.parseInvoice.result.total}}`); there is no `data` wrapper.

A reply that is not a JSON object fails the step with `parse_error`, and no half-extracted field reaches a later step. A model asked again may answer valid JSON, so a `retry` policy attempts the extraction again.

## `transcribe`

Turns a stored recording into text on the speech endpoint the operator configures. `source` is a storage key or an attachment field's value; the output is `text`, `language`, `durationSeconds` and `model`, plus `segments` when `timestamps: true`.

```yaml
- name: transcrire
  type: ai
  operator: transcribe
  props:
    source: '{{trigger.data.record.enregistrement}}'
    language: fr
    prompt: 'Dupont, SIRET, devis'
```

To keep the transcript on the record, follow it with a `record/update` writing `{{steps.transcrire.text}}` into a long-text field — there is no transcript field type. `quality` picks the tier (`accurate` by default here, because a kept recording rewards fidelity); `model` names one exact model instead. `prompt` is a vocabulary hint for names and jargon, not an instruction. A file that is neither audio nor a video with an audio track fails the step before anything is sent.

A video is transcribed from its audio track. For `video/mp4`, `video/quicktime`, `video/webm` and `video/x-matroska` files that hold a video track, `ai/transcribe` copies the audio track out first — AAC is sent as `.m4a`, Opus or Vorbis as `.webm` — the same remux `file/extractAudio` performs, so nothing is re-encoded. `STT_MAX_FILE_BYTES` is then checked against that audio, not the video, and the video itself is read up to 100 MiB, refused from its catalogued size when it is larger. A video with no audio track, or whose audio codec cannot be copied into an audio container, fails the step at once and nothing is sent. An audio-only file, a video container holding no picture, and a `video/ogg` file are sent as they are.

`ai/transcribe` checks an audio recording's size in the storage catalog against `STT_MAX_FILE_BYTES` before downloading it, so an oversized recording fails the step without being read.

In a run someone started by hand, `ai/transcribe` refuses a recording named by key that is stored in a table attachment field's bucket, or in a bucket whose `download` permission does not admit the person who started it, unless this run wrote it, with `Resource not found`. A key nothing holds, a file that is not audio and a video with no usable audio track get the same answer, and nothing is sent to the speech endpoint. A starter with the admin role is not refused, and a key nothing holds is named in her step's error.

Under a `retry` policy, only a failure another attempt could fix is retried. A speech endpoint answering `5xx`, `408` or `429`, or not answering before `STT_TIMEOUT_MS`, is retried up to `maxAttempts`. A `4xx` other than `408` and `429`, a recording refused before it is sent (not audio, a video with no usable audio track, or too large), and a speech endpoint that is not configured fail the step at once, and the run ends `failed` rather than `exhausted`.

The speech engine receives the recording under a file name whose extension comes from its audio type (`audio/webm` → `.webm`, `audio/mp4` → `.m4a`, `audio/mpeg` → `.mp3`, `audio/ogg` → `.ogg`, `audio/wav` → `.wav`), because engines pick their decoder from that name. A browser recording stored as `.weba` keeps its stored name; only the name sent to the engine changes.

## `agent`

Invokes an agent configured under the app's agents. The agent plans and executes several steps against its own scoped tools, rather than answering in one turn.

```yaml
- name: resolve
  type: ai
  operator: agent
  props:
    agent: support-resolver
    task: 'Resolve ticket {{trigger.data.id}} using the knowledge base.'
    context: { customerTier: '{{trigger.data.tier}}' }
    maxSteps: 8
    responseFormat: json
```

`maxSteps` caps the agent's reasoning and tool steps. Set it: an agent without a cap is a loop whose termination depends on a model.

Each tool call the model makes really runs. A `record.create` writes the row, an `http.request` sends the request, an `email.send` delivers the message. They go through the same actions a step of the automation would, inside the same run, and the real result goes back to the model. Every call first passes the agent's gates: its allowlist and role, its action limits, and its approval rule. A call the approval rule covers waits for a person, and the step completes with the request's id in `pendingApprovals`. Each action is recorded in the AI activity log as the agent's, with the surface `automation`.

When the agent turns on knowledge retrieval (`memory.knowledge.enabled`), the step retrieves from that agent's own knowledge base and from the shared knowledge documents (narrowed to its `memory.knowledge.sources`, when set). It never retrieves from another agent's knowledge base, so an agent declared with a narrow role cannot ground its answer on what an agent with a wider role has embedded.

A run someone starts by hand (a manual trigger, a record button) has a human caller, and its agent steps never show her more than she may read herself: of the agent's knowledge, the step grounds only on records she may read through the records API, and only on fields she may read. A run nobody started by hand (a webhook, a schedule, a record event) keeps the agent's declared reach.

## When an AI step fails

Every error an AI action meets fails its step: a provider refusing the call (a rate limit, a rejected key, a timeout, an unavailable service), an AI service that is not configured, a reply `extract` cannot parse, an agent tool call outside its allowlist. The step is recorded as `failed`, its error reads `<code>: <message>` — `rate_limit_exceeded`, `authentication_error`, `gateway_timeout`, `provider_unavailable`, `ai_not_configured`, `parse_error`, `invalid_tool`, `table_not_found` and the like — and it exposes no generated or extracted fields.

The run then behaves as after any failed step. Without `continueOnError`, it fails and the steps after it do not run, so a `loop/each` over an extraction that failed never runs at all; a synchronous webhook answers `500` with the run's id and status, and the error is in the step's record in run history. Under a `retry` policy, an error worth another attempt — a rate limit, a timeout, an unavailable provider, a malformed reply — is attempted again up to `maxAttempts`, and a run that used them all ends `exhausted`; a rejected key or another refusal fails at once. With `continueOnError: true` the run goes on, and the next step can branch on `{{steps.<name>.status}}` (`failed`) and read `{{steps.<name>.error.message}}`.

The AI service already repeats a provider call that fails transiently a few times within one attempt, unless the step sets its own `timeout`; a `retry` policy counts whole attempts on top of that.

## Routing is the operator's choice, not the action's

Every AI call goes through the provider-precedence resolver, which the operator governs through an environment variable and which is local-first by default. Naming a provider in the action says which credentials and model to use; it does not override an operator who has chosen to serve the request from a local model. Do not hard-code a single cloud provider as though it were the only path.

Where a decision has consequences somebody should own — a refund, a message to a customer — put an approval step between the model's answer and the action that acts on it.
