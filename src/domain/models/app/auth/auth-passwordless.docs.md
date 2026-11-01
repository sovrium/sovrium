# Magic Link & Email OTP

> Two ways to sign someone in without a password (a link they click and a code they type), enabled by two different mechanisms.

Both prove control of an inbox. Neither stores a password, so neither has a password to leak or reset.

They are enabled differently: the link is a strategy entry, the code is not. That asymmetry is the one thing to get right here.

## Magic link

A strategy entry. The user submits their email, receives a one-time link, and is signed in by following it.

```yaml
auth:
  strategies:
    - type: magicLink
      expirationMinutes: 30
```

<!-- sovrium:options MagicLinkStrategySchema -->

`expirationMinutes` defaults to `15` and is at most `60`; validation refuses a longer link. That default assumes the user is waiting on the mail. Stretch it when your audience checks email on a phone, later; shorten it when the link grants access to something sensitive, since a live link sitting in an inbox is a live credential. Whatever you set, the default magic-link mail tells its reader how long the link lasts.

A link asked for an address that has no account creates that account only while sign-up is open. `allowSignUp` on the strategy decides it for links alone and wins over `auth.allowSignUp`, which is closed unless the config opens it: `false` sends links to existing accounts only while the password sign-up stays open, and `true` lets a newcomer's link create the account while every other way stays closed. An address that gets no link receives the same answer as one that does, in the same time (the mail goes out after the answer), so the form tells nobody which addresses have an account.

The database keeps a hash of each link's token and of each sign-in code, never the link or the code itself: a copy of the database signs nobody in.

On an account with two-step verification turned on, a link or a code is the first step only, as a password is: the reader still enters the code from her authenticator app (see Two-Factor Authentication).

```yaml
auth:
  strategies:
    - type: magicLink
      allowSignUp: true
    - type: emailAndPassword
```

The message body is rendered from the `magicLink` email template when you supply one, with the link substituted into it.

A sign-in link signs in whichever browser opens it, so tell your users to open only links they asked for themselves.

A page sign-in form enables it with `action: { type: auth, method: login, strategy: magicLink }`. Such a form asks for an email address only and sends the link on submit; on an app that also offers passwords, each form follows the strategy it declares.

```yaml
pages:
  - name: sign-in
    path: /sign-in
    components:
      - type: form
        action: { type: auth, method: login, strategy: magicLink }
```

A form that declares its own `fields` keeps them.

Once the link is sent the form shows a confirmation banner: your `onSuccess.toast.message`, or a built-in sentence. Declare `onSuccess: { type: successPage, title, message }` instead and the form gives way to that page: the title as a heading and the message under it, with no field left to fill again. `$form.<field>` in either prints what the reader typed into that field, as plain text, and a field the form does not have prints nothing. A password-reset request form (`method: resetPassword`) takes the same success page.

```yaml
- type: form
  action:
    type: auth
    method: login
    strategy: magicLink
    onSuccess:
      type: successPage
      title: Check your inbox
      message: We sent a sign-in link to $form.email.
```

## Email one-time codes

A numeric code instead of a link. It is better on a device where following a link would break the flow, and easier to read aloud over a phone.

**There is no `emailOtp` strategy entry.** The flow activates when you define the `emailOtp` email template: its presence is what mounts the plugin.

```yaml
auth:
  strategies:
    - type: emailAndPassword
  emailTemplates:
    emailOtp:
      subject: Your sign-in code
      text: 'Your verification code is $otp. It expires shortly.'
```

The code substitutes into **`$otp`**. Any other spelling is left in the message verbatim, so a template written around `$code` mails the characters `$code` to the user and the sign-in cannot be completed.

Note that the strategy array above declares only email and password: the code flow rides alongside whatever strategies you declared rather than replacing them.

Adding `type: emailOtp` to `strategies` is a **validation error**. The union accepts email-and-password, magic link and OAuth only, so a configuration that guesses at an OTP strategy fails validation rather than booting without the flow. That is the outcome you want, because the failure mode of the alternative is a sign-in screen nobody can get past.

## Limits on mail and codes

One address receives at most five sign-in links and codes per rate-limit window (`RATE_LIMIT_WINDOW_SECONDS`, 60 seconds unless set), counted together with password-reset and verification mails, whichever client asks. The request past that answers `429` and sends nothing.

A mailed code allows three wrong attempts, and an address allows ten attempts that do not succeed across all its codes in fifteen minutes. After that, every route that checks a code refuses that address with `429` and `code: "TOO_MANY_CODE_ATTEMPTS"` until the oldest of those attempts is fifteen minutes old, even with the right code. A right code clears the count. Anyone who knows an address can trigger that lock, so keep a password or a passkey available to the accounts that cannot afford to wait. The full table of limits is in the security hardening guide.

## Both need SMTP

A passwordless flow that cannot send mail cannot sign anyone in. With SMTP unset the app boots with email disabled and logs a warning; sign-in attempts then fail silently, with the user waiting on a message that was never sent.

Configure SMTP before shipping either flow, and prefer keeping email and password declared alongside them while you do: it leaves a working way in if mail delivery breaks.
