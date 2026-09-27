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

`url` is a template, and a value interpolated into it is inserted as it is — so `?email={{trigger.data.email}}` sends `claire+test@atelier.fr` as `claire test@atelier.fr`, and a company named `Dupont & Fils` splits into two parameters. Give the parameters as a `query` object instead: each value is resolved first (templates, `$env`), then percent-encoded on its own and appended to the `url`, after any query the `url` already carries.

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

A string or template is sent percent-encoded, a number or boolean as its literal text, and an array repeats its key once per item, in order (`status=interested&status=contacted`). A nested object has no single encoding across APIs and is refused when the config loads — write the flat key the API expects. On `post`, `put` and `patch` the query goes on the url and the body is sent unchanged. For a value that belongs in the path, `{{urlEncode value}}` encodes it in place.

### `contentType` has no default

Set it and Sovrium stamps the matching `Content-Type` **and** encodes the body to match — `form` URL-encodes a JSON-shaped body rather than announcing one encoding while sending another.

Omit it and `post`, `put` and `patch` still send `application/json` for a JSON-shaped body, while `request` and `delete` send no `Content-Type` of their own. An explicit `Content-Type` in `headers` wins outright, over both the header and the encoding — which is the escape hatch for an API wanting something this vocabulary does not name.

### What a non-2xx does

A 2xx response succeeds the step; any other status fails it, with the status folded into a stable error category that a retry policy can match on. The status and body land on the step output either way, so a step that must tolerate a 404 can be marked `continueOnError` and branched on the response status.

Response bodies are captured up to 64 KiB. Past that the body is cut at the cap and the output's `truncated` flag is set; the key is absent otherwise, so a step can tell a clipped payload from an endpoint that genuinely returned nothing.

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
