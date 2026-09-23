# AI Providers

> The language and embedding backend, selected entirely by environment variable — six providers, their keys, and the defaults each one resolves to.

The provider is never named in the app schema. Setting `AI_PROVIDER` is the master switch that activates the AI layer; leaving it unset keeps AI dormant.

```bash
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-5
```

## The six providers

| Provider          | Value                    | Key | Base URL | Notes                                |
| ----------------- | ------------------------ | --- | -------- | ------------------------------------ |
| Anthropic         | `anthropic`              | yes | no       | Claude models                        |
| OpenAI            | `openai`                 | yes | no       | GPT and o-series models              |
| Mistral           | `mistral`                | yes | no       | Mistral and Codestral                |
| Google Gemini     | `google`, alias `gemini` | yes | no       | Gemini models                        |
| Ollama            | `ollama`                 | no  | yes      | Local and self-hosted; no key needed |
| OpenAI-compatible | `openai-compatible`      | yes | yes      | Any endpoint speaking the OpenAI API |

`gemini` is an accepted alias for the canonical `google`; prefer `google` in a new configuration.

## The variables

| Variable                  | Holds                                                             |
| ------------------------- | ----------------------------------------------------------------- |
| `AI_PROVIDER`             | The provider identifier, and the master switch                    |
| `AI_API_KEY`              | The key for a cloud provider; unused by Ollama                    |
| `AI_BASE_URL`             | The endpoint; required for Ollama and compatible endpoints        |
| `AI_MODEL`                | The default model, falling back to the provider's recommended one |
| `AI_TEMPERATURE`          | The default sampling temperature, 0 to 1 inclusive                |
| `AI_MAX_TOKENS`           | The default maximum output length                                 |
| `AI_EMBEDDING_MODEL`      | The embedding model for retrieval, defaulting per provider        |
| `AI_EMBEDDING_DIMENSIONS` | The vector width, which must match the embedding model's output   |

An empty or whitespace-only value is treated identically to unset: an operator who blanks out the provider intends to disable it, not to supply an invalid value, so the server boots cleanly with AI off rather than throwing a parse error.

## Conventional aliases

Each cloud provider also accepts its own conventional variable. The generic `AI_*` value always wins; the alias is the fallback.

| Provider      | Key alias           | Base-URL alias    |
| ------------- | ------------------- | ----------------- |
| Anthropic     | `ANTHROPIC_API_KEY` | —                 |
| OpenAI        | `OPENAI_API_KEY`    | —                 |
| Mistral       | `MISTRAL_API_KEY`   | —                 |
| Google Gemini | `GOOGLE_API_KEY`    | —                 |
| Ollama        | no key              | `OLLAMA_BASE_URL` |

## Default models

| Provider          | Default                |
| ----------------- | ---------------------- |
| Anthropic         | `claude-sonnet-4-5`    |
| OpenAI            | `gpt-4o`               |
| Mistral           | `mistral-large-latest` |
| Google Gemini     | `gemini-2.0-flash`     |
| Ollama            | `llama3.1`             |
| OpenAI-compatible | none — set it yourself |

A compatible endpoint points at an arbitrary backend, so there is no universal default and `AI_MODEL` is required.

## Model names are checked, not enforced

For a provider with a known catalogue, a startup **warning** fires when the model name is not recognised — typically a cross-provider mix-up or a typo. It is a warning rather than an error, and the server still starts, because a catalogue goes stale faster than a deployment does.

Ollama and compatible endpoints have open-ended catalogues, so name validation is skipped for them entirely.

## Examples

```bash
AI_PROVIDER=ollama
AI_BASE_URL=http://localhost:11434
AI_MODEL=llama3.1
AI_EMBEDDING_MODEL=nomic-embed-text
```

```bash
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://my-gateway.internal/v1
AI_API_KEY=...
AI_MODEL=my-deployed-model
```

Any agent can override the model, temperature and maximum length for itself, falling back to these defaults when it does not.
