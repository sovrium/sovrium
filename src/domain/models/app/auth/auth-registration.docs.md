# Registration Control

> Whether a stranger may create an account at all: a decision independent of which strategies are enabled.

Declaring a strategy says _how_ somebody authenticates. It does not say _whether_ they may create an account in the first place. `allowSignUp` is that second decision.

```yaml
auth:
  allowSignUp: true
  strategies:
    - type: emailAndPassword
```

| Value                         | Behaviour                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `true`                        | Anyone can self-register through the enabled strategies                                                        |
| `false`, or omitted (default) | Self-registration is off; an admin creates users, an invitation does, or the first-admin environment variables |

Sign-up is closed unless you open it. Most apps (internal tools, customer portals, client spaces) give an account rather than let one be taken, and an app that declared a sign-in way without thinking about sign-up should not hand a session to anyone who finds its URL. A public product writes `allowSignUp: true`.

A closed sign-up applies to every way in: email and password, magic link (an unknown address is sent no link), email one-time codes (an unknown address is sent no code), every social provider, and single sign-on providers that do not set their own `allowSignUp`. The magic-link strategy can also set its own `allowSignUp`, which wins over this one for links only. Closing sign-up closes the public door, not the admin one. Admin-driven user creation is always available once authentication is configured, as are invitations.

A page can follow the same decision: a component gated with `visibility: { declares: auth.signUp }` is drawn only while sign-up is open, and one gated with `unlessDeclares: auth.signUp` only while it is closed: a sign-in page's "Create an account" link, and the line saying how to get an account instead.

## Open sign-up reaches your tables

Every self-registered account receives `defaultRole`, which is `member` unless you set it. A table whose permissions admit `authenticated`, or that role by name, is therefore open to anyone willing to fill in the sign-up form. Sovrium does not refuse this, because an open community app is a legitimate design, but it says so at every boot of an app with `allowSignUp: true`: a `⚠ Open sign-up` line names the role, each reachable table and the operations it grants. Close it with `allowSignUp: false` (or by removing the key), or reserve those permissions to roles a new account does not receive.

Buckets are named in the same line. A bucket that declares no `upload`, or no `download` and is not `public`, lets any signed-in caller upload to it or read every file in it, so the warning lists it with the operations a new account reaches, e.g. `contracts (upload, download)`. A bucket whose permissions name only roles a new account does not receive is left out, and so are a public bucket's reads, which are open to everyone already. Delete is not listed: in a bucket that declares no `delete`, a caller can only remove her own files.

## What a new account may carry

Every way that creates an account (a password, a sign-in link, a sign-in code) applies the same profile rules. A name is stored as plain text, its markup removed. A profile picture cannot be chosen at sign-up: it is set later through the account avatar upload, and a social or single sign-on sign-in keeps the picture its provider supplies. A language must be one the app declares. The two operator-email switches start on and cannot be turned off at sign-up. A sign-up that breaks one of these is refused with a `400` and creates no account.

## Asking for the person's name

A sign-up form asks for an email and a password. List `name` in its action's `fields` to ask for the person's name as well: the form draws a required name input where the list places it, labelled by the entry's `label`, and the account carries the name that was typed. Without it, the account is named after the part of the address before the `@`.

```yaml
action:
  type: auth
  method: signup
  strategy: email
  fields:
    - { name: name, label: Full name }
    - { name: email, label: Email }
    - { name: password, label: Password }
```

## Onboarding with self-registration off

You still need a way to onboard real people that does not involve an admin inventing a password and transmitting it. An invitation is that path: an admin issues a single-use token, Sovrium emails a link, and the invitee sets their own password.

```yaml
auth:
  strategies:
    - type: emailAndPassword
  invitationTokenExpiry: 7d
```

`invitationTokenExpiry` is a duration string (a positive integer followed by `s`, `m`, `h` or `d`) or a bare number read as milliseconds. It defaults to `72h`, and anything else fails validation.

A shorter expiry suits a high-security portal; the default suits business onboarding, where an invitee may not check email the same day. Tokens are single-use either way, consumed on the first successful accept.

## Which path

| You want                                         | Set                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| A public product anyone can join                 | `allowSignUp: true`                                                 |
| A closed app, users onboarded by email           | Omit `allowSignUp` (or write `false`) plus invitations              |
| A closed app, accounts provisioned by a script   | Omit `allowSignUp` plus the admin create-user API                   |
| Federated-only access, no local accounts         | Omit `allowSignUp` plus an OAuth strategy                           |
| Accounts by email link only, no password sign-up | `{ type: magicLink, allowSignUp: true }` with `allowSignUp` omitted |
