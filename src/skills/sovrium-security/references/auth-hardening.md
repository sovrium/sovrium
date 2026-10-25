# Authentication hardening

## Contents

- Who may create an account
- Email verification
- Passwords and brute force
- Two-factor and passkeys
- Single sign-on and SCIM
- API keys and the CLI's device sign-in
- Sessions and the secrets behind them
- Account deletion
- Checks against your own running app

Manual: `sovrium docs auth/auth-overview`, `sovrium docs auth/auth-strategies`, `sovrium docs auth/auth-email-password`, `sovrium docs auth/auth-registration`, `sovrium docs auth/auth-two-factor`, `sovrium docs auth/auth-passkeys`, `sovrium docs auth/auth-sso`, `sovrium docs auth-accounts/auth-sessions`, `sovrium docs auth-accounts/api-keys`. Every option: `auth-options.generated.md`.

## Who may create an account

`auth.allowSignUp` defaults to `true`: anyone can self-register through every strategy the app enables. That is right for a public product and wrong for an internal tool, a customer portal or anything invited-only.

```yaml
auth:
  allowSignUp: false
  strategies:
    - type: emailAndPassword
  invitationTokenExpiry: 7d
```

- `false` closes every public door (email and password, magic link, email one-time codes, social providers, and SSO providers that do not set their own `allowSignUp`). Admins can still create users, and invitations still work.
- Every self-registered account gets `defaultRole` (`member` unless you set another). A table or bucket that grants `authenticated`, or that role by name, is therefore open to anyone who fills the sign-up form. Sovrium allows it on purpose (an open community is a real design) and says so at every boot in a `⚠ Open sign-up` line listing each reachable table, bucket and operation. Read that line on the deploy target.
- An invitation token defaults to 72 hours and is single-use.

**Decide**: who is the audience? Public product, keep sign-up and verify email. Anyone else, `allowSignUp: false` plus invitations, the admin create-user API, or an SSO provider.

## Email verification

`requireEmailVerification` on the `emailAndPassword` strategy defaults to `false`. With it on, sign-up creates the account but sign-in is refused until the emailed link is followed: it separates "anyone with a mailbox" from "anyone who can type an address".

It needs SMTP. With no SMTP configured, the app boots with email disabled, the message is never sent, and nobody who signs up can ever sign in. Check it on the deploy target. `autoSignIn` (default `true`) is moot once verification is required.

## Passwords and brute force

- `minPasswordLength` defaults to 8 and accepts 6 to 128; `maxPasswordLength` defaults to 128. Raise the minimum (12 or more is a sound floor). There is no composition rule (upper, lower, digit) to turn on; length is the lever.
- There is **no per-account lockout** after failed passwords. What exists: per-address limits on sign-in and sign-up, on password-reset requests and on every route that mails an address; a lockout on failed two-factor codes. If you need an account lockout, put it at the ingress.
- Magic links and email one-time codes send a sign-in to whoever controls the mailbox. Enable them only when the audience needs passwordless sign-in.

## Two-factor and passkeys

- `auth.twoFactor` enables TOTP for the `emailAndPassword` strategy; `backupCodes: true` gives recovery codes, without which a lost phone locks a person out of their own account.
- `auth.passkeys` adds WebAuthn sign-in. `requireForAdmin: true` admits an admin-tier account to the admin plane only from a session opened with a passkey; everything behind the admin plane answers `404` to its password session until it signs in again with the passkey. Over the app's MCP server, an admin then reaches the admin-only tools only with an OAuth token from a passkey session, never an API key.
- A page can tell a reader whether her account is protected: `visibility.condition` on `$user.twoFactorEnabled`.

## Single sign-on and SCIM

- `auth.sso` declares OpenID Connect or SAML providers in config only. The client secret is an `$env.NAME` reference; a literal is refused.
- `domains` lists the email domains a provider is authoritative for. An existing account on one of them is linked on its first SSO sign-in; an address on any other domain is never linked by email alone. Over OpenID Connect the provider must assert the address is verified. List only domains the provider really owns.
- A provider with no `domains` links nothing, but while sign-up is open any account it vouches for can create one. For a provider anyone can hold an account at, set that provider's `allowSignUp: false`.
- `roleMapping` gives a role from a claim at every sign-in; only an entry written in `map` grants a role. Map only claims the provider controls.
- `auth.scim` provisions users and groups; its bearer token is an `$env.NAME`, and any other token answers `404`.

## API keys and the CLI's device sign-in

- `auth.apiKeys: true` lets a signed-in user mint, list and revoke her own keys, sent on `x-api-key`. A key carries its owner's role, resolved on every request: demote or ban the person and the key narrows or stops. Keys are hashed at rest and shown once.
- `auth.deviceAuthorization` lets the `sovrium` CLI sign in with a short code a signed-in person approves. Turn it on only where people use the CLI against this app.

## Sessions and the secrets behind them

- Sessions are server-side and revocable. Signing out ends an OAuth access token at once.
- The session-signing secret is derived from the encryption key unless `AUTH_SECRET` is set. A new `AUTH_SECRET` signs everyone out and invalidates every signed link; a new encryption key also signs everyone out when `AUTH_SECRET` is not set, and leaves stored connection tokens unreadable. See `secrets-and-env.md`.

## Account deletion

A signed-in person can delete her own account: scheduled with a seven-day window, or at once by a mailed link when `auth.immediateAccountDeletion` is on (its default, when email works). The last admin who can sign in is refused. See `gdpr-and-retention.md`.

## Checks against your own running app

```
- [ ] Sign-up page and POST /api/auth/sign-up/email as nobody → refused when allowSignUp is false
- [ ] Sign up with verification on → no session until the mailed link is followed (needs SMTP on the target)
- [ ] A password one character under minPasswordLength → refused
- [ ] Twenty-one wrong passwords from one address → 429 with Retry-After
- [ ] An admin's password session with requireForAdmin → the admin plane answers 404 until a passkey sign-in
- [ ] A revoked API key → refused on the next request
- [ ] The boot banner → read the Open sign-up line, if any, and agree with every table it names
```
