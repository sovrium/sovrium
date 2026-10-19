/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The Developers trio: `/api`, `/mcp`, `/changelog`.
//
// A fourth area file for the reason `app.ts` gives about the split generally.
// The measured table of which slots resolve a `$t:` token lives in `console.ts`
// and is not repeated here.
//
// ─── WHAT DELIBERATELY STAYS A LITERAL ON THESE THREE PAGES ────────────────
//
// The code samples. Every `curl`, every `fetch`, every JSON block is a
// TRANSCRIPT of a command the reader is about to paste, so translating it would
// break it — and even the comment line inside a sample stays with its sample,
// because a half-translated snippet is worse than an English one. That is the
// same rule the website's docs zone follows for its fences.
//
// The three surfaces also carry the console's flatest vocabulary — "Data",
// "Actions", "Automations", "Tables", "Pages" — which are the operator's own
// nouns rather than the console's (BRAND §6: they chose those words). They are
// keyed anyway: a French console writes "Tableaux" and "Pages", and leaving a
// noun literal because it happens to be short is how a table ends up half
// migrated.

export default {
  // ── API (`/api`) ────────────────────────────────────────────────────────
  'admin.api.heading': 'API',
  'admin.api.blurb':
    'Your app exposes a REST API generated from its config. Each table becomes a set of CRUD endpoints. Here are the essentials to get started, plus the full interactive reference.',
  'admin.api.access.heading': 'Access',
  'admin.api.baseUrl.heading': 'Base URL',
  'admin.api.auth.heading': 'Authentication',
  'admin.api.auth.blurb':
    'Better Auth session (login cookie). A request sent from this browser, signed in as an administrator, is authenticated automatically.',
  'admin.api.keys.heading': 'API keys',
  'admin.api.keys.blurb':
    'A script has no browser session. Give it a long-lived key instead and send it in the x-api-key header.',
  'admin.api.keys.link': 'Manage keys',
  // The Keys tab on an instance that declared no `auth.apiKeys`. Every endpoint
  // behind the manager 404s there, so the honest answer names the capability
  // and where it is turned on — which is a config file, not a control here.
  'admin.api.examples.heading': 'Request examples',
  'admin.api.examples.note':
    'The verb and path are enough; the interactive reference details the parameters, request bodies, and responses for each endpoint.',
  // The example lines for an app with tables. Each call has its comment on the
  // line above it, so the calls line up whatever the table names, and the
  // comment names the table by its label (`label` per row of the folded list,
  // `exampleTableLabel` for the single calls) while the path keeps its name.
  'admin.api.examples.httpList': '# List “$record.label”\nGET  /api/tables/$record.name/records',
  'admin.api.examples.httpCreate':
    '# Create a record in “$record.exampleTableLabel”\nPOST /api/tables/$record.exampleTable/records',
  'admin.api.examples.curlListComment':
    '# List “$record.exampleTableLabel” (this browser’s admin session authenticates the call)',
  'admin.api.examples.jsListComment':
    '// List “$record.exampleTableLabel” from this browser (the session cookie is included)',
  // The table-less example lines. Each one holds no `$record`, so the whole
  // line can live in the catalogue and follow the reader's language.
  'admin.api.examples.httpListAny':
    'GET  /api/tables/{table}/records      # List a table’s records',
  'admin.api.examples.httpCreateAny': 'POST /api/tables/{table}/records      # Create a record',
  'admin.api.examples.curlListAnyComment':
    '# List a table’s records (this browser’s admin session authenticates the call)',
  'admin.api.examples.jsListAnyComment':
    '// List a table’s records from this browser (the session cookie is included)',
  'admin.api.createUser.heading': 'Create user',
  'admin.api.createUser.blurb':
    'Create an account through Better Auth’s admin API, or through the MCP server. Set a strong password; the person changes it after signing in.',
  'admin.api.createUser.comment': '# POST /api/auth/admin/create-user — create an account',
  'admin.api.reference.heading': 'Interactive reference',
  'admin.api.reference.blurb':
    'Browse every endpoint, try requests, and read the schemas in the interactive reference (Scalar).',
  'admin.api.reference.link': 'Open the interactive reference',

  // ── MCP (`/mcp`) ────────────────────────────────────────────────────────
  'admin.mcp.heading': 'MCP',
  'admin.mcp.blurb':
    'Connect your AI (Claude, Cursor…) to this instance over MCP. Issue a credential, paste the config into your client, and your AI reaches the tools below — reading and writing data, actions, and automations.',
  // The Clients tab. `oauth_clients`, `oauth_consents` and `oauth_access_tokens`
  // all exist; no admin read joins them, so there is nothing to list yet. The
  // panel says that rather than drawing an empty table, which would read as
  // "nobody has ever connected".
  'admin.mcp.endpoint.heading': 'MCP endpoint',
  'admin.mcp.endpoint.blurb':
    'Your MCP server is mounted at this address. Paste it into your AI client’s config as-is.',
  'admin.mcp.endpoint.filename': 'Endpoint',
  'admin.mcp.credential.heading': 'Issue a credential',
  'admin.mcp.credential.blurb':
    'Register an MCP client to obtain a credential. The response returns a “client_id” and a “client_secret” to paste into your AI client. Run it signed in as an admin — without a session the endpoint answers 401, and “$SOVRIUM_SESSION” carries your login cookie.',
  'admin.mcp.credential.comment':
    '# POST /api/auth/oauth2/register — issue an MCP credential (RFC 7591)',
  'admin.mcp.credential.anonymous':
    'Claude Desktop, Cursor and ChatGPT Dev Mode register themselves before any browser session exists. To let them, set “SOVRIUM_OAUTH_ANONYMOUS_CLIENT_REGISTRATION=true” — registration then accepts any caller, capped at 20 per minute per IP.',
  'admin.mcp.config.heading': 'Reference configuration',
  'admin.mcp.config.filename': 'MCP client config',
  'admin.mcp.config.blurb':
    'The MCP config to paste into your client, with the endpoint already set to this instance’s address.',
  'admin.mcp.tools.heading': 'Available tools',
  'admin.mcp.tools.region': 'Available MCP tools',
  'admin.mcp.tools.data': 'Data',
  'admin.mcp.tools.actions': 'Actions',
  'admin.mcp.tools.automations': 'Automations',
  'admin.mcp.tools.empty': 'No tools exposed yet',
  'admin.mcp.tools.emptyHint':
    'Add “aiAccess” to a table, an action, or a manual automation in your app config to expose it here as an MCP tool.',

  // ── Changelog (`/changelog`) ────────────────────────────────────────────
  //
  // The boot ledger, and — at `?view=current` — the configuration as booted.
  // The `admin.schema.*` block below is NOT dead: the current view is Schema's
  // body re-homed, and it keeps Schema's own words rather than paraphrasing
  // them one route over.
  'admin.changelog.heading': 'Changelog',
  'admin.changelog.blurb':
    'Every start this instance recorded, newest first, and what changed between them.',
  'admin.changelog.ledger.region': 'Boot ledger',
  'admin.changelog.ledger.blurb':
    'One row per start whose version or configuration differed from the one before it.',
  'admin.changelog.ledger.search': 'Search versions',
  'admin.changelog.ledger.empty': 'No start recorded yet.',
  'admin.changelog.ledger.noMatch': 'No start matches this search.',
  'admin.changelog.current': 'current',
  'admin.changelog.current.heading': 'Configuration as booted',
  'admin.changelog.current.declarations': 'declarations',
  'admin.changelog.toCurrent': 'Read the configuration as booted',
  'admin.changelog.back': 'Back to the changelog',

  // ── One boot (`/changelog/:hash`) ───────────────────────────────────────
  'admin.changelog.one.heading': 'Release',
  'admin.changelog.one.blurb':
    'One recorded start: what it applied to your database, and how its configuration differed from the start before it.',
  'admin.changelog.boot.region': 'Boot record',
  'admin.changelog.boot.heading': 'Boot',
  'admin.changelog.field.version': 'Version',
  'admin.changelog.field.bootedAt': 'Booted',
  'admin.changelog.field.bootedBy': 'Started by',
  'admin.changelog.field.engine': 'Engine',
  'admin.changelog.field.previousEngine': 'Previous engine',
  'admin.changelog.field.config': 'Config',
  'admin.changelog.field.previousConfig': 'Previous config',
  'admin.changelog.diff.heading': 'Configuration diff',
  'admin.changelog.diff.baseline':
    'The first recorded boot has nothing before it to compare against, so it carries no diff.',
  'admin.changelog.diff.pruned':
    'The boot this one followed has been pruned, so there is nothing left to diff against.',
  'admin.changelog.diff.redaction':
    'Both sides of this diff are starts that happened. Credentials were redacted before either was stored. Export it to read the lines.',
  'admin.changelog.ddl.heading': 'Tables changed',
  'admin.changelog.ddl.empty':
    'No table changed: the engine derived nothing to apply from this configuration.',
  'admin.changelog.migrations.heading': 'Engine migrations',
  'admin.changelog.migrations.empty': 'None: the engine did not change.',

  // ── The configuration as booted (`/changelog?view=current`) ─────────────
  'admin.schema.heading': 'Schema',
  'admin.schema.declared.heading': 'Declared configuration',
  'admin.schema.declared.region': 'Declared configuration',
  'admin.schema.declared.empty': 'This config declares nothing yet.',
  'admin.schema.raw.heading': 'Declarations by family',
  'admin.schema.raw.summary': 'Export the configuration to read or share the whole document.',
  'admin.schema.nav.region': 'Configuration',
  'admin.schema.nav.overview': 'Overview',
  'admin.schema.nav.rootKeys': 'Root keys',
  'admin.schema.overview.body':
    'What this server booted with, decoded and redacted. Choose a root key to read one family, or export the whole configuration below.',

  'admin.schema.counts.tables': 'Tables',
  'admin.schema.counts.pages': 'Pages',
  'admin.schema.counts.forms': 'Forms',
  'admin.schema.counts.automations': 'Automations',
  'admin.schema.counts.agents': 'Agents',
  'admin.schema.counts.buckets': 'Buckets',
  'admin.schema.counts.connections': 'Connections',

  // ── LOCKED · audit ──────────────────────────────────────────────────────
  //
  // Three statements about what this software does with the operator's config
  // and their AI's reach. Each is the sentence a reader would cite if they were
  // wrong about it afterwards: what the console does with a running config,
  // what it redacts, and what an AI can touch by default.
  'admin.locked.audit.schema.readOnlyNotice':
    'Edit your app config file and restart to change any of this. The console reads the running configuration; it never writes it.',
  'admin.locked.audit.schema.redactionNotice':
    'The configuration this instance booted from, exactly as it is running. Credentials are redacted before the page is built.',
  'admin.locked.audit.mcp.exposureNotice':
    'You decide what your AI can do: nothing is exposed by default.',

  // The callout heading above the read-only notice. Not locked on its own — it
  // is a label, and the sentence under it carries the claim.
  'admin.schema.readOnly.heading': 'Configuration lives in code',
} as const
