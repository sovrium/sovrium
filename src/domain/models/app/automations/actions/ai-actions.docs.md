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
      total: { type: number }
      due_date: { type: string }
      vendor: { type: string }
    connection: openai-key
```

`schema` describes the shape you want back. Pair it with a file action that turns a PDF into text first — extraction reads text, not documents.

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

To keep the transcript on the record, follow it with a `record/update` writing `{{steps.transcrire.text}}` into a long-text field — there is no transcript field type. `quality` picks the tier (`accurate` by default here, because a kept recording rewards fidelity); `model` names one exact model instead. `prompt` is a vocabulary hint for names and jargon, not an instruction. A file that is not audio fails the step before anything is sent.

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

## Routing is the operator's choice, not the action's

Every AI call goes through the provider-precedence resolver, which the operator governs through an environment variable and which is local-first by default. Naming a provider in the action says which credentials and model to use; it does not override an operator who has chosen to serve the request from a local model. Do not hard-code a single cloud provider as though it were the only path.

Where a decision has consequences somebody should own — a refund, a message to a customer — put an approval step between the model's answer and the action that acts on it.
