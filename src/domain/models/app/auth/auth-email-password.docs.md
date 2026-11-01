# Email & Password

> The credential strategy: the password policy, verification before sign-in, and the one strategy two-factor authentication can sit on.

A user picks a password, it is validated and hashed server-side, and a session is issued on a successful match. It is the only strategy two-factor authentication can layer on, because TOTP enrols against a password credential.

```yaml
auth:
  strategies:
    - type: emailAndPassword
      minPasswordLength: 12
      maxPasswordLength: 128
      requireEmailVerification: true
      autoSignIn: true
```

<!-- sovrium:options EmailAndPasswordStrategySchema -->

Every property is optional: `- type: emailAndPassword` on its own is a valid, working strategy. `minPasswordLength` defaults to 8 and accepts 6 to 128; `maxPasswordLength` defaults to 128 and accepts 8 to 256. Both bounds are enforced at their own extremes, so a configuration cannot ask for a four-character minimum.

The minimum is also said where it applies. Every password field that sets a password (signing up, choosing a new password from a reset link, accepting an invitation, and any page form field marked `autocomplete: new-password`) shows "At least 8 characters" under it, with your `minPasswordLength` in place of 8, worded in the page language. The sign-in field asks for a password the reader already has and shows nothing.

## Verification before sign-in

With `requireEmailVerification: true`, signing up creates the account but not a usable session. A verification email is sent, rendered from the `verification` template, and sign-in is refused until the link is followed.

```yaml
auth:
  strategies:
    - type: emailAndPassword
      requireEmailVerification: true
  emailTemplates:
    verification:
      subject: Confirm your email for MyApp
      text: 'Hi $name, confirm your email: $url'
```

This is the setting that separates "anyone with an email box" from "anyone who can type an address". Turn it on for public sign-up. It matters less when accounts are created by an admin, who can mark the address verified at creation.

It is on by default when the app also offers a federated way in (an `oauth` strategy or an `auth.sso` provider), and off otherwise. A federated provider links an existing account by its email address, so an account opened with a password on an address its owner never confirmed would otherwise be handed that owner's identity at their first federated sign-in. Write `requireEmailVerification: false` to turn it off beside a provider anyway, for instance when every account is created by an admin.

**Verification needs SMTP.** With no SMTP configured the app boots with email disabled, the message is never sent, and a user who signs up under this setting can never complete sign-in. That combination is worth checking on the deploy target rather than locally.

## Auto sign-in

`autoSignIn` defaults to `true`: a successful sign-up issues a session immediately, so the user never types the password they just chose.

Set it to `false` to return them to the sign-in form instead. That is worth doing when signing up is a privileged act you want re-authenticated, and unavoidable in practice when verification is required, since there is nothing to sign into yet.

## Password reset ships with the strategy

There is nothing to enable. A reset request emails a single-use link rendered from the `resetPassword` template, and an admin can also set a password directly through the admin API. The link opens the first of your pages that holds the form choosing the new password (`action: { type: auth, method: setNewPassword }`), carrying its token; with no such page it opens `/reset-password/new`, the address of the `auth-password-reset-new` block.

The way to the request is drawn for you too. When one of your pages holds the form that asks for a reset link (`action: { type: auth, method: resetPassword }`) and the instance has outgoing mail configured, every email sign-in form (`method: login`, `strategy: email`) draws "Forgot your password?" at the end of its Password label row, above the field, linking to that page, in the page's language. With no such page, or with no outgoing mail, the row holds the label alone, so the link never leads to a page that is not there or to a reset email that never leaves. There is no option to set, and no link to author beside the form.

## Changing the account's email

A signed-in user moves their account to another address with `POST /api/auth/change-email` and a `newEmail`. Two things guard the move, because whoever holds the address receives every password reset that follows:

- **It needs a recent sign-in.** A session older than a day answers `403` with the code `SESSION_NOT_FRESH`, and the address stays as it is: sign in again, then ask.
- **The current address agrees first.** When the current address is verified, it receives a message naming the new address, with a link to confirm. Nothing is sent to the new address until that link is followed; the new address then receives its own message, and following that one moves the account. Ignoring the first message leaves everything as it was. See [Email Templates](/en/docs/auth-email-templates) for the wording.

A new address on a domain an identity provider owns is refused outright; see [Single Sign-On](/en/docs/auth-sso).
