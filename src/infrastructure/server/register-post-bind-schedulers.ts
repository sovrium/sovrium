/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { logHourlyMaintenance } from '@/infrastructure/scheduling/hourly-maintenance'
import { registerAccountPurgeScheduler } from '@/infrastructure/scheduling/register-account-purge'
import { registerActivityLogRetentionScheduler } from '@/infrastructure/scheduling/register-activity-log-retention'
import { registerApprovalExpiryScheduler } from '@/infrastructure/scheduling/register-approval-expiry'
import { registerAuthExpiredRowsSweepScheduler } from '@/infrastructure/scheduling/register-auth-expired-rows-sweep'
import { registerAutomationRunRetentionScheduler } from '@/infrastructure/scheduling/register-automation-run-retention'
import { registerBrowserArtifactSweepScheduler } from '@/infrastructure/scheduling/register-browser-artifact-sweep'
import { registerCronAutomations } from '@/infrastructure/scheduling/register-cron-automations'
import { registerDelayedRunResumeScheduler } from '@/infrastructure/scheduling/register-delayed-run-resume'
import { registerFailureRollupScheduler } from '@/infrastructure/scheduling/register-failure-rollup'
import { registerFormDraftExpiryScheduler } from '@/infrastructure/scheduling/register-form-draft-expiry'
import { registerSignatureEvidenceSweepScheduler } from '@/infrastructure/scheduling/register-signature-evidence-sweep'
import { registerSignatureRequestSweepScheduler } from '@/infrastructure/scheduling/register-signature-request-sweep'
import { registerStuckRunSweepScheduler } from '@/infrastructure/scheduling/register-stuck-run-sweep'
import { registerTableRetentionScheduler } from '@/infrastructure/scheduling/register-table-retention'
import { registerWebhookOutboxScheduler } from '@/infrastructure/scheduling/register-webhook-outbox'
import {
  registerWeeklyDigestScheduler,
  runWeeklyDigestCatchUp,
} from '@/infrastructure/scheduling/register-weekly-digest'
import { fireAgentSchedule } from '@/infrastructure/server/compose-hono-app'
import { registerAgentSchedules } from '@/infrastructure/server/register-agent-schedules'
import type { App } from '@/domain/models/app'

/**
 * Post-bind arm-ups: cron-triggered automations, scheduled agents, and the GDPR Art. 17
 * erasure sweep (hourly; without it, scheduled account erasures would never complete in
 * production — see register-account-purge.ts). Agent schedules were decoded and echoed back
 * for as long as agents have shipped but never armed; without this line `agent.schedule.cron`
 * is a promise the binary does not keep — see register-agent-schedules.ts.
 *
 * Every registrar arms its jobs on the ONE `CronScheduler` the domain runtime carries.
 * None may `Effect.provide(CronSchedulerLive)` for itself, because the scheduler is scoped:
 * one provide each would be one registry per scope, each closing (and interrupting its
 * jobs) the instant its own registration returned. Providing the resolved domain context
 * instead is one build, one registry, one scope — the server's.
 */
export const registerPostBindSchedulers = (app: App) =>
  Effect.all([
    registerCronAutomations(app),
    registerAgentSchedules(app, fireAgentSchedule),
    registerAccountPurgeScheduler(app),
    registerActivityLogRetentionScheduler,
    registerTableRetentionScheduler(app),
    registerAutomationRunRetentionScheduler,
    registerAuthExpiredRowsSweepScheduler,
    registerFailureRollupScheduler(app),
    registerStuckRunSweepScheduler(app),
    registerWebhookOutboxScheduler(app),
    // Approval timeouts: a boot sweep for the requests that expired while
    // the server was stopped — forked on the scheduler's scope, since a
    // resumed run's tail can take minutes and must not hold the banner —
    // then one every minute. Post-bind, because an `onTimeout: approve`
    // resumes its run through this runtime.
    registerApprovalExpiryScheduler(app),
    // Runs parked on a long wait: at boot for those due, then every minute.
    registerDelayedRunResumeScheduler(app),
    registerSignatureRequestSweepScheduler(app), // overdue or unfinished signing requests
    registerSignatureEvidenceSweepScheduler(app), // signing evidence past its `evidence.keep`
    // Browser screenshots past BROWSER_ARTIFACT_RETENTION_DAYS: at boot, then daily.
    registerBrowserArtifactSweepScheduler(app),
    // Saved form drafts past their resume link's life: at boot, then hourly.
    registerFormDraftExpiryScheduler(app),
    // One line: the minute of the hour the three hourly jobs above share.
    logHourlyMaintenance(app.name),
    registerWeeklyDigestScheduler(app),
    // The weekly summary's boot catch-up: one summary for a week missed
    // while the server was down. Post-bind, because it reads every domain
    // the summary covers — the app's own tables included — through this
    // runtime; awaited (the list runs in sequence), so a summary it sends
    // has gone out by the time the banner says the boot is complete. It
    // cannot fail the boot.
    runWeeklyDigestCatchUp(app),
  ])
