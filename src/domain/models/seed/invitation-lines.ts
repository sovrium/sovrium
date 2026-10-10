/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The line a seed run prints for each invitation it issues, and the same line
 * with its link withheld.
 *
 * The link carries the invitation's token: whoever holds it can accept the
 * invitation. A run on a terminal prints it once, because nothing else ever
 * shows it. A run whose output is KEPT — a `--report` file, the journal of a
 * hosting machine's seed unit, the run history of the automation that started
 * it — must not, so those lines keep the email and say how to send the
 * invitation instead.
 */

/** What stands in for a link the output does not carry. */
export const WITHHELD_INVITATION_LINK = 'link withheld; send it with Resend in the console'

/** `invitation: <email> → <link>` — the shape every run prints. */
export const invitationLine = (email: string, link: string): string =>
  `invitation: ${email} → ${link}`

/** An invitation line, the email captured. A table line never holds the arrow. */
const INVITATION_LINE = /^invitation: (\S+) → .+$/u

/** `lines` with every invitation link replaced by {@link WITHHELD_INVITATION_LINK}. */
export const withholdInvitationLinks = (lines: readonly string[]): readonly string[] =>
  lines.map((line) => {
    const email = INVITATION_LINE.exec(line)?.[1]
    return email === undefined ? line : invitationLine(email, WITHHELD_INVITATION_LINK)
  })
