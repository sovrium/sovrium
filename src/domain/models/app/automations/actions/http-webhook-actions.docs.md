# HTTP & Webhook Actions

> Outbound calls to an external API, outgoing signed webhooks, and the response written back to an inbound one.

## HTTP — outbound requests

Six operators. The generic `request` takes an explicit `method`; the verb operators are shorthands and accept a `connection` reference for an authenticated call.

| Operator  | Key props                                                                       |
| --------- | ------------------------------------------------------------------------------- |
| `request` | `url`, `method`, `query?`, `headers?`, `body?`, `contentType?`, `timeout?`      |
| `get`     | `url`, `query?`, `headers?`, `timeout?`, `connection?`                          |
| `post`    | `url`, `query?`, `headers?`, `body?`, `contentType?`, `timeout?`, `connection?` |
| `put`     | the same as `post`                                                              |
| `patch`   | the same as `post`                                                              |
| `delete`  | `url`, `query?`, `headers?`, `body?`, `timeout?`, `connection?`                 |

<!-- sovrium:options HttpActionSchema -->

`props.timeout` accepts 1000 to 120000 milliseconds and defaults to 15000. `connection` names a stored credential, which is what makes the call authenticated without a secret appearing in the configuration.

### `query`: parameters as values, not text glued into the URL

`url` is a template, and a value placed in it is encoded for where it lands: in the path it stays one segment (`/`, `?` and `#` in it are encoded), in the query one value (`&` and `=` too). So `orders/{{trigger.data.id}}` always reads one order, and `?q={{trigger.data.term}}` sends a term like `Dupont & Fils` as a single parameter. A value that is a bare `.` or `..` fails the step. A `url` that is exactly one template (`'{{steps.list.response.body.next}}'`), a `$env.` reference, and the output of `urlEncode` are inserted as they are. For a path that spans several segments — a file path, an `owner/repo` pair — use `{{urlPath value}}`: it keeps the slashes, encodes each segment, and fails the step on a `..` segment. The `query` object below remains the clearest way to send several parameters: each value is resolved first (templates, `$env`), then percent-encoded on its own and appended to the `url`, after any query the `url` already carries.

```yaml
- name: findLead
  type: http
  operator: get
  props:
    url: https://api.lemlist.com/api/leads
    connection: lemlist
    query:
      email: '{{trigger.data.email}}'
      limit: 50
      status: [interested, contacted]
```

A string or template is sent percent-encoded, a number or boolean as its literal text, and an array repeats its key once per item, in order (`status=interested&status=contacted`). A nested object has no single encoding across APIs and is refused when the config loads — write the flat key the API expects. On `post`, `put` and `patch` the query goes on the url and the body is sent unchanged.

### `contentType` has no default

Set it and Sovrium stamps the matching `Content-Type` **and** encodes the body to match — `form` URL-encodes a JSON-shaped body rather than announcing one encoding while sending another.

Omit it and `post`, `put` and `patch` still send `application/json` for a JSON-shaped body, while `request` and `delete` send no `Content-Type` of their own. An explicit `Content-Type` in `headers` wins outright, over both the header and the encoding — which is the escape hatch for an API wanting something this vocabulary does not name.

### A body written as JSON text

A `body` given as a string is sent as written. When the request is sent as JSON — a `Content-Type: application/json` header, `contentType: json`, or `webhook/send`, which sends JSON unless its headers say otherwise — each value placed in that text is escaped as the content of a JSON string, so a quote or a backslash in it cannot end the string or add a key. A body given as an object is serialised as JSON and needs nothing of the kind.

### What a non-2xx does

A 2xx response succeeds the step; any other status fails it, with the status folded into a stable error category that a retry policy can match on. The status and body land on the step output either way, so a step that must tolerate a 404 can be marked `continueOnError` and branched on the response status.

### When the request itself fails

A failed request puts an `error` object on the step output, beside `response` when an answer arrived. `error.message` is the text the run history records, and `error.code` says what went wrong:

| `error.code` | When                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `timeout`    | No complete answer within `timeout`                                                                                                                    |
| `dns`        | The host name does not resolve                                                                                                                         |
| `connection` | The host was found but the connection was refused, reset or closed before an answer                                                                    |
| `tls`        | The `https` connection could not be secured: an untrusted, expired or mismatched certificate                                                           |
| `http`       | An answer arrived with a status outside 2xx, which `response.status` holds                                                                             |
| `blocked`    | Sovrium refused to send the request or follow a redirect: a private address, a scheme other than `http`/`https`, a malformed `url` or a sixth redirect |

The step still fails: without `continueOnError` the run stops there, as it always has. With it, the next step reads the outcome, which is how an uptime check records a target that is down:

```yaml
- name: check
  type: http
  operator: get
  continueOnError: true
  props: { url: 'https://shop.example.com/health', timeout: 5000 }
- name: recordCheck
  type: record
  operator: create
  props:
    table: checks
    data:
      latency_ms: '{{steps.check.durationMs}}'
      http_status: '{{steps.check.response.status}}'
      failure: '{{steps.check.error.code}}'
```

A step that fails before any request is made — no `url`, or a `connection` whose credentials cannot be found — carries `error.message` only. The `ai` actions report their failures with the same `code` and `message` keys.

Response bodies are read up to 64 KiB, and the rest is never downloaded: past the cap the body is cut there and the output's `truncated` flag is set; the key is absent otherwise, so a step can tell a clipped payload from an endpoint that genuinely returned nothing. An answer that never ends therefore costs 64 KiB, not the run.

### Private addresses and redirects

The `url` may not point at a private, loopback or link-local address, and neither may any redirect it answers with. Every hop is checked before it is requested, whatever way the address is written (`[::ffff:127.0.0.1]` is `127.0.0.1`); up to five redirects are followed, over `http` as well as `https`, and a refused hop fails the step with `invalid_outbound_url_<reason>`. A redirect to another host does not carry the request's `Authorization` header. The same rules apply to `webhook/send`. Host names are not resolved before the check, so restrict the server's outbound traffic at the firewall when it shares a network with internal services; `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1` lifts the address rule for development.

```yaml
- name: createContact
  type: http
  operator: post
  props:
    url: 'https://api.crm.example/contacts'
    connection: crm-oauth
    contentType: json
    body: { email: '{{trigger.data.email}}', name: '{{trigger.data.name}}' }
```

Prefer `connection` over inlining a secret in a header. With one referenced, Sovrium attaches the right `Authorization` header and, for OAuth2, refreshes the token before it expires.

## Webhook — sending and responding

Two operators: `send` fires a signed outgoing webhook, and `response` writes the HTTP response for an automation that a webhook trigger started.

<!-- sovrium:options WebhookActionSchema -->

```yaml
# Requires env: [{ key: OUTGOING_WEBHOOK_SECRET }] at the top of the app
- name: notifyDownstream
  type: webhook
  operator: send
  props:
    url: 'https://hooks.example.com/orders'
    event: order.created
    data: { id: '{{trigger.data.id}}' }
    secret: $env.OUTGOING_WEBHOOK_SECRET
```

```yaml
- name: ack
  type: webhook
  operator: response
  props: { status: 200, body: { ok: true } }
```

### Three things called webhook

They are different mechanisms and the names collide badly:

- The webhook **trigger** receives inbound HTTP and starts an automation.
- The `webhook/send` **action** posts outgoing HTTP from a running automation.
- A **table** webhook fires automatically on a record event, with no automation authored at all.

The `response` action applies only to an automation a webhook trigger started. Used anywhere else there is no inbound request to answer, so it has nothing to write to.

It is also the only way a webhook-started run hands back what its steps produced. Without it, the caller is answered the run's `id` and `status` and nothing else; with it, the caller gets exactly the status, headers and body the action declares. A body value that is exactly one template, such as `'{{steps.lookup.record}}'`, keeps the type of what it names (an object, a list, a number, a boolean or `null`), and a template that names nothing leaves its key out; a value mixing text with a template is a string. A whole record carries every field the step read, so name the fields to return when some are not the caller's to see. The body is always sent as JSON, and `<`, `>` and `&` are written as `\u003c`, `\u003e` and `\u0026`, whatever `Content-Type` the action declares: the caller's JSON parser reads the same value, and a browser never finds markup in the response.
