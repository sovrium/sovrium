# Public surfaces

## Contents

- Inventory first
- Pages
- Forms
- Buckets and files
- Tables an anonymous visitor writes to
- Record ids are not secrets
- Inbound webhooks and outbound redirects
- Checks against your own running app

Manual: `sovrium docs pages/pages-layouts-access`, `sovrium docs form-delivery/form-access`, `sovrium docs form-delivery/form-anti-spam`, `sovrium docs form-delivery/form-availability`, `sovrium docs buckets/buckets-permissions`, `sovrium docs files/file-security`, `sovrium docs file-access/signed-urls`, `sovrium docs components/action-allow-origins`.

## Inventory first

List every address an anonymous visitor can reach and what each one reads or writes. In a Sovrium app the open-by-default ones are:

| Surface             | Default                                                                                            | What closes it                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| A page              | `access` omitted means everyone                                                                    | `access: authenticated`, a role list, or `{ require, redirectTo }` |
| A form              | `access` omitted means everyone may open and submit it                                             | `forms[].access.require`                                           |
| A table             | no `permissions` block: every non-viewer role; anonymous gets nothing unless an operation is `all` | the table's block (`sovrium-data-model`)                           |
| A bucket            | upload and download for any signed-in caller; downloads for everyone when `public: true`           | `upload`, `download`, `delete` grants                              |
| Signing a file link | admin only                                                                                         | widened only by `sign` or `signUpload`                             |
| An agent            | any signed-in caller, never anonymous                                                              | `permissions.trigger`                                              |

## Pages

- A page's `access` gates who may load it. A signed-in person without the role gets `404`; an anonymous visitor is sent to `redirectTo` when one is set.
- `access` protects the page, not the data. A `dataSource` filter, a hidden column or a component's `visibility` changes what the page draws; the records API keeps answering whatever the table's permissions allow. Put the rule on the table, then test the API.
- A component whose `visibility` is not met is left out of the HTML entirely, not hidden with CSS. That is a presentation choice; it is still not the permission.
- A page that embeds a role-gated form answers `404` as a whole to someone the form refuses.

## Forms

- A form with no `access` is a public write endpoint. Decide, form by form, whether it should be.
- `require: authenticated` answers `401` to an anonymous visitor (it names the form, which is useful); a role list answers `404` to everyone without the role.
- Anti-spam is on by default: a honeypot field, and a rate limit per address and per form over a rolling window. Writing an `antiSpam` block with only a rate limit keeps the honeypot. `honeypot: false` is the only way to turn the trap off; never on a public form.
- A refused submission tells the client nothing specific; the reason is on the submission ledger. The submitter's address is stored only as a salted hash.
- `availability` closes a form on a date or after `maxSubmissions`. A `closedPage.cta.href` takes only an `http(s)` address or a path on this site.
- There is no "one submission per person" switch. A unique constraint on the bound table's column is the only rule a race cannot beat.
- A public form stamps its rows `system`, so they belong to nobody: they are not in anyone's export and not removed by anyone's erasure.

## Buckets and files

Write the grants with `sovrium-data-model`, `references/permissions.md`; check here that they exist and match the audience.

- An undeclared `upload` lets any signed-in caller add files; an undeclared `download` lets any signed-in caller read every file unless the bucket is `public`. Undeclared `delete` and replacing a file at its key fall back to the file's uploader or an admin.
- `public: true` opens downloads to everyone and nothing else. In an app with **no `auth` block**, a public bucket also accepts anonymous uploads.
- `sign: all` or `signUpload: all` lets anyone, signed in or not, mint a signed link for the bucket. Use it only when minting links for the public is the intent.
- Every upload is checked by filename, size (`maxFileSize`, else a platform cap) and `allowedMimeTypes` before the permission gate. Restrict the MIME types of any bucket the public can write to.

## Tables an anonymous visitor writes to

A table with `create: all` lets visitors add rows through the records API, limited per address and per table. Use it only for genuinely public submissions, prefer a form (it has the honeypot and the ledger), and never pair it with a wide `read`.

## Record ids are not secrets

A record id is a counting integer. The `404` hides whether a record exists; it does not hide the id space. A link like `/rate?ticket=42` lets its holder try `43`. Anything one person alone should reach needs a permission check (a row-level rule, an owner field), not an id in the URL.

## Inbound webhooks and outbound redirects

- An inbound webhook trigger is authenticated with the sender's HMAC scheme or a token from `$env`, and deduplicated. Write it with `sovrium-automations`, `references/reliability.md`; here, check that no webhook trigger is unauthenticated.
- An action that sends the browser to an address its run returned (a payment checkout) does so only to the exact origins `onSuccess.allowOrigins` lists. List the provider's checkout origin, never a wildcard.

## Checks against your own running app

```
- [ ] Each page, anonymous            → 200 only where access is all, otherwise 404 or the redirect
- [ ] Each form, anonymous and as a role it excludes → 401 or 404 as designed
- [ ] A public form, submitted fast from one address → 429 after the limit
- [ ] Each bucket: upload and download as a signed-in user of the lowest role → refused where it should be
- [ ] The file another user uploaded, as a second account → 404 unless the grant says otherwise
- [ ] POST /api/tables/<t>/records anonymous → 401, except on a table with create: all
- [ ] A record page reached by editing its id → 404 for a record that is not the caller's
```
