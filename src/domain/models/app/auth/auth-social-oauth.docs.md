# Social & OAuth Providers

> Federated sign-in through an external identity provider — the five accepted providers, where their credentials live, and the callback URL you do not configure.

The user proves who they are to an external provider, and Sovrium trusts that result. No password is stored on your side, and offboarding somebody at the identity provider offboards them from your app.

```yaml
auth:
  strategies:
    - type: oauth
      providers: [google, github, microsoft, slack, gitlab]
```

<!-- sovrium:options OAuthStrategySchema -->

`providers` is a non-empty array drawn from a **closed** list, so a name outside it fails validation rather than being silently ignored at boot.

| Provider    | Usual case                   |
| ----------- | ---------------------------- |
| `google`    | Google Workspace             |
| `github`    | Developer authentication     |
| `microsoft` | Enterprise directories       |
| `slack`     | Workspace communication      |
| `gitlab`    | Developer and CI integration |

## Credentials live in the environment

A client secret is **never** in the schema. The configuration is code: it goes into version control, gets reviewed, and ships to a mirror, so a secret written there is a secret published.

Each enabled provider reads a credential pair from the environment, upper-cased from the provider identifier:

```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
```

A declared provider with no credentials will not sign anyone in. The strategy validates against the provider list, not against the environment, so a mistyped or missing variable passes validation and fails at the redirect instead. Check each pair on the deploy target rather than locally.

## Callback URLs are derived

They come from `BASE_URL`; there is nothing to configure per provider. Register the derived URL with each provider's console, and make sure `BASE_URL` on the deploy target is the public origin users actually reach rather than localhost.

A mismatch there is the usual cause of a provider rejecting the round trip: the redirect Sovrium sends does not match the one registered, and the provider refuses before your app is ever involved — which is why the failure shows up as the provider's error page rather than yours.
