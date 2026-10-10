# Sign In to a Sovrium Cloud

> Sign the CLI in with `sovrium login`: one click in the browser it opens — or a short code where no browser can reach this machine — and the CLI keeps an API key of yours on this machine for `sovrium deploy`.

Your password never reaches the terminal. The CLI asks the cloud for a sign-in request, you approve it in a browser where you are already signed in, and the cloud hands the CLI an API key of yours — once.

## `sovrium login`

```text
Usage: sovrium login [options]
```

```bash
sovrium login                                    # https://cloud.sovrium.com, one click in the browser
sovrium login --device                           # approve a code instead (SSH, a remote machine)
sovrium login --host https://cloud.example.org   # another Sovrium cloud
sovrium login --api-key "$SOVRIUM_API_KEY"       # a key you already have, e.g. in CI
sovrium login --status                           # who is this machine signed in as?
sovrium login --logout                           # revoke the key and forget it
```

```console
$ sovrium login
Opening https://cloud.sovrium.com/device?user_code=WDJBMJHT in your browser…
(request WDJB-MJHT)
Waiting for approval…
Signed in to https://cloud.sovrium.com as Noor Haddad.
```

The command opens the approval page in your browser and prints it too, in case the browser does not open. Approve the request there, and the browser hands the answer back to the CLI on this machine — you compare no code. The `(request …)` line is only a reference, for an approval page that still shows a code. If the request is denied, or the browser never comes back before the request expires, the command stops with exit code `1` and stores nothing; when your browser cannot reach this machine, run `sovrium login --device`.

### When there is no browser here: `--device`

```console
$ sovrium login --device
To sign in, open https://cloud.sovrium.com/device?user_code=WDJBMJHT
and confirm the code WDJBMJHT.
Waiting for approval…
Signed in to https://cloud.sovrium.com as Noor Haddad.
```

`--device` prints the page and a code to confirm, then checks back every few seconds until someone approves it — from any device. The command picks this mode by itself where this machine has no browser of its own: over SSH, with `BROWSER=none`, and — unless `BROWSER` names a command — in a container, in CI, or on Linux without a display. Running without a terminal does not change the mode. A cloud that does not offer one-click sign-in is told apart by the CLI, which says so in one line and uses a code. It stops with exit code `1` if the code is denied or expires before anyone approves it — run it again for a new code.

`BROWSER` is honoured as usual: it names the command that opens a page, with `%s` standing for the page (else the page is its last argument), and `BROWSER=none` opens nothing. `--open` is still accepted, and changes nothing: the browser already opens by default.

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

`--api-key <key>` skips the browser: the CLI checks the key with the cloud once and stores it if the cloud accepts it. A key the cloud does not accept is refused and nothing is written. For a CI job, setting `SOVRIUM_API_KEY` writes nothing at all (see “A key from the environment” below).

### Check and sign out

`sovrium login --status` reads the file and prints the cloud, the key's id and the day you signed in — with no network call, and never the key itself. On a machine that is not signed in it says so, with exit code `1`.

```console
$ sovrium login --status
Signed in to https://cloud.sovrium.com
  Key id   KDkcNRCCGxbhGFgw5g4WEUa6ZAkLNmXX
  Since    2026-10-08
  Key from /home/kofi/.sovrium/credentials.json
```

`sovrium login --logout` revokes the key on the cloud, so it stops working everywhere, then deletes the file. A key the cloud had already revoked is simply forgotten; any other refusal keeps the file, so you can try again.

### A key from the environment

`SOVRIUM_API_KEY` takes precedence over the file for every command that signs a call — the CI case, where nothing is written to disk. The key belongs to the cloud in `SOVRIUM_HOST`, or to `https://cloud.sovrium.com` when that is unset, and is never sent to another. `--status` then prints `Key from SOVRIUM_API_KEY`; `--logout` refuses it, touching neither the cloud nor the file — unset the variable instead.

### Network rules

During a one-click sign-in the CLI listens on `127.0.0.1` only, on a port the system picks, and answers one request: `GET /callback`, the browser coming back. It stops listening as soon as the sign-in ends.

The cloud is reached over `https` only: an API key never crosses the internet in clear. Plain `http` is accepted for a private or loopback address when `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1` is set, for a cloud you run on your own network. With `SOVRIUM_DISABLE_NETWORK=1` the command is refused before any request.

The cloud end of this is an ordinary Sovrium app with `auth.apiKeys` and `auth.deviceAuthorization` turned on; see [Device Authorization](/en/docs/device-authorization).
