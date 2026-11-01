# Call the API from Your Own Front-End

> `sovrium client` writes one TypeScript file that calls your app's records API, typed from your own tables, fields and views, with nothing to install.

```text
Usage: sovrium client [config] [--output <file>] [--audience <role|all>] [--check]
```

Building a React site, a mobile app or a script against your Sovrium app? Run `sovrium client` in the project, copy the file it writes into your front-end, and import it. The file needs no package: it calls the API with plain `fetch`, and it type-checks with the standard TypeScript libraries alone.

```console
$ sovrium client app.yaml
✓ sovrium-client.ts
```

The command reads the config `sovrium start` would boot (the path you give, or the one found in the current directory) and checks it exactly as `sovrium validate` does. An invalid config writes nothing and prints the same report.

| Option                     | Effect                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `--output <file>`          | Write to this file instead of `sovrium-client.ts` in the current directory, creating its directory when missing. |
| `--audience <role or all>` | Write only what that role may read, or with `all`, what a visitor who is not signed in may read. See below.      |
| `--check`                  | Write nothing. Exit 0 when the file is current, 1 when it is missing or the config changed since it was written. |

**The file names only what its reader may read.** A front-end's source is public, so the file leaves out every table, field and view its audience may not read, exactly as the API does not name them to that reader. By default the audience is a signed-in person holding the app's default role (`auth.defaultRole`, `member` unless the config says otherwise); on an app with no `auth`, it is a visitor. A back-office front-end for admins takes `--audience admin`, and a public site `--audience all`. A role the app does not declare is refused with exit `1`, naming the roles it does declare (on an app with no `auth`, pointing to `--audience all`), and nothing is written. Pass the same `--audience` to `--check`.

The file is generated: it opens with a do-not-edit banner and is replaced on every run. Run the command again after you change a table, a field or a view, and run `sovrium client --check` in a pre-commit hook or a CI job to catch a client that fell behind.

## Read and write records

```ts
import { createClient } from './sovrium-client'

const sovrium = createClient({ url: 'https://crm.example.com' })

await sovrium.auth.signIn({ email, password })

const { data, error } = await sovrium.from('tasks').list({
  filter: { field: 'status', operator: 'equals', value: 'Open' },
  sort: 'due:asc',
  limit: 20,
})
if (error) {
  console.error(error.status, error.code, error.message)
} else {
  for (const task of data.records) console.log(task.fields.title)
}
```

| Call                                                            | What it does                                                |
| --------------------------------------------------------------- | ----------------------------------------------------------- |
| `auth.signIn`, `auth.signUp`, `auth.signOut`, `auth.getSession` | Email and password sign-in, sign-up and sign-out            |
| `from(table).list(query)`                                       | List records, with `filter`, `sort`, `page`, `limit`, `q`   |
| `from(table).get(id)`                                           | Read one record                                             |
| `from(table).create(fields)`                                    | Create a record                                             |
| `from(table).update(id, fields, { updatedAt })`                 | Change a record; a stale `updatedAt` answers `409 CONFLICT` |
| `from(table).delete(id)`, `restore(id)`                         | Move a record to the trash, and bring it back               |
| `from(table).createMany`, `updateMany`, `deleteMany`            | The batch routes                                            |
| `from(table).upsert(rows, { mergeOn })`                         | Update the record matching on `mergeOn`, or create one      |
| `from(table).view(viewId).list(query)`                          | List the records of a view                                  |

Every call answers `{ data, error }` and never throws on a refused request. `error` is the API's own answer: `status`, `code` (`NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`, `UNAUTHORIZED`…), `message`, and `errors` when a `400` names fields. A network failure answers `status: 0` and `code: 'NETWORK_ERROR'`. A request still unanswered after 30 seconds is abandoned and answers `status: 0` and `code: 'TIMEOUT'`; pass `timeoutMs` to `createClient` to wait longer or less. A record you may not read answers `404 NOT_FOUND`, exactly like one that does not exist.

`from()` accepts only your table names and `view()` only that table's view ids, and `Row<'tasks'>`, `Insert<'tasks'>` and `Update<'tasks'>` describe a table's records, what a create requires and what an update may change. Every key of a record's `fields` is optional, because a field your role may not read is left out of the answer.

## Credentials

**In a browser**, the client sends the session cookie the sign-in set, and `url` defaults to the page's own address. When your front-end is served from **another origin** (a Vite dev server on `http://localhost:5173`, a site on its own domain), set `SOVRIUM_CORS_ORIGINS` on the Sovrium server to that origin; without it the browser refuses the answers.

**On a server** (a script, a server route, a scheduled job), pass an API key:

```ts
const sovrium = createClient({
  url: process.env.SOVRIUM_URL,
  apiKey: process.env.SOVRIUM_API_KEY,
})
```

The key travels in the `x-api-key` header and acts with its creator's role, so anyone holding it reads what that person reads. `createClient` therefore throws when given an API key in a browser or a React Native app, before any request is sent: use the session cookie there.

Not in the client yet: files and buckets, realtime, search, aggregates, record history and comments. Call those routes with `fetch` meanwhile; see `sovrium docs records/records-overview`.
