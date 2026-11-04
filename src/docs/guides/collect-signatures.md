# Collect signatures on a document

> Ask the people a record names to sign its PDF from a link of their own, verify them by email code, and keep the evidence file until its retention ends.

You keep contracts in a table, each with a PDF, and you want the person a contract names to sign it from her inbox, without an account, and to keep a record of how she signed that you can check years later. What a signing flow produces is a simple electronic signature with an evidence file. For an advanced or qualified signature, use a signature provider through a connection.

## The whole app

This config is complete: a table holding the contract and the fields the flow writes back, the page signers land on, the flow itself, and an automation that sends a request whenever a contract is created.

```yaml
name: contracts-app
auth:
  strategies:
    - type: emailAndPassword
tables:
  - id: 1
    name: contracts
    fields:
      - { id: 1, name: title, type: single-line-text }
      - { id: 2, name: employee_name, type: single-line-text }
      - { id: 3, name: employee_email, type: email }
      - { id: 4, name: draft_pdf, type: single-attachment }
      - { id: 5, name: employee_signature, type: signature }
      - { id: 6, name: signed_pdf, type: single-attachment }
      - { id: 7, name: proof_pdf, type: single-attachment }
      - { id: 8, name: signing_status, type: single-line-text }
pages:
  - name: contract_signing
    path: /sign/:token
    components:
      - type: text
        element: h1
        content: $signing.record.title
      - type: text
        element: p
        content: $signing.signer.displayName
      - type: signature-pad
        field: employee_signature
        statement: $signing.statement
signatures:
  - name: employment_contract
    table: contracts
    document: { field: draft_pdf }
    statement: I have read and accept $record.title.
    expires: 30d
    reminders: { every: 3d, max: 4 }
    verify: { email: true }
    surface: { page: contract_signing, fields: [title] }
    signers:
      - name: employee
        email: $record.employee_email
        displayName: $record.employee_name
        field: employee_signature
        placement: { page: last, at: { x: 320, y: 640 }, width: 180 }
    output: { signedFile: signed_pdf, proofFile: proof_pdf, status: signing_status }
    evidence: { keep: 6y, basis: legal-obligation }
automations:
  - name: send-contract
    trigger: { type: record, table: contracts, events: [create] }
    actions:
      - name: send
        type: signature
        operator: send
        props: { flow: employment_contract }
```

Check it with `sovrium validate app.yaml`. Every name the flow uses is checked: the table, the document field, each signer's `signature` field, the `output` fields and the page, which must carry a `:token` segment in its path.

## Set the environment

Signing links are mailed, so the server needs a mail transport and its public address. A flow that verifies by code also needs the secret the codes come from:

```bash
BASE_URL=https://contracts.example.com
SMTP_HOST=smtp.example.com
SMTP_USER=contracts@example.com
SMTP_PASS=<the mailbox password>
SIGNATURE_OTP_SECRET=<openssl rand -hex 32>
```

Without `SIGNATURE_OTP_SECRET`, a config with `verify` refuses to start and names the flow. The seal and the timestamp authority are optional and come later; see the last step.

## Send a request

Create a contract with a PDF in `draft_pdf` and an address in `employee_email`. The automation runs, the engine copies the PDF and records its fingerprint, and the employee receives a link. From then on the request owns the document: a write to `draft_pdf` is refused while the request is open, and `signed_pdf`, `proof_pdf`, `signing_status` and `employee_signature` are written by the engine only, whoever asks.

A `signature/send` step fails, with a code a later step can read, when the record holds no document, when the PDF is one the engine refuses (encrypted, already signed, too large, carrying scripts), or when a signer has no address. [Signing Flows](/en/docs/signing-flows) lists every code.

## What the signer sees

The link opens `contract_signing` without an account. The server swaps the link for a short signing session, so the token leaves the address bar, and the page reads the request through `$signing`: here the contract's title, which `surface.fields` lets it read, and the signer's name. The `signature-pad` shows the statement frozen for her, a link to the document she is signing, then asks for the code mailed to her before she draws or types her signature. She can also decline, with a reason.

A link that is unknown, expired, already used or withdrawn shows one neutral page that names nothing of the request.

## Follow the request

A `signature` trigger runs an automation on each event of a request: `sent`, `signed`, `declined`, `cancelled`, `completed`, `sealed` or `expired`. To tell the team when a contract is fully signed:

```yaml
automations:
  - name: contract-signed
    trigger: { type: signature, flow: employment_contract, event: completed }
    actions:
      - name: notify
        type: email
        operator: send
        props:
          to: hr@example.com
          subject: A contract was signed
          template: { inline: '<p>Request {{requestId}} is complete.</p>' }
          data: { requestId: '{{trigger.signature.requestId}}' }
```

A `signature/cancel` step withdraws the open request of a record, with an optional reason recorded in the evidence; the signer never sees that reason.

## Seal and timestamp the result

When the request completes, the engine writes the signed PDF, with each signer's mark at its `placement`, and the proof file. To show that both left your server unchanged, set the organisation's seal; to anchor the evidence in time outside your server, set a timestamp authority. Both are environment variables, described in [Signing Keys](/en/docs/signing-keys).

## Keep, erase and verify

The evidence of each request is kept for `evidence.keep` after the request ends, six years here, and deleted within the hour after that, whatever happens to the record or the accounts in the meantime. A signer who asks to be erased before then is erased by an administrator: her contact details and the values that tie her to the log go, the log still verifies. The signed document and the proof file keep the name she signed with until `keep` ends.

An administrator downloads a request's export from `GET /api/signatures/requests/<request id>/export`, and anyone holding it checks it offline:

```bash
sovrium signature verify contract-export.json
```

See [Verifying a Signing Export](/en/docs/signature-verify) for what each check proves.
