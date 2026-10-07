# Passkeys

> Sign in with a key held by the device, the password manager or a security key — no password to type, phish or reuse.

A passkey is a WebAuthn credential. The user creates one while signed in, and from then on signs in with it: the device asks for a fingerprint, a face or a PIN, and the server never sees a secret it could leak.

```yaml
auth:
  strategies:
    - type: emailAndPassword
  passkeys: true
```

Passkeys sit beside the other strategies rather than replacing them. One account may hold a password, two-factor authentication and several passkeys — a laptop, a phone and a hardware key, say — and use any of them.

## Options

<!-- sovrium:options PasskeysConfigSchema -->

There is no `rpID` or `origin` to configure. A passkey is bound to the host it was created on, so both are derived from `BASE_URL`: the relying-party id is its host name, and the expected origin is its origin. A ceremony run from any other origin is refused. Moving the app to another domain means users register new passkeys there. Without `BASE_URL` — on a development machine — the address the browser used on `localhost` stands in.

## Registering a passkey

A signed-in user registers a passkey from any page that carries a `registerPasskey` action — typically the account page:

```yaml
- type: form
  action:
    type: auth
    method: registerPasskey
```

The browser asks the authenticator to create the credential; the server stores its public key, never a secret. A user can register several and remove the ones they no longer use.

## Signing in

A sign-in form whose action uses the `passkey` strategy draws a passkey button. Pressing it asks the browser for a passkey of this site and signs the user in with the one they pick — no email address needed first.

```yaml
- type: form
  action:
    type: auth
    method: login
    strategy: passkey
```

On an app with passkeys on, the email field of every email sign-in form is marked `autocomplete="username webauthn"`, so a browser that holds a passkey for the site offers it right in that field; elsewhere it stays `email`. A sign-in password field is `current-password`, and the password chosen at sign-up or on a reset is `new-password`, so password managers fill the one and propose to save the other.

## Requiring a passkey for administrators

With `requireForAdmin: true`, an admin-tier account reaches the admin plane only from a session it opened with a passkey. Its password session is not locked out of its own account: it can still register a passkey, but everything behind the admin plane answers 404 to it until it signs in again with that passkey. Accounts below the admin tier are unaffected.

The requirement reaches the MCP server too. There, an administrator's credential is offered the admin-only tools (the admin reads, the internal tables, the tool-call log and the configuration reads) only when it is an OAuth access token authorised from a session opened with a passkey, and only for as long as that session lives. An API key never qualifies, whichever session created it: a key outlives the session it came from, and the admin API turns keys away under this setting for the same reason. Any other credential is not offered those tools, and calling one by name is refused with a message naming the tool and the passkey requirement, before anything is read. The app's own table, action and automation tools are unaffected, so an administrator's API key keeps everything else its role allows. To give an AI client the admin tools, authorise it through OAuth after signing in with your passkey.
