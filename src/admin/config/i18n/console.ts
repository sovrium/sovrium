/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console's own string table: the overview, the account cluster, and the
// three unauthenticated auth surfaces.
//
// Split from `chrome.ts` (shell, breadcrumbs, document titles), `data.ts` (the
// operator-data surfaces), `developers.ts` (API/MCP/schema) and
// `design-system.ts`. One alphabetised object appended to by every migration in
// flight is a merge conflict per commit; `app.ts` merges the halves, so a key's
// HOME is an authoring convenience and its ADDRESS never moves.
//
// ─── WHERE A `$t:` TOKEN RESOLVES (RE-MEASURED 2026-09-18) ──────────────────
//
// Measured by serving the console and reading the HTML for the resolved value
// versus the raw key, in English and in French. This table has now been wrong
// twice in opposite directions, so read the dates rather than the confidence:
// the 2026-09-06 revision corrected a false claim about `props`, and its own
// RAW KEY half went stale when `resolveComponentTranslationTokens` landed.
//
//   RESOLVES  component `content`
//   RESOLVES  page `meta.title` (and the rest of the meta block)
//   RESOLVES  breadcrumb `labels[segment]` and `home.label`
//   RESOLVES  `props['aria-label']` — on a plain element AND on an island host
//   RESOLVES  AUTH-form `submitLabel`, `pendingLabel`, `fields[].label`
//   RESOLVES  ENDPOINT-form `submitLabel` and `fields[].label`   ← was RAW KEY
//   RESOLVES  `kpi.label`                                        ← was RAW KEY
//   RESOLVES  `table` `columns[].label`, `valueLabels`,          ← was RAW KEY
//             `emptyMessage`
//   RESOLVES  `matrix` / `graph` `label` and `emptyMessage`
//   RESOLVES  a tab caption (via `buildTabsItems` → `localizeChildLabel`)
//   RESOLVES  a sidebar `navItems[]` `label` and a group `landmark`
//
//   RAW KEY   a `graph` `columns[].label` / `lanes.label` /
//             `lanes.stations.label`, and a `matrix` `cell.flag.label`
//
//   UNVERIFIED SINCE the pass landed — probe before keying: a row action's
//   `label` / `confirm.*` / success toast, a button's `confirm.*` and
//   `action.onSuccess.message`, an auth-form's `onSuccess.toast.message`,
//   `select` `options[].label` and `emptyOption.label`, chart `series[].label`,
//   `table` `noMatchMessage` and `search.placeholder`.
//
// WHY THE LIST MOVED. `resolveComponentTranslationTokens`
// (`src/presentation/render/i18n/translation-handler.ts:245`, called from
// `component-renderer.tsx:367`) walks a component's own schema-level fields
// BEFORE island props are built, skipping only `props`, `children`, `content`,
// `panels`, `responsive`, `i18n`, `graphView` and `matrixView` — each of which
// another pass owns. So "a field an island re-reads out of the component" is no
// longer a reason a token ships raw, and the old auth-form / endpoint-form
// split has collapsed: both resolve.
//
// WHY THE ONE RAW KEY ROW SURVIVES, and it is ordering rather than depth. The
// graph and matrix RESOLVERS project their authored axis config into a
// render-time `graphView` / `matrixView` (`graph-resolver.ts:163`,
// `matrix-graph-resolver.ts:155`) before that pass runs, and those two keys are
// exactly the ones it skips — so the drawing is built from the untranslated
// original. Six captions in `organisation.ts` are literals for this reason,
// each carrying its French in a comment.
//
// The rule to author by is unchanged: key what this table says resolves; for
// anything in the UNVERIFIED block, plant a probe and read the HTML first.
//
// ─── THE `admin.locked.*` NAMESPACE ────────────────────────────────────────
//
// A key under `admin.locked.` marks a PLATFORM-PINNED string: one that must read
// the same on every deployment of a release. There is no operator override seam
// for it to defend against — the console ships as a preset compiled into the
// binary, and an operator's config cannot restate its strings — so the prefix is
// a standing classification carried by the key itself, naming which strings would
// have to stay pinned if such a seam were ever added.
//
// Three classes are reserved. Only ONE of them has keys today, and the reason
// the other two are empty is worth stating so nobody concludes they were
// forgotten:
//
//   `admin.locked.audit.*`   — POPULATED. Statements about what this software
//                              does with the operator's data, secrets or
//                              records. A rewrite here could talk someone into
//                              a disclosure or a deletion they did not intend.
//   `admin.locked.confirm.*` — EMPTY. Every destructive confirmation in the
//                              console lives in `confirm.title` / `.message` /
//                              `.confirmLabel`, which ship the raw key (see the
//                              table above). They are locked-class strings
//                              sitting in a slot that cannot carry a key yet.
//   `admin.locked.errors.*`  — EMPTY, for the same reason: failure and recovery
//                              messages live in toast `message` slots. The
//                              anti-enumeration line on `/forgot-password` —
//                              "If an account exists for that address…" — is the
//                              single most lock-worthy string in the console and
//                              is currently un-keyable. It was probed
//                              specifically; it renders the raw key.
//
// When those slots start resolving, the strings move here under their class —
// the prefix classifies them on arrival, with no second list to keep in sync.

export default {
  // ── Shared vocabulary ───────────────────────────────────────────────────
  //
  // One concept, one word, one key. "Email address" is the same noun as a
  // section heading on `/profile` and as a field label on `/login`, and an
  // operator renaming it should get both — which is the whole reason a
  // dictionary beats per-page literals (BRAND §6: one term per concept).
  'admin.field.email': 'Email address',
  'admin.field.password': 'Password',
  'admin.field.displayName': 'Display name',
  'admin.field.newPassword': 'New password',
  'admin.field.newEmail': 'New email address',
  'admin.field.currentPassword': 'Current password',

  // ── Welcome (`/`) ───────────────────────────────────────────────────────
  //
  // The nine tile labels are ABSENT, and that is now a backlog item rather than
  // a constraint: they were left literal because `kpi.label` shipped the raw
  // key, which stopped being true on 2026-09-18 (see the table above). Keying
  // them is a straightforward pass nobody has made yet — the Reach lens's two
  // tiles are keyed and do render French, which is the proof it works.
  //
  // The greeting names the reader, and stays a sentence when it cannot.
  //
  // `[, $session.name]` is an OPTIONAL SEGMENT: the brackets and everything in
  // them survive only if every `$session.` token inside resolves. A caller with
  // a name reads "Welcome, Ada Lovelace"; one with no name, and an anonymous
  // one, read plain "Welcome" — the comma leaves with the name it belongs to,
  // so no reader ever meets a stranded "Welcome,".
  //
  // The name resolves in the BROWSER, and that is deliberate rather than a
  // limitation to route around: the mount's SSR pass is session-less by design,
  // so a server-rendered name would be a caller's identity baked into a page
  // another caller can be served. What the server ships is the fallback —
  // "Welcome" — and hydration ADDS the name. The heading is therefore a
  // complete sentence at every instant and never corrects itself; it grows
  // sideways on one line, where a bare `$session.name` heading would have
  // arrived empty and filled in.
  'admin.welcome.intro': 'Welcome[, $session.name]. What needs you, and what this app declares.',
  'admin.welcome.instance.heading': 'Instance',
  'admin.welcome.instance.description': 'What this instance runs on',
  'admin.welcome.instance.booted': 'Started',
  'admin.welcome.instance.version': 'Version',
  'admin.welcome.instance.database': 'Database',
  'admin.welcome.instance.storage': 'File storage',
  'admin.welcome.instance.ai': 'AI provider',
  'admin.welcome.ask.title': 'Ask about this app',
  'admin.welcome.ask.description':
    'Answers from this app’s data and configuration. Read-only. Also in ⌘K.',
  'admin.invitation.heading': 'Join the console',
  'admin.invitation.headingMember': 'Join $app.label',
  'admin.invitation.landsAdmin': 'After you join, you land in the console.',
  'admin.invitation.landsMember':
    'After you join, you land in $app.label. The console is for admins.',
  'admin.invitation.invitedYouTo': 'invited you to',
  'admin.invitation.signInAs': 'You will sign in as',
  'admin.invitation.submit': 'Set password and join',
  'admin.invitation.asRole': 'as',
  'admin.invitation.worksUntil': 'This invitation works until',
  'admin.invitation.unusable.heading': 'This invitation link no longer works',
  'admin.invitation.unusable.body':
    'It may have expired or already been used. Ask the person who invited you to send a new one.',
  'admin.invitation.unusable.signIn': 'Go to sign in',
  'admin.internalError.heading': 'This page couldn’t load',
  'admin.internalError.body':
    'Sovrium hit an internal error while drawing it. Your data is unchanged. Reload the page; if it fails again, report it so it gets fixed.',
  'admin.notFound.heading': 'Page not found',
  'admin.notFound.body':
    'Nothing in this console answers this address. The section may not exist in this app, or the link is out of date.',
  'admin.notFound.back': 'Back to Overview',
  // The bare 404 a signed-in member gets on any console address: ways on that
  // fit a session that exists, never Sign in.
  'admin.notFound.toApp': 'Go to the app',

  // ── Welcome · needs attention ───────────────────────────────────────────
  //
  // Each row reads `<what> <count>`, the label first, so no label has to agree
  // in number with the figure beside it. The actions name the sidebar's own
  // nouns — Runs is Runs in both places, or an operator has two names for one
  // console.
  'admin.welcome.pulse.region': 'What needs attention',
  'admin.welcome.pulse.heading': 'Needs attention',
  'admin.welcome.pulse.since': 'Since this instance started',
  'admin.welcome.pulse.failedRuns': 'Failed runs',
  'admin.welcome.pulse.failedRuns.action': 'Open runs',
  'admin.welcome.pulse.variablesUnset': 'Required variables unset',
  'admin.welcome.pulse.variablesUnset.action': 'Open environment',
  'admin.welcome.pulse.tokensExpired': 'Connections to reconnect',
  'admin.welcome.pulse.tokensExpired.action': 'Open connections',
  'admin.welcome.pulse.invitationsPending': 'Invitations pending',
  'admin.welcome.pulse.invitationsPending.action': 'Open users',
  'admin.welcome.pulse.recentSubmissions': 'New submissions',
  'admin.welcome.pulse.recentSubmissions.action': 'Open submissions',
  'admin.welcome.pulse.findingsCount': 'Findings',
  'admin.welcome.pulse.findingsCount.action': 'Review findings',
  'admin.welcome.pulse.allClear': 'All clear',
  'admin.welcome.pulse.allClear.body':
    'No failed run, no unset variable, no connection to reconnect, nothing waiting.',

  // ── Welcome · the declaration tiles ─────────────────────────────────────
  'admin.welcome.counts.region': 'What this app declares',
  'admin.welcome.counts.heading': 'What this app declares',
  'admin.welcome.counts.description': 'A card appears for each feature your config declares.',
  'admin.welcome.figures.region': 'Headline figures',
  'admin.welcome.figures.runs': 'Runs, last 24 h',
  'admin.welcome.figures.runs.sub': 'failed since this instance started',
  'admin.welcome.figures.submissions': 'Submissions',
  'admin.welcome.figures.submissions.sub': 'since this instance started',
  'admin.welcome.figures.storage': 'Files stored',
  'admin.welcome.runsChart.region': 'Runs, last 7 days',
  'admin.welcome.runsChart.runs': 'Runs',
  'admin.welcome.runsChart.failures': 'Failed',

  // ── Profile (`/profile`) ────────────────────────────────────────────────
  //
  // Row labels are nouns and submit labels are verbs, both as short as the row
  // allows: the label column already says which property a button belongs to, so
  // a submit repeating it ("Save name" beside "Display name") spends a word on
  // nothing. The hints are the exception — each one states something the control
  // cannot, and the email and language hints in particular are the only place a
  // reader learns that the change is not immediate.
  'admin.profile.identity.region': 'Your account',
  'admin.profile.rows.region': 'Account settings',

  'admin.profile.picture.label': 'Picture',
  'admin.profile.picture.hint': 'PNG, JPEG or WebP. 5 MB maximum.',
  'admin.profile.picture.upload': 'Change',
  'admin.profile.picture.remove': 'Remove',
  'admin.profile.picture.removeConfirm.title': 'Remove your picture?',
  'admin.profile.picture.removeConfirm.message':
    'The console will show your initials instead. You can upload a new picture at any time.',
  'admin.profile.picture.removeConfirm.confirm': 'Remove',
  'admin.profile.picture.removeConfirm.cancel': 'Keep it',
  'admin.profile.picture.uploaded': 'Picture updated.',
  'admin.profile.picture.uploadFailed':
    'That file was not accepted. Use a PNG, JPEG or WebP under 5 MB.',
  'admin.profile.picture.removed': 'Picture removed.',
  'admin.profile.picture.removeFailed': 'Could not remove your picture.',

  'admin.profile.displayName.hint': 'Shown beside your activity across the console.',
  'admin.profile.displayName.formRegion': 'Change your display name',
  'admin.profile.displayName.submit': 'Save',
  'admin.profile.displayName.saved': 'Name saved.',
  'admin.profile.displayName.failed': 'Could not save your name.',

  'admin.profile.email.hint':
    'Changes only after you follow the verification link sent to the new address.',
  'admin.profile.email.formRegion': 'Change your email address',
  'admin.profile.email.submit': 'Send link',
  'admin.profile.email.sent': 'Verification link sent.',
  'admin.profile.email.sentDetail':
    'Verification link sent. Your address changes once you follow it.',
  'admin.profile.email.failed': 'Could not send the link.',

  'admin.profile.password.formRegion': 'Change your password',
  'admin.profile.password.submit': 'Change password',
  'admin.profile.password.saved': 'Password changed.',
  'admin.profile.password.failed': 'Could not change your password — check your current one.',

  'admin.profile.language.label': 'Language',
  'admin.profile.language.hint':
    'Saved to your account, it follows you to any browser. Until you save one, each browser keeps its own.',
  'admin.profile.language.formRegion': 'Change the console language',
  'admin.profile.language.saved': 'Language saved.',
  'admin.profile.language.savedDetail': 'Language saved. The console switches on your next page.',
  'admin.profile.language.failed': 'Could not save your language.',

  'admin.profile.notifications.label': 'Notifications',
  'admin.profile.notifications.hint': 'Every alert email links back here, where you turn them off.',
  'admin.profile.notifications.saved': 'Preference saved.',
  'admin.profile.notifications.failed': 'Could not save the preference.',
  'admin.profile.notifications.automationAlerts.label': 'Automation alerts',
  'admin.profile.notifications.automationAlerts.hint':
    'Email me when an automation fails, is interrupted, paused or resumed.',
  'admin.profile.notifications.automationAlerts.formRegion': 'Change your automation alerts',
  'admin.profile.notifications.weeklyDigest.label': 'Weekly summary',
  'admin.profile.notifications.weeklyDigest.hint':
    'Email me every week with what ran, what failed and how the data grew.',
  'admin.profile.notifications.weeklyDigest.formRegion': 'Change your weekly summary',

  'admin.profile.cloud.label': 'Sovrium Cloud',
  'admin.profile.cloud.connect': 'Connect Sovrium Cloud account',
  'admin.profile.cloud.disconnect': 'Disconnect Sovrium Cloud account',
  'admin.profile.data.label': 'Your data',
  'admin.profile.data.hint':
    'Export everything this instance holds about you, or erase your account.',
  'admin.profile.gdprLink': 'Open My data',

  // ── My data / GDPR (`/gdpr`) ────────────────────────────────────────────
  'admin.gdpr.heading': 'My data (GDPR)',
  'admin.gdpr.blurb': 'Export what this instance holds about you, or erase your account.',
  'admin.profile.blurb': 'Your name, sign-in and preferences in this console.',
  'admin.gdpr.identity.heading': 'My identity',
  'admin.gdpr.export.heading': 'Export my data',
  'admin.gdpr.export.submit': 'Generate export',
  'admin.gdpr.export.failed': 'Couldn’t prepare your export. Nothing was sent.',
  'admin.gdpr.export.retry': 'Retry',
  'admin.gdpr.erase.heading': 'Erase my account',
  'admin.gdpr.erase.submit': 'Request erasure',
  // The type-to-confirm gate. It repeats the irreversibility the row hint
  // already states, because the two are read at different moments — and it is
  // keyed for the same reason: a French console must say it in French at the
  // moment the operator is deciding, not only in the paragraph above.
  'admin.gdpr.erase.confirm.title': 'Confirm erasure',
  'admin.gdpr.erase.confirm.message':
    'This action is permanent and irreversible. Enter your email address to confirm erasure of your account.',
  'admin.gdpr.erase.confirm.input': 'Enter your email address',
  'admin.gdpr.erase.confirm.affirm': 'Erase',
  'admin.gdpr.erase.confirm.dismiss': 'Cancel',
  'admin.gdpr.pending.region': 'Requests in progress',
  'admin.gdpr.pending.account': 'Account',
  'admin.gdpr.pending.due': 'Due',
  'admin.gdpr.pending.actions': 'Actions',
  'admin.gdpr.pending.empty': 'No erasure request in progress',
  'admin.gdpr.pending.cancel': 'Cancel',
  // The affirm repeats the title rather than saying "Cancel": two buttons one
  // dialog apart reading "Cancel" and meaning opposite things is the ambiguity
  // the longer label buys out of.
  'admin.gdpr.pending.confirm.title': 'Confirm cancellation',
  'admin.gdpr.pending.confirm.message':
    'Cancel your account erasure request? Your account will not be deleted.',
  'admin.gdpr.pending.confirm.affirm': 'Confirm cancellation',
  'admin.gdpr.pending.confirm.dismiss': 'Back',
  'admin.gdpr.account.label': 'Your account',
  'admin.gdpr.account.hint': 'Change your name, email, password, picture or language.',
  'admin.gdpr.profileLink': 'Open My profile',

  // ── API keys (`/api-keys`) ──────────────────────────────────────────────
  'admin.report.heading': 'Report a problem',
  'admin.report.description':
    'Something wrong in Sovrium? Open a prefilled issue on GitHub. Nothing is sent until you submit it there.',
  'admin.report.installation.heading': 'A new report',
  'admin.report.installation.body':
    'A blank bug report with this installation’s version, install channel, database and system filled in. Describe what you saw and what you expected.',
  'admin.report.latest.heading': 'The last internal error',
  'admin.report.latest.body':
    'The most recent fault in Sovrium this server kept, with its details filled in.',
  'admin.apiKeys.heading': 'API keys',
  'admin.apiKeys.region': 'Your API keys',
  'admin.apiKeys.loading': 'Loading your API keys…',

  // ── Environment (`/env`) ────────────────────────────────────────────────
  'admin.env.heading': 'Environment',
  'admin.auditLog.heading': 'Audit log',
  'admin.auditLog.blurb':
    'Who read or changed what on this instance, when, and through which door. Read-only, newest first.',
  'admin.auditLog.region': 'Audit log',
  'admin.auditLog.filter.transport': 'Transport',
  'admin.auditLog.filter.allTransports': 'All transports',
  'admin.auditLog.filter.resource': 'Resource',
  'admin.auditLog.filter.allResources': 'All resources',
  'admin.auditLog.col.time': 'Time',
  'admin.auditLog.col.actor': 'Actor',
  'admin.auditLog.col.action': 'Action',
  'admin.auditLog.col.resource': 'Resource',
  'admin.auditLog.col.result': 'Result',
  'admin.auditLog.col.transport': 'Transport',
  'admin.auditLog.result.success': 'Success',
  'admin.auditLog.result.failure': 'Failed',
  'admin.auditLog.transport.configfile': 'Config file',
  'admin.auditLog.transport.env': 'Environment',
  'admin.auditLog.transport.api': 'API',
  'admin.auditLog.transport.mcp': 'MCP',
  'admin.auditLog.transport.restore': 'Restore',
  'admin.auditLog.resource.user': 'Account',
  'admin.auditLog.resource.config': 'Config',
  'admin.auditLog.resource.table': 'Table',
  'admin.auditLog.resource.record': 'Record',
  'admin.auditLog.resource.form': 'Form',
  'admin.auditLog.resource.submission': 'Submission',
  'admin.auditLog.resource.automation': 'Automation',
  'admin.auditLog.resource.automationRun': 'Run',
  'admin.auditLog.resource.agent': 'Agent',
  'admin.auditLog.resource.bucket': 'Bucket',
  'admin.auditLog.resource.link': 'Link',
  'admin.auditLog.resource.connection': 'Connection',
  'admin.auditLog.resource.group': 'Group',
  'admin.auditLog.resource.designShare': 'Design share',
  'admin.auditLog.empty':
    'No audit events yet. Every admin read and change lands here as it happens.',
  'admin.auditLog.noMatch': 'No audit events match these filters. Clear a filter to see more.',
  'admin.auditLog.entry.title': 'Audit event',
  'admin.auditLog.entry.details': 'Details',
  'admin.env.search': 'Search variables',
  'admin.env.filter.status': 'Filter by status',
  'admin.env.filter.allStatuses': 'All statuses',
  'admin.env.filter.required': 'Filter by requirement',
  'admin.env.filter.allRequirements': 'Required and optional',
  'admin.env.col.variable': 'Variable',
  'admin.env.col.required': 'Required',
  'admin.env.col.status': 'Status',
  'admin.env.col.source': 'Source',
  'admin.env.empty': 'This app declares no environment variables.',
  'admin.env.noMatch': 'No variable matches. Clear the search or a filter.',
  'admin.env.blurb':
    'The variables this app declares, and whether this instance resolved each one. Values are never shown.',
  'admin.env.callout.heading': 'Values live in the deployment environment',
  'admin.env.declared.heading': 'Declared variables',
  'admin.env.declared.region': 'Declared environment variables',
  // Row vocabulary. Single words carrying a status, so they are short by
  // necessity rather than by restraint — and each is a different fact, which is
  // why "Set" and "From the environment" are two keys and not one sentence.
  'admin.env.usedBy': 'Used by',
  'admin.env.requiredUnset':
    'is required and not set. Set it where you run this instance, then restart.',
  'admin.env.unused': 'Unused',
  'admin.env.required': 'Required',
  'admin.env.optional': 'Optional',
  'admin.env.set': 'Set',
  'admin.env.notSet': 'Not set',
  'admin.env.fromEnvironment': 'From the environment',
  'admin.env.fromDefault': 'From the declared default',

  // ── Decisions (`/decisions`, `/decisions/:id`) ──────────────────────────
  // The register names the app's own reasoning, so its copy says WHERE the
  // record lives wherever an operator would look for a way to change it. Both
  // `sr-only` headings are the surface's, never the record's: the document's
  // visible title is the decision's own, one level down.
  'admin.decisions.heading': 'Decisions',
  'admin.decisions.blurb':
    'The architecture decision records this app declares, and what each one was about.',
  'admin.decisions.register.region': 'Decision register',
  'admin.decisions.provenance': 'Declared in your config file. Change it there and redeploy.',
  'admin.decisions.one.heading': 'Decision',
  'admin.decisions.one.blurb':
    'One record from the register: the situation, the choice, and what follows from it.',
  'admin.decisions.back': 'Back to decisions',
  'admin.decisions.record.heading': 'Record',
  'admin.decisions.record.region': 'Decision record',
  // The three Nygard parts, named as the register itself names them.
  'admin.decisions.part.context': 'Context',
  'admin.decisions.part.decision': 'Decision',
  'admin.decisions.part.consequences': 'Consequences',
  'admin.decisions.field.status': 'Status',
  'admin.decisions.field.date': 'Date',
  'admin.decisions.field.deciders': 'Deciders',
  'admin.decisions.field.supersedes': 'Supersedes',
  'admin.decisions.field.supersededBy': 'Superseded by',
  'admin.decisions.field.touches': 'Touches',
  'admin.decisions.field.source': 'Source',

  // ── Sign in (`/login`) ──────────────────────────────────────────────────
  // Decided on the canvas, round 8. The verb is the heading and is said ONCE;
  // the sentence under it names the OPERATOR's own app, never ours. What it
  // replaces opened both lines with "Sign in to" and called the thing "your
  // Sovrium app" — engine before app, which every other surface reverses.
  // `$app.label` resolves here pre-auth, to the app the console is mounted in.
  'admin.login.heading': 'Sign in',
  'admin.login.blurb': 'The operator console for ',
  'admin.login.sessionEnded': 'Your session ended — sign in to continue.',
  'admin.login.submit': 'Sign in',
  // The in-flight label. BRAND §8's smallest and most often lost row: a pending
  // label that falls back to a generic default says the button is busy but not
  // what it is busy doing.
  'admin.login.pending': 'Signing in…',
  'admin.login.cloudSignIn': 'Sign in with Sovrium Cloud',
  // The rule between the Sovrium Cloud button and the email form.
  'admin.login.orEmail': 'Or with your email',

  // ── Forgot password (`/forgot-password`) ────────────────────────────────
  'admin.forgotPassword.heading': 'Forgot password',
  'admin.forgotPassword.blurb':
    'Enter your email address. We’ll send you a link to set a new password.',
  'admin.forgotPassword.submit': 'Send the link',
  'admin.forgotPassword.pending': 'Sending…',
  'admin.forgotPassword.expiry':
    'The link expires after one hour. You can request another at any time.',

  // ── New password (`/reset-password`) ────────────────────────────────────
  'admin.resetPassword.heading': 'New password',
  'admin.resetPassword.blurb': 'Choose a new password. It replaces the old one immediately.',
  'admin.resetPassword.submit': 'Save the password',
  'admin.resetPassword.pending': 'Saving…',
  'admin.resetPassword.singleUse': 'This link works only once. Request a new one if you need it.',

  // Shared by both recovery surfaces.
  'admin.auth.backToSignIn': 'Back to sign in',

  // ── LOCKED · audit ──────────────────────────────────────────────────────
  //
  // Statements an operator may not rewrite, because each asserts what this
  // software does with data the reader is about to act on. The GDPR pair is the
  // clearest case: someone reads the irreversibility notice and then presses a
  // button that deletes their account. A softened wording there is not a
  // branding choice.
  'admin.locked.audit.gdpr.exportScope':
    'Download a JSON archive of your data (profile, records you created, form submissions, activity).',
  'admin.locked.audit.gdpr.erasureNotice':
    'Erasure is permanent and irreversible. After a 7-day grace period, your account and your data are deleted for good — they cannot be restored from the trash.',
  'admin.locked.audit.apiKeys.scopeNotice':
    'Long-lived credentials for scripts and services that call this instance on your behalf. Present one in the x-api-key header. A key carries your own role — it can never do more than you can.',
  'admin.locked.audit.env.secrecyNotice':
    'Set a variable in the environment you run this instance in, then restart. The console reports what resolved; it never stores or reveals a value.',
} as const
