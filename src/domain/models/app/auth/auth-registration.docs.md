# Registration Control

> Whether a stranger may create an account at all — a decision independent of which strategies are enabled.

Declaring a strategy says _how_ somebody authenticates. It does not say _whether_ they may create an account in the first place. `allowSignUp` is that second decision.

```yaml
auth:
  allowSignUp: false
  strategies:
    - type: emailAndPassword
```

| Value               | Behaviour                                                                    |
| ------------------- | ---------------------------------------------------------------------------- |
| `true`, the default | Anyone can self-register through the enabled strategies                      |
| `false`             | Self-registration is off; only an admin creates users, or an invitation does |

The default is `true` because it is the right answer for a public product. It is the wrong answer for most internal tools and every customer portal, where an account is something you are _given_ — leaving self-registration on there means anyone who finds the URL is one form away from a session.

`allowSignUp: false` applies to every way in: email and password, magic link, email one-time codes (an unknown address is sent no code), every social provider, and single sign-on providers that do not set their own `allowSignUp`. It closes the public door, not the admin one. Admin-driven user creation is always available once authentication is configured and is unaffected by this flag, as are invitations.

## Open sign-up reaches your tables

Every self-registered account receives `defaultRole` — `member` unless you set it. A table whose permissions admit `authenticated`, or that role by name, is therefore open to anyone willing to fill in the sign-up form. Sovrium does not refuse this, because an open community app is a legitimate design, but it says so at every boot: a `⚠ Open sign-up` line names the role, each reachable table and the operations it grants. Close it with `allowSignUp: false`, or reserve those permissions to roles a new account does not receive.

Buckets are named in the same line. A bucket that declares no `upload`, or no `download` and is not `public`, lets any signed-in caller upload to it or read every file in it, so the warning lists it with the operations a new account reaches, e.g. `contracts (upload, download)`. A bucket whose permissions name only roles a new account does not receive is left out, and so are a public bucket's reads, which are open to everyone already. Delete is not listed: in a bucket that declares no `delete`, a caller can only remove her own files.

## Onboarding with self-registration off

You still need a way to onboard real people that does not involve an admin inventing a password and transmitting it. An invitation is that path: an admin issues a single-use token, Sovrium emails a link, and the invitee sets their own password.

```yaml
auth:
  allowSignUp: false
  strategies:
    - type: emailAndPassword
  invitationTokenExpiry: 7d
```

`invitationTokenExpiry` is a duration string — a positive integer followed by `s`, `m`, `h` or `d` — or a bare number read as milliseconds. It defaults to `72h`, and anything else fails validation.

A shorter expiry suits a high-security portal; the default suits business onboarding, where an invitee may not check email the same day. Tokens are single-use either way, consumed on the first successful accept.

## Which path

| You want                                       | Set                                                 |
| ---------------------------------------------- | --------------------------------------------------- |
| A public product anyone can join               | `allowSignUp: true`, or omit it                     |
| A closed app, users onboarded by email         | `allowSignUp: false` plus invitations               |
| A closed app, accounts provisioned by a script | `allowSignUp: false` plus the admin create-user API |
| Federated-only access, no local accounts       | `allowSignUp: false` plus an OAuth strategy         |
