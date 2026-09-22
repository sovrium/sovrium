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
  'admin.welcome.heading': 'Welcome[, $session.name]',
  'admin.welcome.heroRegion': 'Ask or search',
  'admin.welcome.noAi': 'No AI provider configured — search the app instead.',
  // The hero's palette trigger, named APART from the sidebar's.
  //
  // Both controls open the same palette, and Welcome is the one surface where
  // both are on screen at once. They carried the same `admin.shell.search`
  // name — so a reader listing the page's buttons heard "Search" twice, with
  // nothing to tell them apart, and a strict locator resolved to two elements.
  // The sidebar keeps the bare verb: it is the console's standing affordance
  // on EVERY surface, and qualifying it there would be a longer name for a
  // control that has no rival to be distinguished from. The hero names its
  // target instead, in the same words as the caption directly beneath it
  // (BRAND §6 — one term per concept, so both still say "search").
  'admin.welcome.searchHero': 'Search the app',

  // ── Welcome · the pulse strip ───────────────────────────────────────────
  //
  // Each cell reads `<count> <what>`, so the label is the PREDICATE and starts
  // lower-case: the number is the first word of the phrase. The destinations
  // are the sidebar's own nouns, unchanged — Runs is Runs in both places, or an
  // operator has two names for one console (BRAND §6).
  'admin.welcome.pulse.region': 'What needs attention',
  'admin.welcome.pulse.heading': 'Since this instance started',
  'admin.welcome.pulse.failedRuns': 'failed runs',
  'admin.welcome.pulse.failedRuns.where': 'Runs →',
  'admin.welcome.pulse.variablesUnset': 'required variables unset',
  'admin.welcome.pulse.variablesUnset.where': 'Environment →',
  'admin.welcome.pulse.tokensExpired': 'tokens expired',
  'admin.welcome.pulse.tokensExpired.where': 'Connections →',
  'admin.welcome.pulse.invitationsPending': 'invitations pending',
  'admin.welcome.pulse.invitationsPending.where': 'Users →',
  'admin.welcome.pulse.recentSubmissions': 'new submissions',
  'admin.welcome.pulse.recentSubmissions.where': 'Submissions →',
  'admin.welcome.pulse.automationsPaused': 'automations paused',
  'admin.welcome.pulse.automationsPaused.where': 'Runs →',

  // ── Welcome · the declaration tiles ─────────────────────────────────────
  'admin.welcome.counts.region': 'What this app declares',
  'admin.welcome.counts.heading': 'What this app declares',

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
  'admin.profile.password.submit': 'Change',
  'admin.profile.password.saved': 'Password changed.',
  'admin.profile.password.failed': 'Could not change your password — check your current one.',

  'admin.profile.language.label': 'Language',
  'admin.profile.language.hint': 'Follows your account to any browser you sign in from.',
  'admin.profile.language.formRegion': 'Change the console language',
  'admin.profile.language.submit': 'Save',
  'admin.profile.language.saved': 'Language saved.',
  'admin.profile.language.savedDetail': 'Language saved. The console switches on your next page.',
  'admin.profile.language.failed': 'Could not save your language.',

  'admin.profile.data.label': 'Your data',
  'admin.profile.data.hint':
    'Export everything this instance holds about you, or erase your account.',
  'admin.profile.gdprLink': 'Open My data',

  // ── My data / GDPR (`/gdpr`) ────────────────────────────────────────────
  'admin.gdpr.heading': 'My data (GDPR)',
  'admin.gdpr.blurb': 'What this instance holds about you, and how to take it out or erase it.',
  'admin.gdpr.identity.heading': 'My identity',
  'admin.gdpr.export.heading': 'Export my data',
  'admin.gdpr.export.submit': 'Generate export',
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
  'admin.apiKeys.heading': 'API keys',
  'admin.apiKeys.region': 'Your API keys',
  'admin.apiKeys.loading': 'Loading your API keys…',

  // ── Environment (`/env`) ────────────────────────────────────────────────
  'admin.env.heading': 'Environment',
  'admin.env.blurb':
    'The variables this app declares, and whether this instance resolved each one. Values are never shown.',
  'admin.env.callout.heading': 'Values live in the deployment environment',
  'admin.env.declared.heading': 'Declared variables',
  'admin.env.declared.region': 'Declared environment variables',
  // Row vocabulary. Single words carrying a status, so they are short by
  // necessity rather than by restraint — and each is a different fact, which is
  // why "Set" and "From the environment" are two keys and not one sentence.
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
  'admin.decisions.provenance': 'Declared in app.ts. Changed there and redeployed, never here.',
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
  'admin.login.submit': 'Sign in',
  // The in-flight label. BRAND §8's smallest and most often lost row: a pending
  // label that falls back to a generic default says the button is busy but not
  // what it is busy doing.
  'admin.login.pending': 'Signing in…',
  'admin.login.forgotLink': 'Forgot your password?',

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
    'Set a variable where you run this instance, then restart. The console reports what resolved; it never stores or reveals a value.',
} as const
