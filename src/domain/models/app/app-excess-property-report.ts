/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The decode reporter, bound to THIS app's migration knowledge.
 *
 * The reporter itself is feature-free and lives in `kernel/config-parsing/`:
 * the issue-tree walk and its design (`decode-issue-walk.ts`), the union choice
 * (`decode-union-choice.ts`), the finding vocabulary (`decode-findings.ts`), the
 * settled problems (`decode-problems.ts`), the prose and machine renderings with
 * THE ECHO RULE (`decode-report-format.ts`) and where a problem lives in the
 * author's files (`decode-source-attribution.ts`).
 *
 * What only the app knows is where a REMOVED key, a RETIRED component type, a
 * retired action and a retired value now live. That knowledge is bound here,
 * once, so every caller reads the same hints and none of them can forget one.
 */

import {
  collectDecodeFindings as collectFindingsWith,
  collectDecodeProblems as collectProblemsWith,
  collectExcessPropertyFindings as collectExcessWith,
  type DecodeHints,
} from '@/domain/kernel/config-parsing/decode-problems'
import { formatDecodeReport } from '@/domain/kernel/config-parsing/decode-report-format'
import { migrationHintForRetiredComponentType } from './pages/components/component-types/retired-types'
import {
  appendRetiredValueHint,
  migrationHintForRetiredAction,
} from './pages/components/component-types/retired-values'
import { migrationHintForExcessKey } from './removed-key-hints'
import type {
  DecodeFinding,
  ExcessPropertyFinding,
} from '@/domain/kernel/config-parsing/decode-findings'
import type { SchemaIssue } from 'effect'

/** This app's migration knowledge, as the reporter asks for it. */
const APP_DECODE_HINTS: DecodeHints = {
  excessKey: migrationHintForExcessKey,
  retiredComponentType: migrationHintForRetiredComponentType,
  retiredAction: migrationHintForRetiredAction,
  retiredValueLines: appendRetiredValueHint,
}

/**
 * Everything the reporter can say about a decode failure, located and explained.
 *
 * Empty when the decode failed for some other reason (a missing required field,
 * a bad value); the caller falls back to the decoder's own formatter so no
 * failure is ever swallowed. Pure.
 */
export const collectDecodeFindings = (issue: SchemaIssue.Issue): readonly DecodeFinding[] =>
  collectFindingsWith(issue, APP_DECODE_HINTS)

/**
 * EVERY problem in a decode failure, one per mistake, in document order when
 * `document` (the config as parsed) is given. Pure.
 */
export const collectDecodeProblems = (
  issue: SchemaIssue.Issue,
  document?: unknown
): readonly DecodeFinding[] => collectProblemsWith(issue, APP_DECODE_HINTS, document)

/** Every unrecognised property the decoder rejected, located and explained. Pure. */
export const collectExcessPropertyFindings = (
  issue: SchemaIssue.Issue
): readonly ExcessPropertyFinding[] => collectExcessWith(issue, APP_DECODE_HINTS)

/**
 * The whole pipeline: issue tree in, report lines out, empty when the reporter
 * has nothing better to say than the decoder does. Pure.
 */
export const buildDecodeIssueReport = (
  issue: SchemaIssue.Issue,
  refSources: ReadonlyMap<string, string>
): readonly string[] => formatDecodeReport(collectDecodeFindings(issue), refSources)
