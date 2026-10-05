# Email Templates

> The subject and body of every authentication email — and the one template whose mere presence turns a sign-in flow on.

Authentication emails are the part of a product a user reads before they have ever seen the app. `emailTemplates` replaces the defaults with your own wording.

Every template is optional: a sensible default ships for each, so an app that sets none still sends working mail. The defaults speak for your app, not for Sovrium: their subjects and greetings use the app's `name` — `Reset your MyApp password`, `Verify your MyApp email address`, `Welcome to MyApp!` — and an invitation reads `You are invited to join <organisation> on MyApp`.

```yaml
auth:
  strategies:
    - type: emailAndPassword
    - type: magicLink
  emailTemplates:
    verification:
      subject: Verify your email for $appName
      text: 'Hi $name, confirm your email: $url'
    resetPassword:
      subject: Reset your password
      text: 'Reset your password: $url'
      html: '<p>Click <a href="$url">here</a> to reset your password.</p>'
    magicLink:
      subject: Your sign-in link
      text: 'Sign in to MyApp: $url'
```

## The eight templates

<!-- sovrium:options AuthEmailTemplatesSchema depth=1 -->

| Template               | Sent when                                 |
| ---------------------- | ----------------------------------------- |
| `verification`         | An address needs verifying after sign-up  |
| `resetPassword`        | A password reset is requested             |
| `magicLink`            | A magic-link sign-in is requested         |
| `emailOtp`             | A one-time code is issued — and see below |
| `twoFactorBackupCodes` | Backup codes are delivered at enrolment   |
| `welcome`              | Verification completes                    |
| `accountDeletion`      | An immediate account deletion is asked    |
| `invitation`           | An admin issues an invitation             |

**`accountDeletion` carries the confirmation link for an immediate account deletion.** Variables: `$url` (the link, valid 24 hours, single use), `$name`, `$email`, `$appName`. When omitted, a default is sent. Nothing is mailed after the erasure itself: the address is part of what it removes.

> **Upgrade note.** Up to 0.29.1, `accountDeletion` was a notice sent after an account deletion went through, so a template written for it — « your account has been deleted » — carries no `$url`. It is now the email that asks the user to confirm, and a copy with no `$url` reaches the user with no link to follow: the deletion can never be confirmed. Before the new version starts — after `sovrium update`, while `sovrium validate` checks the config — rewrite a custom `accountDeletion` as a confirmation request that includes `$url`, or delete it to send the default.

While `auth.immediateAccountDeletion` is on, a custom `accountDeletion` must carry `$url` in every part it supplies — `text`, `html` — and supply at least one; `sovrium validate` and the server's start refuse it otherwise, naming the part. With `immediateAccountDeletion: false` it is never sent, and not checked.

**`emailOtp` is not merely cosmetic.** Defining it _enables_ the one-time-code sign-in flow; there is no strategy entry for it. Every other template only changes the wording of a flow you already turned on.

## The shape of one template

<!-- sovrium:options AuthEmailTemplateSchema -->

`subject` is required; `text` and `html` are both optional and may both be supplied, which gives the recipient's client a choice.

Supplying only `text` is the safest default. It renders everywhere, and it never trips a spam filter on its markup — which for a sign-in link is the difference between a working product and a support ticket.

## Variables

Subjects and bodies substitute `$variable` references. Which ones carry a value depends on the email being sent: a code is meaningless in a password reset, and an inviter's name exists only in an invitation.

| Variable            | Carries                                                    |
| ------------------- | ---------------------------------------------------------- |
| `$url`              | The action link — verify, reset, magic link, accept        |
| `$name`             | The recipient's name, or `there` when the account has none |
| `$email`            | The recipient's address                                    |
| `$otp`              | The one-time sign-in code, in `emailOtp`                   |
| `$codes`            | The recovery codes, in `twoFactorBackupCodes`              |
| `$organizationName` | The organisation's name, in an invitation                  |
| `$inviterName`      | The name of the admin who sent an invitation               |
| `$appName`          | The app's `name`, in every email                           |

That is the whole list. A reference outside it is left in place verbatim — writing `$code` puts the characters `$code` in the reader's inbox where the sign-in code should be, which is why the two code variables are spelled out separately above rather than sharing one name.

A variable that _is_ on the list but carries nothing for the email being sent substitutes to an empty string, so it disappears rather than showing its own name.

```yaml
auth:
  emailTemplates:
    invitation:
      subject: '$inviterName invited you to MyApp'
      text: |
        Hi $name,
        $inviterName invited you to join.
        Set your password: $url
```

## Templates do not deliver mail

Magic links, one-time codes, password resets, verifications and invitations all need SMTP. With it unset the app boots with email disabled and logs a warning: the templates are read, and nothing is sent.
