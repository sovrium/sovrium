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

`issuer` is the name shown in the user's authenticator app, which is what tells them which account an entry belongs to when they have thirty of them. `digits` accepts **6 or 8 and nothing else**, and defaults to 6; `period` is any positive number of seconds and defaults to 30.

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

## The enrolment flow

1. The user signs in with email and password as usual.
2. They enrol, and the app shows a TOTP secret — typically as a QR code — labelled with `issuer`.
3. They scan it into an authenticator app, which starts generating a code every `period` seconds.
4. On later sign-ins, the code follows the password step.
5. Where they are enabled, a backup code provides the recovery path when the device is unavailable.
