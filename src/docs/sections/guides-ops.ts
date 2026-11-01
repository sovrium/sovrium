/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import analyticsAndConsentBody from '@/docs/guides/analytics-and-consent.md' with { type: 'file' }
import backupRestoreSqliteBody from '@/docs/guides/backup-restore-sqlite.md' with { type: 'file' }
import upgradeNotesEarlierBody from '@/docs/guides/upgrade-notes-earlier.md' with { type: 'file' }
import upgradeRollbackBody from '@/docs/guides/upgrade-rollback.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * Guides: operations — the section manifest.
 *
 * How this section differs from `operations`:
 * `[internal ref]`, § `the four guides-* sections`.
 * Shape, ordering and the gates that hold a manifest: the same page,
 * "The conventions every manifest follows".
 */
export const section = defineSection({
  slug: 'guides-ops',
  title: 'Guides: Operations',
  order: 10_600,
  tab: 'guides',
  articles: [
    defineArticle({
      slug: 'backup-restore-sqlite',
      title: 'Back up and restore a Sovrium SQLite database',
      description:
        'Back up an app on the SQLite default with sovrium backup — database, key, config and uploads in one archive — and restore it with sovrium restore.',
      keywords: [
        'sovrium',
        'backup',
        'restore',
        'sqlite',
        'database',
        'data directory',
        'disaster recovery',
        'sovrium backup',
        'sovrium restore',
      ],
      order: 10_600,
      sidebarLabel: 'Back up & restore SQLite',
      body: backupRestoreSqliteBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'upgrade-rollback',
      title: 'Upgrade and roll back a Sovrium app',
      description:
        'Move a Sovrium app to a new version safely, and roll back by restoring the backup with the prior binary.',
      keywords: [
        'sovrium',
        'upgrade',
        'rollback',
        'version',
        'migration',
        'sovrium update',
        'safe deploy',
        'downgrade',
      ],
      order: 10_610,
      sidebarLabel: 'Upgrade & rollback',
      body: upgradeRollbackBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'upgrade-notes-earlier',
      title: 'Upgrade notes for earlier releases',
      description:
        'What changed between older Sovrium releases, for an app that moves across several versions at once.',
      keywords: [
        'sovrium',
        'upgrade',
        'release notes',
        'breaking changes',
        'version',
        'migration',
        'sovrium validate',
      ],
      order: 10_620,
      sidebarLabel: 'Earlier upgrade notes',
      body: upgradeNotesEarlierBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'analytics-and-consent',
      title: 'Set up analytics and visitor consent',
      description:
        'Choose what the built-in analytics stores, whether it waits for acceptance and how visitors object, and see what each choice leaves for you to decide.',
      keywords: [
        'sovrium',
        'analytics',
        'consent',
        'consent banner',
        'opt-out',
        'global privacy control',
        'do not track',
        'privacy notice',
        'cnil',
      ],
      order: 10_630,
      sidebarLabel: 'Analytics & consent',
      body: analyticsAndConsentBody,
      documents: [],
      stories: [],
    }),
  ],
})
