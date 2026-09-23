/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import databaseInfrastructureBody from '@/docs/operations/database-infrastructure.md' with { type: 'file' }
import ecoconceptionBody from '@/docs/operations/ecoconception.md' with { type: 'file' }
import gdprPrivacyBody from '@/docs/operations/gdpr-privacy.md' with { type: 'file' }
import migrationsBody from '@/docs/operations/migrations.md' with { type: 'file' }
import securityHardeningBody from '@/docs/operations/security-hardening.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * Operations — the section manifest.
 *
 * Five articles about running a deployed instance: policy rather than
 * configuration. Each spans the whole engine — a migration touches every
 * table, a security header every response — so none of them is about one
 * property directory and all five sit in the cross-cutting tree.
 *
 * Like every `src/docs/` article they carry no `sovrium:options` directive.
 * The env-var tables here are HAND-WRITTEN on purpose: an environment variable
 * is not an `AppSchema` node, so no walk can produce one, and the operator
 * posture is deliberately outside the app config (ADR 013).
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
        'SQLite as the zero-config default, PostgreSQL through DATABASE_URL, the data directory, the page-render cache, and the standalone binary.',
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
        'US-SECURITY-PROTOTYPE-POLLUTION',
        'US-SECURITY-REMOTE-SCHEMA-SSRF',
        'US-SECURITY-RESPONSE-HEADERS',
        'US-SECURITY-SECURE-COOKIES',
        'US-SECURITY-SQL-INJECTION-RECORD-API',
        'US-SECURITY-STORED-XSS-RECORD-CONTENT',
      ],
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
      slug: 'ecoconception',
      title: 'Ecoconception',
      description:
        'Environmental footprint as a first-class platform property — performance-first by default, frugality opt-in, operator-controlled through ECO_* variables.',
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
  ],
})
