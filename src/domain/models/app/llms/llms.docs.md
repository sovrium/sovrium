# Publish llms.txt

> Serve your app's documentation to AI assistants at `/llms.txt` and `/llms-full.txt` — auto-derived from your content pages, with optional overrides.

[llms.txt](https://llmstxt.org) is a convention for serving documentation to AI assistants as plain text at well-known URLs. When your app publishes markdown content, Sovrium can expose it that way with no work from you.

Two routes are served:

| Route            | Contents                                                                      |
| ---------------- | ----------------------------------------------------------------------------- |
| `/llms.txt`      | A compact index — the site title, a one-line description, and links to pages. |
| `/llms-full.txt` | Every page's full markdown body, concatenated. No index, no links — bodies.   |

Both are derived from your content-directory pages, so a documentation site gets them automatically. **The trigger is a page declaring `contentDir`**: an app with none serves neither route, and `llms.enabled: true` does not conjure them — there would be nothing to index. Set `enabled: false` to withhold the routes from an app that does have content.

## Configuration

The whole `llms` block is optional. Declare it only to turn the feature off, or to override what the generated header says.

```yaml
llms:
  title: Acme Handbook
  description: Everything the team needs to know.
  full: true
```

<!-- sovrium:options LlmsSchema -->

Two of the defaults are inherited rather than fixed, so they are worth stating
in words: `title` falls back to the app's own `name`, and `description` falls
back to the app's `description`. An app that declares neither still gets a
blockquote — the generated sentence `Documentation and content for <name>.` —
because the llmstxt.org format expects one and an empty blockquote reads as a
broken document rather than as an absent description.

Turning `full` off is the usual adjustment for a large corpus — the index stays useful while the concatenated body, which can run to thousands of lines, is not served.

```yaml
llms:
  full: false
```

## One language per route

An app that declares `languages` serves one language per address, so an agent
reads the documentation once in the language it asked for instead of paying for
every translation at once.

| Route                   | Contents                           |
| ----------------------- | ---------------------------------- |
| `/llms.txt`             | The index for `languages.default`  |
| `/llms-full.txt`        | The bodies for `languages.default` |
| `/{lang}/llms.txt`      | The index for that language        |
| `/{lang}/llms-full.txt` | The bodies for that language       |

Every code you declare under `languages.supported` answers, the default one
included, so an address can be built from a language code with no special case.
A code you do not declare returns 404, exactly as an undeclared `/{lang}/` page
URL does.

A page belongs to a language by the `/{lang}/` prefix in its own `path`. A page
with no such prefix is language-neutral: it appears in every language's file
_and_ at the root. That is why an app declaring no `languages` is unaffected —
nothing carries a prefix, so the root keeps serving every content page.

It is also why a collection you declare once per language over one shared
directory — a changelog written in one language and linked from both — is
listed once per route rather than twice in one.

## Verify

```bash
curl -fsS http://localhost:3000/llms.txt | head -20
```

Every content page you expect should appear as a link. A page missing from the index is a page outside a content directory.

## This is your app's llms.txt, not Sovrium's

The `llms` block configures the file _your_ app serves to _its_ readers. Sovrium's own manual is not published this way — it ships inside the binary and is read with `sovrium docs`, which needs no network at all.
