# Signing Flows

> Ask people to sign the PDF a record holds, each through a link of her own, and keep an evidence file of every step. What a flow produces is a simple electronic signature with an evidence file.

A signing flow is declared once under `signatures` and started for one record by a `signature/send` step. The engine copies and fingerprints the document at that moment, sends each signer a link, records every event of the request, and writes each signature, the signed document, the proof file and the status back into the record. Those fields are written by the engine only: a write from a form, the records API or a workflow step is refused.

```yaml
name: hr-app
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
        content: Sign your contract
signatures:
  - name: employment_contract
    table: contracts
    document: { field: draft_pdf }
    statement: I have read and accept $record.title.
    expires: 30d
    surface: { page: contract_signing, fields: [title] }
    signers:
      - name: employee
        email: $record.employee_email
        displayName: $record.employee_name
        field: employee_signature
        placement: { page: last, at: { x: 320, y: 640 }, width: 180 }
    output: { signedFile: signed_pdf, proofFile: proof_pdf, status: signing_status }
    evidence: { keep: 6y, basis: legal-obligation }
```

<!-- sovrium:options SignatureFlowSchema depth=3 -->

## Starting and cancelling a request

A `signature/send` step names the flow and, in `recordId`, the record (the record that started the run when left out). A record that already has an open request for the flow fails the step. A `signature/cancel` step stops the open request of a record: every unused link stops working, signatures already given stay in the evidence, and an optional `reason` is recorded in the evidence and passed to `signature` triggers; a signer who opens her link then sees the not-found page, which gives no reason. Write the reason for the people who run the app and keep personal details out of it: it is kept in clear with the evidence until `evidence.keep` ends, and erasing a signer does not remove it. A signer can also decline from the signing page, with an optional reason.

```yaml
automations:
  - name: send-contract
    trigger: { type: record, table: contracts, events: [create] }
    actions:
      - name: send
        type: signature
        operator: send
        props: { flow: employment_contract }
```

## What a step reads back

A `signature/send` step outputs exactly `{ requestId, status }`, never a link or an address. When it cannot start, it fails with `error.code` and `error.message`, which a later step reads after `continueOnError`: `document-missing`, `request-open`, `document-too-large`, `document-too-many-pages`, `document-malformed`, `document-encrypted`, `document-signed`, `document-active-content`, `document-hidden-content`, or `signer-contact-missing`. A `signature/cancel` step outputs `{ cancelled: true, requestId, status }`, or `{ cancelled: false }` when the record had no open request. `GET /api/signatures/requests/:requestId` answers where a request stands to whoever may read its record.

A `signature` trigger names a `flow` and one `event`. Its run reads `$trigger.signature.requestId`, `event`, `status`, and for `signed` and `declined` the `signer`, with the `reason` of a decline or cancel, and `$trigger.record`, the record as it stands. Neither carries a link or a signer's contact.

## What is frozen when a request is sent

The document is copied out of `document.field`, checked and fingerprinted. Files over 25 MiB or 500 pages, encrypted, already signed, running scripts, holding switchable layers or damaged are refused when the request is sent. An empty signature field the PDF already holds is kept as a plain named box, and one signature field is added for the organisation's seal. Every signer signs that copy, and her signature records its fingerprint. While a request is open, a client write to this field is refused; once it has ended the field takes a new file. The `statement` is resolved once per signer, in her language, and the resolved sentence is stored on the request. Contact values read through `$record.<field>` are copied too, so editing the record never redirects a link already sent.

## The signing page

`surface.page` names a page you declare, whose path carries a `:token` segment, such as `/sign/:token`. Signing links point at that path. Opening a valid link needs no account: the server exchanges the link for a signing session held in a cookie, then redirects to the same page with `session` in place of the token, so the token leaves the address bar, the browser history and any referrer. The session lasts thirty minutes at most and never past the request's deadline. Opening the link again starts a new session; the link keeps working until its signer signs or declines, or the request ends. The page, the redirect and the not-found page are sent with `Referrer-Policy: no-referrer`.

The page is only ever served this way: without a session, to a signed-in administrator, or under its plain path, it is not found. Components on it read the request as `$signing`:

| Reference                        | What it prints                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `$signing.signer.displayName`    | The signer's name, as the request was sent to her                                 |
| `$signing.signer.status`         | `waiting`, `sent`, `signed` or `declined`                                         |
| `$signing.statement`             | The statement as frozen for her at send, in her language                          |
| `$signing.request.status`        | The request status: `sent`, `in-progress`, `sealing`, `completed` and so on       |
| `$signing.request.expiresAt`     | When unused links stop working                                                    |
| `$signing.document.url`          | The address of the frozen document, valid in this signing session only            |
| `$signing.document.hash`         | The fingerprint of the frozen document                                            |
| `$signing.document.pages`        | Its number of pages                                                               |
| `$signing.verification.required` | The channels the flow verifies                                                    |
| `$signing.verification.verified` | The channels already verified in this session                                     |
| `$signing.record.<field>`        | A field of the record, read as it stands now, only when `surface.fields` lists it |

A `$signing.record.<field>` the flow does not list prints nothing, and its value is never sent to the page. The session gives no access to the records API. `$signing.document.url` serves the copy frozen when the request was sent, never the record's current file, as an inline PDF that is not cached.

A `signature-pad` on the page signs for the flow, as the signer of the session; a form field bound to the flow does the same. An unknown, expired, used or withdrawn link, and the page reached without a session, show one neutral page in the app's design and language. It names nothing of the request, the flow or the signer, so a link reveals nothing about the request it belonged to.

After twenty links that lead nowhere from one network address within an hour, every link opened from that address, a valid one included, shows that same page until the hour has passed, so tokens cannot be guessed at speed. The session only acts from the page's own site: a code request, a signature or a decline posted from another site is refused with 403, on a local development server too.

## Verifying the signer

Without `verify`, holding the link is the only check. With `verify.email`, the signer receives a one-time code at her address; with `verify.sms`, a code by text message through the named connection. Every declared channel is required. Codes are derived from `SIGNATURE_OTP_SECRET`, which must be set as soon as one flow declares `verify`.

With `verify.email`, the page asks for a code with `POST /api/signatures/challenge` and `{ "channel": "email" }`. The code goes to the address frozen when the request was sent, whatever the request body names, and the answer shows that address masked (`a•••@example.com`) with the challenge id, when the code expires and when a new one may be asked. The signature then carries the challenge id and the six-digit code. Without them it is refused with `VERIFICATION_REQUIRED`; with a wrong code, a code used on another request, or one already used, with `CODE_INVALID`, which never says how many tries are left; with a code past its ten minutes, with `CODE_EXPIRED`. A signature accepted this way records `email-otp` as the signer's identity, and the evidence records the verification just before the signature.

| Limit                        | Value                                         | Refused with             |
| ---------------------------- | --------------------------------------------- | ------------------------ |
| A code is valid              | 10 minutes                                    | `CODE_EXPIRED`           |
| Between two codes            | 60 seconds                                    | `RESEND_TOO_SOON`        |
| Codes per signer and request | 3                                             | `TOO_MANY_CODES_SENT`    |
| Codes per network address    | 10 an hour, across every request              | `TOO_MANY_CODES_SENT`    |
| Codes tried per signer       | 5 per request, across every code she received | `TOO_MANY_CODE_ATTEMPTS` |

With `verify.sms`, the same request with `{ "channel": "sms" }` texts the code to the phone frozen when the request was sent, through the connection `verify.sms.connection` names (its `provider` says which messaging API it speaks), from `verify.sms.from` when set, and the answer shows the phone masked (`+33 •• •• •• •• 78`). Every signer of such a flow needs a phone in international format when the request is sent, or the send is refused. Text messages have their own budgets, with the numbers of the table above, and a signature accepted this way records `sms-otp` as the signer's identity unless the flow also verifies by email. When the provider cannot take the message, its sending budget spent or failing, the answer is `SMS_UNAVAILABLE` (503): nothing is added to the evidence, the request stays open, and she may ask again after a minute. With both channels, the email code comes first: the text-message request carries it as `challengeId` and `code`, a request without it is refused with `VERIFICATION_REQUIRED`, and the signature then carries the text-message code.

The fifth wrong code locks that signer's verification for the life of the request: the right code and a new code are refused from then on, and the request has to be sent again. Every count is kept in the database, so a restart resets none of them. Only a keyed digest of each code is stored; the code itself appears in the message and nowhere else, not in the log, an automation run, the evidence or the export.

## Order, expiry and reminders

With `order: sequential` (the default), each signer receives her link once the signer before her has signed; with `parallel`, every link is sent at once. The request expires `expires` after it was sent (30 days by default). `reminders` mails a signer whose turn has come and who has not signed once `every` has passed since her last message (her link, then each reminder), at most `max` times, checked every minute. No reminder goes out once the request was signed, declined, cancelled or has expired. Each reminder carries a new link, and the link of every earlier message then shows the not-found page, so only the latest message works. Each reminder is recorded in the evidence as a `reminded` event with its number.

## What the engine writes

Each signature is stored in its signer's `signature` field. When every signer has signed, the engine writes the signed PDF to `output.signedFile`, the proof file (each signer, the statement, the document fingerprint and every event) to `output.proofFile`, and the request status to `output.status`. A `signature` trigger runs automations on `sent`, `signed`, `declined`, `cancelled`, `completed`, `sealed` and `expired`.

## Where each mark goes

A signer's `placement` puts a visible mark on the signed document, beside the evidence. `pdfField` names a signature field the PDF already contains: the field is kept as the mark's position, and the mark fills its box. `page` and `at` put the mark's top-left corner at a point, in points from the top-left corner of the page (one point is 1/72 of an inch), `width` points wide (180 by default); `page: last` is the last page of the document. A placement the document cannot hold, a page past its end or a field it does not contain, refuses the send before anything is mailed. A signer without `placement` appears in the proof file only.

When the last signer signs, the engine adds one revision to the frozen copy: the copy every signer signed stays byte for byte at the start of the signed document, and the marks follow it. A mark draws the signer's drawn signature, or her typed name, with the day she signed; it is a stamp, not a signature field, and its text names her and her signing instant exactly.

## The proof file

The proof file is a separate PDF kept with the request's evidence. It lists the request, the fingerprint of the document every signer signed and of the signed document, each signer with her statement, signing instant, method and identification, and every event of the log up to completion, in order, with the head of the log they end on. The completion event that follows links to that head and records the fingerprint of the signed document and of the proof, so `sovrium signature verify` can check both files against the log. Names and statements are printed as written; a character the built-in font cannot draw is printed as its code point, such as `U+674E`. The evidence file, `evidence.json`, is attached to the proof and is the authoritative record; the printed pages are its readable copy.

## The seal and the timestamp

The seal is the organisation's, not the signer's: it shows that the signed document left this server unchanged, while who signed is in the evidence file. It is applied when `SIGNATURE_SEAL_KEY` and `SIGNATURE_SEAL_CERT_CHAIN` are set: the signed document and the proof file each carry one PAdES signature (`ETSI.CAdES.detached`, SHA-256) in the same revision as the marks, so the copy every signer signed still begins the file. The request records a `sealed` event, and its status answers `sealed: true`. Without a key, a flow completes with unsealed documents, the status answers `sealed: false`, and the proof file says so. A self-signed certificate is shown as untrusted by PDF readers; a certificate issued by an authority the reader trusts is not.

A key the seal cannot use stops the server at start, with the reason. [Signing Keys](/en/docs/signing-keys) lists the keys it accepts and converts a PKCS#12 file.

The event log of each request is a chain: every event commits to the one before it. Without a timestamp authority (`SIGNATURE_TSA_URL`), that chain only detects an accidental change, because whoever runs the server could rewrite it whole. With one, the end of the chain is timestamped by a party outside the server when the request completes, the status answers `timestamped: true`, and each seal also carries a timestamp of its own signature (PAdES level B-T rather than B-B). A request whose authority does not answer, redirects, or returns a token for another request stays `sealing` and is completed by a later attempt, once a minute: with an authority configured, a request never completes without its timestamp. Signers are not held up: their signatures are already recorded.

The four `SIGNATURE_*` variables, their formats and what each adds are in [Signing Keys](/en/docs/signing-keys).

## Each signer's copy

When a request completes with a document, each signer who signed is mailed a link of her own to the signed document and to the proof file. The link works for 7 days and opens nothing else; any other link, an expired one included, answers the same not-found. The log records one `delivered` event per signer, without her address.

## Checking a sealed document

`sovrium signature verify` checks the seal and the timestamp offline, with the rest of the export: the signature covers the whole file but itself, it was made by the certificate the log recorded, the timestamp stamps the event it names, and each certificate chain verifies. A chain that verifies but leads to a root the verifier was not given is reported `untrusted`, not failed; the verifier trusts the certificates in `SIGNATURE_SEAL_CERT_CHAIN` when that variable is set where it runs.

## Keeping and erasing the evidence

`evidence.keep` is required: how long the evidence of a request is kept, written as a duration such as `6y` (a year being 365 days), and `evidence.basis` records why. The time counts from the end of the request: when it completes, is declined or cancelled, or expires, an expired request ending at its expiry instant. The evidence file of a request states the date its evidence goes. Until then the frozen document, the signed document, the proof file and the event log survive the deletion of the record, of the account, and of the files in a bucket, and no `file` step can delete or move them. Within the hour after that date, every row of the request and every file it holds are deleted; the record it signed stays.

A signer may ask for her data to be erased before then. An administrator erases her with `POST /api/signatures/requests/<request id>/erasures` and `{ "signer": "<signer name>" }`: her contact details, the reason she gave if she declined, her one-time codes and the values that tie her to the log are deleted, her signature cell keeps what she signed and how but no longer her name or her mark, and one erasure event is added to the log, which still verifies without identifying her. Erasing her again changes nothing. A caller who is not an administrator, an unknown request and a name the request has no signer under all get the same not-found answer. The signed document and the proof file still carry the name she drew or typed, and stay until `keep` ends.

When a request is sent, a signer whose address an account holds (case ignored) is linked to that account; how she proves who she is when signing does not change. The data export of an account lists each signature given from it, with what was signed, how, and the contact details the evidence keeps, in clear; deleting the account erases its holder from every request as above.

A `signature-pad` that signs a table field outside any flow keeps no retention of its own. Its evidence follows the record and the person: deleting the record for good deletes it, mark included, and deleting the account that signed erases her from it. Its evidence file states neither a deletion date nor a basis.

## What this is and is not

A flow produces a simple electronic signature with an evidence file. It does not check identity documents, and it does not produce an advanced or qualified signature; for those, use a signature provider through a connection. Nothing in this configuration decides a document's legal effect.
