# Environment Variables: AI and Speech

> AI is off until a provider is set, and every limit below is the operator's: none of them appears in the app config. Unset, each keeps the default the table gives.

## Provider

AI is disabled until a provider is set, and an unrecognised value aborts the boot rather than failing silently later. Leaving it unset is not silent either when it matters: if the config actually uses AI, the startup banner warns that agents are inert and AI fields fall back to their baseline. An app with no AI surface starts without that warning.

| Variable                  | Default          | Description                                                                                                                                                            |
| ------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AI_PROVIDER`             | unset (disabled) | `anthropic`, `openai`, `mistral`, `google`, `ollama` or `openai-compatible`; `gemini` aliases `google`                                                                 |
| `AI_API_KEY`              | —                | Provider API key; required for every provider except `ollama`                                                                                                          |
| `AI_BASE_URL`             | `mistral` only   | Endpoint URL; required for `ollama` and `openai-compatible`, and today for `openai`, `anthropic` and `google`; optional for `mistral`, whose public API is the default |
| `AI_MODEL`                | per provider     | Model identifier                                                                                                                                                       |
| `AI_TEMPERATURE`          | provider default | Sampling temperature, 0 to 1 inclusive                                                                                                                                 |
| `AI_MAX_TOKENS`           | provider default | Maximum output tokens                                                                                                                                                  |
| `AI_VISION`               | unset (off)      | `1` declares the model able to read pictures; a chat message carrying a PNG, JPEG, GIF or WebP is refused with `422` without it                                        |
| `AI_EMBEDDING_MODEL`      | —                | Embedding model identifier                                                                                                                                             |
| `AI_EMBEDDING_DIMENSIONS` | —                | Embedding vector dimensions                                                                                                                                            |

Provider-specific aliases are read when the generic variable is absent: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MISTRAL_API_KEY` and `GOOGLE_API_KEY` stand in for the generic key, and `OLLAMA_BASE_URL` for the generic base URL. **The generic name always wins when both are set**, which is worth knowing before debugging a key that appears to be ignored.

Where a model call may go — the local model, a cloud provider, or the local one only — is decided by `ECO_AI_PROVIDER_PRECEDENCE`, listed with the other eco levers in **Env Vars: Services**.

## Chat

Every chat limit is off or generous by default. A turn that breaks one is answered with an error the chat window shows, never with a reply the model did not give.

| Variable                      | Default        | Description                                                                                                          |
| ----------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| `AI_CHAT_RATE_LIMIT`          | unset (no cap) | Chat messages allowed per user per window; the next one answers `429`                                                |
| `AI_CHAT_RATE_WINDOW`         | `60`           | Length of that window, in seconds                                                                                    |
| `AI_ANON_RATE_LIMIT`          | `10`           | Anonymous transcriptions and chat messages allowed per window, per client address, on an app without `auth`          |
| `AI_ANON_RATE_WINDOW`         | `60`           | Length of that window, in seconds                                                                                    |
| `AI_CHAT_MAX_MESSAGE_LENGTH`  | unset (no cap) | Longest question accepted, in characters; a longer one answers `400`                                                 |
| `AI_CHAT_TIMEOUT`             | unset (none)   | Time one model call may take, in milliseconds; past it the turn answers `504`                                        |
| `AI_CHAT_STREAM_TIMEOUT`      | unset (none)   | Time a streamed answer may take to send its first words, in milliseconds; past it the stream answers `504`           |
| `AI_CHAT_MAX_RETRIES`         | unset (none)   | Retries of a model call the provider refused as busy (`429` or `503`)                                                |
| `AI_CHAT_MAX_TOOL_ITERATIONS` | `5`            | Rounds of tool calls the model may make before it must answer                                                        |
| `AI_CHAT_MAX_QUERY_ROWS`      | `100`          | Most records one table query from the chat returns                                                                   |
| `AI_CONFIRMATION_TTL_MS`      | `300000`       | How long a delete or bulk update the chat proposes waits for its confirmation, in milliseconds; after it, it expires |
| `AI_CHAT_MAX_FILE_CHARS`      | `20000`        | Most characters of any one file sent in a chat that the model reads                                                  |
| `AI_CHAT_MAX_TURN_FILE_CHARS` | `50000`        | Most characters of all the files one turn carries, together                                                          |

**A signed-in user's chat is not rate-limited until you set `AI_CHAT_RATE_LIMIT`.** An app with `auth` that exposes a chat agent exposes an uncapped path to a metered provider until it is set. An app without `auth` is covered by the anonymous limit whether or not it is.

**The file limits apply on every turn.** A file sent in a conversation is read again on each later turn of it, so its text is bounded each time: the newest message's files are served first, and a file cut short ends with `[…truncated, N more characters]`, `N` being what the model did not read. Raise both for a model with a large context window. An SVG is markup and counts as a file, read as text; only a raster picture is sent as an image, and only with `AI_VISION=1`.

## Conversation memory

A signed-in user's conversations are stored, and each turn sends the model the conversation so far.

| Variable                     | Default      | Description                                                                                              |
| ---------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| `AI_MEMORY_CONTEXT_MESSAGES` | unset (all)  | Most recent stored messages of the conversation sent with each turn                                      |
| `AI_MEMORY_MAX_AGE_DAYS`     | unset (kept) | Days a conversation is kept after its last message; older ones are deleted, with every file sent in them |

**Retention runs on the user's own next message.** At the start of each turn answered on `POST /api/ai/chat` or its stream, `POST /api/ai/chat/stream`, that user's conversations whose last activity is older than `AI_MEMORY_MAX_AGE_DAYS` days are deleted: their messages, and the files sent in them, rows and stored bytes alike. It is a hard delete, as deleting the conversation by hand is. A sweep that cannot finish leaves the conversation in place and tries again on the next message, so a file is never left behind by a conversation that is gone. Unset, or anything but a positive whole number, keeps every conversation until the user deletes it or their account is erased.

## Retrieval

Read when an agent searches documents for its answers.

| Variable               | Default       | Description                            |
| ---------------------- | ------------- | -------------------------------------- |
| `AI_KNOWLEDGE_DIR`     | `./knowledge` | Where documents are discovered         |
| `AI_RAG_CHUNK_SIZE`    | `512`         | Characters per chunk                   |
| `AI_RAG_CHUNK_OVERLAP` | `50`          | Overlap between adjacent chunks        |
| `AI_RAG_SIMILARITY`    | `0.5`         | The minimum score a passage must reach |
| `AI_RAG_MAX_RESULTS`   | `5`           | The most passages returned per query   |

An agent's own `memory.knowledge` settings win over the last two.

## Speech-to-text

A separate endpoint from the language model, never derived from `AI_BASE_URL`. Unset `STT_PROVIDER` keeps transcription off without stopping the app.

| Variable             | Default          | Purpose                                                                      |
| -------------------- | ---------------- | ---------------------------------------------------------------------------- |
| `STT_PROVIDER`       | unset (disabled) | `openai-compatible`, `whisper-cpp`, `openai` or `mistral`                    |
| `STT_BASE_URL`       | provider default | Speech server URL (`/audio/transcriptions`, or `/inference` for whisper.cpp) |
| `STT_API_KEY`        | —                | Required for `openai` and `mistral`; startup refuses without it              |
| `STT_MODEL`          | per provider     | Default speech model                                                         |
| `STT_MODEL_FAST`     | `STT_MODEL`      | Model for the `fast` tier                                                    |
| `STT_MODEL_ACCURATE` | `STT_MODEL`      | Model for the `accurate` tier                                                |
| `STT_TIMEOUT_MS`     | `600000`         | Upper bound on one transcription request, in ms; at most 2147483647          |
| `STT_MAX_FILE_BYTES` | `104857600`      | Largest recording sent, in bytes (chat dictation is capped at 25 MB)         |
