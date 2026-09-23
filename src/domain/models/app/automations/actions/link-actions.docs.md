# Link Actions

> Minting, re-pointing and retiring a tracked short link from inside a workflow — the address a later step receives, and the three refusals that fail the step.

A campaign link for a product that did not exist at deploy time cannot be declared in configuration. This is how one gets made. Three operators.

| Operator | Props                                                              | Does                                                                  |
| -------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `create` | `slug`, `destination`, `title?`, `tags?`, `notes?`, `utm?`         | Mints a link and returns its address                                  |
| `update` | `slug`, plus any of `destination`, `title`, `tags`, `notes`, `utm` | Re-points or re-labels an existing link; omitted props are left alone |
| `delete` | `slug`                                                             | Retires a link, softly — the click history survives                   |

<!-- sovrium:options LinkActionSchema -->

```yaml
- name: mint
  type: link
  operator: create
  props:
    slug: 'product-{{trigger.record.handle}}'
    destination: 'https://example.com/products/{{trigger.record.handle}}'
    title: '{{trigger.record.name}} — launch'
    utm: { source: newsletter, medium: email, campaign: launch }

- name: announce
  type: email
  operator: send
  props:
    to: '{{trigger.record.owner_email}}'
    subject: 'Your link is live'
    body: '{{steps.mint.result.shortUrl}}'
```

## What a later step receives

`create` and `update` return four fields; `delete` returns the slug and whether anything changed.

| Field         | Value                                 |
| ------------- | ------------------------------------- |
| `slug`        | The resolved slug, after templates    |
| `destination` | Where the link now points             |
| `shortUrl`    | The absolute address                  |
| `qrUrl`       | The absolute QR code for that address |

Both URLs are **absolute**, deliberately. They are minted to be pasted into an email, an SMS or a PDF, where a root-relative path has no page to resolve against and is simply a dead string. The origin comes from `BASE_URL` where it is set, otherwise from the address the server actually bound to, and only then from localhost and the port — so set `BASE_URL` in production, because it is what the link a customer clicks will carry.

## Templates resolve first, then are checked

Every string property is a template, and the **resolved** value is what gets validated. That ordering is what makes the action safe to template freely: a slug is checked against the slug rules after the interpolation, so a record whose handle is not slug-shaped fails the step instead of storing an address nobody can reach.

A destination is checked the same way — the resolved value must be a root-relative path or an absolute `http` or `https` URL, so a `javascript:` or `data:` value arriving through a record field is refused rather than minted.

## The three slugs an automation cannot write

Each refusal fails the step with its reason named, so a failed run says which one happened.

| Refusal                   | Meaning                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `LINK_RESERVED_SLUG`      | The slug is `overview` or `series`, which the console's own API claims |
| `LINK_IS_CONFIG_DECLARED` | The slug is declared in the `links` block; edit the config file        |
| `LINK_SLUG_TAKEN`         | A live link already holds it; pick another slug                        |

A reserved slug is checked **first**, and refused whether or not the config also declares it — "edit the file" would be advice that does not help, because the collision is with `/api/admin/links/overview` and `/api/admin/links/series` rather than with anything you wrote. A link minted under either name would resolve publicly and be invisible to the operator who owns it.

`LINK_IS_CONFIG_DECLARED` is the one that matters most in practice. Configuration is the source of truth for the links it declares, and an automation that could mint over one would be config mutation through a data-shaped side door. `update` and `delete` refuse a config-declared slug for the same reason: they touch only links created at runtime.

`LINK_SLUG_TAKEN` is a refusal rather than an overwrite. Minting the same slug twice keeps the first link, because re-pointing an address people have already shared — and re-attributing the clicks it has already earned — is not something a repeated trigger should do by accident. Use `update` when re-pointing is what you mean, and `continueOnError: true` where a refused mint should not stop the workflow.

## Delete keeps the history, and there is no rename

`delete` is soft: the link stops resolving and answers `404`, while every click it already earned stays in analytics under the same slug. A hard delete would destroy the campaign record along with the link.

Deleting twice succeeds, reporting that nothing changed, so a workflow that runs again does not break. A retired slug can be minted again later.

There is no rename. The slug is the address every share already carries and the key every click is recorded under, so changing it would break the shares and orphan the history in one move. Mint a new link instead.
