# Device Authorization

> Sign the `sovrium` CLI in with a short code approved in the browser — and hand it an API key, never a password.

A command-line tool cannot show a sign-in form, and asking somebody to paste their password into a terminal is exactly the habit a credential policy exists to break. The device flow ([RFC 8628](https://datatracker.ietf.org/doc/html/rfc8628)) splits the job in two: the CLI asks for a short code, the person approves that code in a browser where they are already signed in, and the CLI collects a credential once the approval lands.

The flow is off by default. Turn it on beside API keys, which it needs:

```yaml
auth:
  strategies:
    - type: emailAndPassword
  apiKeys: true
  deviceAuthorization: true
```

`deviceAuthorization: true` without `apiKeys: true` is refused when the config is validated: an approved code is redeemed for an API key, and nothing else. Absent — the default — every endpoint below answers **404**.

## The flow, end to end

| Step | Who               | Request                                                                              | Answer                                                                              |
| ---- | ----------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 1    | CLI               | `POST /api/auth/device/code` `{ "client_id": "sovrium-cli" }`                        | `device_code`, `user_code`, `verification_uri`, `expires_in` (1800), `interval` (5) |
| 2    | Person, signed in | `GET /api/auth/device?user_code=<code>`                                              | The code's status; the first signed-in reader claims it                             |
| 3    | Person            | `POST /api/auth/device/approve` `{ "userCode": "<code>" }`                           | Approved — or `POST /api/auth/device/deny` to refuse it                             |
| 4    | CLI, polling      | `POST /api/auth/device/api-key` `{ "device_code": "…", "client_id": "sovrium-cli" }` | `{ "key", "keyId", "name" }` — once                                                 |

Your app supplies the page at `verification_uri`: a page that reads the code, shows it, and calls the approve or deny endpoint for the person looking at it. Only a signed-in person can claim, approve or deny a code, and only the person who claimed it can approve it.

### Redeeming for an API key

Step 4 is Sovrium's own endpoint. It consumes the approved code and mints an API key (see _API Keys_) for the person who approved it — named after the device, carrying that person's role exactly as a key they minted themselves would. The plaintext key is in that response and in no other, ever; redeeming the same code again answers `invalid_grant`.

Until the person acts, polling answers `400` with an RFC 8628 error the CLI reads:

| `error`                 | Means                                                            |
| ----------------------- | ---------------------------------------------------------------- |
| `authorization_pending` | Not approved yet — poll again after `interval` seconds           |
| `slow_down`             | Polled faster than `interval` — wait longer before the next poll |
| `access_denied`         | The person denied the request — start over                       |
| `expired_token`         | The 30 minutes ran out — request a new code                      |
| `invalid_grant`         | Unknown code, already redeemed, or requested by another client   |

The upstream `POST /api/auth/device/token` exists too, but it would answer a raw session token, which no Sovrium route accepts as a credential. It refuses every code the CLI requested, and the refusal does not consume the code: the CLI redeems it through `/device/api-key`.

## Guard rails

- **One client.** Only `client_id: "sovrium-cli"` can request a code; any other client id answers `400`.
- **Rate-limited lookups.** `GET /api/auth/device` answers at most 5 lookups per client address per 30 minutes, and `429` beyond — a user code is short, so guessing one is throttled.
- **Codes are short-lived.** A code expires 30 minutes after it was requested, approved or not.
