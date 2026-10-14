# AI Memory

> Context that persists beyond a single message — two independent tiers, both off by default, and the one thing that is not configured here.

Before the runtime invokes a model it assembles context from whichever tiers an agent has enabled.

| Tier        | Persistence       | Direction  | Purpose                                         |
| ----------- | ----------------- | ---------- | ----------------------------------------------- |
| `knowledge` | Read-only sources | Read       | Retrieves relevant documents by semantic search |
| `facts`     | Across sessions   | Read/write | Remembers what the agent learns over time       |

**Chat history is not configured here.** Recent-message context is durable and keyed on the user and the session rather than declared per agent, and the operator caps how many prior messages are replayed. How a user finds, edits and branches a past conversation is described under [Conversation history](#conversation-history).

```yaml
agents:
  - name: support-agent
    role: support
    systemPrompt: Be helpful and remember the customer's preferences.
    memory:
      knowledge:
        enabled: true
        sources: [faq, docs]
        retrievalLimit: 5
        similarityThreshold: 0.7
      facts:
        enabled: true
        maxFacts: 100
        namespace: support
```

<!-- sovrium:options AgentMemorySchema -->

## Knowledge memory

Semantic retrieval from the configured sources. With it enabled, a similarity search runs against those sources before each invocation and the most relevant documents are injected into context.

This is the **runtime retrieval** side of RAG, distinct from the agent's `knowledge` block, which defines the **input sources** that get embedded. The two names are close, and the distinction is the one to hold: one says what goes into the index, the other says how much comes back out of it.

`enabled` is off by default. `retrievalLimit` defaults to 5 documents per query and `similarityThreshold` to 0.7 — raise the threshold when retrieval is returning loosely-related material, and lower it when an obviously relevant document is being left out.

Retrieval runs against the same vector store RAG uses, so the dialect makes no difference here either.

## Facts memory

Persistent facts the agent learns across sessions. Unlike an automation's state store, which a developer sets explicitly, facts are **agent-managed**: the agent decides what is worth remembering, and they are retrieved by relevance to the current task rather than by exact key.

`enabled` is off by default, `maxFacts` allows 100, and `namespace` falls back to the agent's own name.

### Isolation

Facts are partitioned by namespace, defaulting to the agent's own name, so two agents never read each other's learned facts. Combined with the agent-as-user model — each agent being a distinct user — that gives per-agent isolation, and per-user isolation wherever chat scopes by session.

The property that matters in practice: an agent cannot leak one customer's learned facts into another customer's conversation, and it cannot do so by accident, because the partition is not something the prompt can reach across.

## Composing the tiers

Both are optional and combine freely. A read-only analyst might enable only knowledge; a long-running support agent enables both. With both on, context is assembled from each before the model is invoked — the retrieved documents and the relevant facts, together.

## Conversation history

Every chat turn of a signed-in user is stored with the session it belongs to, so a conversation can be found again, corrected, or asked again. All of it is the user's own: another user's conversation answers `404`, as one that does not exist.

| Route                                                                    | Does                                                                                          |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `GET /api/ai/conversations`                                              | Lists the user's conversations, most recent activity first, each titled by its first question |
| `GET /api/ai/conversations/{sessionId}`                                  | Returns the conversation's current branch                                                     |
| `POST /api/ai/conversations/{sessionId}/messages/{messageId}/edit`       | Replaces a question with `{ content }` and answers the new text                               |
| `POST /api/ai/conversations/{sessionId}/messages/{messageId}/regenerate` | Asks for another answer to the same question                                                  |
| `DELETE /api/ai/conversations/{sessionId}`                               | Deletes the conversation, its messages and the files sent in it                               |

The list takes `agent` to show one agent's conversations only, and `limit` (up to 100, 50 by default) and `offset` to page through them; `total` counts them all.

### How long conversations are kept

A conversation is kept until its user deletes it or their account is erased, unless the operator sets `AI_MEMORY_MAX_AGE_DAYS`. Then, at the start of the user's next turn on `POST /api/ai/chat` or `POST /api/ai/chat/stream`, their conversations with no message for longer than that many days are deleted, together with every file sent in them: the messages, the uploads' records and their stored bytes, all hard-deleted. `AI_MEMORY_CONTEXT_MESSAGES` caps how many of a conversation's most recent messages are sent to the model with each turn. Both are listed in **Env Vars: AI**.

### Edits and regenerations keep what came before

Neither an edit nor a regeneration overwrites a message. Each adds an alternative beside the message it replaces, and the conversation continues from the newest alternative. The model is sent the conversation as it stood before the replaced message, never the exchange being replaced. An edit answers the new text and keeps the old question with its answer; a regeneration keeps the old answer. A question sent with files is answered with them again: an edit replaces its text and keeps its files, and a regeneration reads them anew.

Reading a conversation returns its current branch, each assistant message with its answer rendered as sanitized `html`, as the chat stream renders it. A message with alternatives lists their ids in `siblings`, itself included, oldest first, which is what a window needs to show "2 / 3". To read another alternative, pass its id as `branch`: the answer is the conversation through that message, followed by its newest continuation. Both routes answer with the new reply and the branch it now ends.

A new message in the chat continues the current branch. An account export includes every message of every alternative, and deleting the conversation or the account deletes them all.
