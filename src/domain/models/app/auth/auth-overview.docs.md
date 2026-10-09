# Authentication Overview

> One `auth` block gives an app users, sessions, roles and admin user management — and its mere presence is the switch.

The block answers one question: **does this app have users?** Present, authentication is on. Omitted, every authentication route answers `404` and the app is fully public. There is no `enabled` flag.

```yaml
auth:
  strategies:
    - type: emailAndPassword
  defaultRole: member
```

Those four lines give working email-and-password sign-up and sign-in, server-managed sessions, the three built-in roles, and the admin user-management endpoints.

## The block

<!-- sovrium:options AuthSchema depth=1 -->

`strategies` is the only required property: a non-empty array with no two entries sharing a type. Everything else is layered on top.

Infrastructure secrets — signing keys, callback URLs, provider credentials — live in environment variables rather than here. The configuration is code: it goes into version control, gets reviewed, and ships to a mirror.

### Sign-in page

`auth.loginPage` names the path of your app's sign-in page. It defaults to `/login`.

```yaml
auth:
  loginPage: /account/sign-in
  strategies:
    - type: emailAndPassword
```

When Sovrium has to send a signed-out visitor to sign in, it sends them to this page, with the way back:

- An OAuth client's authorize request from a signed-out browser goes there with the authorization request attached. Signing in resumes it.
- Opening the OAuth consent screen signed out, or clicking Allow or Deny after the session has ended, sends the visitor there with `callbackURL` set to the consent screen. A sign-in form on that page returns them to it.
- The site header from the library (`block/navbar-simple`) points its sign-in link there, unless you pass `--set signInHref=…`.

A page's own `access.redirectTo` is not affected: each page names its target. The operator console keeps its own sign-in page at `/_admin/login`.

The value must be a path on your app: it starts with a single `/`, and has no scheme, host, query (`?`), fragment (`#`), backslash or whitespace. `sovrium validate` refuses anything else and names the value.

## Admin features are always on

Once `auth` is configured, user management, role assignment and impersonation endpoints mount automatically; there is no separate toggle.

Registering does not grant admin. Every sign-up receives `defaultRole`, and the first admin is created deliberately — through environment variables, the CLI, or a one-time bootstrap token.

## The three built-in roles

Available without configuration, and they cannot be redefined.

| Role     | Level | Access                                                                   |
| -------- | ----- | ------------------------------------------------------------------------ |
| `admin`  | 80    | Full — manages users, roles and settings, and every table permission     |
| `member` | 40    | Standard access to application resources, and the default for a new user |
| `viewer` | 10    | Read-only                                                                |

The numeric level establishes the hierarchy that permission resolution reads: higher is more privileged. A custom role slots into it with its own level.

## Two environment variables

| Variable      | Purpose                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `BASE_URL`    | The app's public origin, used for callback URLs and email links. Defaults to `http://localhost:PORT` |
| `AUTH_SECRET` | Signs tokens and session cookies. Derived from the app's root key when unset                         |

Neither is mandatory for the app to boot, and both matter the moment it is reachable from anywhere but the machine it runs on. `BASE_URL` is also the single origin the app trusts as its own, so leaving it at the localhost default on a deployed instance is what makes an OAuth round trip fail and puts a `localhost` link into a verification email.

Setting `AUTH_SECRET` pins the signing secret so sessions survive a change of root key. Leaving it out is **not** a weaker install — the derived value is as random as the key it comes from.

If you do set one, treat it like a database password, and know that setting or rotating it invalidates every active session.

## A complete example

```yaml
auth:
  strategies:
    - type: emailAndPassword
      minPasswordLength: 12
      requireEmailVerification: true
    - type: oauth
      providers: [google, github]

  allowSignUp: true
  defaultRole: viewer

  roles:
    - name: editor
      description: Can edit content
      level: 30

  groups:
    - name: marketing
    - name: finance

  twoFactor:
    issuer: MyApp
    backupCodes: true
```
