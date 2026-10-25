# Knowledge, memory and retrieval

## Contents

- Two blocks with close names
- Knowledge from tables
- Knowledge from documents
- What a person may retrieve
- Citations
- Facts memory
- Conversation memory
- Tuning and rebuilding
- Checks

Manual: `sovrium docs agents/ai-rag`, `sovrium docs agents/ai-memory`, `sovrium docs configuration/env-vars-ai`.

## Two blocks with close names

- `knowledge` says **what goes into** the agent's index: table fields and documents.
- `memory.knowledge` says **how much comes out** per turn (`enabled`, `sources`, `retrievalLimit`, `similarityThreshold`); `memory.facts` is a separate store of facts the agent learns.

Both are off until written. Nothing external is needed: vectors live in the app's database (a pgvector column on PostgreSQL, a float blob on SQLite).

## Knowledge from tables

```yaml
knowledge:
  tables:
    - { table: faq, fields: [question, answer] }
    - { table: docs, fields: [content], filter: { status: published } }
```

- **PostgreSQL only.** On SQLite the initial sync and the change listener are skipped, logged rather than raised, and the agent retrieves nothing from `knowledge.tables`: it answers as if the table were empty. Point `DATABASE_URL` at PostgreSQL before relying on table knowledge.
- Embed text-bearing fields only. On PostgreSQL a changed record updates its embedding; every boot rebuilds each agent's table knowledge.
- Each agent's index is its own: one agent never retrieves another's embeddings.

## Knowledge from documents

```yaml
knowledge:
  documents:
    - { path: /knowledge/product-manual.pdf, label: Product Manual }
```

PDF (text only, not scanned pages), Markdown and plain text, on both databases. Documents in `AI_KNOWLEDGE_DIR` (default `./knowledge`) are discovered without a declaration. Give each a `label`: it titles the citation a reader sees.

## What a person may retrieve

A chat never hands the model a row or a field the person could not read through the records API. Table chunks are split by who may read each field, so a member finds an invoice by its title and never the chunk holding a field only admins read. A record in the trash leaves the index. Document results are not tied to a table and come back to any signed-in user: never put a document in knowledge that every signed-in user should not read.

## Citations

Each passage handed to the model gets a number; the reply carries `citations` for the numbers the answer uses, each with its `source`, `label` and `excerpt`, and the `ai-chat` component links them. An answer that marks nothing cites nothing. When an agent must cite, say so in `instructions`.

## Facts memory

```yaml
memory:
  facts:
    enabled: true
    maxFacts: 100
    namespace: support
```

The agent decides what is worth remembering; facts are recalled by relevance. `namespace` defaults to the agent's name and isolates its facts from every other agent's. A fact is recalled only while the person still lists the tables it was learned from. Facts about a person are in her export and erased with her account.

## Conversation memory

A signed-in user's conversations are stored and replayed each turn; nothing to declare per agent. `AI_MEMORY_CONTEXT_MESSAGES` caps how many recent messages are sent; `AI_MEMORY_MAX_AGE_DAYS` deletes idle conversations and their files. An exchange that read a table she no longer lists is left out of what is replayed.

## Tuning and rebuilding

`AI_RAG_CHUNK_SIZE`, `AI_RAG_CHUNK_OVERLAP`, `AI_RAG_SIMILARITY`, `AI_RAG_MAX_RESULTS` are operator settings; an agent's `memory.knowledge.retrievalLimit` and `similarityThreshold` win over the last two. Raising the chunk size without the overlap is the usual cause of an answer missing something plainly in the source. `POST /api/ai/rag/rebuild` re-embeds on demand.

## Checks

```
- [ ] Table knowledge declared → the app runs on PostgreSQL
- [ ] A question answerable only from a document → answered, with a citation
- [ ] The same question as a user who may not read the source table → no answer from it
- [ ] A question the knowledge does not cover → the agent says so (an instruction asks it to)
```
