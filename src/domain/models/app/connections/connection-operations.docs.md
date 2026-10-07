# Connection Operations

> The endpoints of a connected service declared once on its connection — method, path, typed parameters, body and pagination — and called by name from any automation step.

A connection can also declare the endpoints of its service as `operations`, against a `baseUrl`. Each operation names the method, the path and the parameters it takes, with where each one goes and its type; an automation step then calls it by name with `type: connection`, `operator: call`.

```yaml
env:
  - { key: QONTO_API_KEY, description: Qonto API key }
  - { key: BANK_IBAN, description: IBAN of the account to read, secret: false }

connections:
  - name: qonto
    type: apiKey
    props: { key: $env.QONTO_API_KEY, header: Authorization }
    baseUrl: https://thirdparty.qonto.com/v2
    operations:
      - name: list-transactions
        method: GET
        path: /transactions
        params:
          iban: { in: query, type: string, required: true }
          status: { in: query, type: array, items: { type: string, enum: [pending, completed] } }
        pagination:
          {
            style: page,
            pageParam: current_page,
            itemsPath: transactions,
            nextPath: meta.next_page,
          }

automations:
  - name: rent-payments
    trigger: { type: manual }
    actions:
      - name: fetch
        type: connection
        operator: call
        props:
          connection: qonto
          operation: list-transactions
          params: { iban: $env.BANK_IBAN, status: [completed] }
          paginate: all
```

Sovrium places and encodes every value: a path parameter fills exactly one `{name}` segment, even when the value holds a `/`; a query array is sent as repeated keys (`status=pending&status=completed`); body parameters become a JSON object by default, a form or multipart body when the operation's `body` says so, or fill the placeholders of a body sent as written (below); header parameters travel as request headers. The connection's own authentication is attached to every request, OAuth2 tokens included, refreshed first when they have expired.

## A body sent as written

Some endpoints take a body that is not a set of fields: a CSV file, an XML document, or a file's bytes beside its metadata. Declare the body itself with `kind: raw` or `kind: multipart-related`. The parameters declared `in: body` then fill `{{params.<name>}}` placeholders instead of being sent as fields.

```yaml
operations:
  - name: upload-file
    method: POST
    path: /upload/drive/v3/files?uploadType=multipart
    params:
      name: { in: body, type: string, required: true }
      mimeType: { in: body, type: string, required: true }
      file: { in: body, type: string, required: true }
    body:
      kind: multipart-related
      parts:
        - contentType: application/json; charset=UTF-8
          content: '{"name": {{params.name}}, "mimeType": {{params.mimeType}}}'
        - contentType: '{{params.mimeType}}'
          file: '{{params.file}}'
```

- `kind: raw` sends one payload under `contentType`: either `content`, text written in the operation, or `file`, the bytes of a file sent unchanged.
- `kind: multipart-related` sends its `parts` in order as `multipart/related`, each with its own `contentType` and its own `content` or `file`. Sovrium generates the boundary, and the request's content type names the first part's type.
- `file` names a file the way the `file` actions do: a storage key, a `data:` URI or an `https://` URL, usually passed in by the call as `{{params.file}}`.
- In a JSON content type a placeholder becomes the JSON encoding of the value, so a string arrives quoted and escaped and you write `{"name": {{params.name}}}` with no quotes of your own. In any other content type the value is inserted as text.

Each body or part takes exactly one of `content` and `file`, and a placeholder naming a parameter the operation does not declare `in: body` refuses the config when it loads. A file that cannot be read when the step runs (a storage key with nothing stored, or a URL the outbound guard refuses) fails the step, naming the file, and nothing is sent.

## Sending a file as a field

A messaging or document API often takes a file beside ordinary fields: a file part of a `multipart/form-data` body, or the file's content as base64 inside a JSON object. Declare the parameter with `type: file`. Its value names a file the way the `file` actions do: a storage key, the value of an attachment field, a `data:` URI or an `https://` URL.

```yaml
operations:
  - name: send-message
    method: POST
    path: /v1/chats/{chat_id}/messages
    params:
      chat_id: { in: path, type: string }
      text: { in: body, type: string, required: true }
      attachments: { in: body, type: file, required: true }
    body: multipart
```

- In a `multipart` body, a `file` parameter is sent as a file part named after the parameter, with the file's own name (the name it was uploaded under, never its storage key) and its content type.
- With `encoding: base64`, the bytes are inlined as one base64 string in the field instead, in a `json`, `form` or `multipart` body: `attachment: { in: body, type: file, encoding: base64 }`.
- A file is read up to 100 MiB. A file that cannot be read fails the step, naming it, and nothing is sent.

A `file` parameter outside the body, `encoding` on any other type, and a `file` parameter without `encoding` in a `json` or `form` body, which has no part to carry it, refuse the config when it loads.

A file is read with the app's own access to storage, so the caller of a trigger never chooses which file is sent: a `file` parameter whose value reads `{{trigger.…}}` — a webhook body, a manual run's input — refuses the config when it loads. Pass a file from an attachment field, a step's output or a literal key. The one trigger value accepted is an attachment field of the record that started a `record` trigger, `{{trigger.data.record.<attachment field>}}`.

`baseUrl` is a literal URL, `$env.VAR`, or `$token.FIELD` for a service that hands each customer their own API root with the token. Salesforce returns it as `instance_url`: keep it with the OAuth2 prop `tokenFields: [instance_url]` and set `baseUrl: $token.instance_url`. The kept fields are captured from every token response — the first exchange and each refresh — and stored encrypted with the token; a config whose `baseUrl` reads a field the connection does not keep is refused when it loads.

A call is checked when the config loads: an unknown operation, a parameter the operation does not declare, a missing required parameter or a literal of the wrong type refuses the config, naming the step. A value produced by a template is checked when the step runs.

What the next step reads:

- `steps.<name>.data` is the decoded response body. With `paginate: all`, or `paginate: N` for at most N pages, it is instead the items of every page read, concatenated in order, following the operation's `pagination` (page number, offset, cursor, the `Link` header, or the id of the last item read — `style: lastItem`, which stops when `hasMorePath` reads false).
- `steps.<name>.response.status` and `steps.<name>.response.headers` describe the last answer.

A non-2xx answer fails the step, and its error names the operation and the status. A `429` or `503` answer carrying `Retry-After` is retried after the delay the service asked for, up to three times and never after a wait longer than a minute. Every request passes the same outbound-address guard and per-request timeout (`timeout`, 15 seconds by default) as the HTTP actions; so does every redirect it answers with, and a redirect to another host never carries the connection's credentials. An answer larger than 5 MiB fails the step without being downloaded further.

<!-- sovrium:options ConnectionOperationSchema -->
