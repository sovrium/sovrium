/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console's CHROME strings: the persistent shell, the derived breadcrumb
// vocabulary, and every document title.
//
// A separate file from `en.ts` (the account cluster) and `data.ts` (the
// operator-data surfaces) for the reason `app.ts` gives about the split
// generally: several migrations are in flight at once, and one alphabetised
// object appended to by all of them is a merge conflict per commit. What makes
// THIS a natural seam rather than an arbitrary one is that its three groups are
// the only strings authored OUTSIDE a page body — the shell wraps every surface,
// a crumb is a vocabulary the trail draws from, and a title never appears in the
// document at all.
//
// ─── WHY EVERY CRUMB IS HERE, INCLUDING THE ONE-WORD ONES ──────────────────
//
// The derived trail turns a URL segment into a human noun, so `labels` is a
// dictionary rather than page copy: `users` → "Users" is the same decision on
// `/users` and on `/users/invitations`, and the two pages declared it twice.
// Keying it once is what makes them agree — and what makes an operator renaming
// "Users" get both.
//
// Four of these keys (`profile`, `gdpr`, `apiKeys`, `env`) already existed in
// `en.ts` and were referenced by NOTHING: the pages that should have used them
// carried the literal instead. They moved here and are now wired. A key nothing
// reads is the shape this codebase calls an inert surface, and it had already
// happened once inside this catalogue.

export default {
  // ── Persistent shell ────────────────────────────────────────────────────
  // The phone menu button's accessible name: below the medium breakpoint the
  // sidebar folds into a sheet this button opens.
  'admin.shell.openMenu': 'Open menu',
  // The fold control at the top of the content column. It folds the sidebar
  // to its icon strip, and Control or Command with B does the same.
  'admin.shell.toggleSidebar': 'Toggle sidebar',

  // ── Sidebar chrome ──────────────────────────────────────────────────────
  // The identity row links to the console's home. Its visible text is the app,
  // its release and the engine, so the link carries a name that says where it
  // goes instead of reading all three aloud.
  'admin.shell.home': 'Console home',
  // The palette trigger's accessible name and its visible placeholder differ on
  // purpose: the name is the verb, the placeholder is the invitation.
  'admin.shell.search': 'Search',
  'admin.shell.searchPlaceholder': 'Search…',
  // The operator menu names its FUNCTION, not its holder: the signed-in
  // operator's identity is request-time and no config binding reaches it. The
  // seam is documented in `config/components/sidebar.ts`.
  'admin.shell.account': 'Account',
  'admin.offline.message': 'You’re offline. Check your connection, then retry.',
  'admin.offline.retry': 'Retry',
  'admin.shell.readOnly': 'You can read, not change[ — your role is $session.roleLabel]',
  'admin.shell.readOnlyShort': 'Read-only',
  'admin.shell.role.admin': 'Admin',
  'admin.shell.role.viewer': 'Viewer',
  'admin.shell.myAccount': 'My profile',
  'admin.shell.myData': 'My data',
  // No key for the language control: a `language-switcher` names itself with the
  // current language's own `label` (`English` / `Français`) and takes no caption
  // of its own. See `config/components/sidebar.ts` for what that costs.
  'admin.shell.signOut': 'Sign out',

  // ── Sidebar navigation ──────────────────────────────────────────────────
  //
  // Only what the breadcrumb vocabulary below does NOT already name. Fifteen
  // nav rows say exactly what their `admin.crumb.*` twin says — Records, Files,
  // Runs, Analytics — and they are bound to that key rather than given a second
  // one. That is not thrift: a row and the trail it leads to disagreeing is a
  // defect nobody would catch, and one address makes the agreement structural.
  // A row that ever needs to diverge earns its own key on the day it does.
  'admin.nav.overview': 'Overview',
  'admin.nav.group.activity': 'Activity',
  'admin.nav.group.data': 'Data',
  'admin.nav.group.people': 'People',
  'admin.nav.group.audience': 'Audience',
  'admin.nav.group.developers': 'Developers',
  'admin.nav.group.design': 'Design',
  // `landmark` names the `<nav>` region for a screen reader. Every group
  // shares it, so the sidebar is one landmark rather than six.
  'admin.nav.landmark.console': 'Console',
  'admin.nav.design.overview': 'Overview',
  'admin.nav.design.foundations': 'Foundations',
  'admin.nav.design.components': 'Components',
  'admin.nav.design.brand': 'Brand',
  'admin.nav.design.voice': 'Voice',

  // ── Breadcrumb segment labels ───────────────────────────────────────────
  // One entry per console path segment that appears in a derived trail. The
  // root crumb and every href belong to the shell, because a mounted console's
  // root is its MOUNT and only the renderer knows which one.
  'admin.crumb.profile': 'My profile',
  'admin.crumb.gdpr': 'My data',
  'admin.crumb.apiKeys': 'API keys',
  'admin.crumb.env': 'Environment',
  'admin.crumb.api': 'API',
  'admin.crumb.mcp': 'MCP',
  'admin.crumb.changelog': 'Changelog',
  'admin.crumb.records': 'Records',
  'admin.crumb.files': 'Files',
  'admin.crumb.systemBucket': 'System',
  'admin.crumb.conversations': 'Conversations',
  'admin.crumb.submissions': 'Submissions',
  'admin.crumb.connections': 'Connections',
  'admin.crumb.organisation': 'Organisation',
  'admin.crumb.users': 'Users',
  'admin.crumb.analytics': 'Analytics',
  // The row, the trail and the heading all say Runs: the page is the run
  // history, and the automations catalogue is one view inside it.
  'admin.crumb.runs': 'Runs',
  'admin.crumb.run': 'Run',
  'admin.crumb.links': 'Links',
  'admin.crumb.templates': 'Templates',
  // `/decisions/:id` gets NO entry of its own, deliberately: the id segment is
  // the record's own identifier, and the derived trail prints an unlabelled
  // segment verbatim — which is precisely what should name the document.
  'admin.crumb.decisions': 'Decisions',

  // ── Document titles ─────────────────────────────────────────────────────
  //
  // Each opens with the app's own name (`$app.label`, the name its chrome
  // prints) and then names the page, so a tab strip of five console tabs over
  // two apps says which is which. The page name is the one the sidebar gives
  // it. `$app.*` and `$param.*` resolve in a title after its translation, so a
  // record's own page can name the record (`admin.meta.component`).
  //
  // The `Data · ` middle segment mirrors the sidebar's grouping, so a browser
  // tab strip reads the same way the nav does.
  'admin.meta.welcome': '$app.label — Welcome',
  'admin.meta.acceptInvitation': '$app.label — Accept invitation',
  'admin.meta.notFound': '$app.label — Page not found',
  'admin.meta.organisation': '$app.label — Organisation',
  'admin.meta.profile': '$app.label — My profile',
  'admin.meta.gdpr': '$app.label — My data',
  'admin.meta.apiKeys': '$app.label — API keys',
  'admin.meta.env': '$app.label — Environment',
  'admin.meta.api': '$app.label — API',
  'admin.meta.mcp': '$app.label — MCP',
  'admin.meta.changelog': '$app.label — Changelog',
  'admin.meta.release': '$app.label — Changelog · Release',
  'admin.meta.tables': '$app.label — Records',
  'admin.meta.buckets': '$app.label — Files',
  'admin.meta.agents': '$app.label — Conversations',
  'admin.meta.forms': '$app.label — Submissions',
  'admin.meta.connections': '$app.label — Connections',
  'admin.meta.users': '$app.label — Users',
  'admin.meta.invitations': '$app.label — Invitations',
  'admin.meta.userAccount': '$app.label — Account',
  'admin.meta.recordAccess': '$app.label — Who has access',
  'admin.meta.pages': '$app.label — Analytics',
  'admin.meta.automations': '$app.label — Runs',
  'admin.meta.automationRun': '$app.label — Run',
  'admin.meta.links': '$app.label — Links',
  'admin.meta.templates': '$app.label — Templates',
  'admin.meta.footprint': '$app.label — Footprint',
  'admin.meta.decisions': '$app.label — Decisions',
  'admin.meta.decision': '$app.label — Decision',
  'admin.meta.login': '$app.label — Sign in',
  'admin.meta.forgotPassword': '$app.label — Forgot password',
  'admin.meta.resetPassword': '$app.label — New password',
  'admin.meta.designSystem': '$app.label — Design system',
  'admin.meta.foundations': '$app.label — Foundations',
  'admin.meta.components': '$app.label — Components',
  // A component's own page names the component, not the noun.
  'admin.meta.component': '$app.label — $param.name',
  'admin.meta.brand': '$app.label — Brand',
  'admin.meta.voice': '$app.label — Voice',
} as const
