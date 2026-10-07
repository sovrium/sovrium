/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { join } from 'node:path'
import {
  applyPlan,
  blockingFindings,
  findingRow,
  loadSkillsCatalogue,
  planTarget,
  type SkillsCatalogue,
  type SkillsTarget,
  type TargetPlan,
} from '@/cli/commands/skills-files'
import { printDocument, printFailure, type CliLine } from '@/infrastructure/logging/cli-output'

/**
 * `sovrium skills` — write the binary's agent skills into a project.
 *
 * This module is the argv surface and the report; what a run reads, decides
 * and writes is in `skills-files.ts`, which also serves `sovrium init`.
 * Every target is planned before any is written, so a refusal leaves each
 * directory exactly as it was.
 */

/** Every value `--target` accepts, in the order the refusal names them. */
const TARGET_VALUES = ['claude', 'agents', 'all'] as const

/** The old single-agent file every pre-skills template shipped. */
const LEGACY_AGENT_SEGMENTS = ['.claude', 'agents', 'app-editor.md'] as const

/** A skill's description, cut to one line — the listing is a table of contents. */
const summaryOf = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= 100 ? flat : `${flat.slice(0, 99).trimEnd()}…`
}

const successLines = (
  plans: readonly TargetPlan[],
  catalogue: SkillsCatalogue
): readonly CliLine[] =>
  plans.map((plan) => {
    const changed = plan.writes.length + plan.removals.length
    return {
      glyph: 'ok',
      text:
        changed === 0 && plan.manifestCurrent
          ? `Agent skills already current in ${plan.dir} (Sovrium ${catalogue.version}).`
          : `Agent skills for Sovrium ${catalogue.version} written to ${plan.dir} ` +
            `(${plan.writes.length} updated, ${plan.removals.length} removed).`,
    }
  })

const keptRetiredLines = (plans: readonly TargetPlan[]): readonly CliLine[] =>
  plans.flatMap((plan) =>
    plan.keptRetired.map((path): CliLine => ({
      glyph: 'warn',
      text: `${plan.label}/${path} is no longer shipped and you edited it — kept, and no longer tracked.`,
    }))
  )

const legacyAgentLines = async (projectDir: string): Promise<readonly CliLine[]> =>
  (await Bun.file(join(projectDir, ...LEGACY_AGENT_SEGMENTS)).exists())
    ? [
        {
          glyph: 'warn',
          text: `${LEGACY_AGENT_SEGMENTS.join('/')} is superseded by these skills — remove it when you are ready.`,
        },
      ]
    : []

const reportWritten = async (
  plans: readonly TargetPlan[],
  catalogue: SkillsCatalogue,
  projectDir: string
): Promise<void> => {
  const notices = [...keptRetiredLines(plans), ...(await legacyAgentLines(projectDir))]
  printDocument([
    successLines(plans, catalogue),
    catalogue.skills.map(({ name, description }) => ({
      text: name,
      detail: [summaryOf(description)],
    })),
    ...(notices.length > 0 ? [notices] : []),
    [{ text: `Re-run 'sovrium skills' after upgrading the binary to refresh them.` }],
  ])
}

/** The next action for a refusal, by the most serious state it holds. */
const refusalGuidance = (states: ReadonlySet<string>): string => {
  if (states.has('symlink'))
    return (
      'Replace each symlink with a real file or directory (or remove it), then run\n' +
      'sovrium skills again. --force does not apply: Sovrium never writes through a link.'
    )
  if (!states.has('edited'))
    return (
      'Rename or move your own skill directory, then run sovrium skills again.\n' +
      '--force does not apply: it replaces only files Sovrium recorded writing.'
    )
  return (
    "Keep your version, or take Sovrium's with\n  sovrium skills --force\n" +
    '(--force replaces only files Sovrium recorded writing; your own files stay).'
  )
}

const refuse = (plans: readonly TargetPlan[], force: boolean): never => {
  const blocking = plans.flatMap((plan) =>
    blockingFindings(plan, force).map((finding) => ({ plan, finding }))
  )
  const rows = blocking.map(({ plan, finding }) => findingRow(plan, finding))
  printFailure({
    headline: `${rows.length} skill path${rows.length === 1 ? ' is' : 's are'} not Sovrium's to replace — nothing was written.`,
    detail: [
      ...rows,
      '',
      'edited:  Sovrium wrote this file and it has changed since.',
      'foreign: Sovrium never wrote it — no record in .sovrium-skills.json proves otherwise.',
      'symlink: a link, or a skills folder leading outside the project — never written through.',
    ],
    guidance: refusalGuidance(new Set(blocking.map(({ finding }) => finding.state))),
  })
  return process.exit(1)
}

const reportCheck = (plans: readonly TargetPlan[], catalogue: SkillsCatalogue): void => {
  const rows = plans.flatMap((plan) => plan.findings.map((finding) => findingRow(plan, finding)))
  if (rows.length === 0) {
    printDocument([successLines(plans, catalogue)])
    return
  }
  printFailure({
    headline: `The agent skills are not current for Sovrium ${catalogue.version} — nothing was written.`,
    detail: rows,
    guidance:
      "Run 'sovrium skills' to bring them up to date. Edited files need --force;\n" +
      'a foreign directory has to be renamed first.',
  })
  process.exit(1)
}

export interface SkillsCommandOptions {
  /** `--output <dir>` — project root. Defaults to the current directory. */
  readonly outputDir?: string
  /** `--target <value>` — the RAW string; this command owns the refusal. */
  readonly target?: string
  readonly check?: boolean
  readonly force?: boolean
}

const resolveTargets = (raw: string | undefined): readonly SkillsTarget[] => {
  const value = raw ?? 'claude'
  if (value === 'all') return ['claude', 'agents']
  if (value === 'claude' || value === 'agents') return [value]
  printFailure({
    headline: `Unknown --target "${value}".`,
    detail: [`Accepted: ${TARGET_VALUES.join(', ')}.`],
    guidance:
      'Pick where your agent reads skills from:\n' +
      '  claude  .claude/skills/ (Claude Code, Cursor)\n' +
      '  agents  .agents/skills/ (Codex, Copilot, Gemini CLI, OpenCode, Cursor)\n' +
      '  all     both',
  })
  return process.exit(1)
}

const planAll = async (
  catalogue: SkillsCatalogue,
  targets: readonly SkillsTarget[],
  projectDir: string,
  force: boolean
): Promise<readonly TargetPlan[]> =>
  Promise.all(
    targets.map(async (target) => planTarget(catalogue, { projectDir, target, force }))
  ).catch((error: unknown) => {
    printFailure({
      headline: 'Could not read the skills ownership record — nothing was written.',
      detail: [error instanceof Error ? error.message : String(error)],
      guidance:
        'Restore it from version control, or delete it: the next run rebuilds it from\n' +
        'the files still equal to what this version ships.',
    })
    return process.exit(1)
  })

/**
 * Handle `sovrium skills` — write, refresh or check the agent skills.
 *
 * Plans every target before writing any, so a refusal in one directory leaves
 * both untouched: `--target all` either succeeds everywhere or writes nothing.
 */
export const handleSkillsCommand = async (options: SkillsCommandOptions = {}): Promise<void> => {
  const targets = resolveTargets(options.target)
  const projectDir = options.outputDir ?? process.cwd()
  const force = options.force === true
  const catalogue = await loadSkillsCatalogue()
  const plans = await planAll(catalogue, targets, projectDir, force)

  if (options.check === true) {
    reportCheck(plans, catalogue)
    return
  }
  if (plans.some((plan) => blockingFindings(plan, force).length > 0)) return refuse(plans, force)

  await Promise.all(plans.map(applyPlan)).catch((error: unknown) => {
    printFailure({
      headline: `Could not write the agent skills into ${projectDir}.`,
      detail: [error instanceof Error ? error.message : String(error)],
      guidance:
        'Check the directory exists and is writable, or pass a different one with\n' +
        '  sovrium skills --output <dir>',
    })
    return process.exit(1)
  })
  await reportWritten(plans, catalogue, projectDir)
}
