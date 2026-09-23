# Form Access Control

> Who may open a form and post to it — and why a role-restricted form answers 404 rather than 403.

A form is a public route by default. That is right for a contact form and wrong for an internal expense claim, a partner-only order sheet or a member survey, each of which needs its URL to answer differently depending on who asked.

```yaml
forms:
  - id: 2
    name: member-survey
    title: Member Survey
    submitTo: { table: survey_responses }
    access:
      require: authenticated
    fields:
      - { kind: standalone, name: rating, inputType: rating, required: true }
```

<!-- sovrium:options FormAccessSchema -->

`require` is `all`, `authenticated`, or an array of role names with at least one entry. Omitting the whole `access` block is the same as `all`.

A role array may also name a group, with a `group:` prefix — `['admin', 'group:partners']` admits anyone whose role is `admin` or who belongs to the `partners` group.

`redirectTo` is accepted and validated today; the canonical route currently answers a denial with the response below rather than a redirect.

## What a denied submitter gets

The gate applies to opening the form and to posting to it. The denial is deliberately not uniform.

| `require`        | Anonymous visitor        | Signed in, wrong role | Signed in, right role |
| ---------------- | ------------------------ | --------------------- | --------------------- |
| omitted or `all` | Allowed                  | Allowed               | Allowed               |
| `authenticated`  | `401` — sign-in required | Allowed               | Allowed               |
| a role list      | `404`                    | `404`                 | Allowed               |

The `401` names the form and the level it requires, because "sign in to use this" is a useful thing to tell a visitor.

### A role gate answers 404, and that is the feature

`403` would confirm the form exists to anyone who guessed its name, letting an outsider enumerate your internal forms by watching which URLs answer differently. A role-restricted form is simply not there for anyone lacking the role.

The practical consequence: when you hit an unexpected `404` on a form you know you configured, check the signed-in user's role before going looking for a routing bug.

## Access is what makes `$user` resolvable

Requiring authentication is what puts a session in front of the renderer, and therefore what makes a user reference resolvable. On a public form there is no session to read, so a user reference in the prefill map silently drops and the field renders empty.

The inline form of the same reference is stricter: a per-field default referencing the user on a public form is refused when the configuration is decoded, naming the form and the field. A value that can only ever resolve empty is a mistake worth catching before boot rather than a blank input worth shipping.

## Embedded forms

A form rendered inside a page keeps its own gate, and the page inherits the strictest answer: if any embedded form denies the session, the whole page answers `404`.

The alternative — rendering the page with a hole where the form should be — would leak the form's existence through the shape of the page, which is exactly what the role gate exists to prevent.

## Attribution follows the session

When a session is present, the ledger records the submitter's user id and a bound table's created-by column is populated with the same id. A public submission leaves both null, so access control is also what makes a submission attributable.
