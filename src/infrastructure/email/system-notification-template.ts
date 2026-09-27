/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The template every operator email the instance sends on its own is rendered
 * with — the automation-failure alert today, the weekly summary next.
 *
 * One template, so every operator email reads the same way: the app name in
 * the subject, a title, one short paragraph, a few labelled sections, at most
 * one action, and a footer that says where to switch the email off. Every piece
 * of text is data — an automation name, an error message an upstream echoed
 * back — so EVERY interpolation into the HTML part is escaped, with the one
 * canonical `escapeHtml`. Nothing here is rich text, so the rich-text sanitizer
 * is the wrong tool: an error message is shown as the characters it holds.
 */

import { escapeHtml } from '@/domain/kernel/markdown/markdown-renderer'
import { emailLayout } from './templates'

/**
 * A labelled block of lines, e.g. `Automation: …` / `Error: …`. A run of
 * consecutive lines starting with `- ` renders as one HTML list; `nowrap` keeps
 * a short line (a date range) from breaking in a narrow mail client.
 */
export interface SystemNotificationSection {
  readonly heading?: string
  readonly lines: readonly string[]
  readonly nowrap?: true
}

/** A link, rendered as a button (the action) or a footer link. */
export interface SystemNotificationLink {
  readonly label: string
  readonly href: string
}

/** What {@link renderSystemNotification} renders. */
export interface SystemNotificationInput {
  /** The app's own name — heads the email and opens the subject in square brackets. */
  readonly appName: string
  /** `formatAppIdentity(...)` — the versions, printed in the footer. */
  readonly appIdentity: string
  /** The subject after the app name, and the email's own heading. */
  readonly title: string
  readonly intro: string
  readonly sections: readonly SystemNotificationSection[]
  readonly action?: SystemNotificationLink
  readonly footerLinks: readonly SystemNotificationLink[]
}

/** A rendered operator email. */
export interface SystemNotificationEmail {
  readonly subject: string
  readonly html: string
  readonly text: string
}

const LIST_MARKER = '- '

/** Consecutive lines grouped by kind: a run of `- ` items, or a run of prose. */
type LineRun =
  | { readonly kind: 'list'; readonly lines: readonly string[] }
  | { readonly kind: 'prose'; readonly lines: readonly string[] }

const groupRuns = (lines: readonly string[]): readonly LineRun[] =>
  lines.reduce<readonly LineRun[]>((runs, line) => {
    const kind = line.startsWith(LIST_MARKER) ? 'list' : 'prose'
    const text = kind === 'list' ? line.slice(LIST_MARKER.length) : line
    const last = runs[runs.length - 1]
    return last !== undefined && last.kind === kind
      ? [...runs.slice(0, -1), { kind, lines: [...last.lines, text] }]
      : [...runs, { kind, lines: [text] }]
  }, [])

const runHtml = (run: LineRun, paragraphStyle: string): string =>
  run.kind === 'list'
    ? `<ul>${run.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`
    : `<p style="${paragraphStyle}">${run.lines.map((line) => escapeHtml(line)).join('<br>')}</p>`

const sectionHtml = (section: SystemNotificationSection): string => {
  const heading =
    section.heading === undefined
      ? ''
      : `<h3 style="margin-bottom:4px">${escapeHtml(section.heading)}</h3>`
  const paragraphStyle = section.nowrap === true ? 'white-space:nowrap' : 'white-space:pre-wrap'
  return `${heading}${groupRuns(section.lines)
    .map((run) => runHtml(run, paragraphStyle))
    .join('')}`
}

const linkHtml = (link: SystemNotificationLink, className?: string): string =>
  `<a href="${escapeHtml(link.href)}"${className === undefined ? '' : ` class="${className}"`}>${escapeHtml(link.label)}</a>`

const sectionText = (section: SystemNotificationSection): string =>
  [...(section.heading === undefined ? [] : [section.heading]), ...section.lines].join('\n')

const renderHtml = (input: SystemNotificationInput): string => {
  const action =
    input.action === undefined
      ? ''
      : `<p style="text-align: center;">${linkHtml(input.action, 'button')}</p>`
  const content = `
    <div class="content">
      <h2>${escapeHtml(input.title)}</h2>
      <p>${escapeHtml(input.intro)}</p>
      ${input.sections.map(sectionHtml).join('\n')}
      ${action}
    </div>
  `
  const footer = input.footerLinks.map((link) => `<p>${linkHtml(link)}</p>`).join('')
  return emailLayout(content, {
    appName: input.appName,
    footerHtml: `<p>${escapeHtml(input.appIdentity)}</p>${footer}`,
  })
}

const renderText = (input: SystemNotificationInput): string =>
  [
    input.title,
    '',
    input.intro,
    ...input.sections.flatMap((section) => ['', sectionText(section)]),
    ...(input.action === undefined ? [] : ['', `${input.action.label}: ${input.action.href}`]),
    '',
    '---',
    input.appIdentity,
    ...input.footerLinks.map((link) => `${link.label}: ${link.href}`),
  ].join('\n')

/**
 * Render one operator email. The subject is plain text and opens with the app's
 * name — `[acme-ops] Automation failed: …` — so an operator running several
 * apps knows which one is speaking before opening it; the versions stay in the
 * footer, where they do not crowd an inbox line.
 */
export const renderSystemNotification = (
  input: SystemNotificationInput
): SystemNotificationEmail => ({
  subject: `[${input.appName}] ${input.title}`,
  html: renderHtml(input),
  text: renderText(input),
})
