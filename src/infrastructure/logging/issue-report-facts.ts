/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import {
  databaseKindOf,
  installChannelOf,
  secretEnvValues,
  type IssueReportFacts,
  type ReportScrub,
} from '@/domain/kernel/url/issue-report-failure'
import { parseProjectDir } from '@/domain/models/process-env/desktop'
import { isCompiled } from '@/infrastructure/process/package-paths'
import { getSovriumVersionSync } from '@/infrastructure/process/version'

type Env = Readonly<Record<string, string | undefined>>

/**
 * The installation facts a bug report carries, read off this process: its
 * version, platform, install channel and database kind. Reads only what the
 * process already holds — `DATABASE_URL` is read for its scheme, never dialled.
 */
export const readIssueReportFacts = (env: Env = process.env): IssueReportFacts => ({
  version: getSovriumVersionSync(),
  os: `${process.platform} ${process.arch}`,
  installChannel: installChannelOf({
    marker: env['SOVRIUM_INSTALL_METHOD'],
    execPath: process.execPath,
    compiled: isCompiled,
  }),
  database: databaseKindOf(env['DATABASE_URL']),
})

/** `dir` and the directory it resolves to, which differ under a symlink (`/var` → `/private/var`). */
const spellingsOf = (dir: string): readonly string[] => {
  try {
    return [dir, realpathSync(dir)]
  } catch {
    // A directory that cannot be resolved is still worth scrubbing as written.
    return [dir]
  }
}

/**
 * What a report made on this machine is cleaned of: the values of its
 * secret-named variables, the project and working directories, and the home
 * directory.
 */
export const readReportScrub = (env: Env = process.env): ReportScrub => ({
  secretValues: secretEnvValues(env),
  projectDirs: [...new Set([...spellingsOf(parseProjectDir()), ...spellingsOf(process.cwd())])],
  home: homedir(),
})
