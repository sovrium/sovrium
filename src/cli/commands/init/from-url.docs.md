# Forking a Published Config

> Create a project from one YAML or JSON config published over HTTPS: fetched once, checked before a single file is written, and recorded with where it came from.

`--template owner/repo` fetches a whole repository. `--from-url` fetches a **single** config document: the shape a gallery, a blog post or a colleague can publish without owning a repository at all.

It is an option of `sovrium init`, whose other options are in **Project Commands**. An archive written by `sovrium bundle` opens with `--from-bundle` instead, described in **Opening a Bundle**.

```bash
sovrium init ./contact-book --from-url https://example.com/starters/contact-book.yaml
```

The URL is fetched exactly as given. A query string (a signed link's signature, a download name) is sent unchanged and never decides the format: only the path's extension does, and failing that the `Content-Type` (`application/yaml`, `application/x-yaml`, `text/yaml` or `application/json`). What is _recorded_ is not: a signed link is written down without what signs it.

The document is fetched once, at scaffold time, and written into the project byte for byte: comments, key order and all. Nothing ever re-fetches it. That is the difference between a file you have and a file whose author can still change what your app does.

Beside it lands `.sovrium-template.json`, recording where the config came from:

```json
{
  "source": "https://example.com/starters/contact-book.yaml",
  "sha256": "9d950eca6a366fa932ceb930b0a288818cc66921f606decb2f749529148921f7",
  "file": "app.yaml",
  "fetchedAt": "2026-09-22T21:18:36.449Z"
}
```

It is meant to be committed. Provenance goes in a sidecar rather than a header comment because a comment does not survive the first rewrite, and a JSON config cannot carry one at all.

So when the URL carried a signature or a bearer token (an `X-Amz-*`, `X-Goog-*` or Azure SAS query, a `token`, `access_token`, `key`, `apikey`, `auth` or `sig` parameter, or credentials before the host), `source` records it with those parameters removed, the others kept in order, and the sidecar adds `"signedSource": true`, so you know the recorded address is not the whole one. An unsigned fork's sidecar is unchanged. A refused fetch names the address the same way, never its signature.

Every refusal below exits `1` **before a single file is written**, so a rejected fork leaves nothing behind to clean up:

| Refused                                                                               | Why                                                                                                                                   |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| A plain `http://` URL                                                                 | The document becomes your whole application, so whoever can rewrite it in flight chooses what your project is                         |
| A URL ending in `.ts`                                                                 | A TypeScript config is a program. Downloading one from a URL to run it is a different thing from copying a document                   |
| A URL whose path has no `.yaml`/`.yml`/`.json` and whose `Content-Type` names neither | The format is what decides whether the fork lands as `app.yaml` or `app.json`. Checked after the fetch, still before the first write  |
| A document over 1 MB                                                                  | A config is a few kilobytes. The limit applies while the document is read, so an oversized one is abandoned rather than buffered      |
| A config carrying a remote `$ref`                                                     | Following it would leave the fork incomplete and every later boot dependent on a host you did not choose                              |
| A config the schema rejects                                                           | The document is decoded before the first write. A half-scaffolded project whose config does not boot is worse than no project         |
| A redirect chain over five hops                                                       | A published document is served directly or behind a redirect or two. A longer chain is a loop, or a redirector                        |
| A redirect to a non-`https` address                                                   | You chose the address you typed; the publisher chose where it goes next. A cleartext hop hands the document to whoever is on the path |

```console
$ sovrium init ./my-app --from-url http://example.com/app.yaml
Error: --from-url requires an https:// address, and "http://example.com/app.yaml" is not one.
This document becomes your whole application, so it is fetched over TLS or not at all.
```

## Redirects are followed, and each one is checked

Published templates redirect (`raw.githubusercontent.com` answers a `302`), so a link that redirects still works, and the provenance sidecar records the URL **you** gave rather than wherever it ended up. But the address you typed is the only one you chose, so each hop is put through the same checks again: it must be `https`, and it must not point at a private, loopback or link-local host, whether the address is written that way or the host name resolves to one. Every host name, the one you typed included, is resolved before the request is made, and the request goes to the address that was checked. Up to five hops are followed; past that the chain is refused.

Without this, every rule in the table above would be decided against the first URL while the bytes came from the last one.

```console
$ sovrium init ./my-app --from-url https://example.com/starter.yaml
Error: https://example.com/starter.yaml redirected to http://cdn.example.net/starter.yaml, which is not https, so nothing was fetched.
A redirect hop is chosen by the publisher rather than by you, and a cleartext hop hands
the document to whoever is on the path. Ask them for an https address.
```

A document the schema rejects is reported without printing its own values back at you, unlike `sovrium validate` on a file you wrote. These bytes came from somebody else, and a publisher who controls them should not get to choose what lands in your terminal. You still get the position and the expected shape.

## Look before you fork: `--inspect`

```console
$ sovrium init --from-url https://example.com/starters/lead-desk.yaml --inspect --json
{"host":"example.com","name":"lead-desk","size":1843,"sha256":"…","verdict":"unverified","containsDemoData":false,"containsCode":[{"automation":"on-new-lead","step":"postToSlack"}],"file":null}
```

`--inspect` runs every check above, fetches the document, writes nothing, and prints one JSON object on standard output, in the same shape `--from-bundle --inspect` prints: the host the document finally came from (after redirects), the app name, the size in bytes, the document's sha256, the verdict, `containsDemoData`, `containsCode`, every automation step that runs code (`[]` when none), and `file`. A published document carries no signature, so its verdict is always `unverified`; it carries no demo data; and nothing is kept on disk, so `file` is `null`. A refused document exits `1` with the same reason a fork would print, on standard error. `--inspect` always prints JSON; `--json` beside it is accepted and changes nothing.

## Pin the bytes: `--expect-sha256`

```bash
sovrium init ./lead-desk --from-url https://example.com/starters/lead-desk.yaml --expect-sha256 9d950eca…
```

Refuses the document if its sha256 is not the one given, exiting `1` with both hashes, before anything is written. Inspect, show the result to whoever decides, then fork pinned to the sha256 that was inspected: the document is fetched again, and if the publisher changed it in between, nothing is created. The bytes approved are the bytes written.
