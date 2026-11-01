# Rebuilding the AI Knowledge Index

> Re-embed your knowledge documents and your agents' knowledge tables from the command line, with no server running and no account needed.

```text
Usage: sovrium reindex [config]
```

The AI knowledge index is what an agent searches when it answers from your own material: the documents in `AI_KNOWLEDGE_DIR` and the tables an agent lists under `knowledge.tables`. `sovrium reindex` rebuilds it from the shell and exits. Whoever can run the binary next to the database can run it, so it works on an app that declares no `auth` (where `POST /api/ai/rag/rebuild` answers `404`, since no visitor can be an administrator) and on a stopped app.

It reads what the server would read. The config is the path you pass, or the file found in the current directory as `sovrium seed` finds it. The database is `DATABASE_URL` when set, otherwise the SQLite file in the data directory. The documents are the files in `AI_KNOWLEDGE_DIR` (default `./knowledge`). The AI provider is the one `AI_PROVIDER` and its companion variables name.

## What it rebuilds

1. **Knowledge documents**, on both database engines. Every supported file is read, cut into chunks and embedded, replacing that document's previous chunks.
2. **Knowledge tables**, on PostgreSQL. For every agent whose `knowledge.tables` lists a table, every row the agent may read is embedded again, replacing that agent's previous table chunks. The fields are grouped by who may read them, exactly as a boot does.

On SQLite, knowledge tables are not indexed and the command says so on its own line: `Table knowledge not indexed: it needs PostgreSQL (set DATABASE_URL)`. The documents are still indexed and the run still succeeds.

Before writing anything, the command brings the database forward with the same two steps `sovrium seed` runs, so it also works on a database nothing has started against yet. Running it twice replaces what the first run wrote; it never adds a second copy of a chunk.

## What it prints

One line per document and per knowledge table, then a total:

```text
$ sovrium reindex
  Indexed document opening-hours.md: 1 chunk
  Indexed document returns-policy.txt: 1 chunk
  Indexed table faq for agent support-agent: 2 chunks

  Knowledge index rebuilt: 4 chunks
```

When there is no supported file in the knowledge directory and no agent knowledge table, it prints `Nothing to index: no knowledge documents and no agent knowledge tables`, contacts no AI provider, and exits `0`.

## When the AI provider cannot be reached

The command asks the provider for one embedding before it touches the index. If that fails, it prints `Error: Could not reach the AI provider (<provider>): nothing was indexed` with the provider's reason, and exits `1`. The existing index is left exactly as it was: a rebuild that cannot embed never empties it.

## Exit codes

- **`0`**: the index was rebuilt, or there was nothing to index.
- **`1`**: the config is missing or invalid, the database could not be prepared, or the AI provider could not be reached.
