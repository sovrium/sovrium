/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The string table of the operator-DATA surfaces.
//
// One catalogue file per area rather than one alphabetised object, for the
// reason `app.ts` gives about the split generally: the console is being
// authored by several hands at once, and two of them appending keys to one
// object is a merge conflict on every commit. `chrome.ts` keeps the shell, the
// breadcrumb vocabulary and the document titles; `console.ts` the overview, the
// account cluster and the auth surfaces; this file the data cluster;
// `developers.ts` the API/MCP/schema trio. `app.ts` merges them into the one
// table the interpreter sees, so a key's HOME is an authoring convenience and
// its ADDRESS is unchanged.
//
// ─── WHAT IS KEYED HERE, AND WHAT DELIBERATELY IS NOT ──────────────────────
//
// `content`-bound strings AND `aria-label`s. The full measured table of which
// slots resolve a `$t:` token lives in `console.ts` and is not repeated here —
// read it before adding a key to a slot it does not list.
//
// The short version, and the two corrections that matter. An early revision of
// this note said a token in `props` never resolves: FALSE for an `aria-label`,
// which lands on the rendered element and does resolve, on a plain element and
// on an island host alike. A later one said a field an island re-reads out of
// the component — a `kpi.label`, a grid column `label`, an `emptyMessage` —
// never resolves: that was true when it was written and is FALSE since
// `resolveComponentTranslationTokens` landed, because it walks the component
// BEFORE island props are built. Both were verified live on 2026-09-18, in
// English and in French.
//
// What still does not resolve is narrow and named: a caption the graph or
// matrix resolver copies into `graphView` / `matrixView`, which is projected
// ahead of that pass and skipped by it. Six of those are literals in
// `organisation.ts`.
//
// The three footprint captions ARE lifted here now, under `admin.locked.audit.`
// The earlier note kept them on the page so the argument stayed beside the page
// making it. That reasoning loses to a stronger one: each says what a published
// number means and who took it, so an operator free to reword them could make
// this instance report a footprint figure that does not mean what it says.
//
// Namespaced `admin.<surface>.<slot>`, like `console.ts`, so an operator's own
// table can never collide with the console's.

export default {
  // ── Organisation (`/organisation`) ──────────────────────────────────────
  //
  // The blurb is the page's `sr-only` orienting sentence, so it names the three
  // checks, the matrix and the map — and not the three lenses the canvas draws
  // that are still absent: it must describe what the page SHOWS, and a
  // screen-reader user told about drawings that are not there has been
  // misdirected by the one sentence written for them. It gained its second
  // clause when the matrix shipped, its third when the map did and its fourth
  // when the lanes did; it takes a fifth the day Reach or Agents land.
  //
  // There is no `.heading` key for any region, and the absence is the point:
  // the tab trigger above each one already says `Findings`, `Matrix` or `Map`,
  // so a heading repeating it was the restated heading [internal ref] §D4 names
  // outright. What survives is `.region` — the fuller phrase that names the
  // landmark for a screen reader (`Structural findings`, `Grant matrix`,
  // `Access map`), which is doing work the one-word trigger cannot.
  //
  // The findings region is still not called the canvas's own `What the map
  // found`. The canvas puts that phrase UNDER the map, as its caption; here the
  // findings are a lens of their own, addressable at `?tab=findings` and
  // readable without opening the map at all. Borrowing the caption would name
  // one lens after another.
  'admin.organisation.heading': 'Organisation',
  'admin.organisation.blurb':
    'What this application exposes: write paths reachable without signing in, resources readable by everyone, and places where one person is the only connection between two parts of the app. The matrix crosses every resource with every grant source, where an absence reads as plainly as a grant. The map draws the chain itself — who acts, what authorises them, and what they reach. The lanes draw the other half, where nobody acts: each automation and the steps it runs on its own.',
  'admin.organisation.tabs.region': 'Organisation lenses',
  'admin.organisation.findings.region': 'Structural findings',
  'admin.organisation.findings.blurb':
    'Three structural checks against the configuration this server is running, re-derived every time this page is opened. Nothing is stored and nothing is acknowledged — a finding disappears when the configuration that caused it changes.',
  'admin.organisation.matrix.region': 'Grant matrix',
  'admin.organisation.matrix.blurb':
    'Every resource against every grant source, ordered by privilege with the open rung last. A cell is a grant and an empty cell is none — the half a list of findings cannot show, because the three checks report what is exposed and never what is unreachable.',
  'admin.organisation.map.region': 'Access map',
  // What the map adds over the matrix, in one sentence, because two lenses over
  // one read have to justify being two.
  //
  // The matrix crosses resources with grant SOURCES: it answers "which role
  // reaches this table". It cannot answer "which PERSON reaches this table",
  // because the people are not on either axis — the membership edge that joins
  // a person to a role is a fact the grid has nowhere to put. The map adds that
  // column and that edge, so it draws the whole chain rather than its last link.
  'admin.organisation.map.blurb':
    'The chain the matrix collapses: the people and agents that act, the roles, teams and open rung that authorise them, and the resources they reach — drawn left to right, one line per grant. Selecting anything follows its chain and dims what it does not touch. The table beneath carries the same nodes and the same grants as text.',
  'admin.organisation.processes.region': 'Automation lanes',
  // What Processes adds, and it is not a wider version of the map.
  //
  // The other three lenses are three readings of one access graph, and every
  // one of them is about a PRINCIPAL — who acts, what authorises them, what
  // they reach. This one draws the part of the app where nobody acts at all: an
  // automation fires on its trigger whether or not a person is there. So the
  // blurb names what the lens IS rather than what it adds to the one before it,
  // and it spells out the two weights, because a dashed lane is the one thing
  // on the drawing a reader cannot work out by looking at it.
  'admin.organisation.processes.blurb':
    'What runs with nobody in front of it: each automation as a lane, and the steps it takes along it, in the order it takes them. A dashed lane is paused; a grey one is switched off in the configuration. The table beneath carries the same lanes and the same steps as text.',
  // ── The lens vocabulary: tab strip, drawings, grid ──────────────────────
  //
  // These were LITERALS until 2026-09-18, under a comment asserting that a
  // component's own schema field is not on the `$t:` substitution pass. That
  // premise went stale: `resolveComponentTranslationTokens`
  // (`src/presentation/render/i18n/translation-handler.ts:245`, called from
  // `component-renderer.tsx:367`) walks EVERY schema-level field of a component
  // except `props`, `children`, `content`, `panels`, `responsive`, `i18n`,
  // `graphView` and `matrixView` — each of which another pass owns. So a
  // `matrix` `label`/`emptyMessage`, a `graph` `label`/`emptyMessage`, a
  // `data-table` `columns[].label` / `valueLabels` / `emptyMessage` and a
  // `kpi` `label` all resolve now, and a tab caption resolves through
  // `buildTabsItems` → `localizeChildLabel`.
  //
  // The exception, measured the same day: an axis caption the graph or matrix
  // RESOLVER copies into its `graphView` / `matrixView` is baked in before that
  // pass runs, and those two keys are the ones it skips. Six captions are
  // therefore literals in `organisation.ts` rather than keys here, each with
  // its French in a comment — see the note where the keys would have gone.
  //
  // Panel ids stay DECLARED in `organisation.ts` regardless: a caption's id is
  // derived from the raw token's key when none is written, and `?tab=` is an
  // address that must not move with the active locale.
  'admin.organisation.tabs.findings': 'Findings',
  'admin.organisation.tabs.matrix': 'Matrix',
  'admin.organisation.tabs.map': 'Map',
  'admin.organisation.tabs.reach': 'Reach',
  'admin.organisation.tabs.processes': 'Processes',

  'admin.organisation.degraded.heading': 'Part of the graph could not be read.',
  'admin.organisation.degraded.body':
    'Findings that depend on the unread source are missing rather than absent, so this list is incomplete. Check the server log for the failure.',

  // The matrix's `cell.flag.label`, the map's three column captions and the two
  // lane captions are keyed here. They were literals until the order was fixed:
  // the drawing was projected into a `graphView` / `matrixView` before the `$t:`
  // pass ran, so a key there shipped verbatim. The component is translated
  // first now. The skip is as wide as it ever was, so a NODE's own label — which
  // came back from the endpoint — is data, not vocabulary, and is not on this
  // list.
  'admin.organisation.matrix.label':
    'Resources by grant source. The table below carries the same grants as text.',
  'admin.organisation.matrix.empty':
    'Nothing to cross. This app declares no resources, or no roles, teams or open grants that could reach them.',
  'admin.organisation.matrix.flag': 'Through the open rung',

  'admin.organisation.map.label':
    'Who reaches what, and through which grant. The table below carries the same nodes and grants as text.',
  'admin.organisation.map.empty':
    'Nothing to map. This app declares no principals, no grant sources, or no resources they could reach.',
  'admin.organisation.map.column.principals': 'Principals',
  'admin.organisation.map.column.grantSources': 'Grant sources',
  'admin.organisation.map.column.resources': 'Resources',

  'admin.organisation.processes.label':
    'Each automation as a lane, with the steps it runs along it. The table below carries the same lanes and steps as text.',
  'admin.organisation.processes.empty':
    'Nothing runs on its own. This app declares no automations.',
  'admin.organisation.processes.lane': 'Automation',
  'admin.organisation.processes.stations': 'Steps, in order',

  'admin.organisation.reach.region': 'Access graph as text',
  'admin.organisation.reach.blurb':
    'Every relationship in the graph, one per row — the same facts the map and the grid draw, sortable and copyable. Sort by Route to see what the open rung reaches.',
  'admin.organisation.reach.things': 'Things',
  'admin.organisation.reach.relationships': 'Relationships',
  'admin.organisation.reach.from': 'Source',
  'admin.organisation.reach.kind': 'Relationship',
  'admin.organisation.reach.to': 'Target',
  'admin.organisation.reach.ops': 'Permits',
  'admin.organisation.reach.route': 'Route',
  'admin.organisation.reach.openRung': 'Open rung',
  'admin.organisation.reach.kind.member': 'stands in',
  'admin.organisation.reach.kind.grant': 'is granted',
  'admin.organisation.reach.kind.trigger': 'may trigger',
  'admin.organisation.reach.kind.escalation': 'escalates to',
  'admin.organisation.reach.kind.step': 'then',
  'admin.organisation.reach.empty':
    'No relationships. Nothing in this app grants anything to anybody.',

  // Structural position — the four per-principal figures the graph read
  // publishes on every `person` and `agent` node.
  //
  // The four terms are ALSO explained in the panel's own `<dl>`, which stays
  // LITERAL — and the reason is not the one an earlier draft of this comment
  // gave. It said a `description-list` item is off the `$t:` pass; MEASURED, it
  // is not: a token in `items[].term` resolves server-side, and zero raw `$t:`
  // survive in the response. What it does NOT emit is the `data-translations`
  // twin the language switch repaints from, so a key there renders the English
  // value and stays English after the switch — today.
  //
  // It is left literal to match the legend shipped beside it on the same page,
  // not because a key is impossible. Keying both is a one-line follow-up for
  // whoever closes the French pass, and it is the right move the day the mount
  // resolves the console's locale server-side (`fr.ts` names that seam).
  'admin.organisation.reach.position.heading': 'Structural position',
  'admin.organisation.reach.position.holds': 'Holds',
  'admin.organisation.reach.position.reaches': 'Reaches',
  'admin.organisation.reach.position.writes': 'Writes',
  'admin.organisation.reach.position.duplicateRoutes': 'Duplicate routes',

  // Exceptions — the narrowings beneath the Matrix grid. `scope` is the AXIS a
  // narrowing applies to, which is why its two values read as the nouns
  // `Columns` and `Rows` rather than as the wire's `field` / `row`: a reader
  // meets this in a table cell, not in a schema.
  'admin.organisation.exceptions.heading': 'Where a cell is not the whole truth',
  'admin.organisation.exceptions.resource': 'Resource',
  'admin.organisation.exceptions.scope': 'Scope',
  'admin.organisation.exceptions.scope.field': 'Columns',
  'admin.organisation.exceptions.scope.row': 'Rows',
  'admin.organisation.exceptions.op': 'Operation',
  'admin.organisation.exceptions.field': 'Field',
  'admin.organisation.exceptions.rung': 'Granted to',
  'admin.organisation.exceptions.rung.everyone': 'Everyone',
  'admin.organisation.exceptions.rung.anySession': 'Anyone signed in',
  'admin.organisation.exceptions.rung.roles': 'Named roles',
  'admin.organisation.exceptions.detail': 'Detail',
  'admin.organisation.exceptions.empty': 'No narrowings declared.',

  // ── Footprint (`/footprint`) ────────────────────────────────────────────
  'admin.footprint.heading': 'Footprint',
  'admin.footprint.blurb':
    'What this instance consumed, and the levers it is running under. Every figure below is either measured by this process or declared by you — each region says which.',

  // ── Records (`/tables`, `/tables/:table`) ───────────────────────────────
  'admin.tables.heading': 'Records',
  'admin.tables.blurb':
    'Browse and edit the records in your tables. Choose a table to open its grid — search, sort, filter, then open a record to edit it.',

  // ── Files (`/buckets`, `/buckets/:bucket`) ──────────────────────────────
  'admin.buckets.heading': 'Files',
  'admin.buckets.blurb':
    'Browse the files stored in your buckets. Choose a bucket to open its browser — search, sort, filter by type, then download a file.',

  // ── Conversations (`/agents`, `/agents/:agent`) ─────────────────────────
  //
  // TWO blurbs, because the general-purpose agent is a different thing from a
  // declared one and the sentence that orients an operator has to say so. Which
  // one a page uses is decided by route order, not by a condition — see
  // `pages/data/agents.ts`.
  'admin.agents.heading': 'Conversations',
  'admin.agents.blurb':
    'Every conversation your users had with this agent. Open one to read the full thread.',
  'admin.agents.blurbDefault':
    'The general-purpose agent: every conversation no declared agent claimed. Open one to read the full thread.',

  // ── Submissions (`/forms`, `/forms/:form`) ──────────────────────────────
  'admin.forms.heading': 'Submissions',
  'admin.forms.blurb':
    'Review the submissions you have received, form by form. Choose a form to browse its inbox, open a submission, or export everything to CSV.',

  // ── Connections (`/connections`) ────────────────────────────────────────
  'admin.connections.heading': 'Connections',
  'admin.connections.blurb':
    'Inspect your app’s connections to external services and the state of their tokens: active, expiring soon, or expired. Connections are declared in config — here you observe their real state.',

  // ── Users (`/users`) ────────────────────────────────────────────────────
  //
  // The blurb names the admin API as the way to CREATE an account, because the
  // console deliberately has no create form and an operator who cannot find one
  // needs to be told where it went rather than left looking.
  'admin.users.heading': 'Users',
  'admin.users.blurb':
    'Manage your app’s accounts: search for a user, adjust their role, or suspend access. Account creation goes through the admin API (see Developers → API).',
  'admin.users.tabs.region': 'Users sub-views',
  'admin.users.account.heading': 'Account',
  'admin.users.account.blurb':
    'One account: its role and status, the writes an administrator may make on it, and what the console cannot show about it yet.',
  'admin.users.account.region': 'Account',
  'admin.users.account.back': 'Back to users',
  'admin.users.account.roles.region': 'Assignable roles',
  'admin.users.account.roles.heading': 'Assignable roles',
  'admin.users.account.roles.body':
    'Every role this app may assign, read from its configuration. Roles are declared in auth.roles[]; the console reads them and never writes them.',
  'admin.users.account.gaps.region': 'Not shown here',
  'admin.users.account.gaps.heading': 'Not shown here',
  'admin.users.account.gaps.sessions.heading': 'Open sessions',
  'admin.users.account.gaps.sessions.body':
    'Ending every session is above, under the row actions. Listing them is not: the endpoint that returns them answers a POST, and a console read is a GET.',
  'admin.users.account.gaps.teams.heading': 'Teams',
  'admin.users.account.gaps.teams.body':
    'Teams are declared in auth.groups[]. No admin read publishes which ones an account belongs to, so membership cannot be shown or changed here.',
  'admin.users.account.gaps.activity.heading': 'Last active',
  'admin.users.account.gaps.activity.body':
    'The directory returns id, email, name, role and status. A per-account last-activity moment needs the session table joined in, which no read does.',

  // ── Invitations (`/users/invitations`) ──────────────────────────────────
  'admin.invitations.heading': 'Invitations',
  'admin.invitations.blurb':
    'Invite someone to this app, see which invitations are still outstanding, and take one back before it is accepted.',

  // ── Analytics (`/pages`) ────────────────────────────────────────────────
  //
  // TWO blurbs, because the lede describes what the page SHOWS and has to track
  // whether it can show anything. Promising the trend and the top pages
  // directly above an "Analytics is not enabled" panel reads as a broken page
  // rather than an unconfigured one. Which one renders is decided by the host
  // app's declaration, not by a condition — see `pages/data/pages.ts`.
  'admin.pages.heading': 'Analytics',
  'admin.pages.blurb':
    'Measure your pages’ audience over the last 30 days: views, visitors, and sessions, the trend over time, the most-viewed pages, where the traffic came from, what it browsed with, and the raw event log.',
  'admin.pages.blurbDisabled':
    'Measure your pages’ audience — views, visitors, sessions and their sources. Analytics is off for this app; turn it on to start collecting.',
  'admin.pages.tabs.region': 'Analytics sub-views',

  // ── Automations (`/automations`) ─────────────────────────────────────
  //
  // The blurb drops the "here is what this page contains" line and keeps the two
  // sentences an operator needs: what Pause does and what it deliberately does
  // NOT touch, then where to go when a row reads `Disabled in config`. [internal ref]
  // D4 cuts ornament, not the sentence that says what happens next.
  'admin.automations.heading': 'Runs',
  'admin.automations.blurb':
    'Every run this app has made, and the automations they came from. Pause one to stop it running without changing your config; an automation disabled in your app config can only be re-enabled there.',
  'admin.automations.tabs.region': 'Runs sub-views',
  'admin.automations.metrics.region': 'Run metrics',

  // ── Links (`/links`, `/links/:slug`) ──────────────────────────────
  //
  // The DEEP-DIVE's heading and blurb are deliberately absent from this table.
  // Both carry `$record.*` references resolved from the page-level `{ system }`
  // binding, and a key whose value is a template belongs beside the binding that
  // fills it rather than in a catalogue that reads as a list of finished
  // sentences.
  'admin.links.heading': 'Links',
  'admin.links.blurb':
    'Read how your short links are performing, and open the one you need to change. The figures come from the same click store the Analytics surface reads; the catalog below lists every link this instance serves, whether it was declared in config or minted here.',
  // ── Region names (accessible landmarks) ─────────────────────────────────
  //
  // An `aria-label` on a `section` is the name a screen-reader user hears when
  // they list the page's regions, so it is the sighted heading's equivalent and
  // is keyed beside it. Where a region already carries a visible heading, both
  // point at the SAME key: two spellings of one landmark is a defect a sighted
  // reviewer cannot see.
  'admin.agents.region': 'Conversations',
  'admin.agents.loading': 'Loading conversations…',
  'admin.automations.region': 'Automations',
  'admin.buckets.browser.region': 'File browser',
  'admin.buckets.upload.region': 'Upload file',
  'admin.connections.region': 'Connections',
  'admin.forms.metrics.region': 'Form metrics',
  'admin.forms.submissions.region': 'Submissions',
  'admin.users.metrics.region': 'User metrics',
  'admin.users.region': 'Users',
  'admin.invitations.form.region': 'Invite a teammate',
  'admin.invitations.pending.region': 'Pending invitations',

  // ── Empty states: the three different problems ──────────────────────────
  //
  // BRAND §7: a console showing nothing must say WHICH nothing. "This app
  // declares none" is a configuration fact and reads differently from "nothing
  // matched" — the second is a search result, the first is an instruction. Each
  // whole-page empty state is therefore a triple: what it is, why it is empty,
  // and the one next action ([internal ref] D4 keeps the next-action sentence).
  'admin.tables.empty.heading': 'No tables',
  'admin.tables.empty.body':
    'This app declares no tables yet. Add one in your app config to start capturing records.',
  'admin.tables.empty.hint': 'Add a table first — records follow.',
  'admin.forms.empty.heading': 'No forms',
  'admin.forms.empty.body':
    'This app declares no forms yet. Add one in your app config to start receiving submissions.',
  'admin.forms.empty.hint': 'No forms yet — the inbox follows.',
  'admin.automations.empty.heading': 'No automations',
  'admin.automations.empty.body':
    'This app declares no automations yet. Add one in your app config to see its runs appear here.',
  'admin.automations.empty.hint': 'No automations yet — so nothing to run.',

  // ── Automations · run history (`/automations`) ──────────────────────────
  'admin.automations.runs.heading': 'Run history',
  'admin.automations.runs.scope':
    'Shows the 25 most recent runs. Search and the filters query every run and return the 25 most recent matches.',
  // The one thing a run drawer cannot answer with a control: configuration is
  // code-only, so the drawer names the address instead of offering an
  // edit affordance it would have to refuse.
  'admin.automations.runs.detail.configuredInCode':
    'Configured in code, not here. Edit the app config and restart to change it.',

  // ── Submissions · one form (`/forms/:form`) ─────────────────────────────
  'admin.forms.openForm': 'Open form',
  'admin.forms.conversion.heading': 'Conversion rate',
  'admin.forms.conversion.why':
    'Conversion rate needs a view counter — Sovrium does not measure that yet.',
  'admin.forms.tabs.region': 'Submissions sub-views',
  'admin.forms.trend.region': 'Submissions over time',
  'admin.forms.gaps.region': 'Figures not measured yet',
  'admin.forms.gaps.heading': 'Not measured yet',
  // The value line shared by every gap card. Deliberately not "0" and not
  // "unavailable": nothing failed, the figure is simply not instrumented.
  'admin.forms.metric.unmeasured': 'not measured',
  'admin.forms.duration.heading': 'Average completion time',
  'admin.forms.duration.why':
    'Timing a submission needs the moment the form was opened; only the moment it arrived is recorded.',
  'admin.forms.attachments.heading': 'Attachments',
  'admin.forms.attachments.why':
    'Counting them means reading every submission’s data, which the aggregate query deliberately skips to stay cheap.',
  'admin.forms.dropOff.heading': 'Drop-off per step',
  'admin.forms.dropOff.why':
    'Knowing where someone stopped needs a record of the steps they reached; a multi-step form stores only what it received.',
  'admin.forms.export.region': 'Export to CSV',
  'admin.forms.scope':
    'Shows the 25 most recent submissions. Search queries every submission and returns the 25 most recent matches.',

  // ── Analytics (`/pages`) ────────────────────────────────────────────────
  'admin.pages.metrics.region': 'Audience metrics',
  'admin.pages.trend.region': 'Audience trend',
  'admin.pages.top.region': 'Most-viewed pages',
  'admin.pages.acquisition.heading': 'Acquisition',
  'admin.pages.referrers.region': 'Top referrers',
  'admin.pages.campaigns.region': 'Campaigns',
  'admin.pages.technology.heading': 'Technology',
  'admin.pages.devices.region': 'Device types',
  'admin.pages.browsers.region': 'Browsers',
  'admin.pages.os.region': 'Operating systems',
  'admin.pages.events.heading': 'Event log',
  'admin.pages.disabled.region': 'Analytics not enabled',
  'admin.pages.disabled.heading': 'Analytics is not enabled',
  'admin.pages.disabled.body':
    'Enable analytics in your app config (analytics) to measure your pages’ audience, visitors, and sessions.',
  'admin.pages.disabled.hint': 'Nothing to measure until analytics is enabled.',

  // ── Links (`/links`, `/links/:slug`) ────────────────────────────────────
  //
  // The period chips are keyed even though two of the three are near-identical
  // across languages: a French console writes "7 j", not "7d", and leaving the
  // odd one out literal would hide that from whoever translates the pair.
  'admin.links.period.region': 'Period',
  'admin.links.period.24h': '24h',
  'admin.links.period.7d': '7d',
  'admin.links.period.30d': '30d',
  'admin.links.metrics.region': 'Link metrics',
  'admin.links.trend.region': 'Link click trend',
  'admin.links.catalog.region': 'Link catalog',
  'admin.links.unavailable.region': 'Link metrics unavailable',
  'admin.links.unavailable.heading': 'Click metrics are not available',
  'admin.links.unavailable.body':
    'Link clicks are recorded through the built-in analytics engine. Enable analytics in your app config to measure them — the catalog below works either way.',
  'admin.links.definition.heading': 'Definition',
  'admin.links.definition.region': 'Link definition',
  'admin.links.qr.region': 'QR code',
  'admin.links.qr.download': 'Download SVG',
  'admin.links.audience.heading': 'Audience',
  'admin.links.referrers.region': 'Referrers',
  'admin.links.devices.region': 'Devices',
  'admin.links.campaigns.region': 'Campaigns',
  'admin.links.clickLog.heading': 'Click log',
  'admin.links.clickLog.region': 'Click log',
  'admin.links.definition.full': 'Full definition',
  'admin.links.create.region': 'New link',
  'admin.links.create.heading': 'New link',
  'admin.links.create.body':
    'A slug and where it points. A title, campaign parameters and an expiry are set on the link’s own page once it exists.',
  'admin.links.manage.region': 'Manage this link',
  'admin.links.manage.heading': 'Manage',
  'admin.links.manage.repoint': 'Re-point this link',
  'admin.links.manage.config.heading': 'Declared in configuration',
  'admin.links.manage.config.body':
    'This link is declared in app.links[]. Edit the configuration file and restart to change it; the console never writes configuration.',

  // ── Footprint (`/footprint`) ────────────────────────────────────────────
  'admin.footprint.measured.heading': 'Measured',
  'admin.footprint.storage.heading': 'Storage',
  'admin.footprint.storage.region': 'Storage consumers',
  'admin.footprint.configuration.heading': 'Configuration',
  'admin.footprint.levers.region': 'Eco levers',
  'admin.footprint.rgesn.blurb':
    'Ecoconception is a design practice, not runtime state, so it is not scored here. How the engine measures against the French référentiel is published once, for every install:',
  'admin.footprint.rgesn.link': 'How Sovrium measures up against RGESN 2024',

  // ── LOCKED · audit ──────────────────────────────────────────────────────
  //
  // Each of the three says what a published number MEANS and which instrument
  // took it. An operator free to reword them could make this instance report a
  // footprint figure that does not mean what it says — which is the same class
  // of harm as a softened erasure notice, arriving through a different door.
  'admin.locked.audit.footprint.measuredProvenance':
    'Measured by this process since it started; the counters reset when it restarts. Grades read each response’s Content-Length via the X-Eco-Index header — not a Lighthouse or EcoIndex.fr score, which inspect the rendered page. Set ECO_INDEX_HEADER=on to record them. The hit rate counts only renders the cache was offered: signed-in and dynamic requests bypass it, so an instance without anonymous traffic shows — rather than a rate.',
  'admin.locked.audit.footprint.storageProvenance':
    'The three largest consumers, measured on request. Each row names the instrument behind its number, because a size with no stated origin cannot be told apart from one nobody took. A blank size means the probe was unavailable — a zero means the resource was measured and is empty.',
  'admin.locked.audit.footprint.configurationProvenance':
    'Read from the environment on every request, so a change takes effect on the next refresh. Configuration is declared, not measured: it describes how this instance is set up, not what it emitted.',
} as const
