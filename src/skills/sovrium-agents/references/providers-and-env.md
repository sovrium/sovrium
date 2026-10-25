# Providers, routing and the environment

## Contents

- The provider is the operator's
- The six providers
- Where a call may go
- Without a provider
- Chat limits and retention
- Speech-to-text
- Checks

Manual: `sovrium docs ai/ai-providers`, `sovrium docs ai/ai-eco-routing`, `sovrium docs configuration/env-vars-ai`, `sovrium docs guides-integrations/integrate-ollama`.

## The provider is the operator's

The provider, its key, its endpoint and its model are environment variables, set in `.env` or the host. The config never names a key and has no top-level `ai` key. `AI_PROVIDER` is the master switch: unset (or blank), AI is off; an unrecognised value aborts the boot.

| Variable                                        | Holds                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `AI_PROVIDER`                                   | `anthropic`, `openai`, `mistral`, `google` (alias `gemini`), `ollama`, `openai-compatible`                         |
| `AI_API_KEY`                                    | the key; every provider except `ollama` needs one                                                                  |
| `AI_BASE_URL`                                   | the endpoint; needed for `ollama` and `openai-compatible`, optional for `mistral` (read the manual for the others) |
| `AI_MODEL`                                      | the model; each provider but `openai-compatible` has a default                                                     |
| `AI_EMBEDDING_MODEL`, `AI_EMBEDDING_DIMENSIONS` | for retrieval                                                                                                      |
| `AI_VISION`                                     | `1` when the model reads pictures                                                                                  |

Provider aliases (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MISTRAL_API_KEY`, `GOOGLE_API_KEY`, `OLLAMA_BASE_URL`) are read when the generic name is absent; the generic name always wins when both are set, which explains a key that "is ignored". An unknown model name for a provider with a catalogue prints a startup warning and boots anyway.

## The six providers

Prefer what the operator already runs. For data that should not leave the machine, `ollama` (or any OpenAI-compatible server on your own network) with `ECO_AI_PROVIDER_PRECEDENCE=local-only`. Name `google` rather than `gemini` in a new setup. `openai-compatible` needs `AI_MODEL` set by hand.

## Where a call may go

`ECO_AI_PROVIDER_PRECEDENCE` routes every AI call, an operator setting, never the config:

- `local-first` (the default): a reachable local model answers; otherwise the configured cloud provider does. A local model that is configured but unreachable falls back with a recorded reason.
- `local-only`: no cloud fallback. An app that uses AI refuses to boot when the local model is unreachable; a file in a chat goes to the local model only, and a turn that would need the cloud fails rather than pretending.
- `cloud-first`: the cloud provider answers when configured.

An unset, empty or **misspelt** value resolves to `local-first`, silently, and matching is case-sensitive. Confirm the route in force on `/api/health` (its `ai` section, read as an admin) rather than trusting the variable. Naming a provider in an automation's `ai` action chooses credentials and a model; it never overrides the operator's routing.

## Without a provider

The app still boots. The banner warns that agents are inert and AI fields fall back to their baseline when the config uses AI. An `ai-chat` draws a status line naming the variables to set instead of a broken composer; AI fields keep their deterministic value; an AI step fails with `ai_not_configured`. Write the page so it says what happens there: `visibility: { runtime: ai }` on the chat, and an alternative with `unlessRuntime: ai`.

## Chat limits and retention

Every chat limit is off or generous by default:

| Variable                                    | Default                          | Set it when                               |
| ------------------------------------------- | -------------------------------- | ----------------------------------------- |
| `AI_CHAT_RATE_LIMIT`, `AI_CHAT_RATE_WINDOW` | no cap, 60 s                     | always, for a chat signed-in people use   |
| `AI_ANON_RATE_LIMIT`                        | applies on an app without `auth` | rarely; it already caps anonymous use     |
| `AI_CHAT_MAX_MESSAGE_LENGTH`                | no cap                           | the chat is open to many people           |
| `AI_CHAT_TIMEOUT`, `AI_CHAT_STREAM_TIMEOUT` | none                             | a slow provider must answer or fail       |
| `AI_CHAT_MAX_TOOL_ITERATIONS`               | a few rounds                     | an agent needs more tool rounds           |
| `AI_CHAT_MAX_QUERY_ROWS`                    | a page of records                | a question needs more rows per query      |
| `AI_MEMORY_CONTEXT_MESSAGES`                | all                              | long conversations cost too much per turn |
| `AI_MEMORY_MAX_AGE_DAYS`                    | kept                             | conversations hold personal data          |

Read the exact current defaults with `sovrium docs configuration/env-vars-ai`. The rate cap is a launch item: hand it to `sovrium-security`.

## Speech-to-text

Transcription has its own endpoint, never derived from `AI_BASE_URL`: `STT_PROVIDER` (`openai-compatible`, `whisper-cpp`, `openai`, `mistral`), `STT_BASE_URL`, `STT_API_KEY`, `STT_MODEL`, and a model per tier (`STT_MODEL_FAST`, `STT_MODEL_ACCURATE`). Sovrium ships no speech model: point it at a server you run (whisper.cpp, Speaches, LocalAI) the way you would at Ollama. Unset, transcription is off and the app boots. The config only names a tier (`quality: fast | accurate`) on the `ai-chat` component's `voiceInput` or the `ai` `transcribe` action; there is no top-level speech key. The precedence applies: under `local-only`, a cloud speech provider is refused at startup.

## Checks

```
- [ ] grep the config for api keys, model ids and an ai: root → none
- [ ] .env sets AI_PROVIDER (and AI_API_KEY unless ollama), never committed
- [ ] /api/health as admin → the provider, the precedence and the route you meant
- [ ] the app booted with no ⚠ line saying agents are inert
- [ ] a page with ai-chat, on an instance without a provider → the alternative renders
```
