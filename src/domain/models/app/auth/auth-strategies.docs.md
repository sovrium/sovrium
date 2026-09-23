# Strategies Overview

> The required `strategies` array — the three ways in, how to choose between them, and the two rules the decoder enforces.

`strategies` declares how users authenticate. Each entry is discriminated by `type`, and **no two entries may share a type**: a strategy is configured once or not at all.

```yaml
auth:
  strategies:
    - type: emailAndPassword
    - type: oauth
      providers: [google, github]
```

That block accepts credential sign-in **and** federated sign-in. Users arriving by either route land in the same account store, with the same roles and the same sessions.

<!-- sovrium:options AuthStrategySchema -->

| `type`             | Sign-in feels like           |
| ------------------ | ---------------------------- |
| `emailAndPassword` | A password form              |
| `magicLink`        | A one-time link in the inbox |
| `oauth`            | A "continue with…" button    |

## Choosing

The array is additive: every declared strategy is offered, and one user may hold credentials for several. Pick by what your users already have.

| Situation                                               | Declare                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| An internal tool whose staff already have work accounts | `oauth` alone — no password to leak, no reset flow to build |
| A customer portal with occasional logins                | `magicLink` alone — nothing for a customer to forget        |
| You need two-factor authentication                      | `emailAndPassword` — TOTP enrols against a password         |
| A mixed audience, some federated and some not           | `emailAndPassword` **and** `oauth`                          |

Both passwordless flows send mail. With SMTP unset the app still boots, with email disabled and a logged warning — and those strategies then fail to deliver silently, which looks from the outside like a broken sign-in rather than a missing environment variable.

## What the decoder enforces

Two rules are checked when the configuration is decoded, so validation catches a malformed block offline:

- **At least one strategy.** An empty array is refused. Omitting `auth` entirely is how an app runs with no authentication at all.
- **No duplicate type.** Two email-and-password entries would make the effective password policy ambiguous, and there is no defensible way to pick one.

A third rule reaches across the block: configuring two-factor authentication without an email-and-password strategy is refused, because TOTP enrols on top of a password credential and there would be nothing to enrol against.
