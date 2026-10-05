# Crypto & Digest Actions

> Two small families solving two unrelated problems — proving a payload was not tampered with, and turning a flood of events into one message a human will read.

## Crypto — hashing and HMAC

Two operators computing digests and signatures, typically to verify an inbound webhook or sign an outbound one.

<!-- sovrium:options CryptoActionSchema -->

`algorithm` is required on both operators. `encoding` is `hex` by default, or `base64`.

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
