/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const docs: Record<string, string> = {
  'docs.banner.title': 'Sovrium v0.2.0 — Active Development',
  'docs.banner.body':
    'This project is under active development. APIs, configuration format, and features may change between versions.',
  'docs.sidebar.toggle': 'Menu',
  'docs.toc.heading': 'On this page',
  'docs.sidebar.section.getStarted': 'Get Started',
  'docs.sidebar.section.appSchema': 'App Schema',
  'docs.sidebar.section.references': 'References',
  'docs.sidebar.jsonSchema': 'JSON Schema',
  'docs.sidebar.llmReference': 'LLM Reference',
  'docs.sidebar.roadmap': 'Roadmap',
  'docs.sidebar.contributing': 'Contributing',
  'docs.sidebar.license': 'License',
  'docs.sidebar.introduction': 'Introduction',
  'docs.sidebar.introduction.href': '/en/docs',
  'docs.sidebar.installation': 'Installation',
  'docs.sidebar.installation.href': '/en/docs/installation',
  'docs.sidebar.quickStart': 'Quick Start',
  'docs.sidebar.quickStart.href': '/en/docs/quick-start',
  'docs.sidebar.overview': 'Overview',
  'docs.sidebar.overview.href': '/en/docs/overview',
  'docs.sidebar.tables': 'Tables & Fields',
  'docs.sidebar.tables.href': '/en/docs/tables',
  'docs.sidebar.theme': 'Theme',
  'docs.sidebar.theme.href': '/en/docs/theme',
  'docs.sidebar.pages': 'Pages & Components',
  'docs.sidebar.pages.href': '/en/docs/pages',
  'docs.sidebar.auth': 'Authentication',
  'docs.sidebar.auth.href': '/en/docs/auth',
  'docs.sidebar.languages': 'Languages',
  'docs.sidebar.languages.href': '/en/docs/languages',
  'docs.sidebar.analytics': 'Analytics',
  'docs.sidebar.analytics.href': '/en/docs/analytics',
  'docs.sidebar.apiReference': 'API Reference',
  'docs.sidebar.apiReference.href': '/en/docs/api-reference',
  'docs.introduction.meta.title': 'Introduction - Sovrium Docs',
  'docs.introduction.meta.description':
    'Learn what Sovrium is, why it exists, and how it lets you build complete applications from a single configuration file.',
  'docs.installation.meta.title': 'Installation - Sovrium Docs',
  'docs.installation.meta.description':
    'Install Sovrium via Bun and create your first configuration file in YAML or JSON.',
  'docs.quickStart.meta.title': 'Quick Start - Sovrium Docs',
  'docs.quickStart.meta.description':
    'Build your first Sovrium app in minutes using YAML or TypeScript. Install, configure, and start the server.',
  'docs.overview.meta.title': 'Schema Overview - Sovrium Docs',
  'docs.overview.meta.description':
    'Complete reference for the 10 root properties of the Sovrium app schema. Define data models, authentication, pages, themes, and analytics.',
  'docs.tables.meta.title': 'Tables & Fields - Sovrium Docs',
  'docs.tables.meta.description':
    'Define data models with 41 field types, relationships, and RBAC permissions in the Sovrium schema.',
  'docs.theme.meta.title': 'Theme - Sovrium Docs',
  'docs.theme.meta.description':
    'Customize colors, fonts, spacing, shadows, animations, and breakpoints in the Sovrium theme system.',
  'docs.pages.meta.title': 'Pages & Components - Sovrium Docs',
  'docs.pages.meta.description':
    'Build server-rendered pages with 62 component types, SEO metadata, and i18n support.',
  'docs.auth.meta.title': 'Authentication - Sovrium Docs',
  'docs.auth.meta.description':
    'Configure authentication strategies, roles, two-factor auth, and email templates.',
  'docs.languages.meta.title': 'Languages - Sovrium Docs',
  'docs.languages.meta.description':
    'Add multi-language support with the $t: translation syntax and locale configuration.',
  'docs.analytics.meta.title': 'Analytics - Sovrium Docs',
  'docs.analytics.meta.description':
    'Enable privacy-friendly, cookie-free analytics with configurable retention and session options.',
  'docs.apiReference.meta.title': 'API Reference - Sovrium Docs',
  'docs.apiReference.meta.description':
    'Complete REST API reference for Sovrium. Browse 55+ endpoints for tables, records, views, activity, analytics, and authentication.',
  'docs.apiReference.title': 'API Reference',
  'docs.apiReference.description':
    'Sovrium exposes a complete REST API for managing tables, records, views, activity logs, analytics, and authentication. All endpoints accept and return JSON.',
  'docs.apiReference.earlyPreview.title': 'Early Preview',
  'docs.apiReference.earlyPreview.body':
    'The API surface is evolving. Endpoints may change before v1.0.',
  'docs.apiReference.earlyPreview.badge': 'Early Preview — API may change before v1.0',
  'docs.apiReference.backToDocs': 'Back to Docs',
  'docs.apiReference.cta.title': 'Interactive API Explorer',
  'docs.apiReference.cta.description':
    'Browse and test every endpoint interactively with the Scalar API client. Includes request builder, response viewer, and code generation.',
  'docs.apiReference.cta.button': 'Open API Explorer',
  'docs.apiReference.cta.href': '/en/docs/scalar',
  'docs.apiReference.baseUrl.title': 'Base URL',
  'docs.apiReference.baseUrl.description':
    'All endpoints are relative to your Sovrium instance base URL.',
  'docs.apiReference.health.title': 'Health',
  'docs.apiReference.health.description': 'Server health check endpoint.',
  'docs.apiReference.health.get': 'Check server status',
  'docs.apiReference.tables.title': 'Tables',
  'docs.apiReference.tables.description':
    'Read table definitions, including field schemas and permission rules.',
  'docs.apiReference.tables.list': 'List all tables',
  'docs.apiReference.tables.get': 'Get table by ID',
  'docs.apiReference.tables.permissions': 'Get table permissions',
  'docs.apiReference.records.title': 'Records',
  'docs.apiReference.records.description':
    'Full CRUD, batch operations, soft-delete lifecycle, revision history, and record comments.',
  'docs.apiReference.records.crud.title': 'CRUD',
  'docs.apiReference.records.list': 'List records',
  'docs.apiReference.records.create': 'Create a record',
  'docs.apiReference.records.get': 'Get record by ID',
  'docs.apiReference.records.update': 'Update a record',
  'docs.apiReference.records.delete': 'Soft-delete a record',
  'docs.apiReference.records.batch.title': 'Batch Operations',
  'docs.apiReference.records.batchCreate': 'Create multiple records',
  'docs.apiReference.records.batchUpdate': 'Update multiple records',
  'docs.apiReference.records.batchDelete': 'Soft-delete multiple records',
  'docs.apiReference.records.upsert': 'Create or update a record',
  'docs.apiReference.records.lifecycle.title': 'Trash & History',
  'docs.apiReference.records.trash': 'List trashed records',
  'docs.apiReference.records.restore': 'Restore a deleted record',
  'docs.apiReference.records.batchRestore': 'Restore multiple records',
  'docs.apiReference.records.history': 'Get record revision history',
  'docs.apiReference.records.comments.title': 'Comments',
  'docs.apiReference.records.commentsList': 'List comments on a record',
  'docs.apiReference.records.commentsCreate': 'Add a comment',
  'docs.apiReference.records.commentsGet': 'Get comment by ID',
  'docs.apiReference.records.commentsUpdate': 'Update a comment',
  'docs.apiReference.records.commentsDelete': 'Delete a comment',
  'docs.apiReference.views.title': 'Views',
  'docs.apiReference.views.description':
    'Pre-configured views that filter, sort, and group records from a table.',
  'docs.apiReference.views.list': 'List views for a table',
  'docs.apiReference.views.get': 'Get view by ID',
  'docs.apiReference.views.records': 'Get records through a view',
  'docs.apiReference.activity.title': 'Activity',
  'docs.apiReference.activity.description': 'Audit log of data changes across all tables.',
  'docs.apiReference.activity.list': 'List activity entries',
  'docs.apiReference.activity.get': 'Get activity detail',
  'docs.apiReference.analyticsEndpoints.title': 'Analytics',
  'docs.apiReference.analyticsEndpoints.description':
    'Privacy-friendly, cookie-free usage analytics.',
  'docs.apiReference.analyticsEndpoints.collect': 'Collect a page view event',
  'docs.apiReference.analyticsEndpoints.overview': 'Get analytics overview',
  'docs.apiReference.analyticsEndpoints.pages': 'Get top pages',
  'docs.apiReference.analyticsEndpoints.referrers': 'Get top referrers',
  'docs.apiReference.analyticsEndpoints.devices': 'Get device breakdown',
  'docs.apiReference.analyticsEndpoints.campaigns': 'Get campaign stats',
  'docs.apiReference.auth.title': 'Authentication',
  'docs.apiReference.auth.description':
    'Powered by Better Auth with 28+ endpoints for sign-in, sign-up, sessions, OAuth, 2FA, and admin user management.',
  'docs.apiReference.auth.summary':
    'Authentication is handled by Better Auth and includes email/password sign-in, social OAuth providers, session management, password reset, email verification, two-factor authentication, and admin endpoints. See the Auth configuration docs or explore all endpoints in the interactive API explorer.',
  'docs.apiReference.auth.configLink': 'Auth Configuration →',
  'docs.apiReference.auth.scalarLink': 'View all auth endpoints in Explorer ↗',
  'docs.apiReference.features.title': 'Cross-Cutting Features',
  'docs.apiReference.features.description': 'Capabilities that apply across all API endpoints.',
  'docs.apiReference.openapi.title': 'OpenAPI Schema',
  'docs.apiReference.openapi.description':
    'Download the OpenAPI 3.1 specification for use with any API client or code generator.',
  'docs.apiReference.openapi.download': 'Download app.openapi.json',
  'docs.scalar.meta.title': 'API Explorer - Sovrium Docs',
  'docs.scalar.meta.description':
    'Interactive REST API explorer for Sovrium. Browse, test, and generate code for 55+ endpoints.',
  'docs.scalar.loading': 'Loading API Explorer...',
  'docs.jsonSchema.meta.title': 'JSON Schema - Sovrium Docs',
  'docs.jsonSchema.meta.description':
    'Explore the Sovrium app configuration JSON Schema. Browse interactively, integrate with your editor, and validate config files programmatically.',
  'docs.jsonSchema.title': 'JSON Schema',
  'docs.jsonSchema.description':
    'The Sovrium app schema defines the complete structure of your application configuration. Published as a standard JSON Schema, it enables editor autocomplete, real-time validation, and programmatic config verification.',
  'docs.jsonSchema.cta.title': 'Interactive Schema Explorer',
  'docs.jsonSchema.cta.description':
    'Browse the full schema visually with the JSON Schema Viewer. Expand properties, view types, and explore nested structures.',
  'docs.jsonSchema.cta.button': 'Open Schema Explorer',
  'docs.jsonSchema.explorer.title': 'Schema Explorer',
  'docs.jsonSchema.explorer.description':
    'Browse the Sovrium app schema interactively. Expand properties to explore types, constraints, and nested structures.',
  'docs.jsonSchema.explorer.openFull': 'Open in new tab',
  'docs.jsonSchema.explorer.rootTitle': 'Root Properties',
  'docs.jsonSchema.explorer.expandHint': 'Click to explore the full schema interactively →',
  'docs.jsonSchema.urls.title': 'Schema URLs',
  'docs.jsonSchema.urls.description':
    'Reference the Sovrium JSON Schema by URL in your editor, CI pipeline, or validation scripts.',
  'docs.jsonSchema.urls.versioned.title': 'Versioned (recommended)',
  'docs.jsonSchema.urls.versioned.description':
    'Pin to a specific version for production stability. The schema URL includes the exact package version.',
  'docs.jsonSchema.urls.latest.title': 'Latest',
  'docs.jsonSchema.urls.latest.description':
    'Always points to the most recent version. Convenient for development, but may introduce breaking changes.',
  'docs.jsonSchema.urls.download.versioned': 'Download versioned schema',
  'docs.jsonSchema.urls.download.latest': 'Download latest schema',
  'docs.jsonSchema.editor.title': 'Editor Integration',
  'docs.jsonSchema.editor.description':
    'Add the JSON Schema to your editor for autocomplete, inline documentation, and real-time validation as you write your Sovrium config.',
  'docs.jsonSchema.editor.vscode.description':
    'VS Code supports JSON Schema natively for both JSON and YAML files with the YAML extension.',
  'docs.jsonSchema.editor.vscode.inline': 'Option 1: Add $schema directly to your config file',
  'docs.jsonSchema.editor.vscode.settings': 'Option 2: Configure in VS Code settings.json',
  'docs.jsonSchema.editor.jetbrains.description':
    'IntelliJ IDEA, WebStorm, and other JetBrains IDEs support JSON Schema mapping natively.',
  'docs.jsonSchema.editor.jetbrains.steps':
    'Go to Settings > Languages & Frameworks > Schemas and DTDs > JSON Schema Mappings. Click + to add a new mapping, paste the schema URL below, and set the file pattern to match your config file (e.g., app.yaml or app.json).',
  'docs.jsonSchema.versioning.title': 'Versioning',
  'docs.jsonSchema.versioning.description':
    'The JSON Schema follows semantic versioning aligned with the Sovrium package.',
  'docs.jsonSchema.versioning.semver':
    'Each Sovrium release publishes a matching JSON Schema version. Breaking schema changes only occur in major version bumps.',
  'docs.jsonSchema.versioning.latest':
    'The /schemas/latest/ URL is an alias that always redirects to the most recent version. Use it for development convenience.',
  'docs.jsonSchema.versioning.pin':
    'For production, pin to a specific version URL to avoid unexpected validation changes when Sovrium updates.',
  'docs.jsonSchema.validation.title': 'Programmatic Validation',
  'docs.jsonSchema.validation.description':
    'Validate your Sovrium configuration files against the JSON Schema in CI pipelines, pre-commit hooks, or custom scripts.',
  'docs.jsonSchema.validation.intro':
    'Use any JSON Schema validator library to verify your config. The example below uses Ajv, one of the most popular JSON Schema validators for JavaScript/TypeScript.',
  'docs.jsonSchema.validation.tip.title': 'CI Integration',
  'docs.jsonSchema.validation.tip.body':
    'Add schema validation to your CI pipeline to catch configuration errors before deployment. The schema URL can be fetched at build time or bundled with your project.',
  'docs.sidebar.jsonSchema.href': '/en/docs/json-schema',
  'docs.introduction.header.title': 'Introduction',
  'docs.introduction.header.description':
    'Sovrium is a source-available, self-hosted platform that turns a single configuration file into a complete web application.',
  'docs.introduction.what.title': 'What is Sovrium?',
  'docs.introduction.what.description':
    'Sovrium is a configuration-driven application platform. You describe your application in a YAML or JSON file — data models, authentication, pages, themes, analytics — and Sovrium turns it into a running, full-stack web application.',
  'docs.introduction.what.detail':
    'No boilerplate code, no framework setup, no build pipeline. Just one file that declares what your app should be.',
  'docs.introduction.why.title': 'Why Sovrium?',
  'docs.introduction.why.description':
    'Most business applications share the same building blocks: data tables, user authentication, server-rendered pages, and a design system. Sovrium provides all of these out of the box, configured through a single schema.',
  'docs.introduction.why.point1.title': 'No vendor lock-in',
  'docs.introduction.why.point1.description':
    'Self-hosted on your infrastructure. Your data stays yours.',
  'docs.introduction.why.point2.title': 'Configuration over code',
  'docs.introduction.why.point2.description':
    'Declare what you need instead of writing boilerplate. 41 field types, 62 component types, built-in auth.',
  'docs.introduction.why.point3.title': 'Progressive complexity',
  'docs.introduction.why.point3.description':
    'Start with just a name. Add tables, theme, pages, auth, and analytics as your needs grow.',
  'docs.introduction.why.point4.title': 'Source-available',
  'docs.introduction.why.point4.description':
    'Business Source License 1.1. Free for internal use. Becomes Apache 2.0 in 2029.',
  'docs.introduction.how.title': 'How it works',
  'docs.introduction.how.description':
    'Write a configuration file, run one command, and get a working application:',
  'docs.introduction.how.step1': 'Define your schema in YAML or JSON',
  'docs.introduction.how.step2': 'Run sovrium start app.yaml',
  'docs.introduction.how.step3': 'Get a full-stack app with data tables, auth, pages, and more',
  'docs.introduction.next.title': 'Next steps',
  'docs.introduction.next.description':
    'Ready to try it? Install Sovrium and build your first app in under 5 minutes.',
  'docs.introduction.help.title': 'Getting help',
  'docs.introduction.help.description':
    'Found a bug, have a question, or want to request a feature?',
  'docs.introduction.help.body':
    'Sovrium is open source. If you run into any issues or have ideas for improvement, the best way to reach us is through GitHub Issues.',
  'docs.introduction.help.link': 'Open an issue on GitHub →',
  'docs.installation.header.title': 'Installation',
  'docs.installation.header.description':
    'Install Sovrium globally or as a project dependency using Bun.',
  'docs.installation.prerequisites.title': 'Prerequisites',
  'docs.installation.prerequisites.descriptionBefore': 'Sovrium requires ',
  'docs.installation.prerequisites.descriptionLink': 'Bun 1.3+',
  'docs.installation.prerequisites.descriptionAfter':
    '. A PostgreSQL 15+ database is optional, needed only for data persistence (tables, auth).',
  'docs.installation.global.title': 'Global installation',
  'docs.installation.global.description':
    'Install Sovrium globally to use the sovrium command from anywhere:',
  'docs.installation.project.title': 'Project dependency',
  'docs.installation.project.description': 'Or add Sovrium as a dependency in an existing project:',
  'docs.installation.verify.title': 'Verify installation',
  'docs.installation.verify.description':
    'Run the help command to check that Sovrium is installed correctly:',
  'docs.installation.config.title': 'Create a config file',
  'docs.installation.config.description':
    'Sovrium reads a YAML or JSON configuration file. Create an app.yaml with the simplest valid config:',
  'docs.installation.config.tip.title': 'YAML or JSON',
  'docs.installation.config.tip.body':
    'Sovrium supports both .yaml/.yml and .json files. YAML is recommended for readability.',
  'docs.installation.database.title': 'Database setup',
  'docs.installation.database.description':
    'If your app uses tables or auth, set the DATABASE_URL environment variable:',
  'docs.installation.database.tip.title': 'No database needed for static sites',
  'docs.installation.database.tip.body':
    'If you only use pages and theme (no tables or auth), Sovrium works without a database. Run sovrium build app.yaml to generate a static site.',
  'docs.quickStart.header.title': 'Quick Start',
  'docs.quickStart.header.description':
    'Build your first Sovrium app in minutes. From zero to a running application. Choose the approach that fits your workflow.',
  'docs.quickStart.chooseApproach': 'Choose your approach',
  'docs.quickStart.chooseApproach.description':
    'Sovrium supports two configuration formats. YAML is great for simplicity; TypeScript gives you full type safety and autocompletion.',
  'docs.quickStart.yaml.title': 'Option A — YAML + CLI',
  'docs.quickStart.yaml.description':
    'The simplest path. Install the Sovrium CLI, write a YAML config, and start the server:',
  'docs.quickStart.yaml.step1.title': 'Install the CLI',
  'docs.quickStart.yaml.step1.description':
    'Install Sovrium globally with Bun to get the sovrium command.',
  'docs.quickStart.yaml.step2.title': 'Create a config file',
  'docs.quickStart.yaml.step2.description':
    'Create an app.yaml with the simplest valid configuration — just a name.',
  'docs.quickStart.yaml.step3.title': 'Add data tables',
  'docs.quickStart.yaml.step3.description':
    'Define your data models with typed fields, options, and validation.',
  'docs.quickStart.yaml.step4.title': 'Start the server',
  'docs.quickStart.yaml.step4.description':
    'Run the dev server and visit http://localhost:3000 to see your app.',
  'docs.quickStart.ts.title': 'Option B — TypeScript + Bun',
  'docs.quickStart.ts.description':
    'The power-user path. Create a Bun project, add Sovrium as a dependency, and write type-safe code:',
  'docs.quickStart.ts.step1.title': 'Initialize a project',
  'docs.quickStart.ts.step1.description':
    'Scaffold a new Bun project with bun init and move into the directory.',
  'docs.quickStart.ts.step2.title': 'Add Sovrium',
  'docs.quickStart.ts.step2.description': 'Install Sovrium as a project dependency.',
  'docs.quickStart.ts.step3.title': 'Write your app',
  'docs.quickStart.ts.step3.description':
    'Open index.ts and import the start function with a minimal configuration.',
  'docs.quickStart.ts.step4.title': 'Add data tables',
  'docs.quickStart.ts.step4.description':
    'Extend the configuration with typed fields, options, and validation — with full autocompletion.',
  'docs.quickStart.ts.step5.title': 'Run your app',
  'docs.quickStart.ts.step5.description':
    'Execute index.ts with Bun. Visit http://localhost:3000 to see your app.',
  'docs.quickStart.ts.tip.title': 'Why TypeScript?',
  'docs.quickStart.ts.tip.body':
    'TypeScript gives you autocompletion for every property, compile-time validation of field types, and the full power of Bun as your runtime. Ideal for developers who prefer code over config files.',
  'docs.quickStart.tip.title': 'Add more as you go',
  'docs.quickStart.tip.body':
    'Start small with just tables. Then progressively add theme, auth, pages, and analytics as your needs grow.',
  'docs.quickStart.whatsNext.title': "What's next?",
  'docs.quickStart.whatsNext.description':
    'Now that your app is running, explore the schema reference to add more capabilities:',
  'docs.quickStart.whatsNext.overview': 'Schema Overview — All 10 root properties explained',
  'docs.quickStart.whatsNext.tables': 'Tables & Fields — 41 field types, permissions, indexes',
  'docs.quickStart.whatsNext.theme': 'Theme — Colors, fonts, spacing, and design tokens',
  'docs.quickStart.whatsNext.pages': 'Pages — 62 component types for server-rendered pages',
  'docs.overview.header.title': 'Schema Overview',
  'docs.overview.header.description':
    'The complete reference for the Sovrium app schema. A declarative configuration object with 10 root properties.',
  'docs.overview.title': 'Schema Structure',
  'docs.overview.description':
    'A Sovrium app is a declarative configuration object with 10 root properties. Only name is required — everything else is optional, enabling progressive complexity from a minimal app identifier to a full-stack application.',
  'docs.overview.footnote':
    'Configuration files can be written in YAML or JSON. Run sovrium start app.yaml to launch a dev server, or sovrium build app.yaml to generate a static site.',
  'docs.overview.tip.title': 'Progressive complexity',
  'docs.overview.tip.body':
    'Only name is required. Add tables, theme, pages, auth, and other sections as your app grows.',
  'docs.rootProps.title': 'Root Properties',
  'docs.rootProps.description': 'The app schema has 10 root properties. Only name is required.',
  'docs.rootProps.name.description':
    'App identifier following npm naming conventions. Lowercase, max 214 chars, supports scoped format (@scope/name).',
  'docs.rootProps.version.description':
    'Semantic Versioning 2.0.0 string (e.g., 1.0.0, 2.0.0-beta.1). Supports pre-release and build metadata.',
  'docs.rootProps.description.description':
    'Single-line app description. No line breaks allowed. Unicode and emojis supported.',
  'docs.rootProps.tables.description':
    'Data models with 41 field types, relationships, indexes, permissions, and views.',
  'docs.rootProps.theme.description':
    'Design tokens: colors, fonts, spacing, shadows, animations, breakpoints, and border radius.',
  'docs.rootProps.pages.description':
    'Server-rendered pages with 62 component types, SEO metadata, and i18n support.',
  'docs.rootProps.auth.description':
    'Authentication strategies (email/password, magic link, OAuth), roles, and two-factor authentication.',
  'docs.rootProps.languages.description':
    'Multi-language support with $t: translation syntax, browser detection, and language persistence.',
  'docs.rootProps.components.description':
    'Reusable UI templates with $ref referencing and $variable substitution.',
  'docs.rootProps.analytics.description':
    'Privacy-friendly, cookie-free, first-party analytics. Set to true for defaults or configure with options.',
  'docs.overview.details.title': 'Property Details',
  'docs.overview.details.description':
    'Detailed rules and constraints for the three scalar root properties: name, version, and description.',
  'docs.overview.details.name.description':
    'The app name follows npm naming conventions. It must be lowercase, URL-safe, and unique within your deployment.',
  'docs.overview.details.name.pattern':
    'Regex: ^(?:@[a-z0-9-~][a-z0-9-._~]*/)?[a-z0-9-~][a-z0-9-._~]*$. Lowercase letters, digits, hyphens, dots.',
  'docs.overview.details.name.maxLength':
    '214 characters maximum (including @scope/ prefix if scoped).',
  'docs.overview.details.name.scoped':
    'Supports npm-style scoped packages: @scope/name (e.g., @acme/dashboard).',
  'docs.overview.details.version.description':
    'Follows Semantic Versioning 2.0.0 (semver.org). Format: MAJOR.MINOR.PATCH with optional pre-release and build metadata.',
  'docs.overview.details.description.body':
    'A single-line text describing the application. Displayed in the admin UI and metadata.',
  'docs.overview.details.description.format': 'Single line only. No line breaks (\\n) allowed.',
  'docs.overview.details.description.maxLength': '2000 characters maximum.',
  'docs.overview.details.description.unicode':
    'Full Unicode support including emojis and special characters.',
  'docs.overview.formats.title': 'Configuration Formats',
  'docs.overview.formats.description':
    'Sovrium accepts both YAML and JSON configuration files. YAML is recommended for readability; JSON works for programmatic generation.',
  'docs.overview.formats.tip.title': 'YAML vs JSON',
  'docs.overview.formats.tip.body':
    'YAML supports comments, is more readable, and requires less syntax. Use JSON when generating configs programmatically or when your tooling prefers it.',
  'docs.tables.title': 'Tables & Fields',
  'docs.tables.description':
    'Tables define your data models. Each table has an id, name, fields, and optional permissions, indexes, and views.',
  'docs.tables.structure.title': 'Table Structure',
  'docs.tables.structure.description':
    'Each table has an id, name, fields array, and optional permissions and indexes.',
  'docs.tables.tableProps.title': 'Table Properties',
  'docs.tables.tableProps.description':
    'Each table in the tables array accepts the following properties.',
  'docs.tables.tableProps.id': 'Unique integer identifier for the table.',
  'docs.tables.tableProps.name':
    'Table name. Lowercase letters, digits, and underscores (^[a-z][a-z0-9_]*). Max 63 characters.',
  'docs.tables.tableProps.fields': 'Array of field definitions. At least one field is required.',
  'docs.tables.tableProps.primaryKey':
    'Column(s) used as primary key. Defaults to an auto-generated id column.',
  'docs.tables.tableProps.indexes':
    'Array of index definitions for query performance and uniqueness enforcement.',
  'docs.tables.tableProps.uniqueConstraints': 'Array of multi-column uniqueness constraints.',
  'docs.tables.tableProps.foreignKeys':
    'Explicit foreign key definitions for cross-table referential integrity.',
  'docs.tables.tableProps.constraints':
    'Array of check constraints with SQL expressions for data validation.',
  'docs.tables.tableProps.views':
    'Saved views with pre-configured filters, sorting, and visible fields.',
  'docs.tables.tableProps.permissions':
    'RBAC permissions object controlling create, read, update, delete, and comment operations.',
  'docs.tables.tableProps.allowDestructive':
    'Boolean. When true, allows destructive schema migrations (column drops, type changes). Defaults to false.',
  'docs.tables.baseFields.title': 'Base Field Properties',
  'docs.tables.baseFields.description':
    'Every field has these base properties: id (unique integer), name (identifier), type (one of 41 types), and optional required, unique, indexed, description, and defaultValue.',
  'docs.tables.baseFields.id': 'Unique integer identifier for the field within the table.',
  'docs.tables.baseFields.name':
    'Field name used as the column identifier. Lowercase, digits, underscores (^[a-z][a-z0-9_]*).',
  'docs.tables.baseFields.type':
    'One of the 41 available field types (e.g., single-line-text, integer, checkbox).',
  'docs.tables.baseFields.required':
    'Boolean. When true, the field must have a value for every record.',
  'docs.tables.baseFields.unique': 'Boolean. When true, no two records can have the same value.',
  'docs.tables.baseFields.indexed':
    'Boolean. When true, creates a database index on this field for faster queries.',
  'docs.tables.baseFields.descriptionProp':
    'Optional human-readable description shown as a tooltip in the UI.',
  'docs.tables.baseFields.defaultValue':
    'Default value assigned when a record is created without specifying this field.',
  'docs.tables.fieldTypes.title': '41 Field Types',
  'docs.tables.fieldTypes.description': 'Field types are organized into 9 categories:',
  'docs.tables.fieldTypes.text': 'Text Fields',
  'docs.tables.fieldTypes.text.description':
    'Fields for textual content — from short labels to rich formatted text and structured strings.',
  'docs.tables.fieldTypes.text.maxLength':
    'Maximum character count for rich-text fields. Validates on input.',
  'docs.tables.fieldTypes.text.fullTextSearch':
    'Boolean. Enables full-text search indexing for rich-text and long-text fields.',
  'docs.tables.fieldTypes.text.barcodeFormat':
    'Barcode encoding format: CODE128, EAN13, QR, UPC, etc.',
  'docs.tables.fieldTypes.numeric': 'Numeric Fields',
  'docs.tables.fieldTypes.numeric.description':
    'Fields for numbers, currencies, percentages, ratings, and progress indicators.',
  'docs.tables.fieldTypes.numeric.minMax':
    'Minimum and maximum allowed values. Applies to integer, decimal, currency, and percentage.',
  'docs.tables.fieldTypes.numeric.precision':
    'Number of decimal places for decimal and currency fields (0–20).',
  'docs.tables.fieldTypes.numeric.currency':
    'ISO 4217 currency code (e.g., USD, EUR, GBP). Required for currency fields.',
  'docs.tables.fieldTypes.numeric.symbolPosition':
    'Currency symbol placement: "before" ($100) or "after" (100€). Default: before.',
  'docs.tables.fieldTypes.numeric.thousandsSep':
    'Boolean. Enable thousands grouping separator (1,000 vs 1000). Default: true.',
  'docs.tables.fieldTypes.numeric.negativeFormat':
    'Display format for negatives: "minus" (-100), "parentheses" ((100)), or "red" (∞100 in red).',
  'docs.tables.fieldTypes.numeric.ratingMax': 'Maximum rating value (1–10). Default: 5.',
  'docs.tables.fieldTypes.numeric.ratingStyle':
    'Visual style for rating display: "stars", "hearts", "thumbs", or "numeric".',
  'docs.tables.fieldTypes.numeric.progressColor':
    'Color of the progress bar. Accepts any CSS color value.',
  'docs.tables.fieldTypes.selection': 'Selection Fields',
  'docs.tables.fieldTypes.selection.description':
    'Fields for choosing from predefined options — single or multi-select with colored labels.',
  'docs.tables.fieldTypes.selection.options':
    'Array of option objects defining the available choices.',
  'docs.tables.fieldTypes.selection.optionLabel': 'Display text for the option. Required.',
  'docs.tables.fieldTypes.selection.optionColor':
    'Badge color for the option: gray, red, orange, yellow, green, blue, purple, pink.',
  'docs.tables.fieldTypes.selection.maxSelections':
    'Maximum number of choices for multi-select fields. No limit by default.',
  'docs.tables.fieldTypes.dateTime': 'Date & Time Fields',
  'docs.tables.fieldTypes.dateTime.description':
    'Fields for dates, times, timestamps, and duration values.',
  'docs.tables.fieldTypes.dateTime.dateFormat':
    'Display format for dates: "YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY", etc.',
  'docs.tables.fieldTypes.dateTime.timeFormat': 'Time display format: "12h" or "24h".',
  'docs.tables.fieldTypes.dateTime.includeTime':
    'Boolean. When true, date fields also capture time.',
  'docs.tables.fieldTypes.dateTime.timezone':
    'IANA timezone identifier (e.g., "America/New_York"). Defaults to UTC.',
  'docs.tables.fieldTypes.dateTime.durationFormat':
    'Display format for duration fields: "hours:minutes", "minutes", "seconds", etc.',
  'docs.tables.fieldTypes.user': 'User & Audit Fields',
  'docs.tables.fieldTypes.user.description':
    'Auto-populated fields tracking who created/updated/deleted a record and when. Requires auth to be configured.',
  'docs.tables.fieldTypes.media': 'Attachment Fields',
  'docs.tables.fieldTypes.media.allowedFileTypes':
    'Array of allowed MIME types (e.g., ["image/png", "application/pdf"]). Empty = all types.',
  'docs.tables.fieldTypes.media.maxFileSize':
    'Maximum file size in bytes. Example: 10485760 for 10 MB.',
  'docs.tables.fieldTypes.media.maxFiles':
    'Maximum number of files for multiple-attachments fields.',
  'docs.tables.fieldTypes.media.storage':
    'Storage backend: "local" (default) or "s3" for cloud storage.',
  'docs.tables.fieldTypes.media.generateThumbnail':
    'Boolean. When true, automatically generates image thumbnails on upload.',
  'docs.tables.fieldTypes.media.storeMetadata':
    'Boolean. When true, stores file metadata (dimensions, EXIF, duration).',
  'docs.tables.fieldTypes.computed': 'Computed Fields',
  'docs.tables.fieldTypes.computed.formula':
    'Expression string referencing other fields. Example: "price * quantity".',
  'docs.tables.fieldTypes.computed.resultType':
    'Expected output type of the formula: "string", "integer", "decimal", "boolean", or "date".',
  'docs.tables.fieldTypes.computed.format':
    'Display format for the computed result (e.g., "0,0.00" for numbers).',
  'docs.tables.fieldTypes.computed.prefix':
    'Text prepended to autonumber values (e.g., "TKT-", "INV-").',
  'docs.tables.fieldTypes.computed.startFrom':
    'Starting value for autonumber sequence. Default: 1.',
  'docs.tables.fieldTypes.computed.digits':
    'Minimum digits for autonumber, zero-padded. Example: 5 → "00001".',
  'docs.tables.fieldTypes.advanced': 'Advanced Fields',
  'docs.tables.fieldTypes.advanced.jsonSchema':
    'JSON Schema object for validating json field contents.',
  'docs.tables.fieldTypes.advanced.itemType':
    'Data type for array elements: "string", "number", "boolean", or "object".',
  'docs.tables.fieldTypes.advanced.maxItems': 'Maximum number of elements in an array field.',
  'docs.tables.fieldTypes.advanced.buttonLabel':
    'Text displayed on the button. Supports $t: translation syntax.',
  'docs.tables.fieldTypes.advanced.buttonAction':
    'Action triggered on click: "openUrl", "runScript", or "callWebhook".',
  'docs.tables.fieldTypes.advanced.buttonUrl':
    'URL to open or webhook to call. Supports {field_name} template variables.',
  'docs.tables.fieldTypes.relational': 'Relational Fields',
  'docs.tables.relational.title': 'Relational Fields',
  'docs.tables.relational.description':
    'Four field types enable cross-table relationships: relationship, lookup, rollup, and count. These form a chain — relationship defines the link, then lookup, rollup, and count derive data from it.',
  'docs.tables.relational.relationship.description':
    'Creates a foreign-key link to another table. Foundation for all relational features.',
  'docs.tables.relational.relationship.relatedTable':
    'Name of the target table to link to. Must match an existing table name.',
  'docs.tables.relational.relationship.relationType':
    'Cardinality: "one-to-one", "many-to-one", "one-to-many", or "many-to-many".',
  'docs.tables.relational.relationship.foreignKey':
    'Custom foreign key column name. Auto-generated if omitted.',
  'docs.tables.relational.relationship.displayField':
    'Field from the related table shown in the UI (e.g., "name" instead of "id").',
  'docs.tables.relational.relationship.onDelete':
    'Referential action on delete: "cascade", "set-null", "restrict", or "no-action".',
  'docs.tables.relational.relationship.onUpdate':
    'Referential action on update: "cascade", "set-null", "restrict", or "no-action".',
  'docs.tables.relational.relationship.reciprocalField':
    'Field name for the inverse relationship on the related table.',
  'docs.tables.relational.relationship.allowMultiple':
    'Boolean. For many-to-many, allows selecting multiple related records.',
  'docs.tables.relational.lookup.description':
    'Reads a field value from a related record via an existing relationship. Read-only and auto-updated.',
  'docs.tables.relational.lookup.relationshipField':
    'Name of the relationship field to traverse (must exist in the same table).',
  'docs.tables.relational.lookup.relatedField':
    'Field name on the related table whose value to display.',
  'docs.tables.relational.lookup.filters':
    'Optional filter expression to narrow which related records are included.',
  'docs.tables.relational.rollup.description':
    'Aggregates values from multiple related records (sum, avg, count, min, max, etc.).',
  'docs.tables.relational.rollup.relationshipField':
    'Name of the relationship field connecting to the related table.',
  'docs.tables.relational.rollup.relatedField': 'Field on the related table to aggregate.',
  'docs.tables.relational.rollup.aggregation':
    'Aggregation function: "sum", "avg", "min", "max", "count", "concat", or "array".',
  'docs.tables.relational.rollup.format':
    'Display format for the aggregated result (e.g., "$0,0.00" for currency sums).',
  'docs.tables.relational.rollup.filters':
    'Optional filter to include only matching related records in the aggregation.',
  'docs.tables.relational.count.description':
    'Counts the number of related records. A simplified rollup with aggregation always set to count.',
  'docs.tables.relational.count.relationshipField':
    'Name of the relationship field to count records from.',
  'docs.tables.relational.count.conditions':
    'Optional filter expression to count only matching records.',
  'docs.tables.relational.tip.title': 'Relational chain',
  'docs.tables.relational.tip.body':
    'Start with a relationship field to create the link, then use lookup, rollup, or count to derive data without duplication. Example: orders → customer (relationship) → customer_email (lookup).',
  'docs.tables.permissions.title': 'Permissions (RBAC)',
  'docs.tables.permissions.description':
    'Table permissions use role-based access control. Each permission accepts: "all" (public), "authenticated" (logged-in users), or an array of role names.',
  'docs.tables.permissions.props.create': 'Who can create new records. Default: "authenticated".',
  'docs.tables.permissions.props.read': 'Who can view records. Default: "all".',
  'docs.tables.permissions.props.update':
    'Who can modify existing records. Default: "authenticated".',
  'docs.tables.permissions.props.delete': 'Who can remove records. Default: "authenticated".',
  'docs.tables.permissions.props.comment':
    'Who can add comments to records. Default: "authenticated".',
  'docs.tables.permissions.props.fields':
    'Object mapping field names to per-field read/update permissions. Enables fine-grained access control.',
  'docs.tables.permissions.props.inherit':
    'Boolean. When true, inherits permissions from a parent table or global defaults.',
  'docs.tables.permissions.props.override':
    'Boolean. When true, these permissions override any inherited ones.',
  'docs.tables.permissions.tip.title': 'Three access levels',
  'docs.tables.permissions.tip.body':
    '"all" for public access, "authenticated" for any logged-in user, or an array of role names like [admin, member] for specific roles.',
  'docs.tables.permissions.security.title': 'Security best practice',
  'docs.tables.permissions.security.body':
    'Unauthorized access returns 404 (not 403) to prevent attackers from discovering which resources exist. This follows OWASP recommendations for resource enumeration prevention.',
  'docs.tables.indexes.title': 'Indexes & Constraints',
  'docs.tables.indexes.description':
    'Optimize queries with indexes and enforce data integrity with uniqueness and check constraints.',
  'docs.tables.indexes.indexesTitle': 'Indexes',
  'docs.tables.indexes.indexName':
    'Optional human-readable name for the index (e.g., "idx_email").',
  'docs.tables.indexes.indexFields':
    'Array of field names to index. Composite indexes list multiple fields.',
  'docs.tables.indexes.indexUnique':
    'Boolean. When true, enforces uniqueness across the indexed columns.',
  'docs.tables.indexes.indexWhere':
    'Partial index condition as SQL expression. Only rows matching the condition are indexed.',
  'docs.tables.indexes.uniqueTitle': 'Unique Constraints',
  'docs.tables.indexes.uniqueName': 'Name for the unique constraint (e.g., "uq_email_org").',
  'docs.tables.indexes.uniqueFields':
    'Array of field names that must be unique together (composite uniqueness).',
  'docs.tables.indexes.constraintsTitle': 'Check Constraints',
  'docs.tables.indexes.constraintName':
    'Name for the check constraint (e.g., "chk_positive_price").',
  'docs.tables.indexes.constraintCheck':
    'SQL boolean expression that must be true for every row (e.g., "price > 0").',
  'docs.theme.title': 'Theme',
  'docs.theme.description':
    'The theme property defines your design system with 7 optional token categories. All tokens generate CSS custom properties and Tailwind CSS utility classes.',
  'docs.theme.colors.title': 'colors',
  'docs.theme.colors.description':
    'Named color tokens as key-value pairs. Each becomes a CSS variable (--color-{name}) and Tailwind class (bg-{name}, text-{name}).',
  'docs.theme.colors.props.name':
    'Token name (e.g., primary, accent). Used to generate CSS variable --color-{name} and Tailwind utilities.',
  'docs.theme.colors.props.output':
    'Generates --color-{name} CSS variable plus bg-{name}, text-{name}, border-{name} utility classes.',
  'docs.theme.fonts.title': 'fonts',
  'docs.theme.fonts.description':
    'Typography configuration for heading, body, and mono fonts. Supports family, fallback, weights, size, line height, and Google Fonts URL.',
  'docs.theme.fonts.props.family':
    'Font family name (e.g., "Inter", "Roboto"). Maps to CSS font-family.',
  'docs.theme.fonts.props.fallback':
    'Fallback font stack used when primary font is unavailable (e.g., "system-ui, sans-serif").',
  'docs.theme.fonts.props.weights':
    'Array of numeric font weights to load (e.g., [400, 600, 700]). Optimizes download size.',
  'docs.theme.fonts.props.size':
    'Base font size as CSS value (e.g., "16px", "1rem"). Applied to body text.',
  'docs.theme.fonts.props.lineHeight':
    'Line height multiplier or CSS value (e.g., "1.5", "1.2"). Controls vertical spacing between lines.',
  'docs.theme.fonts.props.googleFontsUrl':
    'Full Google Fonts URL to auto-load custom fonts. Injected as <link> in <head>.',
  'docs.theme.spacing.title': 'spacing',
  'docs.theme.spacing.description':
    'Named spacing tokens as Tailwind class strings. Define container widths, section padding, gaps, and component spacing.',
  'docs.theme.shadows.title': 'shadows',
  'docs.theme.shadows.description':
    'Named shadow tokens as CSS box-shadow values. Each becomes a shadow-{name} utility.',
  'docs.theme.animations.title': 'animations',
  'docs.theme.animations.description':
    'Custom @keyframes animations with enabled flag, duration, timing function, iteration count, and keyframe definitions.',
  'docs.theme.breakpoints.title': 'breakpoints',
  'docs.theme.breakpoints.description':
    'Custom responsive breakpoints as pixel values. Each becomes a min-width media query for responsive utilities.',
  'docs.theme.borderRadius.title': 'borderRadius',
  'docs.theme.borderRadius.description':
    'Named border radius tokens as CSS values. Each becomes a rounded-{name} utility class.',
  'docs.theme.fonts.tip.title': 'Google Fonts',
  'docs.theme.fonts.tip.body':
    'Add a googleFontsUrl to automatically load custom fonts. The URL is injected as a <link> tag in the page head.',
  'docs.theme.advanced.title': 'Shadows, Animations & More',
  'docs.theme.advanced.description':
    'Additional design tokens for shadows, animations, responsive breakpoints, and border radius.',
  'docs.theme.fullExample.title': 'Full Example',
  'docs.theme.fullExample.description':
    'A complete theme configuration combining colors, fonts, spacing, and shadows.',
  'docs.theme.screenshot.alt': 'Sovrium app with custom theme applied',
  'docs.theme.screenshot.caption':
    'A CRM application rendered with custom theme colors, fonts, and spacing.',
  'docs.pages.title': 'Pages & Components',
  'docs.pages.description':
    'Pages are server-rendered using a component tree system. Each page has a name, path, metadata (SEO, favicons), and sections containing nested components.',
  'docs.pages.structure.title': 'Page Structure',
  'docs.pages.structure.description':
    'Each page has a name, path, SEO metadata, and sections with nested components.',
  'docs.pages.pageProps.title': 'Page Properties',
  'docs.pages.pageProps.description': 'Each page in the pages array accepts these properties.',
  'docs.pages.pageProps.name': 'Unique page identifier. Used for internal routing and referencing.',
  'docs.pages.pageProps.path':
    'URL path for the page (e.g., "/", "/about", "/blog/:slug"). Supports dynamic segments.',
  'docs.pages.pageProps.meta':
    'SEO metadata object: title, description, OpenGraph, Twitter cards, structured data, favicon.',
  'docs.pages.pageProps.sections':
    'Array of component nodes forming the page body. Each section is a component tree.',
  'docs.pages.pageProps.scripts': 'Array of script URLs or inline code to inject into the page.',
  'docs.pages.metaSeo.title': 'Meta & SEO',
  'docs.pages.metaSeo.description':
    'Comprehensive metadata for search engines, social sharing, and browser display.',
  'docs.pages.meta.props.title':
    'Page title shown in browser tab and search results. Supports $t: translations.',
  'docs.pages.meta.props.description':
    'Page description for search engines. Recommended 150–160 characters.',
  'docs.pages.meta.props.openGraph':
    'OpenGraph metadata for social sharing: title, description, image, type, url.',
  'docs.pages.meta.props.twitter':
    'Twitter Card metadata: card (summary, summary_large_image), site, creator.',
  'docs.pages.meta.props.structuredData':
    'JSON-LD structured data for rich search results: type, name, description, and custom properties.',
  'docs.pages.meta.props.favicon': 'Path to the favicon file (e.g., "/favicon.ico", "/icon.svg").',
  'docs.pages.meta.props.canonical':
    'Canonical URL to prevent duplicate content issues in search engines.',
  'docs.pages.componentModel.title': 'Component Model',
  'docs.pages.componentModel.description':
    'Every component in the tree is a node with a type, optional content, props, and children. This recursive model enables arbitrary UI composition.',
  'docs.pages.componentModel.type':
    'One of the 62 component types (e.g., "section", "h1", "card", "button").',
  'docs.pages.componentModel.content':
    'Text content of the component. Supports $t: translation syntax for i18n.',
  'docs.pages.componentModel.props':
    'HTML attributes and CSS classes. className is the most common for Tailwind styling.',
  'docs.pages.componentModel.children':
    'Array of nested component nodes, forming a recursive tree structure.',
  'docs.pages.componentModel.interactions':
    'Animation and behavior config: hover effects, click actions, scroll triggers, entrance animations.',
  'docs.pages.componentModel.ref':
    'Reference to a reusable component template defined in the components array.',
  'docs.pages.componentModel.vars':
    'Variables to substitute in the referenced template (e.g., $title, $description).',
  'docs.pages.componentModel.tip.title': 'Recursive composition',
  'docs.pages.componentModel.tip.body':
    'Any component can contain children, which can themselves contain children. This lets you build complex layouts from simple, nested building blocks.',
  'docs.pages.componentTypes.title': '62 Component Types',
  'docs.pages.componentTypes.description':
    'Components form a recursive tree — each can have type, content, props, and children.',
  'docs.pages.componentTypes.layout': 'Layout',
  'docs.pages.componentTypes.typography': 'Typography & Text',
  'docs.pages.componentTypes.media': 'Media & Images',
  'docs.pages.componentTypes.interactive': 'Interactive & Navigation',
  'docs.pages.componentTypes.display': 'Cards & Display',
  'docs.pages.componentTypes.feedback': 'Feedback & Utilities',
  'docs.pages.componentTypes.layout.description':
    'Structural elements that control page layout, sections, and content flow.',
  'docs.pages.componentTypes.typography.description':
    'Text elements from headings to paragraphs, inline text, and code blocks.',
  'docs.pages.componentTypes.media.description':
    'Visual and multimedia elements for images, avatars, video, audio, and embeds.',
  'docs.pages.componentTypes.interactive.description':
    'Elements for user interaction including buttons, links, accordions, and navigation.',
  'docs.pages.interactions.title': 'Interactions',
  'docs.pages.interactions.description':
    'Components support 4 interaction types via the interactions property: hover (transform, opacity, scale, shadow changes), click (navigation, scroll, toggle), scroll (parallax, fade-in, sticky behavior), and entrance (animation on first view with delay and duration).',
  'docs.pages.interactions.hover.title': 'Hover',
  'docs.pages.interactions.hover.description':
    'Transform, opacity, scale, and shadow changes on mouse hover.',
  'docs.pages.interactions.click.title': 'Click',
  'docs.pages.interactions.click.description':
    'Navigate to a URL, scroll to an anchor, or toggle visibility.',
  'docs.pages.interactions.scroll.title': 'Scroll',
  'docs.pages.interactions.scroll.description':
    'Parallax effects, fade-in on scroll, and sticky positioning.',
  'docs.pages.interactions.entrance.title': 'Entrance',
  'docs.pages.interactions.entrance.description':
    'Animate when element first enters the viewport with configurable delay and duration.',
  'docs.pages.templates.title': 'Component Templates',
  'docs.pages.templates.description':
    'Define reusable components with $ref references and $variable substitution for DRY markup.',
  'docs.pages.screenshot.hero.alt': 'Hero section rendered by Sovrium',
  'docs.pages.screenshot.hero.caption':
    'A hero section with heading, description, and call-to-action buttons — all from YAML config.',
  'docs.pages.screenshot.features.alt': 'Features grid rendered by Sovrium',
  'docs.pages.screenshot.features.caption':
    'A 3-column features grid using section, grid, and card components with emoji icons.',
  'docs.auth.title': 'Authentication',
  'docs.auth.description':
    'Built-in authentication powered by Better Auth. Configure strategies, roles, two-factor authentication, and email templates.',
  'docs.auth.basic.title': 'Basic Setup',
  'docs.auth.basic.description':
    'Start with the simplest auth config — email and password with a default role.',
  'docs.auth.strategies.title': 'Strategies',
  'docs.auth.strategies.description':
    'Choose one or more authentication strategies to offer your users.',
  'docs.auth.strategies.emailPassword':
    'Traditional email + password. Supports signup, login, password reset, and email verification.',
  'docs.auth.strategies.magicLink':
    'Passwordless authentication via a one-time link sent by email. No password to remember.',
  'docs.auth.strategies.oauth':
    'Social login via external providers. Supports: google, github, apple, microsoft, facebook, twitter, discord, spotify, twitch, gitlab, bitbucket, linkedin, dropbox.',
  'docs.auth.oauth.title': 'Adding OAuth',
  'docs.auth.oauth.description':
    'Add social login providers alongside email-password. Multiple strategies can coexist.',
  'docs.auth.oauth.warning.title': 'Environment variables required',
  'docs.auth.oauth.warning.body':
    'OAuth providers require AUTH_SECRET and provider-specific CLIENT_ID / CLIENT_SECRET environment variables.',
  'docs.auth.roles.title': 'Roles & Permissions',
  'docs.auth.roles.description':
    'Three built-in roles: admin, member, viewer. Define custom roles with name + description. Set defaultRole for new users. First user automatically becomes admin.',
  'docs.auth.roles.admin': 'Full access to all features, user management, and settings.',
  'docs.auth.roles.member': 'Can create, read, and update records. Cannot manage users.',
  'docs.auth.roles.viewer': 'Read-only access. Cannot create or modify records.',
  'docs.auth.twoFactor.title': 'Two-Factor Auth',
  'docs.auth.twoFactor.description':
    'Optional TOTP-based 2FA. Enable with twoFactor: true in the auth config. Users can set up authenticator apps.',
  'docs.auth.emails.title': 'Email Templates',
  'docs.auth.emails.description':
    'Customizable emails for verification, password reset, and magic link. Supports $name, $url, $email variable substitution in subject and body.',
  'docs.auth.emails.var.name': "The recipient's display name.",
  'docs.auth.emails.var.url': 'The action URL (verification link, reset link, or magic link).',
  'docs.auth.emails.var.email': "The recipient's email address.",
  'docs.auth.emails.var.org': 'The organization name (for invitation emails).',
  'docs.auth.emails.var.inviter': 'The name of the person who sent the invitation.',
  'docs.languages.title': 'Languages',
  'docs.languages.description':
    'Multi-language support with translation keys, browser language detection, and automatic URL-based language routing (/en/..., /fr/...). Reference translations in pages using the $t: prefix.',
  'docs.languages.defining.title': 'Defining Languages',
  'docs.languages.defining.description':
    'Set a default language and list supported languages with code, locale, label, and text direction.',
  'docs.languages.props.default':
    'ISO 639-1 code for the default language (e.g., "en"). Used when no language is detected.',
  'docs.languages.props.supported':
    'Array of language entry objects. Each defines a supported language.',
  'docs.languages.entryProps.title': 'Language Entry Properties',
  'docs.languages.entryProps.description':
    'Each entry in the supported array describes a language with these properties.',
  'docs.languages.entryProps.code':
    'ISO 639-1 language code (e.g., "en", "fr", "ar"). Used in URL routing (/en/, /fr/).',
  'docs.languages.entryProps.locale':
    'Full locale identifier (e.g., "en-US", "fr-FR", "ar-SA"). Used for number/date formatting.',
  'docs.languages.entryProps.label':
    'Human-readable language name shown in language switchers (e.g., "English", "Français").',
  'docs.languages.entryProps.direction':
    'Text direction: "ltr" (left-to-right) for most languages, "rtl" (right-to-left) for Arabic, Hebrew, etc.',
  'docs.languages.rtl.title': 'RTL Support',
  'docs.languages.rtl.description':
    'Set direction: rtl for right-to-left languages like Arabic or Hebrew. Sovrium automatically mirrors the page layout, aligns text to the right, and applies the dir="rtl" attribute to the HTML root.',
  'docs.languages.translations.title': 'Translation Keys',
  'docs.languages.translations.description':
    'Define key-value pairs for each language. Keys use dot notation for organization.',
  'docs.languages.usage.title': 'Using Translations',
  'docs.languages.usage.description':
    'Reference translations in any content or prop value with the $t: prefix.',
  'docs.languages.syntax.title': '$t: Translation Syntax',
  'docs.languages.syntax.description':
    'Use $t:key.path in any page content or prop value to reference a translation. Example: $t:hero.title resolves to "Welcome" in English and "Bienvenue" in French.',
  'docs.languages.adding.title': 'Adding a New Language',
  'docs.languages.adding.description':
    'Follow these steps to add a new language to your application.',
  'docs.languages.adding.step1.title': 'Add language entry',
  'docs.languages.adding.step1.description':
    'Add a new item to the supported array with code, locale, label, and direction.',
  'docs.languages.adding.step2.title': 'Add translations',
  'docs.languages.adding.step2.description':
    'Create a new translations section for the language code with all required keys.',
  'docs.languages.adding.step3.title': 'Test the language',
  'docs.languages.adding.step3.description':
    'Visit /[lang-code]/ in your browser to verify the new language renders correctly.',
  'docs.languages.screenshot.en.alt': 'English version of the app',
  'docs.languages.screenshot.en.caption': 'English — /en/',
  'docs.languages.screenshot.fr.alt': 'French version of the app',
  'docs.languages.screenshot.fr.caption': 'Français — /fr/',
  'docs.analytics.title': 'Analytics',
  'docs.analytics.description':
    'Built-in, privacy-friendly analytics with no cookies, no external services, and full GDPR compliance. All data stays on your server.',
  'docs.analytics.howItWorks.title': 'How It Works',
  'docs.analytics.howItWorks.description':
    'Sovrium analytics follows a simple three-step pipeline — no external services required.',
  'docs.analytics.howItWorks.collect.title': 'Collect',
  'docs.analytics.howItWorks.collect.description':
    'A lightweight script records page views, sessions, referrers, and device info via /api/analytics/collect.',
  'docs.analytics.howItWorks.store.title': 'Store',
  'docs.analytics.howItWorks.store.description':
    'All data is stored locally in your database. No cookies, no fingerprinting, no external calls.',
  'docs.analytics.howItWorks.query.title': 'Query',
  'docs.analytics.howItWorks.query.description':
    'Access your analytics via the admin dashboard or API. Data stays on your server.',
  'docs.analytics.quickEnable.title': 'Quick Enable',
  'docs.analytics.quickEnable.description':
    'Set analytics to true for sensible defaults — no configuration needed.',
  'docs.analytics.booleanVsObject.title': 'Boolean vs Object',
  'docs.analytics.booleanVsObject.description':
    'analytics: true enables defaults (90-day retention, DNT respected, 30-min sessions). Use an object to override specific settings while keeping defaults for the rest.',
  'docs.analytics.advanced.title': 'Advanced Configuration',
  'docs.analytics.advanced.description':
    'Fine-tune analytics behavior with retention, privacy, and session options.',
  'docs.analytics.props.retentionDays': 'Number of days to retain analytics data. Default: 90.',
  'docs.analytics.props.respectDoNotTrack':
    'When true, respects the browser Do Not Track setting. Default: true.',
  'docs.analytics.props.excludePaths':
    'Array of URL paths to exclude from tracking (e.g., /admin, /api).',
  'docs.analytics.props.sessionTimeout':
    'Session timeout in minutes. A new session starts after this idle period. Default: 30.',
  'docs.analytics.privacy.title': 'Privacy-first analytics',
  'docs.analytics.privacy.body':
    'Sovrium analytics are cookie-free, GDPR-compliant by default. All data stays on your server — no third-party services involved.',
  'docs.analytics.details':
    'When enabled, Sovrium injects a lightweight tracking script that records page views, sessions, referrers, and device information. Analytics data is collected at /api/analytics/collect and stored locally.',
  // ── CLI Reference ──────────────────────────────────────────────────────
  'docs.sidebar.cli': 'CLI Reference',
  'docs.sidebar.cli.href': '/en/docs/cli',
  'docs.cli.meta.title': 'CLI Reference - Sovrium Docs',
  'docs.cli.meta.description':
    'Complete reference for the Sovrium command-line interface. Commands, flags, environment variables, and usage examples.',
  'docs.cli.header.title': 'CLI Reference',
  'docs.cli.header.description':
    'The Sovrium CLI provides two commands: start a development server and build a static site. Configuration is loaded from a file or environment variable.',
  'docs.cli.usage.title': 'Usage',
  'docs.cli.usage.description':
    'The CLI accepts a command followed by an optional config file path and flags.',
  'docs.cli.commands.title': 'Commands',
  'docs.cli.commands.description':
    'Sovrium has two commands. If no command is specified, start is used by default.',
  'docs.cli.commands.start.title': 'sovrium start',
  'docs.cli.commands.start.description':
    'Start a development server that serves your application. This is the default command \u2014 running sovrium app.yaml is equivalent to sovrium start app.yaml.',
  'docs.cli.commands.build.title': 'sovrium build',
  'docs.cli.commands.build.description':
    'Generate a static site from your configuration. Produces HTML, CSS, and assets ready for deployment to any static hosting provider.',
  'docs.cli.commands.help.title': 'sovrium --help',
  'docs.cli.commands.help.description':
    'Display the help message with a summary of commands, options, and examples.',
  'docs.cli.flags.title': 'Flags',
  'docs.cli.flags.description': 'Flags can be placed anywhere in the command.',
  'docs.cli.flags.watch.name': '--watch, -w',
  'docs.cli.flags.watch.description':
    'Watch the config file for changes and hot-reload the server automatically. Only available with the start command.',
  'docs.cli.flags.help.name': '--help, -h',
  'docs.cli.flags.help.description': 'Show the help message and exit.',
  'docs.cli.configFormats.title': 'Configuration Sources',
  'docs.cli.configFormats.description':
    'Sovrium can load configuration from a file path or from the APP_SCHEMA environment variable. A file path takes precedence when both are provided.',
  'docs.cli.configFormats.file.title': 'File path',
  'docs.cli.configFormats.file.description':
    'Pass a path to a JSON or YAML configuration file as the second argument.',
  'docs.cli.configFormats.env.title': 'Environment variable',
  'docs.cli.configFormats.env.description':
    'Set the APP_SCHEMA variable to provide configuration without a file. Supports inline JSON, inline YAML, or a remote URL.',
  'docs.cli.examples.title': 'Examples',
  'docs.cli.examples.description': 'Common CLI usage patterns.',
  'docs.cli.watchMode.title': 'Watch Mode',
  'docs.cli.watchMode.description':
    'Watch mode monitors your config file and automatically reloads the server when changes are detected.',
  'docs.cli.watchMode.tip.title': 'Error recovery',
  'docs.cli.watchMode.tip.body':
    'If the updated config file is invalid, the reload fails gracefully and the previous server continues running. Fix the config and save to retry.',
  'docs.cli.exitCodes.title': 'Exit Codes',
  'docs.cli.exitCodes.description': 'The CLI uses standard exit codes.',
  'docs.cli.exitCodes.zero': '0 \u2014 Success',
  'docs.cli.exitCodes.one': '1 \u2014 Error (invalid config, missing file, unknown command)',

  // ── Environment Variables ──────────────────────────────────────────────
  'docs.sidebar.envVars': 'Environment Variables',
  'docs.sidebar.envVars.href': '/en/docs/env-vars',
  'docs.envVars.meta.title': 'Environment Variables - Sovrium Docs',
  'docs.envVars.meta.description':
    'Complete reference for all environment variables used by Sovrium. Covers application, server, database, authentication, email, build, and debug settings.',
  'docs.envVars.header.title': 'Environment Variables',
  'docs.envVars.header.description':
    'Sovrium reads configuration from environment variables at startup. Set them in a .env file or your server environment. All variables are optional unless noted otherwise.',
  'docs.envVars.app.title': 'Application',
  'docs.envVars.app.description':
    'Core application configuration. APP_SCHEMA is the primary way to provide a schema without a file argument.',
  'docs.envVars.app.appSchema':
    'App schema as inline JSON, inline YAML, or a remote URL. Alternative to passing a file path on the command line.',
  'docs.envVars.server.title': 'Server',
  'docs.envVars.server.description': 'Server networking options for the start command.',
  'docs.envVars.server.port':
    'Server port number (0\u201365535). 0 selects an available port. Default: 3000.',
  'docs.envVars.server.hostname': 'Server hostname. Default: localhost.',
  'docs.envVars.server.baseUrl':
    'Base URL of the application (e.g., https://myapp.com). Used for authentication callback URLs and email links.',
  'docs.envVars.server.nodeEnv':
    'Runtime environment. Set to "production" for secure cookies, CSRF checks, and strict SMTP validation. Default: development.',
  'docs.envVars.database.title': 'Database',
  'docs.envVars.database.description':
    'PostgreSQL connection settings. Required when using tables or authentication.',
  'docs.envVars.database.databaseUrl':
    'PostgreSQL connection string (e.g., postgresql://user:password@localhost:5432/dbname). Required when the schema defines tables or auth.',
  'docs.envVars.auth.title': 'Authentication',
  'docs.envVars.auth.description':
    'Variables for Better Auth integration. Required when the schema defines an auth section.',
  'docs.envVars.auth.secret':
    'Secret key for signing tokens and encrypting sessions. Must be a strong random string (32+ characters recommended).',
  'docs.envVars.auth.admin.title': 'Default Admin User',
  'docs.envVars.auth.admin.description':
    'Optional variables to create a default admin user on first startup. All three must be set for the admin user to be created.',
  'docs.envVars.auth.admin.email': 'Email address for the default admin user.',
  'docs.envVars.auth.admin.password':
    'Password for the default admin user. Must be at least 8 characters.',
  'docs.envVars.auth.admin.name':
    'Display name for the default admin user. Optional, defaults to "Admin".',
  'docs.envVars.auth.oauth.title': 'OAuth Providers',
  'docs.envVars.auth.oauth.description':
    'Credentials for each OAuth provider configured in the auth schema. Replace {PROVIDER} with the uppercase provider name.',
  'docs.envVars.auth.oauth.clientId': "OAuth client ID from the provider's developer console.",
  'docs.envVars.auth.oauth.clientSecret':
    "OAuth client secret from the provider's developer console. Keep this confidential.",
  'docs.envVars.auth.oauth.tip.title': 'Supported providers',
  'docs.envVars.auth.oauth.tip.body':
    'Sovrium supports Google, GitHub, Microsoft, Slack, GitLab, and Facebook. For example, set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for Google OAuth.',
  'docs.envVars.smtp.title': 'Email (SMTP)',
  'docs.envVars.smtp.description':
    'SMTP configuration for sending authentication emails (verification, password reset, magic link). In development, falls back to Mailpit on localhost:1025 if SMTP_HOST is not set.',
  'docs.envVars.smtp.host': 'SMTP server hostname (e.g., smtp.gmail.com). Required in production.',
  'docs.envVars.smtp.port': 'SMTP server port. Default: 587.',
  'docs.envVars.smtp.secure':
    'Use SSL/TLS connection. Default: false for port 587, true for port 465.',
  'docs.envVars.smtp.user': 'SMTP authentication username.',
  'docs.envVars.smtp.pass': 'SMTP authentication password or app-specific password.',
  'docs.envVars.smtp.from':
    'Default sender email address (e.g., noreply@yourdomain.com). Default: noreply@sovrium.com.',
  'docs.envVars.smtp.fromName': 'Default sender display name. Default: Sovrium.',
  'docs.envVars.smtp.tip.title': 'Local development',
  'docs.envVars.smtp.tip.body':
    'When SMTP_HOST is not configured in development mode, Sovrium automatically falls back to Mailpit (localhost:1025). Install Mailpit to view sent emails in a local web UI.',
  'docs.envVars.build.title': 'Build',
  'docs.envVars.build.description': 'Options for the build command that generates a static site.',
  'docs.envVars.build.outputDir': 'Output directory. Default: ./dist.',
  'docs.envVars.build.baseUrl':
    'Base URL for sitemap generation and canonical links (e.g., https://example.com).',
  'docs.envVars.build.basePath': 'Path prefix for subdirectory deployments (e.g., /my-app).',
  'docs.envVars.build.deployment': 'Deployment target: github-pages or generic.',
  'docs.envVars.build.languages': 'Comma-separated language codes to build (e.g., en,fr,de).',
  'docs.envVars.build.defaultLanguage': 'Default language code (e.g., en).',
  'docs.envVars.build.generateSitemap': 'Generate sitemap.xml. Default: false.',
  'docs.envVars.build.generateRobots': 'Generate robots.txt. Default: false.',
  'docs.envVars.build.hydration': 'Enable client-side hydration. Default: false.',
  'docs.envVars.build.generateManifest': 'Generate manifest.json for PWA. Default: false.',
  'docs.envVars.build.bundleOptimization': 'Optimization strategy: split (code splitting) or none.',
  'docs.envVars.build.publicDir': 'Directory containing static assets to copy into the output.',
  'docs.envVars.debug.title': 'Debug',
  'docs.envVars.debug.description':
    'Diagnostic and testing variables. Not needed in normal operation.',
  'docs.envVars.debug.logLevel':
    'Set to "debug" for verbose logging (request logs, CSS compilation diagnostics). Default: follows NODE_ENV.',
  'docs.envVars.debug.effectDevtools':
    'Set to "1" to enable Effect DevTools integration for runtime inspection.',
  'docs.envVars.debug.rateLimitWindow':
    'Rate limit window in seconds. Used in tests for faster execution. Default: 60.',

  // ── TypeScript Integration ─────────────────────────────────────────────
  'docs.sidebar.typescript': 'TypeScript API',
  'docs.sidebar.typescript.href': '/en/docs/typescript',
  'docs.typescript.meta.title': 'TypeScript API - Sovrium Docs',
  'docs.typescript.meta.description':
    'Use Sovrium programmatically with TypeScript. Import the start and build functions with full type safety.',
  'docs.typescript.header.title': 'TypeScript API',
  'docs.typescript.header.description':
    'Use Sovrium as a library in your TypeScript project. Import the start and build functions for full programmatic control with typed configuration.',
  'docs.typescript.why.title': 'Why TypeScript?',
  'docs.typescript.why.description':
    'Using Sovrium programmatically gives you advantages beyond the CLI.',
  'docs.typescript.why.point1.title': 'Type safety',
  'docs.typescript.why.point1.description':
    'The App type provides autocomplete for every property and field type. Catch errors at compile time, not runtime.',
  'docs.typescript.why.point2.title': 'Programmatic control',
  'docs.typescript.why.point2.description':
    'Generate configuration dynamically, compose schemas, and integrate Sovrium into existing applications.',
  'docs.typescript.why.point3.title': 'IDE integration',
  'docs.typescript.why.point3.description':
    'Full IntelliSense in VS Code and JetBrains \u2014 hover docs, go-to-definition, and type errors.',
  'docs.typescript.start.title': 'start(app, options?)',
  'docs.typescript.start.description':
    'Start a development server from a typed configuration object. Returns a server instance with a stop() method.',
  'docs.typescript.start.options.title': 'StartOptions',
  'docs.typescript.start.options.description': 'Optional second argument to configure the server.',
  'docs.typescript.start.options.port':
    'Port number (0\u201365535). 0 selects an available port. Default: 3000.',
  'docs.typescript.start.options.hostname': 'Server hostname. Default: localhost.',
  'docs.typescript.start.options.publicDir':
    'Static file directory. Files are served at their relative path.',
  'docs.typescript.build.title': 'build(app, options?)',
  'docs.typescript.build.description': 'Generate a static site from a typed configuration object.',
  'docs.typescript.build.options.title': 'GenerateStaticOptions',
  'docs.typescript.build.options.description': 'Optional second argument to control static output.',
  'docs.typescript.build.options.outputDir': 'Output directory. Default: ./static.',
  'docs.typescript.build.options.baseUrl': 'Base URL for sitemap and canonical links.',
  'docs.typescript.build.options.basePath': 'Path prefix for subdirectory deployments.',
  'docs.typescript.build.options.deployment': 'Target platform: github-pages or generic.',
  'docs.typescript.build.options.languages': 'Array of language codes for generation.',
  'docs.typescript.build.options.defaultLanguage': 'Default language code.',
  'docs.typescript.build.options.generateSitemap': 'Generate sitemap.xml. Default: false.',
  'docs.typescript.build.options.generateRobotsTxt': 'Generate robots.txt. Default: false.',
  'docs.typescript.build.options.hydration': 'Enable client-side hydration. Default: false.',
  'docs.typescript.build.options.generateManifest':
    'Generate manifest.json for PWA. Default: false.',
  'docs.typescript.build.options.bundleOptimization': 'Splitting strategy: split or none.',
  'docs.typescript.build.options.publicDir': 'Static asset directory to copy into output.',
  'docs.typescript.watchMode.title': 'Watch Mode',
  'docs.typescript.watchMode.description':
    "In development, use Bun's built-in watch mode to automatically restart your script when files change.",
  'docs.typescript.watchMode.tip.title': 'Reload vs watch',
  'docs.typescript.watchMode.tip.body':
    "bun --watch restarts the entire process when any imported file changes. For config-only changes, the CLI's --watch flag is more efficient.",
  'docs.typescript.appType.title': 'App Type',
  'docs.typescript.appType.description':
    'The App type defines the complete structure of a Sovrium configuration. Import it from sovrium for type annotations.',
  'docs.typescript.appType.props.name':
    'Application name. Lowercase, npm-compatible (e.g. my-app, @org/app).',
  'docs.typescript.appType.props.version': 'SemVer version string (e.g. 1.0.0).',
  'docs.typescript.appType.props.description': 'Single-line application description.',
  'docs.typescript.appType.props.tables':
    'Array of data table definitions with fields, indexes, and constraints.',
  'docs.typescript.appType.props.theme':
    'Design tokens: colors, fonts, spacing, animations, breakpoints, shadows, borderRadius.',
  'docs.typescript.appType.props.pages':
    'Array of page configurations with metadata, sections, and scripts.',
  'docs.typescript.appType.props.auth':
    'Authentication config: strategies, roles, plugins (admin, organization).',
  'docs.typescript.appType.props.languages':
    'Multi-language config: supported languages, default language, translations.',
  'docs.typescript.appType.props.components':
    'Array of reusable component templates with variable substitution.',
  'docs.typescript.appType.props.analytics':
    'Built-in privacy-friendly analytics. Set to true for defaults or pass an object.',
  'docs.typescript.appType.tip.title': 'Incremental complexity',
  'docs.typescript.appType.tip.body':
    'Only name is required. Add tables, theme, pages, auth, languages, components, and analytics as you need them.',

  // ── Type Reference ────────────────────────────────────────────────────
  'docs.typescript.typeRef.title': 'Type Reference',
  'docs.typescript.typeRef.description':
    'All TypeScript types exported from the sovrium package. Import them with import type { ... } from "sovrium".',

  'docs.typescript.typeRef.simpleServer.description':
    'Returned by start(). A lightweight interface to the running server.',
  'docs.typescript.typeRef.simpleServer.url':
    'Server URL including protocol and port (e.g. "http://localhost:3000").',
  'docs.typescript.typeRef.simpleServer.stop':
    'Gracefully stop the server. Returns a Promise that resolves when shutdown is complete.',

  'docs.typescript.typeRef.appEncoded.description':
    'The raw input shape accepted by start() and build() before Effect Schema validation. Structurally identical to App but without schema transformations applied.',
  'docs.typescript.typeRef.appEncoded.tip.title': 'App vs AppEncoded',
  'docs.typescript.typeRef.appEncoded.tip.body':
    'Use App when annotating validated configuration objects. Use AppEncoded when typing raw input that will be passed to start() or build() for validation.',

  'docs.typescript.typeRef.page.description':
    'A validated page configuration. Pages define routes, metadata, layout sections, and optional scripts.',
  'docs.typescript.typeRef.page.id': 'Optional unique identifier for internal references.',
  'docs.typescript.typeRef.page.name':
    'Human-readable page name used for identification (e.g. "home", "about").',
  'docs.typescript.typeRef.page.path':
    'URL path where the page is served (e.g. "/", "/about", "/products/pricing").',
  'docs.typescript.typeRef.page.meta':
    'SEO metadata: title, description, Open Graph, Twitter Card, structured data, performance hints.',
  'docs.typescript.typeRef.page.sections':
    'Array of content sections. Each section is a direct component or a $ref to a component template.',
  'docs.typescript.typeRef.page.scripts':
    'Client-side scripts: feature flags, external scripts, inline scripts.',
  'docs.typescript.typeRef.page.vars':
    'Page-level variables for $variable substitution in sections.',

  'docs.typescript.typeRef.pageEncoded.description':
    'The raw input shape for a page before Effect Schema validation. Same relationship as AppEncoded to App.',

  'docs.typescript.typeRef.componentTemplate.description':
    'A reusable UI component template with $variable placeholders. Defined in app.components[] and referenced by pages via $ref syntax.',
  'docs.typescript.typeRef.componentTemplate.name':
    'Unique identifier in kebab-case (e.g. "hero-card", "feature-row").',
  'docs.typescript.typeRef.componentTemplate.type':
    'Component type: container, flex, grid, card, text, button, heading, paragraph, etc.',
  'docs.typescript.typeRef.componentTemplate.props':
    'Component properties. Values may contain $variable placeholders.',
  'docs.typescript.typeRef.componentTemplate.children':
    'Nested child components. Children may also contain $variable placeholders.',
  'docs.typescript.typeRef.componentTemplate.content':
    'Text content. May contain $variable placeholders for dynamic substitution.',

  'docs.typescript.typeRef.generateStaticResult.description':
    'Returned by build(). Contains the output directory path and the list of generated files.',
  'docs.typescript.typeRef.generateStaticResult.outputDir':
    'Absolute path to the output directory (e.g. "./static").',
  'docs.typescript.typeRef.generateStaticResult.files':
    'Array of file paths generated during the build (HTML, CSS, assets).',

  // ── Runtime Schemas ───────────────────────────────────────────────────
  'docs.typescript.runtimeSchemas.title': 'Runtime Schemas',
  'docs.typescript.runtimeSchemas.description':
    'Sovrium exports Effect Schema objects for runtime validation. Use these to validate unknown input programmatically.',
  'docs.typescript.runtimeSchemas.appSchema':
    'Effect Schema for the full app configuration. Validates name, tables, theme, pages, auth, etc.',
  'docs.typescript.runtimeSchemas.pageSchema':
    'Effect Schema for a single page configuration. Validates name, path, meta, sections, scripts.',
  'docs.typescript.runtimeSchemas.tip.title': 'When to use runtime schemas',
  'docs.typescript.runtimeSchemas.tip.body':
    'Use AppSchema and PageSchema when you need to validate configuration from external sources (files, APIs, user input). For typed objects in your own code, the App and Page types provide compile-time safety without runtime overhead.',

  'docs.typescript.examples.title': 'Examples',
  'docs.typescript.examples.description': 'Common usage patterns with Sovrium in TypeScript.',
  'docs.typescript.examples.minimal.title': 'Minimal server',
  'docs.typescript.examples.tables.title': 'With data tables',
  'docs.typescript.examples.build.title': 'Static site generation',
  'docs.typescript.examples.dynamic.title': 'Dynamic configuration',
}
