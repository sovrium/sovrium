# Two-Factor Authentication

> Time-based one-time passwords on top of the credential strategy — the issuer name, backup codes, and the two values not to change.

Users add a second factor with an authenticator app and enter a rotating code at sign-in.

```yaml
auth:
  strategies:
    - type: emailAndPassword
  twoFactor:
    issuer: MyApp
    backupCodes: true
```

Configuring this **without** an email-and-password strategy fails validation at startup. TOTP enrols on top of a password credential, so there would be nothing to enrol against.

## Enabling it

The simplest form is a boolean, which enables it with the defaults:

```yaml
auth:
  strategies:
    - type: emailAndPassword
  twoFactor: true
```

The object form takes control of the issuer name, backup codes and code format.

<!-- sovrium:options TwoFactorConfigSchema -->

`issuer` is the name shown in the user's authenticator app, which is what tells them which account an entry belongs to when they have thirty of them. Left out, it is the app's display name — its `name` title-cased, as `$app.label` prints it, so `atelier-marceau` enrols as **Atelier Marceau**. `digits` accepts **6 or 8 and nothing else**, and defaults to 6; `period` is any positive number of seconds and defaults to 30.

That list is closed deliberately. Authenticator apps implement the two standard lengths, so a 5 or a 7 would decode happily and then produce codes no app generates — refusing them at validation is the only place a configuration author finds out.

Keep both defaults unless you have a specific compatibility need: they are what nearly every authenticator app expects, and a non-standard `period` confuses some of them in ways the user experiences as "the code is always wrong".

## Backup codes

With `backupCodes: true`, users receive a set of single-use recovery codes during enrolment — essential when they lose access to the authenticator device, which is the most common way a second factor locks somebody out of their own account.

Delivery is customised through the `twoFactorBackupCodes` email template.

```yaml
auth:
  strategies:
    - type: emailAndPassword
  twoFactor:
    issuer: MyApp
    backupCodes: true
  emailTemplates:
    twoFactorBackupCodes:
      subject: Your MyApp recovery codes
      text: 'Keep these recovery codes safe: $codes'
```

The codes substitute into **`$codes`**, plural. Any other spelling is left in the message verbatim, so the recipient receives the word rather than the codes — and finds out only when the authenticator is already lost.

## A new set of recovery codes

A reader who has used some of her codes, or fears they were seen, replaces the whole set from a form whose auth action is `regenerateBackupCodes`. It asks for her password, then shows the new codes once — closing them asks her to confirm she saved them — and mails them through the same `twoFactorBackupCodes` template. From then on none of the previous codes signs anyone in. The form is refused on an account that has not turned two-step verification on.

```yaml
components:
  - type: form
    action:
      type: auth
      method: regenerateBackupCodes
      submitLabel: Regenerate codes
      onSuccess: { navigate: /settings/security }
```

## The enrolment flow

1. The user signs in with email and password as usual.
2. They enrol, and the app shows a TOTP secret — typically as a QR code — labelled with `issuer`.
3. They scan it into an authenticator app, which starts generating a code every `period` seconds.
4. On later sign-ins, the code follows the password step.
5. Where they are enabled, a backup code provides the recovery path when the device is unavailable.

The code field of a `verifyTwoFactor` form with `factor: totp` is marked `autocomplete="one-time-code"` with a numeric keyboard, so a phone offers the code it just received; a `backupCode` form is not autofilled. Two such forms can sit on one page — the code, and the recovery code folded under a link — and each keeps its own error message.

## Showing whether it is on

`$user.twoFactorEnabled` is `true` for a reader who has turned two-step verification on and `false` for one who has not, so a security card can show the right half to each with `visibility.condition` and a boolean `value`:

```yaml
components:
  - type: card
    children:
      - type: text
        content: 'An authenticator app is protecting your account.'
        visibility:
          when: authenticated
          condition: { field: $user.twoFactorEnabled, operator: eq, value: true }
      - type: form
        visibility:
          when: authenticated
          condition: { field: $user.twoFactorEnabled, operator: eq, value: true }
        action:
          type: auth
          method: disableTwoFactor
          submitLabel: Disable
          onSuccess: { navigate: /settings/security }
      - type: form
        visibility:
          when: authenticated
          condition: { field: $user.twoFactorEnabled, operator: eq, value: false }
        action:
          type: auth
          method: enableTwoFactor
          submitLabel: Enable
          onSuccess: { navigate: /settings/security }
```

The condition is judged when the page is served. Each form names its own page in `onSuccess.navigate`, so the card turns over as soon as the reader closes the recovery codes or turns two-step off, without her reloading.

## The sign-in pages

When a password is right but a code is still owed, the sign-in is not finished. Two layouts are possible.

**The code on its own page.** Name that page in `onTwoFactor.navigate` on the sign-in form, and an account owing a code is sent there; an account without two-step signs in at once and never sees a code field.

```yaml
pages:
  - name: sign-in
    path: /sign-in
    components:
      - type: form
        action:
          type: auth
          method: login
          strategy: email
          onSuccess: { navigate: /apps }
          onTwoFactor: { navigate: /two-step }
  - name: two-step
    path: /two-step
    components:
      - type: form
        action:
          type: auth
          method: verifyTwoFactor
          factor: totp
          onSuccess: { navigate: /apps }
```

The code form's `onSuccess.navigate` decides where the reader lands. When it names none, she lands where the sign-in form was headed: that destination is kept on the server with the waiting sign-in, not carried in the code page's address. `onTwoFactor.navigate` is a path on this app, with no query or fragment; `sovrium validate` refuses another site.

Opened with no sign-in waiting — a visitor who came straight to it, or one whose sign-in lapsed after its ten minutes — the code page says `Your sign-in has expired — start again.` with a `Back to sign in` link to the app's sign-in page (`auth.loginPage`, `/login` by default), and shows no code field. The notice is all the page offers of its code forms: a second code form (a recovery code), the toggle that opened it, the sentence introducing the field and another link to the sign-in page are left out, so a page holding two code forms says it once, with one way back. The page title stays. With a sign-in waiting, the code field has the focus as the page opens. A code typed after the sign-in lapsed gets the same notice. Both follow the page language and are renamed under `sovrium.twoFactor.attemptExpired` and `sovrium.twoFactor.signInAgain`.

**The code on the sign-in page.** Without `onTwoFactor`, the sign-in form stays where it is and says `Two-step verification is on — enter your code to finish signing in`, and a `verifyTwoFactor` form on the same page finishes the sign-in. That message follows the page language, and an app renames it like any other engine string, under `languages.translations[<lang>]['sovrium.twoFactor.pendingSignIn']`.
