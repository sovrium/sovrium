# Sign In to a Sovrium Cloud

> Sign the CLI in with `sovrium login`: approve a short code in your browser, and the CLI keeps an API key of yours on this machine for `sovrium deploy`.

Your password never reaches the terminal. The CLI asks the cloud for a code, you approve it in a browser where you are already signed in, and the cloud hands the CLI an API key of yours — once.

## `sovrium login`

```text
Usage: sovrium login [options]
```

```bash
sovrium login                                    # https://cloud.sovrium.com
sovrium login --host https://cloud.example.org   # another Sovrium cloud
sovrium login --api-key "$SOVRIUM_API_KEY"       # a key you already have, e.g. in CI
sovrium login --status                           # who is this machine signed in as?
sovrium login --logout                           # revoke the key and forget it
```

```console
$ sovrium login
To sign in, open https://cloud.sovrium.com/device?user_code=WDJBMJHT
and confirm the code WDJBMJHT.
Waiting for approval…
Signed in to https://cloud.sovrium.com as Noor Haddad.
```

The command prints the page and the code and waits; `--open` also opens the page in your default browser. The page is always on the cloud you are signing in to. The command checks back every few seconds, and stops with exit code `1` if the code is denied or expires before anyone approves it — run it again for a new code.

### What it stores

One file, `~/.sovrium/credentials.json`, readable by you alone (`0600`):

```json
{
  "host": "https://cloud.sovrium.com",
  "apiKey": "…",
  "keyId": "KDkcNRCCGxbhGFgw5g4WEUa6ZAkLNmXX",
  "createdAt": "2026-10-08T09:15:00.000Z"
}
```

A machine holds one sign-in: signing in again replaces it. Every command that reads the file refuses it when other users of the machine can read it, and prints the `chmod 600` that fixes it.

### Paste a key instead

`--api-key <key>` skips the browser: the CLI checks the key with the cloud once and stores it if the cloud accepts it. A key the cloud does not accept is refused and nothing is written. This is the mode for a CI job, which has no browser to approve a code in.

### Check and sign out

`sovrium login --status` reads the file and prints the cloud, the key's id and the day you signed in — with no network call, and never the key itself. On a machine that is not signed in it says so, with exit code `1`.

```console
$ sovrium login --status
Signed in to https://cloud.sovrium.com
  Key id   KDkcNRCCGxbhGFgw5g4WEUa6ZAkLNmXX
  Since    2026-10-08
```

`sovrium login --logout` revokes the key on the cloud, so it stops working everywhere, then deletes the file. A key the cloud had already revoked is simply forgotten; any other refusal keeps the file, so you can try again.

### Network rules

The cloud is reached over `https` only: an API key never crosses the internet in clear. Plain `http` is accepted for a private or loopback address when `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1` is set, for a cloud you run on your own network. With `SOVRIUM_DISABLE_NETWORK=1` the command is refused before any request.

The cloud end of this is an ordinary Sovrium app with `auth.apiKeys` and `auth.deviceAuthorization` turned on; see [Device Authorization](/en/docs/device-authorization).
