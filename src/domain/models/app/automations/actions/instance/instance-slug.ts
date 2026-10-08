/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The name of a supervised app: lowercase letters, digits and `-`, 2 to 28
 * characters, starting and ending with a letter or a digit.
 *
 * It is the ONLY caller-supplied value that ever reaches a `systemctl` or
 * `journalctl` command line (as `sovrium-app@<slug>.service`), and it names the
 * instance's directory under `SOVRIUM_INSTANCES_DIR`. No `.`, `/`, `_`, space
 * or uppercase letter can appear in it, so it can neither escape that directory
 * nor name another unit.
 *
 * 28 is the systemd ceiling, not a taste: the host runs each app as the system
 * user `sa-<slug>`, and systemd refuses a user name longer than 31 characters.
 */
export const INSTANCE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,26}[a-z0-9]$/

/**
 * A prop written as one whole template — `{{loop.item.slug}}` — whose value is
 * only known when the step runs. The handler checks the RESOLVED value against
 * the same rule before anything is spawned or written; a value mixing literal
 * text and a template (`app-{{x}}`) is refused here, so every slug is either
 * checked now or checked whole later.
 */
const WHOLE_TEMPLATE_PATTERN = /^\{\{[^{}]+\}\}$/

/** True when the value is exactly one `{{…}}` expression. */
export const isWholeTemplate = (value: string): boolean => WHOLE_TEMPLATE_PATTERN.test(value)

/**
 * A string checked against `pattern` when written literally, or a whole
 * template whose resolved value the handler checks against the same pattern.
 */
export const literalOrWholeTemplate = (
  pattern: Readonly<RegExp>,
  rule: string,
  description: string
) =>
  Schema.String.annotate({ description }).check(
    Schema.makeFilter((value: string) =>
      pattern.test(value) || isWholeTemplate(value)
        ? undefined
        : `${rule}, or one whole {{template}} resolving to one (got "${value}")`
    )
  )

export const InstanceSlugSchema = literalOrWholeTemplate(
  INSTANCE_SLUG_PATTERN,
  'a slug of 2 to 28 lowercase letters, digits and "-", starting and ending with a letter or digit',
  'Name of the supervised app: 2 to 28 lowercase letters, digits and "-", starting and ending with a letter or digit, or one whole {{template}} resolving to one. 28 keeps the app’s system user sa-<slug> within the 31-character limit systemd puts on a user name. It selects the units sovrium-app@<slug>.service and .socket and the directory <SOVRIUM_INSTANCES_DIR>/<slug>'
)

/** @public */
export type InstanceSlug = Schema.Schema.Type<typeof InstanceSlugSchema>

/** A prop written as exactly one `{{…}}` expression, resolved when the step runs. */
export const wholeTemplate = (description: string) =>
  Schema.String.annotate({ description }).check(
    Schema.makeFilter((value: string) =>
      isWholeTemplate(value) ? undefined : `one whole {{template}} (got "${value}")`
    )
  )
