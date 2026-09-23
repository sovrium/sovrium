# OAuth Server

> Sovrium as the authorization server — issuing tokens for downstream apps and AI clients, and the consent screen that refuses to let a client name itself.

Beyond consuming social logins, Sovrium acts as an OAuth 2.1 and OpenID Connect authorization server. That is how one instance becomes the identity provider for a fleet of apps: it holds the users, and other services delegate sign-in to it.

## There is nothing to enable

The endpoints are **auto-mounted whenever authentication is configured**. There is no schema switch.

```yaml
auth:
  strategies:
    - type: emailAndPassword
```

Token lifetimes and the other tunables are operator concerns governed by defaults and environment variables rather than schema fields. Without an auth block there is no identity to authorize, so every auth route answers `404`.

## Endpoints

| Method | Path                                      | Purpose                                   |
| ------ | ----------------------------------------- | ----------------------------------------- |
| `GET`  | `/.well-known/oauth-authorization-server` | Authorization-server metadata             |
| `GET`  | `/.well-known/openid-configuration`       | OpenID discovery metadata                 |
| `GET`  | `/.well-known/jwks.json`                  | Public keys for verifying tokens          |
| `POST` | `/api/auth/oauth2/register`               | Dynamic client registration               |
| `GET`  | `/api/auth/oauth2/authorize`              | The authorization endpoint                |
| `POST` | `/api/auth/oauth2/consent`                | Consent acknowledgement                   |
| `POST` | `/api/auth/oauth2/continue`               | Resume after account select or post-login |
| `POST` | `/api/auth/oauth2/token`                  | The token endpoint                        |
| `GET`  | `/api/auth/oauth2/userinfo`               | Claims for an access token                |
| `POST` | `/api/auth/oauth2/introspect`             | Token introspection                       |
| `POST` | `/api/auth/oauth2/revoke`                 | Token revocation                          |
| `POST` | `/api/auth/oauth2/get-client`             | Client lookup helper                      |

Two of those behave asymmetrically, and both are deliberate. Introspection requires the client to authenticate; revocation needs only a `client_id`, which is what the revocation specification permits and is the reason a client that has lost its secret can still retire a token.

## Resource-bound tokens are not revocable one at a time

A client that asks for a specific resource receives a signed token rather than an opaque database row, and a signed token has nothing to delete. Presenting one at `/api/auth/oauth2/revoke` answers `unsupported_token_type`.

What replaces per-token revocation is session liveness: introspection re-reads the token against the live session, so signing the user out withdraws it immediately. A client that never asks for a resource still receives an ordinary opaque token and can still revoke it, so this affects only the clients that opted into audience binding.

## Defaults

| Setting                     | Default             | Why                                                       |
| --------------------------- | ------------------- | --------------------------------------------------------- |
| Dynamic client registration | Signed in           | Anonymous registration answers `401` unless opened by env |
| Access token lifetime       | 1 hour              | The industry standard                                     |
| Refresh token lifetime      | 30 days             | The industry standard                                     |
| Login page                  | `/login`            | An engine page                                            |
| Consent page                | `/oauth/consent`    | An engine page                                            |
| Proof key exchange          | Required            | OAuth 2.1 mandates it for the authorization code flow     |
| Token signing               | Rotating EdDSA keys | Published through the key-set endpoint                    |

## AI and MCP clients

Dynamic registration exists so an assistant can obtain a token and then call your app's exposed tables — subject to exactly the same roles and table permissions as any other caller. That is what lets an AI client act **on behalf of** a real user, with the access that user would have in the interface.

Registering requires a session, so an operator can mint a client by hand while signed in. A client that registers itself has no session to offer, and needs the anonymous-registration environment variable. That is off by default, because registration writes a client name of the caller's choosing.

## The consent screen

This is the one moment in the flow where a person makes a trust decision, so it is also the page a phishing client most wants to reach. Registration is self-service by design, which means every string a client supplies about itself — its name, its URI, its icon — was chosen by whoever registered it. A screen showing only that name would hand an attacker a first-party-looking page on your own domain.

Two things on the screen are therefore not the client's to choose.

**The registered redirect origin is the primary identity shown.** It is read from the client's stored record, never from the incoming request, so it is exactly where the browser will be sent if the user accepts. A client cannot claim to be something it is not, because what the user is shown is not a name — it is the address.

**Self-asserted metadata is labelled as self-asserted.** A client reads **Verified** only when a third party attested its metadata. Anything that registered itself reads **Unverified**, in the same visual weight as the name it qualifies.

The self-chosen name is still shown — somebody who just pressed "connect" in an app needs to recognise it — but as a quoted claim subordinate to the origin, and escaped, because it arrives straight from a registration payload.

Scopes are listed in plain language, and a scope the screen has no description for is shown **by its raw name rather than hidden**. The one it cannot describe is the one a user most needs to see.
