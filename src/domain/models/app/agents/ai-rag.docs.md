# AI RAG

> Grounding answers in your own records and documents — what gets embedded, where the vectors live on each dialect, and why each agent's corpus is isolated.

Retrieval-augmented generation lets agents and chat answer from **your application's actual data** rather than from a model's training set. Before generating a response the runtime retrieves the most relevant content from a vector-indexed knowledge base and injects it into context.

It is **native** once a provider is configured: the embedding infrastructure is provisioned automatically, with nothing to declare for storage. The schema says _what_ to embed; the operator tunes _how_.

## No external vector database, on either dialect

| Dialect    | Storage                                         | Similarity                            |
| ---------- | ----------------------------------------------- | ------------------------------------- |
| PostgreSQL | A vector column, through the pgvector extension | Cosine distance computed in SQL       |
| SQLite     | A packed 32-bit float blob                      | Cosine similarity computed in the app |

The response envelope and each result's shape are identical across dialects, so a caller never branches on the storage engine, and moving from one to the other changes nothing above the repository.

**One source kind needs PostgreSQL.** Document knowledge is embedded and retrieved on both dialects, so the frugal default — SQLite and a local model — gives a working RAG agent. **Table** knowledge does not: on SQLite the initial sync and the change listener that keeps it current are both skipped, and an agent retrieves nothing from its `knowledge.tables`. The skip is logged rather than raised, so such an agent answers as though the table were empty instead of failing — point `DATABASE_URL` at PostgreSQL where you need table sources.

## What gets embedded

<!-- sovrium:options AgentKnowledgeSchema -->

Both source kinds are optional and combine freely.

### From a table

Embed named fields from a table, optionally narrowed by a filter. Only text-bearing fields are worth embedding.

```yaml
agents:
  - name: support-agent
    role: support
    systemPrompt: Answer using the FAQ and published docs.
    knowledge:
      tables:
        - { table: faq, fields: [question, answer] }
        - { table: docs, fields: [content], filter: { status: published } }
```

On PostgreSQL, a change to a source record updates its embedding automatically — that is what keeps a retrieval corpus from quietly becoming a snapshot of the day it was built. Both the initial sync and that listener are PostgreSQL-only, so on SQLite this block embeds nothing at all.

### From documents

```yaml
knowledge:
  documents:
    - { path: /knowledge/product-manual.pdf, label: Product Manual }
```

A document placed in the knowledge directory is discovered, parsed, chunked, embedded and stored without further declaration.

| Format     | Extension | Notes                                      |
| ---------- | --------- | ------------------------------------------ |
| PDF        | `.pdf`    | Text only; a scanned page is not supported |
| Markdown   | `.md`     | Formatting stripped, structure kept        |
| Plain text | `.txt`    | Ingested directly                          |

## Each agent's corpus is its own

A knowledge base is keyed by agent name, and one agent never retrieves another's embeddings. That isolation is what lets a support agent and a sales agent embed entirely different corpora without cross-contamination — and it is enforced by the store rather than by the prompt.

Chat can additionally reach knowledge scoped to the requesting user's permissions.

## Tuning

Chunking, embedding and retrieval are operator settings.

| Variable                  | Controls                              | Default                |
| ------------------------- | ------------------------------------- | ---------------------- |
| `AI_EMBEDDING_MODEL`      | The embedding model                   | the provider's default |
| `AI_EMBEDDING_DIMENSIONS` | The vector width, matching the model  | auto-detected          |
| `AI_KNOWLEDGE_DIR`        | Where documents are discovered        | `./knowledge`          |
| `AI_RAG_CHUNK_SIZE`       | Characters per chunk                  | `512`                  |
| `AI_RAG_CHUNK_OVERLAP`    | Overlap between adjacent chunks       | `50`                   |
| `AI_RAG_SIMILARITY`       | The minimum score a result must reach | `0.5`                  |
| `AI_RAG_MAX_RESULTS`      | The maximum chunks returned per query | `5`                    |

Overlap exists so a sentence split across a chunk boundary is still retrievable from either side. Raising the chunk size without raising the overlap is the usual cause of an answer that misses something obviously present in the source.

## Rebuilding and searching

| Endpoint                   | Does                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `POST /api/ai/rag/rebuild` | Re-embeds the configured sources and persists the vectors; admin-equivalent roles only |
| `POST /api/ai/rag/search`  | Embeds a query, searches, filters by threshold, and returns ranked results             |

Both behave identically on either dialect — the same authorization, the same response shape.

On an app with `auth`, a search needs a signed-in user, and it returns only what the records API would show her. A result drawn from a table comes back only when she may read that row: the table's read permission (her role, her groups and, on a table with row-level rules, the roles her assignments give her), then the table's row-level read rule. This holds whichever agent's knowledge base is searched, even one whose agent reads under a wider role. A record moved to the trash leaves the index and is never returned; restoring it embeds it again. Results from knowledge documents are not tied to a table and are returned to any signed-in user.

A result also comes back only when she may read every field whose value it holds. A chunk's text is fixed when the record is embedded and cannot be masked afterwards, so the embedding is split instead: the fields an agent lists in `knowledge.tables[].fields` are grouped by who may read them (a field with no read permission of its own takes the table's, and the built-in default field rules count too), each group is embedded as its own chunks, and every chunk records the names of its fields. With `cost_center` readable by admins only, a member searching finds an invoice by its title, and never the chunk that holds its cost centre; an admin finds both. The check runs against the config the app is running, so narrowing a field's read permission takes effect from the next search, before anything is re-embedded. A chunk that records no field names, or names a field the table no longer declares, is never returned to anyone. A record whose listed fields carry two different read permissions costs two sets of chunks, and its title and its notes no longer share one vector.

### On the first boot after upgrading

On PostgreSQL every boot already rebuilds each agent's table knowledge: it clears the agent's chunks and re-embeds them, agent by agent, through the configured provider, once the server is listening. The first boot after an upgrade does the same, with the extra chunks a split adds. While that runs, a search answers from what has been re-embedded so far, so it may return fewer table results for a moment. It never returns a chunk embedded by an earlier version: those record no field names, so they are not served even before the rebuild replaces them. `POST /api/ai/rag/rebuild` remains available to re-embed on demand.
