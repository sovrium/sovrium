/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium init --git` — put the fresh scaffold under version control.
 *
 * A CONVENIENCE, never a prerequisite. Going back to a previous version of an
 * app does not depend on git: the engine keeps its own history of every config
 * it accepted, because the people this scaffold is for have often never made a
 * commit. `--git` is for the people who have.
 *
 * That framing decides the failure mode. A host with no `git` loses the
 * convenience and keeps the project; failing the whole scaffold over a missing
 * optional tool would be out of all proportion to what was lost.
 */

import { printStderr } from '@/infrastructure/logging/cli-output'

/**
 * The identity on the scaffold commit.
 *
 * Passed per-invocation with `-c` rather than read from the user's git config,
 * because a machine that has never run `git config --global user.email` is
 * precisely the machine this flag exists for — and on it, an inherited
 * identity is no identity and the commit simply fails.
 *
 * `local@sovrium` has no TLD on purpose: it cannot be mistaken for a real
 * mailbox, and nothing will ever try to deliver to it.
 */
const COMMIT_AUTHOR_NAME = 'Sovrium'
const COMMIT_AUTHOR_EMAIL = 'local@sovrium'

const COMMIT_MESSAGE = 'Initial commit from sovrium init'

/**
 * Config forced onto every invocation, so the result does not depend on how
 * the host's git happens to be configured.
 *
 * - `init.defaultBranch` also silences the "using master as the name" advice
 *   git prints on an unconfigured host, which would otherwise be the first
 *   thing a new user sees.
 * - `commit.gpgsign=false` because a globally-signed setup would prompt for a
 *   passphrase — or fail outright — in the middle of a scaffold.
 */
const GIT_CONFIG = [
  '-c',
  'init.defaultBranch=main',
  '-c',
  `user.name=${COMMIT_AUTHOR_NAME}`,
  '-c',
  `user.email=${COMMIT_AUTHOR_EMAIL}`,
  '-c',
  'commit.gpgsign=false',
] as const

/** Run one git invocation in `cwd`, capturing output so a scaffold stays quiet. */
const runGit = async (
  cwd: string,
  args: readonly string[]
): Promise<{ readonly ok: boolean; readonly stderr: string }> => {
  const proc = Bun.spawn(['git', ...GIT_CONFIG, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [exitCode, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
  return { ok: exitCode === 0, stderr }
}

/** True when `git` cannot be resolved on this host at all. */
const isMissingGit = (error: unknown): boolean =>
  error instanceof Error && /enoent|not found|no such file/i.test(error.message)

/**
 * `git init`, stage everything, and land one commit over the scaffold.
 *
 * `add -A` is correct HERE and nowhere else in this repository: the directory
 * was created by this command moments ago and contains nothing but what it
 * wrote, so there is no other party's work to sweep up. The `.gitignore` that
 * `init` also wrote is what keeps `.sovrium/` and `.env` out of the commit —
 * which is why this runs AFTER the support files, not alongside them.
 *
 * Never throws. Every failure path reports on stderr and returns, because the
 * scaffold itself has already succeeded by the time this is called.
 */
export const initGitRepository = async (targetDir: string): Promise<void> => {
  try {
    const init = await runGit(targetDir, ['init', '--quiet'])
    if (!init.ok) {
      printStderr(`Could not run 'git init' — the project was created without a repository.`)
      return
    }

    const staged = await runGit(targetDir, ['add', '-A'])
    if (!staged.ok) {
      printStderr(`Could not stage the new files with git — no commit was made.`)
      return
    }

    const committed = await runGit(targetDir, ['commit', '--quiet', '-m', COMMIT_MESSAGE])
    if (!committed.ok) {
      printStderr(
        `Could not create the first commit — the repository exists but is empty.\n` +
          committed.stderr.trim()
      )
    }
  } catch (error) {
    if (isMissingGit(error)) {
      // The documented outcome on a fresh machine, not an error: say what was
      // skipped and why, and leave the exit code alone.
      printStderr(
        `git is not installed, so --git was skipped — the project itself was created.\n` +
          `Install git and run 'git init' in the project directory to version it.`
      )
      return
    }
    printStderr(
      `Could not initialise a git repository — the project was created without one.\n` +
        (error instanceof Error ? error.message : String(error))
    )
  }
}
