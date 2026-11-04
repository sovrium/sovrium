# Signing flows

## Contents

- What a flow is, and what it is not
- Before writing one
- The flow
- The signing page
- Starting, cancelling and following a request
- The environment
- What the engine refuses
- Checks

Manual: `sovrium docs signatures/signing-flows`, `sovrium docs guides-build/collect-signatures`, `sovrium docs operations/signing-keys`, `sovrium docs signatures/signature-verify`. Every option of a flow, with its meaning and its default: `sovrium docs signatures/signing-flows`. Read it before writing one; this file is the order to make the decisions in.

## What a flow is, and what it is not

A flow under the top-level `signatures` key asks the people a record names to sign the PDF that record holds, each through a link of her own, and keeps an evidence file of every step. What it produces is a simple electronic signature with an evidence file. It checks no identity document and produces no advanced or qualified signature: when the person needs one of those, use a signature provider through a connection, and say so rather than presenting a flow as equivalent. Never tell the person what legal effect a signed document has; that is not a question the configuration answers.

A `signature-pad` on an ordinary page, signing one `signature` field of a record the signed-in person may write, is the lighter tool: an approval inside the app, no document, no link, no retention of its own. Reach for a flow when the signer is outside the app, when there is a document, or when the evidence must outlive the record.

## Before writing one

Get an answer to each. A missing answer is a question for the person, not a default to invent.

```
- [ ] Which table holds the things signed, and which single-attachment field holds the PDF
- [ ] Who signs, in which order (sequential is the default), and where each one's address comes from ($record.<field> or a literal)
- [ ] How long the request stays open (expires) and whether to remind (reminders.every, reminders.max)
- [ ] Whether holding the link is enough, or a code by email, text message, or both, is required (verify)
- [ ] What the signing page may show of the record (surface.fields; none by default)
- [ ] How long the evidence is kept (evidence.keep, required, no default) and why (evidence.basis): the operator's decision, never yours
- [ ] Whether the documents are sealed and timestamped (environment, not config)
```

`evidence.keep` and `evidence.basis` are a retention decision with legal weight. Ask; if the person does not know, write the question into the report under "Decisions to record" and leave the flow out of the config until it is answered. Never pick a number to make validation pass.

## The flow

- One `signature` field per signer, on the flow's table, named in that signer's `field`. The flow writes it; nothing else does.
- `output.signedFile` and `output.proofFile` are single-attachment fields, `output.status` a text, single-select or status field. Add them to the table before the flow; the engine writes them and refuses anyone else.
- `statement` may read `$record.<field>`; it is resolved once, when the request is sent, and frozen per signer.
- `placement` puts a signer's visible mark on the signed document: `pdfField` for a signature field the PDF already has, or `page` (a number or `last`) with `at` and `width`. Without it the signer appears in the proof file only.
- `verify.sms.connection` names an entry of the top-level `connections` list, and every signer then needs a phone in international form when the request is sent.

## The signing page

`surface.page` names a page you declare, whose `path` carries a `:token` segment, such as `/sign/:token`. The page is only reachable through a signing link: it needs no account, and outside a signing session it answers not found. Build it with the pages skill; on it:

- read the request as `$signing` (`$signing.statement`, `$signing.signer.displayName`, `$signing.record.<field>` for the fields `surface.fields` lists);
- put a `signature-pad` naming the signer's `field` with `statement: $signing.statement`. In a flow's page the pad signs as the session's signer, shows the frozen statement and a link to the frozen document, asks for the code when the flow verifies, and offers to decline;
- or a form with a signature field whose `bind` is `{ flow, signer }`, which signs instead of creating a row.

Never put the token in a link, a hidden field or anything else on the page: the server has already swapped it for a session.

## Starting, cancelling and following a request

- Start a request with a `signature/send` step naming `flow` (and `recordId` when it is not the record that started the run). Its output is `{ requestId, status }`, never a link. An open request for the record fails the step, so a trigger that fires twice never sends twice; the second run still ends failed, so guard the trigger like any record automation (`watchFields`, a condition on the status field).
- When the step can fail on the document (encrypted, too large, missing), decide what a person sees: `continueOnError` and a later step that reads `error.code`, or the run failing visibly.
- Withdraw with `signature/cancel`. Its `reason` is recorded in the evidence and passed to `signature` triggers; the signer never sees it. Write it for the people who run the app, with no personal details: it stays in clear until `evidence.keep` ends, and erasing a signer does not remove it.
- Follow a request with a `signature` trigger naming `flow` and one `event`: `sent`, `signed`, `declined`, `cancelled`, `completed`, `sealed` or `expired`. Its run reads `trigger.signature.requestId`, `status`, `signer` and `reason`, never a link or a contact.
- Mail the team on `completed` or `declined`; there is no need to mail the signer, who receives her links and her copy from the engine.

## The environment

- `SMTP_*` and `BASE_URL`: links are mailed, and built from the public address.
- `SIGNATURE_OTP_SECRET`: required as soon as one flow declares `verify`; without it the server refuses to start, naming the flow.
- `SIGNATURE_SEAL_KEY` with `SIGNATURE_SEAL_CERT_CHAIN`, and `SIGNATURE_TSA_URL`: optional, the operator's choice. Details, formats and the PKCS#12 conversion: `sovrium docs operations/signing-keys`.

All four live in the environment, never in the config or a record. A self-signed seal is reported as untrusted by PDF readers; tell the person before they choose one.

## What the engine refuses

Design around these instead of working around them:

- A client write to a `signature` field, on every road: the records API, a batch, an import, a form mapping, an automation's record step, an agent tool. Signatures are given through a `signature-pad`, a bound form field or a signing page.
- A client write to a flow's `output` fields.
- A write to `document.field` while a request for that record is open. A new file is accepted once the request ends.
- A form field `bind`ing directly the column a flow signs: bind the flow instead.
- A step, trigger or form naming a flow that is not declared.

## Checks

```
- [ ] sovrium validate passes with the flow, its page and its automations
- [ ] Create one test record with a real PDF and your own address; the run of the send step shows { requestId, status }
- [ ] Open the mailed link in a private window: the page shows the statement and the document, and asks for the code if the flow verifies
- [ ] Sign; the record's status field moves on, and the signed document and the proof file appear once every signer has signed
- [ ] GET /api/signatures/requests/<requestId>/export as an admin, then sovrium signature verify on it: no check fails
- [ ] Open the same link again: the neutral not-found page
```
