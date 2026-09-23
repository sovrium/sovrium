/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import backupRestoreSqliteBody from '@/docs/guides/backup-restore-sqlite.md' with { type: 'file' }
import upgradeRollbackBody from '@/docs/guides/upgrade-rollback.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * Guides: operations — the section manifest.
 *
 * Two guides for running an app for the long haul. They are procedures, where
 * `operations` next door is policy: this one tells you which commands to run,
 * that one tells you what the engine guarantees while you run them.
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
        'Take a consistent backup of an app on the SQLite default, and restore it — one file holds all your data.',
      keywords: [
        'sovrium',
        'backup',
        'restore',
        'sqlite',
        'database',
        'data directory',
        'disaster recovery',
        'wal',
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
  ],
})
