# Opening a Bundle

> Turn an archive written by `sovrium bundle` back into a project you edit: from a link, a `file:` URL or a path on disk, checked from end to end before a single file is written.

`sovrium bundle` packs a project for a host. `sovrium init --from-bundle` is the way back: it opens such an archive as a **new** project, in a directory that does not exist yet or is empty.

```bash
sovrium init --from-bundle https://example.com/starters/crm.tar.gz ./crm
sovrium init --from-bundle ./downloads/crm.tar.gz ./crm
sovrium init --from-bundle file:///home/me/downloads/crm.tar.gz ./crm
```

Like `--from-url`, it is a fork, not a link: the archive is read once, written as an ordinary project you own, and nothing ever fetches it again.

## What you get

| In the bundle                                | In the project                          |
| -------------------------------------------- | --------------------------------------- |
| The validated config                         | `app.yaml`                              |
| `public/` and `seed/`                        | `public/` and `seed/`                   |
| The files the config declares under `assets` | At their declared paths                 |
| The `CLAUDE.md` and `PROMPT.md` it carries   | `CLAUDE.md` and `PROMPT.md` at the root |

`app.yaml` is **generated** from the config the bundle carries, so the comments of the original config are not carried over. It is written as YAML because that is the format a person, and the AI they hand the project to, edit most safely. The usual `.gitignore`, `.env.example` and agent skills are added beside it, as every `sovrium init` does.

Beside it lands `.sovrium-template.json`, recording **what the bundle is**, never the link it came from:

```json
{
  "name": "crm",
  "host": "example.com",
  "sha256": "119d9c2fd8fe2c418f7425f506aef1b4438b4eb4f1b76b721a42084ea6284c6a",
  "manifestSha256": "9a538c4891381b15f5c4055b088aad747ae8dbe9bf1e03c129235a40a16f1664",
  "verdict": "verified",
  "importedAt": "2026-10-25T21:23:12.085Z"
}
```

`host` is the host the archive was finally downloaded from, and nothing else of the address: no path, no query. A link sent to one person often carries a token meant for them alone, in its query string or in its path, and this file is meant to be committed. A bundle opened from disk records no `host`.

## Where it can come from

An `https:` address, followed through at most five redirects, each one checked again: it must be `https`, and it must not point at a private, loopback or link-local host. A short link that leads to a download service, then to a signed storage address, is the normal case. A `file:` URL or a local path is read from disk.

Whether the source is a bundle is decided by the first of these that answers: the file name at the end of the final address (`.tar.gz` or `.tgz`), then the archive's own first bytes, then the `Content-Type` the server sent. A `.yaml`, `.yml` or `.json` address is a config document, and the refusal points you to `--from-url`; a bundle given to `--from-url` points you back here.

## Who published it

A bundle may be **signed** by its publisher. The binary carries the public keys of the publishers it trusts, and the verdict is printed before the project is created:

| The bundle carries                               | Verdict                | What happens                    |
| ------------------------------------------------ | ---------------------- | ------------------------------- |
| A signature by a trusted key, which checks out   | **Verified publisher** | Imports, and says who signed it |
| No signature                                     | **Unverified**         | Imports, with a warning         |
| A signature by a key this binary does not know   | **Unverified**         | Imports, with a warning         |
| A signature by a trusted key that does not check | **Refused**            | Nothing is written              |

An unknown key proves nothing about who published the bundle, so it reads exactly like no signature, and the name it claims is never shown. A signature that does not check out means the bundle was changed after it was signed, which is why it is refused rather than downgraded; so is a signature file that cannot be read as a signature at all.

The verdict answers "who published this", never "is this safe to open". Every bundle, verified or not, goes through every check below.

## What is refused

Every refusal exits `1` **before anything is written**, and leaves no half-written project or temporary directory behind:

- an archive over **25 MiB** compressed, counted while it downloads (a `Content-Length` header is never trusted), or one that inflates past **100 MiB**;
- a file whose size or sha256 differs from what the bundle's manifest lists, a config whose hash differs, or a file the manifest does not list;
- a path that could lead out of the project: absolute, with a `..`, `.` or empty segment, a backslash or a NUL; and two files whose names differ only by letter case, since your disk may not tell them apart;
- anything that is not a regular file: a symbolic link, a hard link, a device or a named pipe;
- TypeScript (`.ts`, `.tsx`, `.mts`, `.cts`), anywhere: a TypeScript file is a program, and running one that arrived in a download is a different thing from opening a project;
- an executable: a file with an execute bit, or whose first bytes are a native program (ELF, Mach-O, PE) or a `#!` line;
- a config the schema rejects, reported without echoing the bundle's own values, and a bundle made by a newer Sovrium than yours, with an invitation to update Sovrium.

A directory entry in the archive is allowed and creates nothing by itself: the folders a project needs are created for the files that go in them. JavaScript under `public/` is allowed: it is content your app serves to a browser, and Sovrium never runs it. Every file is written without an execute, setuid or setgid bit, whatever the archive says.

## Look before you import: `--inspect`

```console
$ sovrium init --from-bundle https://example.com/s/crm --inspect --json
{"host":"example.com","name":"crm","size":184233,"sha256":"…","verdict":"verified","containsDemoData":true,"file":"/tmp/sovrium-bundle-x1Yz/crm.tar.gz"}
```

`--inspect` runs every check above, writes no project, and prints one JSON object on standard output: the host it came from (`null` for a file on disk), the app name, the compressed size in bytes, the archive's sha256, the verdict, whether it carries demo data, and `file`, the downloaded archive, kept in a temporary directory of its own under the name the server gave it in `Content-Disposition`, else the last segment of the address (never its query), else `bundle.tar.gz`. A refused bundle prints `{"verdict":"refused","reason":"…"}` and exits `1`. `--inspect` always prints JSON; `--json` beside it is accepted and changes nothing.

## Pin the bytes: `--expect-sha256`

```bash
sovrium init --from-bundle /tmp/sovrium-bundle-x1Yz/crm.tar.gz ./crm --expect-sha256 119d9c2f…
```

Refuses an archive whose sha256 is not the one given, before anything is written. Inspect, show the result to whoever decides, then import the kept file pinned to the sha256 that was inspected: the bytes approved are the bytes written, and the archive is not downloaded a second time.

## First run: `--with-demo-data`

```console
$ SOVRIUM_DATA_DIR=~/.sovrium-data/crm sovrium init --from-bundle ./downloads/crm.tar.gz ./crm --with-demo-data
…
Demo data loaded from seed/.
Created admin admin@localhost.sovrium. Its password is printed once below, and stored nowhere but as a hash.
{"email":"admin@localhost.sovrium","password":"q3V…"}
```

Once the project is written, `--with-demo-data` creates its admin and loads the demo data the bundle carries, so the app opens with something in it. The admin's address is always `admin@localhost.sovrium`; its password is random, and printed **once**, as the last line of standard output, one JSON object. Nothing writes it to a file: the database keeps only its hash. Keep it, or reset it later with `sovrium admin reset-password admin@localhost.sovrium`.

The data goes into the data directory `SOVRIUM_DATA_DIR` names, else the project's own `.sovrium/`, where `sovrium start` run in the project looks. It is a first run, never a second one: when that directory already holds a database, the import is refused before anything is written, and the database is left exactly as it was. It is also refused while `DATABASE_URL` is set, since that names a database the import cannot tell is empty; load the seed of such a project with `sovrium seed` instead.

A bundle with no `seed/` creates the admin only, and says so. An app with no `auth` gets its demo data and no admin. If the demo data cannot be loaded, the error is printed and the command exits `1`, after the admin's password, since that account exists.
