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

`allowSignUp: false` closes the public door, not the admin one. Admin-driven user creation is always available once authentication is configured and is unaffected by this flag, as are invitations.

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
