/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import licensesBody from '@/cli/commands/licenses.docs.md' with { type: 'file' }
import databaseInfrastructureBody from '@/docs/operations/database-infrastructure.md' with { type: 'file' }
import ecoconceptionBody from '@/docs/operations/ecoconception.md' with { type: 'file' }
import gdprPrivacyBody from '@/docs/operations/gdpr-privacy.md' with { type: 'file' }
import logsAndPersonalDataBody from '@/docs/operations/logs-and-personal-data.md' with { type: 'file' }
import migrationsBody from '@/docs/operations/migrations.md' with { type: 'file' }
import notificationsBody from '@/docs/operations/notifications.md' with { type: 'file' }
import securityHardeningBody from '@/docs/operations/security-hardening.md' with { type: 'file' }
import securityModelBody from '@/docs/operations/security-model.md' with { type: 'file' }
import signingKeysBody from '@/docs/operations/signing-keys.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * Operations — the section manifest.
 *
 * Why every article sits in the cross-cutting tree with hand-written
 * env-var tables:
 * `[internal ref]`, § `operations`.
 * Shape, ordering and the gates that hold a manifest: the same page,
 * "The conventions every manifest follows".
 */
export const section = defineSection({
  slug: 'operations',
  title: 'Operations',
  order: 1600,
  tab: 'operate',
  articles: [
    defineArticle({
      slug: 'database-infrastructure',
      title: 'Database Infrastructure',
      description:
        'SQLite as the zero-config default, PostgreSQL through DATABASE_URL, the data directory, the page-render cache, memory sizing in a container, and the binary.',
      keywords: [
        'sovrium',
        'database',
        'SQLite',
        'PostgreSQL',
        'DATABASE_URL',
        'zero-config',
        'SOVRIUM_DATA_DIR',
        'page cache',
        'ECO_PAGE_CACHE',
        'ECO_PAGE_CACHE_MAX_MB',
        'memory',
        'container',
        'BUN_JSC_forceRAMSize',
        'binary',
        'distribution',
        'embedded',
      ],
      order: 1600,
      sidebarLabel: 'Database Infrastructure',
      body: databaseInfrastructureBody,
      documents: [],
      stories: [
        'US-INFRASTRUCTURE-BINARY-PACKAGING-TIER-001',
        'US-INFRASTRUCTURE-BINARY-PACKAGING-TIER-002',
        'US-INFRASTRUCTURE-BINARY-PACKAGING-TIER-003',
        'US-INFRASTRUCTURE-BINARY-PACKAGING-TIER-004',
        'US-INFRASTRUCTURE-BINARY-PACKAGING-TIER-005',
        'US-INFRASTRUCTURE-BINARY-PACKAGING-TIER-006',
        'US-INFRASTRUCTURE-BINARY-PACKAGING-TIER-007',
        'US-INFRASTRUCTURE-CROSS-DIALECT-CATALOG-HELPERS',
        'US-INFRASTRUCTURE-PAGE-RENDER-CACHE',
        'US-INFRASTRUCTURE-RETENTION-SWEEPS',
      ],
    }),
    defineArticle({
      slug: 'migrations',
      title: 'Schema Migrations',
      description:
        'Automatic schema evolution — Sovrium diffs your config against the database on boot and applies the migration in a transaction.',
      keywords: [
        'sovrium',
        'migrations',
        'schema evolution',
        'checksum validation',
        'rollback',
        'migration history',
        'audit trail',
        'additive DDL',
        'destructive DDL',
        'transaction',
        'boot-time',
      ],
      order: 1610,
      sidebarLabel: 'Schema Migrations',
      body: migrationsBody,
      documents: [],
      stories: [
        'US-MIGRATIONS-ATTACHMENT-URL-BUCKET-BACKFILL',
        'US-MIGRATIONS-BOOT-MIGRATION-ORDERING',
        'US-MIGRATIONS-MIGRATION-SYSTEM',
        'US-MIGRATIONS-POPULATED-UPGRADE-PATH',
        'US-MIGRATIONS-SCHEMA-EVOLUTION-ADD-RELATIONSHIP',
        'US-MIGRATIONS-SCHEMA-EVOLUTION-FIELD-IDENTITY',
        'US-MIGRATIONS-SCHEMA-EVOLUTION-FK-SAFETY',
        'US-MIGRATIONS-SCHEMA-EVOLUTION-INDEXES-VIEWS',
        'US-MIGRATIONS-SCHEMA-EVOLUTION-PROPERTIES',
        'US-MIGRATIONS-SCHEMA-EVOLUTION-STRUCTURE',
        'US-MIGRATIONS-SCHEMA-EVOLUTION-TABLE-IDENTITY',
        'US-MIGRATIONS-SCHEMA-EVOLUTION-TYPE-PREFLIGHT',
        'US-MIGRATIONS-SCOPE-TABLE-UPGRADE-IDEMPOTENCY',
        'US-MIGRATIONS-UPGRADE-PATH-IDEMPOTENCY',
        'US-MIGRATIONS-USER-FOREIGN-KEY-RECONCILIATION',
      ],
    }),
    defineArticle({
      slug: 'security-hardening',
      title: 'Security Hardening',
      description:
        'Hardened response headers, CSRF and cross-origin enforcement, rate limiting, and 404-not-403 anti-enumeration, applied in code on every response.',
      keywords: [
        'sovrium',
        'security',
        'HTTP headers',
        'HSTS',
        'CSP',
        'CSRF',
        'cross-origin',
        'rate limiting',
        '404 not 403',
        'anti-enumeration',
        'secure cookies',
        'defense in depth',
      ],
      order: 1620,
      sidebarLabel: 'Security Hardening',
      body: securityHardeningBody,
      documents: [],
      stories: [
        'US-SECURITY-CORS-ALLOWLIST',
        'US-SECURITY-CSRF-ENFORCEMENT',
        'US-SECURITY-FILE-ACTION-SSRF',
        'US-SECURITY-OUTBOUND-SSRF-SURFACES',
        'US-SECURITY-PREVIEW-TOKEN',
        'US-SECURITY-PROTOTYPE-POLLUTION',
        'US-SECURITY-REMOTE-SCHEMA-SSRF',
        'US-SECURITY-RESPONSE-HEADERS',
        'US-SECURITY-SECURE-COOKIES',
        'US-SECURITY-SQL-INJECTION-RECORD-API',
        'US-SECURITY-STORED-XSS-RECORD-CONTENT',
      ],
    }),
    defineArticle({
      slug: 'security-model',
      title: 'Security Model',
      description:
        "Who can reach your data and through which door: the database stays private, every read and write passes the engine's checks, and owner-only rows take one line.",
      keywords: [
        'sovrium',
        'security model',
        'threat model',
        'row level security',
        'RLS',
        'row-level permissions',
        'owner-only rows',
        'created-by',
        '$currentUser',
        'database exposure',
        'anti-enumeration',
        'defense in depth',
      ],
      order: 1625,
      sidebarLabel: 'Security Model',
      body: securityModelBody,
      documents: [],
      // The row-level stories are cited by Table Permissions, which owns the
      // rules; this article explains the model they sit in.
      stories: [],
    }),
    defineArticle({
      slug: 'gdpr-privacy',
      title: 'GDPR & Privacy',
      description:
        'Self-service data export and account erasure, with the erasure census and its known residuals stated in full.',
      keywords: [
        'sovrium',
        'GDPR',
        'privacy',
        'data export',
        'account deletion',
        'right to erasure',
        'right to be forgotten',
        'hard delete',
        'Article 15',
        'Article 17',
        'Article 20',
        'grace period',
      ],
      order: 1630,
      sidebarLabel: 'GDPR & Privacy',
      body: gdprPrivacyBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'logs-and-personal-data',
      title: 'Logs and Personal Data',
      description:
        'What the server logs, what it redacts by default, what an operator must still treat as personal data, and how logs relate to retention and erasure.',
      keywords: [
        'sovrium',
        'logs',
        'logging',
        'personal data',
        'GDPR',
        'redaction',
        'retention',
        'erasure',
        'LOG_LEVEL',
        'OTLP',
        'SENTRY_DSN',
      ],
      order: 1635,
      sidebarLabel: 'Logs and Personal Data',
      body: logsAndPersonalDataBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'ecoconception',
      title: 'Ecoconception',
      description:
        'Environmental footprint as a platform property: performance-first by default, frugality opt-in via `ECO_*` variables, measured by the `X-Eco-Index` header.',
      keywords: [
        'sovrium',
        'ecoconception',
        'sustainability',
        'environmental footprint',
        'ECO_MODE',
        'ECO_PAGE_CACHE',
        'X-Eco-Index',
        'low-data mode',
        'RGESN',
        'opt-in frugality',
      ],
      order: 1640,
      sidebarLabel: 'Ecoconception',
      body: ecoconceptionBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'notifications',
      title: 'Operator Notifications',
      description:
        'The two emails an instance sends its operators on its own, automation alerts and a weekly summary: who gets them, what they say, the variables that shape them.',
      keywords: [
        'sovrium',
        'notifications',
        'email',
        'automation alerts',
        'weekly summary',
        'digest',
        'SOVRIUM_NOTIFY_TO',
        'SOVRIUM_NOTIFY_AUTOMATIONS',
        'SOVRIUM_NOTIFY_DIGEST',
        'SOVRIUM_NOTIFY_DIGEST_CRON',
        'SOVRIUM_AUTOMATION_AUTOPAUSE',
        'SOVRIUM_TIMEZONE',
      ],
      order: 1650,
      sidebarLabel: 'Operator Notifications',
      body: notificationsBody,
      documents: [],
      // The alert stories are cited by the automations articles that own them
      // (a story is cited by one article); this one owns the weekly summary.
      stories: ['US-ADMIN-NOTIFICATIONS-WEEKLY-DIGEST'],
    }),
    defineArticle({
      slug: 'signing-keys',
      title: 'Signing Keys',
      description:
        'The four SIGNATURE_* variables: the organisation seal, the timestamp authority that anchors the evidence, and the one-time-code secret.',
      keywords: [
        'sovrium',
        'signing keys',
        'organisation seal',
        'timestamp authority',
        'pkcs12',
        'SIGNATURE_SEAL_KEY',
        'SIGNATURE_SEAL_CERT_CHAIN',
        'SIGNATURE_TSA_URL',
        'SIGNATURE_OTP_SECRET',
      ],
      order: 1655,
      sidebarLabel: 'Signing Keys',
      body: signingKeysBody,
      documents: [],
      stories: ['US-SIGNATURES-SEAL-AND-TIMESTAMP'],
    }),
    defineArticle({
      slug: 'third-party-licenses',
      title: 'Third-Party Licenses',
      description:
        'Print the license notice of every third-party component the binary carries — version, copyright and license text — offline, from the binary.',
      keywords: ['sovrium licenses', 'third-party licenses', 'MPL-2.0', 'OFL-1.1', 'attribution'],
      order: 1660,
      sidebarLabel: 'Third-Party Licenses',
      body: licensesBody,
      documents: [],
      stories: ['US-CLI-COMMANDS-LICENSES'],
    }),
  ],
})
