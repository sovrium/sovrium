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
  // The mobile burger's accessible name. It renders a glyph, so this string IS
  // the whole button as a screen reader hears it.
  'admin.shell.openMenu': 'Open menu',

  // ── Sidebar chrome ──────────────────────────────────────────────────────
  // `admin.shell.navLoading` used to live here. It named the placeholder line
  // the sidebar ISLAND rendered before it hydrated; the navigation is now
  // server-rendered, so there is no un-hydrated state left to caption.
  //
  // The brand link leaves the console for the operator's own site, so its name
  // has to say WHERE it goes — the app label alone would read as the console
  // home, which the row below it already is.
  'admin.shell.openSite': 'Open the site in a new tab',
  // The palette trigger's accessible name and its visible placeholder differ on
  // purpose: the name is the verb, the placeholder is the invitation.
  'admin.shell.search': 'Search',
  'admin.shell.searchPlaceholder': 'Search...',
  // The operator menu names its FUNCTION, not its holder: the signed-in
  // operator's identity is request-time and no config binding reaches it. The
  // seam is documented in `config/components/sidebar.ts`.
  'admin.shell.account': 'Account',
  'admin.shell.myAccount': 'My account',
  // No key for the language control: a `language-switcher` names itself with the
  // current language's own `label` (`English` / `Français`) and takes no caption
  // of its own. See `config/components/sidebar.ts` for what that costs.
  'admin.shell.giveFeedback': 'Give feedback',
  'admin.shell.reportBug': 'Report a bug',
  'admin.shell.signOut': 'Sign out',

  // ── Sidebar navigation ──────────────────────────────────────────────────
  //
  // Only what the breadcrumb vocabulary below does NOT already name. Fifteen
  // nav rows say exactly what their `admin.crumb.*` twin says — Records, Files,
  // Runs, Analytics — and they are bound to that key rather than given a second
  // one. That is not thrift: a row and the trail it leads to disagreeing is a
  // defect nobody would catch, and one address makes the agreement structural.
  // A row that ever needs to diverge earns its own key on the day it does.
  'admin.nav.welcome': 'Welcome',
  'admin.nav.group.system': 'System',
  'admin.nav.group.application': 'Application',
  'admin.nav.group.developers': 'Developers',
  // `landmark` names the `<nav>` region for a screen reader; two groups share
  // the `Data` landmark, which is why it is not the group label.
  'admin.nav.landmark.data': 'Data',
  'admin.nav.design': 'Design',
  'admin.nav.design.overview': 'Overview',
  'admin.nav.design.foundations': 'Foundations',
  'admin.nav.design.uiKit': 'UI kit',
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
  'admin.crumb.tables': 'Records',
  'admin.crumb.buckets': 'Files',
  'admin.crumb.agents': 'Conversations',
  'admin.crumb.forms': 'Submissions',
  'admin.crumb.connections': 'Connections',
  'admin.crumb.organisation': 'Organisation',
  'admin.crumb.users': 'Users',
  'admin.crumb.invitations': 'Invitations',
  'admin.crumb.pages': 'Analytics',
  // The row, the trail and the heading all say Runs: the page is the run
  // history, and the automations catalogue is one view inside it.
  'admin.crumb.automations': 'Runs',
  'admin.crumb.links': 'Links',
  'admin.crumb.footprint': 'Footprint',
  // `/decisions/:id` gets NO entry of its own, deliberately: the id segment is
  // the record's own identifier, and the derived trail prints an unlabelled
  // segment verbatim — which is precisely what should name the document.
  'admin.crumb.decisions': 'Decisions',

  // ── Document titles ─────────────────────────────────────────────────────
  //
  // Each carries the "Sovrium — " stem verbatim rather than composing it from a
  // shared prefix plus a leaf. Composition would need a token the title slot
  // does not interpolate, and the stem is the one part of a console title an
  // operator has the least business renaming: it says whose surface this is,
  // inside their own app, under their own domain (BRAND §2).
  //
  // The `Data · ` middle segment mirrors the sidebar's grouping, so a browser
  // tab strip reads the same way the nav does.
  'admin.meta.welcome': 'Sovrium — Welcome',
  'admin.meta.organisation': 'Sovrium — Organisation',
  'admin.meta.profile': 'Sovrium — My profile',
  'admin.meta.gdpr': 'Sovrium — My data',
  'admin.meta.apiKeys': 'Sovrium — API keys',
  'admin.meta.env': 'Sovrium — Environment',
  'admin.meta.api': 'Sovrium — API',
  'admin.meta.mcp': 'Sovrium — MCP',
  'admin.meta.changelog': 'Sovrium — Changelog',
  'admin.meta.release': 'Sovrium — Changelog · Release',
  'admin.meta.tables': 'Sovrium — Data · Records',
  'admin.meta.buckets': 'Sovrium — Data · Files',
  'admin.meta.agents': 'Sovrium — Data · Conversations',
  'admin.meta.forms': 'Sovrium — Data · Submissions',
  'admin.meta.connections': 'Sovrium — Data · Connections',
  'admin.meta.users': 'Sovrium — Data · Users',
  'admin.meta.invitations': 'Sovrium — Data · Invitations',
  'admin.meta.userAccount': 'Sovrium — Data · Account',
  'admin.meta.pages': 'Sovrium — Data · Analytics',
  'admin.meta.automations': 'Sovrium — Data · Runs',
  'admin.meta.links': 'Sovrium — Data · Links',
  'admin.meta.footprint': 'Sovrium — Footprint',
  'admin.meta.decisions': 'Sovrium — Decisions',
  'admin.meta.decision': 'Sovrium — Decision',
  'admin.meta.login': 'Sovrium — Sign in',
  'admin.meta.forgotPassword': 'Sovrium — Forgot password',
  'admin.meta.resetPassword': 'Sovrium — New password',
} as const
