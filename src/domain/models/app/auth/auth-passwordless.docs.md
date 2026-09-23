# Magic Link & Email OTP

> Two ways to sign someone in without a password — a link they click and a code they type — enabled by two different mechanisms.

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

`expirationMinutes` defaults to `15`. That default assumes the user is waiting on the mail. Stretch it when your audience checks email on a phone, later; shorten it when the link grants access to something sensitive, since a live link sitting in an inbox is a live credential.

The message body is rendered from the `magicLink` email template when you supply one, with the link substituted into it.

## Email one-time codes

A numeric code instead of a link — better on a device where following a link would break the flow, and easier to read aloud over a phone.

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

Adding `type: emailOtp` to `strategies` is a **validation error**. The union accepts email-and-password, magic link and OAuth only, so a configuration that guesses at an OTP strategy fails validation rather than booting without the flow — which is the outcome you want, because the failure mode of the alternative is a sign-in screen nobody can get past.

## Both need SMTP

A passwordless flow that cannot send mail cannot sign anyone in. With SMTP unset the app boots with email disabled and logs a warning; sign-in attempts then fail silently, with the user waiting on a message that was never sent.

Configure SMTP before shipping either flow, and prefer keeping email and password declared alongside them while you do — it leaves a working way in if mail delivery breaks.
