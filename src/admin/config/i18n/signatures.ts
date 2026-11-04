/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The Signatures pages: the list of signing requests and one request's detail.
// Read-only operator copy: a request is sent and withdrawn by the app's own
// automations, so no string here offers to change one. Mirrored key for key in
// `fr-signatures.ts`.

export default {
  'admin.signatures.heading': 'Signatures',
  'admin.signatures.blurb':
    'Every signing request your app has sent: who signs it and where it stands. Your automations send and withdraw requests; here you read them and download their evidence.',
  'admin.signatures.search': 'Search requests',
  'admin.signatures.region': 'Signing requests',
  'admin.signatures.empty':
    'No signing requests yet. One appears here when an automation sends it with a signature/send step.',
  'admin.signatures.noMatch': 'No request matches “{query}”',
  'admin.signatures.col.flow': 'Flow',
  'admin.signatures.col.record': 'Record',
  'admin.signatures.col.status': 'Status',
  'admin.signatures.col.signers': 'Signers',
  'admin.signatures.col.sent': 'Sent',
  'admin.signatures.col.ended': 'Ended',
  'admin.signatures.col.keepUntil': 'Evidence kept until',
  'admin.signatures.col.signer': 'Signer',
  'admin.signatures.col.role': 'Role',
  'admin.signatures.col.signedAt': 'Signed',
  'admin.signatures.col.verifiedBy': 'Verified by',
  'admin.signatures.col.seq': '#',
  'admin.signatures.col.event': 'Event',
  'admin.signatures.col.at': 'When',
  'admin.signatures.status.sent': 'Sent',
  'admin.signatures.status.inProgress': 'In progress',
  'admin.signatures.status.sealing': 'Sealing',
  'admin.signatures.status.completed': 'Completed',
  'admin.signatures.status.declined': 'Declined',
  'admin.signatures.status.cancelled': 'Cancelled',
  'admin.signatures.status.expired': 'Expired',
  'admin.signatures.signer.waiting': 'Waiting',
  'admin.signatures.signer.sent': 'Link sent',
  'admin.signatures.signer.signed': 'Signed',
  'admin.signatures.signer.declined': 'Declined',
  'admin.signatures.event.sent': 'Request sent',
  'admin.signatures.event.opened': 'Link opened',
  'admin.signatures.event.challengeSent': 'Code sent',
  'admin.signatures.event.challengeVerified': 'Code confirmed',
  'admin.signatures.event.challengeFailed': 'Wrong code',
  'admin.signatures.event.signed': 'Signed',
  'admin.signatures.event.declined': 'Declined',
  'admin.signatures.event.reminded': 'Reminder sent',
  'admin.signatures.event.cancelled': 'Withdrawn',
  'admin.signatures.event.expired': 'Expired',
  'admin.signatures.event.sealed': 'Sealed',
  'admin.signatures.event.completed': 'Completed',
  'admin.signatures.event.delivered': 'Signed copy sent',
  'admin.signatures.event.erased': 'Signer erased',
  'admin.signatures.detail.blurb':
    'One signing request, read-only: its document, its signers and every event of its evidence log.',
  'admin.signatures.detail.expires': 'Links stop working',
  'admin.signatures.detail.document': 'Document fingerprint (SHA-256)',
  'admin.signatures.detail.sealed': 'Sealed',
  'admin.signatures.detail.timestamped': 'Timestamped',
  'admin.signatures.detail.signers': 'Signers',
  'admin.signatures.detail.signersBlurb': 'Who signs, in order, and how each one was verified.',
  'admin.signatures.detail.noSigners': 'This request has no signers.',
  'admin.signatures.detail.timeline': 'Evidence log',
  'admin.signatures.detail.timelineBlurb':
    'Every event of the request, in order. Each one commits to the one before it, so a changed row breaks the log.',
  'admin.signatures.detail.noEvents': 'No events recorded yet.',
  'admin.signatures.detail.export': 'Download the evidence',
  'admin.signatures.detail.exportHint':
    'A JSON file with the frozen document, the signed document, the proof file and the log. Check it with sovrium signature verify.',

  // ── Users (`/users`) ────────────────────────────────────────────────────
  //
  // The blurb says what the page HOLDS, never what the reader may do to it:
  // the same sentence reaches a read-only operator, who may change nothing
  // here. The writes are offered where they are allowed — Invite, the row
  // menu — and drawn only for a reader who may make them.
} as const
