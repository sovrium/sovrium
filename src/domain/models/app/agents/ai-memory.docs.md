# AI Memory

> Context that persists beyond a single message — two independent tiers, both off by default, and the one thing that is not configured here.

Before the runtime invokes a model it assembles context from whichever tiers an agent has enabled.

| Tier        | Persistence       | Direction  | Purpose                                         |
| ----------- | ----------------- | ---------- | ----------------------------------------------- |
| `knowledge` | Read-only sources | Read       | Retrieves relevant documents by semantic search |
| `facts`     | Across sessions   | Read/write | Remembers what the agent learns over time       |

**Chat history is not configured here.** Recent-message context is durable and keyed on the user and the session rather than declared per agent, and the operator caps how many prior messages are replayed.

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
