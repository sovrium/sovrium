# Crypto & Digest Actions

> Two small families solving two unrelated problems — proving a payload was not tampered with, and who made it, and turning a flood of events into one message a human will read.

## Crypto — hashing, HMAC and signatures

Four operators: `hash` and `hmac` compute digests, typically to verify an inbound webhook or sign an outbound one; `sign` and `verify` make and check Ed25519 signatures.

<!-- sovrium:options CryptoActionSchema -->

`algorithm` is required on every operator. On `hash` and `hmac`, `encoding` is `hex` by default, or `base64`.

```yaml
# Requires env: [{ key: SIGNING_SECRET }] at the top of the app
- name: signPayload
  type: crypto
  operator: hmac
  props:
    input: '{{trigger.data.body}}'
    secret: $env.SIGNING_SECRET
    algorithm: sha256
    encoding: hex
```

### `hmac` does not accept `md5`

Its algorithm vocabulary is `sha256` and `sha512` only, while `hash` still accepts `md5` for interoperating with a system that demands it. That asymmetry is deliberate: a hash may need to match somebody else's legacy choice, but a signature you rely on must not be forgeable, and MD5 is.

Keep the key in the environment rather than inline. The configuration is code, and code reaches a git remote.

### Signatures: `sign` and `verify`

An HMAC proves a payload to whoever holds the same secret, so whoever can check it can also forge it. A signature splits the two: the signer keeps the private key, and every verifier holds only the public one. Use it when many systems must trust what one of them publishes and none may publish in its name.

```yaml
# Requires env: [{ key: RELEASE_SIGNING_KEY }] at the top of the app
- name: signManifest
  type: crypto
  operator: sign
  props:
    data: '{{trigger.data.manifest}}'
    privateKey: $env.RELEASE_SIGNING_KEY
    algorithm: ed25519
    keyId: release-2026
```

`sign` answers `{ signature, keyId }`: the standard 64-byte Ed25519 signature over the UTF-8 bytes of `data`, in base64, which any Ed25519 implementation verifies. `privateKey` must be written `$env.NAME` — a key written inline is refused when the config is read — and holds the 32-byte seed in base64 or a PKCS#8 PEM block. Resolved environment values are masked in the run history, so the key never lands there.

```yaml
- name: checkManifest
  type: crypto
  operator: verify
  props:
    data: '{{trigger.data.manifest}}'
    signature: '{{trigger.data.signature}}'
    keyId: release-2026
    algorithm: ed25519
```

`verify` takes exactly one of `publicKey` — 32 raw bytes in base64, or an SPKI PEM block — and `keyId`, looked up among the keys of `SOVRIUM_BUNDLE_PUBLIC_KEYS` (`<id>:<base64>[,…]`). It answers `{ valid }`. A signature that does not verify, whatever the reason, is `valid: false` on a successful step, so the workflow branches on it; an unreadable public key or an unknown `keyId` fails the step, because that is a configuration mistake rather than a verdict.

## Digest — batch and release

Two operators that collect items across many runs into a named bucket, then drain them as one batch. The usual case is a notification roll-up: one automation collects each event as it happens, another releases them on a schedule.

<!-- sovrium:options DigestActionSchema -->

`digestKey` is required on both operators and is what pairs a producer with its consumer. `sort.direction` defaults to ascending. `sort.field` names a key of the collected items; a key starting with `$`, which reads as a JSON path rather than a key, is refused — when the config is checked, or when a key filled in from the request reaches the release, which then fails with the reason. The refusal points at `sort.field` and names the key to write instead: `$.priority` is refused with `(write "priority")`.

```yaml
- name: queueDigest
  type: digest
  operator: collect
  props:
    digestKey: daily-summary
    item: '{{trigger.data.record}}'
    deduplicateBy: id
```

```yaml
- name: drain
  type: digest
  operator: release
  props:
    digestKey: daily-summary
    sort: { field: created_at, direction: desc }
    limit: 50
```

### The property is `digestKey`, not `bucket`

A digest action written with `bucket:` fails at runtime asking for a `digestKey`. The name is unrelated to storage buckets, which hold files — the collision is in the English, not in the system.

### Two automations, not one

`collect` belongs in an automation triggered by the event; `release` in one triggered by the clock. Because releasing **drains** the bucket, the next window starts empty, so a missed schedule accumulates events rather than losing them — which is the property that makes a digest safe to run on a cron that occasionally does not fire.
