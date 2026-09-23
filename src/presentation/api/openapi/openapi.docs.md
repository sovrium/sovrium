# OpenAPI

> The machine-readable description of the HTTP API — two documents and one explorer, all three admin-only, all three generated from the schemas that validate live traffic.

Sovrium describes its HTTP API as standard **OpenAPI 3.1** documents, generated from the same request and response definitions the routes use for validation. Because those documents expose the full API shape, they are served **admin-only** at runtime and never to an unauthenticated or non-admin caller.

## What is generated

| Endpoint                     | Returns          | Description                                    |
| ---------------------------- | ---------------- | ---------------------------------------------- |
| `GET /api/openapi.json`      | OpenAPI 3.1 JSON | The application API — tables, records and rest |
| `GET /api/auth/openapi.json` | OpenAPI 3.1 JSON | The authentication surface                     |
| `GET /api/scalar`            | HTML             | An interactive explorer over both              |

The explorer mounts the two documents as switchable sources, so one page covers the whole surface.

## Who may read them

All three endpoints share one admin guard.

| Caller                         | Answer                 | Reason                                                     |
| ------------------------------ | ---------------------- | ---------------------------------------------------------- |
| Unauthenticated                | `401`                  | No session, which is ordinary HTTP authentication          |
| Authenticated, not an admin    | `404`                  | An authorization denial wearing the same answer as absence |
| Authenticated admin            | `200` and the document | Full access                                                |
| Any caller, no auth configured | `404`                  | The routes were never registered                           |

The split between `401` and `404` on those first two rows is the anti-enumeration rule the rest of the API follows: missing credentials are a client mistake worth naming, while insufficient ones must not confirm that the route exists.

## Fetching a document

The routes take the same two credential forms as the rest of the API — a session cookie, or an `x-api-key` belonging to an admin. `Authorization: Bearer` resolves nothing and answers `401`.

```bash
curl -H "x-api-key: $SOVRIUM_API_KEY" \
  http://localhost:3000/api/openapi.json -o app.openapi.json
```

**The documents are served at runtime and fetched, not built.** There is no CLI subcommand that writes an OpenAPI file: to get one on disk, fetch the route as an admin and redirect it. The JSON Schema of the _config_ is the opposite case — that one does have a dedicated command, because it describes the file you are about to write rather than the server you are already running.

## The explorer

Visiting `/api/scalar` in a browser while signed in as an admin gives a searchable view of every endpoint, its request and response schemas, its status codes and the canonical error envelope — and lets you issue authenticated requests from the page.

## Feeding external tools

Because the documents are standard OpenAPI 3.1, any compatible tool consumes them once the JSON has been fetched.

| Tool                 | How to use the document                  |
| -------------------- | ---------------------------------------- |
| Postman              | Import the file to generate a collection |
| Insomnia             | Import data from file                    |
| `openapi-typescript` | Generate a typed client                  |
| Redoc, Swagger UI    | Point the viewer at the fetched file     |

For TypeScript types of the _config_ rather than of the API, the CLI writes those directly; the document above is for generating an API client.

## Why it cannot drift

The application document is derived from the same schema definitions the routes decode with, and the authentication document is generated at request time. There is no separately maintained spec file, so adding or changing an endpoint's request or response schema updates the document by construction — which is the point of generating it rather than writing it.
