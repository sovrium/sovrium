/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import signatureVerifyBody from '@/cli/commands/signature.docs.md' with { type: 'file' }
import { SignatureFlowSchema } from '@/domain/models/app/signatures'
import signingFlowsBody from '@/domain/models/app/signatures/signatures.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * Signatures — the section manifest.
 *
 * Every `body` is imported `with { type: 'file' }`, so the value is a PATH and
 * the prose is never loaded until something reads it. Shape, ordering and the
 * gates that hold a manifest: `[internal ref]`.
 */
export const signatures = defineSection({
  slug: 'signatures',
  title: 'Signatures',
  order: 5600,
  tab: 'automations',
  articles: [
    defineArticle({
      slug: 'signing-flows',
      title: 'Signing Flows',
      description:
        'Ask people to sign the PDF a record holds through a link of their own, verify them by code, and keep an evidence file of every step.',
      keywords: [
        'sovrium',
        'electronic signature',
        'signing flow',
        'signature request',
        'evidence file',
        'one-time code',
        'pdf signing',
      ],
      order: 10,
      sidebarLabel: 'Signing flows',
      body: signingFlowsBody,
      documents: [SignatureFlowSchema],
      // The seal and timestamp story is cited by Signing Keys, which owns the
      // variables it turns on (a story is cited by one article).
      stories: [
        'US-SIGNATURES-CONFIGURATION',
        'US-SIGNATURES-REQUEST-LIFECYCLE',
        'US-AUTOMATIONS-ACTIONS-SIGNATURE-SEND-AND-CANCEL',
        'US-AUTOMATIONS-TRIGGERS-SIGNATURE-TRIGGER',
        'US-SIGNATURES-SIGNING-SURFACE',
        'US-SIGNATURES-OTP-VERIFICATION',
        'US-SIGNATURES-REMINDERS-AND-SMS',
        'US-SIGNATURES-PLACEMENT-AND-PROOF',
        'US-SIGNATURES-EVIDENCE-CHAIN',
        'US-SIGNATURES-EVIDENCE-RETENTION',
      ],
    }),
    defineArticle({
      slug: 'signature-verify',
      title: 'Verifying a Signing Export',
      description:
        'Check a signing export offline with sovrium signature verify: every file, every event of the hash chain and the document each signer signed.',
      keywords: [
        'sovrium signature verify',
        'evidence export',
        'hash chain',
        'offline verification',
        'evidence file',
      ],
      order: 20,
      sidebarLabel: 'Verifying an export',
      body: signatureVerifyBody,
      documents: [],
      stories: ['US-CLI-COMMANDS-SIGNATURE-VERIFY'],
    }),
  ],
})
