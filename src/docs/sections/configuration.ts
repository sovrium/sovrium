/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import configValidationBody from '@/cli/commands/config-validation.docs.md' with { type: 'file' }
import configurationTypescriptBody from '@/cli/commands/configuration-typescript.docs.md' with { type: 'file' }
import envVarsProjectBody from '@/cli/commands/env-vars-project.docs.md' with { type: 'file' }
import envVarsServicesBody from '@/cli/commands/env-vars-services.docs.md' with { type: 'file' }
import envVarsBody from '@/cli/commands/env-vars.docs.md' with { type: 'file' }
import jsonSchemaEditorsBody from '@/cli/commands/json-schema-editors.docs.md' with { type: 'file' }
import configurationFilesBody from '@/domain/kernel/config-parsing/configuration-files.docs.md' with { type: 'file' }
import jsonSchemaBody from '@/domain/models/app/json-schema.docs.md' with { type: 'file' }
import configurationRefsBody from '@/infrastructure/config/configuration-refs.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

export const configuration = defineSection({
  slug: 'configuration',
  title: 'Configuration',
  order: 1200,
  tab: 'platform',
  articles: [
    defineArticle({
      slug: 'configuration-files',
      title: 'Config Files: YAML and JSON',
      description:
        'Writing the configuration object as a YAML or JSON file — how the format is decided, and the order in which a command looks for it.',
      keywords: [
        'sovrium',
        'app.yaml',
        'app.json',
        'config file',
        'format detection',
        'APP_SCHEMA',
        'APP_SCHEMA_FILE',
      ],
      order: 1200,
      sidebarLabel: 'Config Files',
      body: configurationFilesBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'configuration-typescript',
      title: 'TypeScript Configs',
      description:
        'The same configuration object as a TypeScript module, checked in your editor as you type, with no npm and no install step.',
      keywords: [
        'sovrium',
        'app.ts',
        'sovrium types',
        'AppConfig',
        'satisfies',
        'import type',
        'tsconfig',
      ],
      order: 1204,
      sidebarLabel: 'TypeScript Configs',
      body: configurationTypescriptBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'configuration-refs',
      title: 'Multi-File Configs with $ref',
      description:
        'Splitting a YAML or JSON config across as many files as you like, with no change to the resulting object and no loss of cross-section checking.',
      keywords: [
        'sovrium',
        '$ref',
        'multi-file config',
        'config partials',
        'path resolution',
        'config directory',
      ],
      order: 1208,
      sidebarLabel: 'Multi-File Configs',
      body: configurationRefsBody,
      documents: [],
      stories: ['US-CLI-MULTI-FILE-CONFIG'],
    }),
    defineArticle({
      slug: 'env-vars',
      title: 'Environment Variables: App, Server and Database',
      description:
        'Infrastructure configuration read from the environment — the server it binds, the database URL, and the two secrets that protect an app.',
      keywords: [
        'sovrium',
        'environment variables',
        'PORT',
        'BASE_URL',
        'DATABASE_URL',
        'SOVRIUM_ENCRYPTION_KEY',
        'AUTH_SECRET',
        'TRUSTED_PROXY_HOPS',
      ],
      order: 1210,
      sidebarLabel: 'Env Vars: Core',
      body: envVarsBody,
      documents: [],
      stories: [
        'US-INFRASTRUCTURE-DEFAULT-DATABASE-PROVIDER-001',
        'US-INFRASTRUCTURE-DEFAULT-DATABASE-PROVIDER-002',
        'US-INFRASTRUCTURE-DEFAULT-DATABASE-PROVIDER-003',
        'US-INFRASTRUCTURE-DEFAULT-DATABASE-PROVIDER-004',
      ],
    }),
    defineArticle({
      slug: 'env-vars-project',
      title: 'Environment Variables: Project and Data Directories',
      description:
        'The four path variables a supervising process sets — the project root a config is discovered in and jailed to, the named config file, the EOF stop request, and the data directory runtime artefacts are written under.',
      keywords: [
        'sovrium',
        'environment variables',
        'SOVRIUM_PROJECT_DIR',
        'SOVRIUM_CONFIG_FILE',
        'SOVRIUM_SHUTDOWN_ON_STDIN_CLOSE',
        'SOVRIUM_INSTALL_METHOD',
        'SOVRIUM_DATA_DIR',
        'SOVRIUM_LOCK_DIR',
      ],
      order: 1212,
      sidebarLabel: 'Env Vars: Directories',
      body: envVarsProjectBody,
      documents: [],
      // No `stories:`. Every story this article's content is about is already
      // cited exactly once elsewhere — `[internal ref]` and
      // `[internal ref]` under `cli-api`, `[internal ref]`
      // under `operations` — and the coverage gate treats a second claim on one
      // id as an error, not as better coverage.
      stories: [],
    }),
    defineArticle({
      slug: 'env-vars-services',
      title: 'Environment Variables: Storage, AI, Email and Observability',
      description:
        'The service variables, every one of them off, local or frugal by default — storage, AI providers, SMTP, the MCP server, eco levers and observability export.',
      keywords: [
        'sovrium',
        'STORAGE_PROVIDER',
        'AI_PROVIDER',
        'SMTP_HOST',
        'MCP_ENABLED',
        'ECO_MODE',
        'SENTRY_DSN',
        'OTEL_EXPORTER_OTLP_ENDPOINT',
      ],
      order: 1215,
      sidebarLabel: 'Env Vars: Services',
      body: envVarsServicesBody,
      documents: [],
      stories: [
        'US-INFRASTRUCTURE-OBSERVABILITY-BANNER',
        'US-INFRASTRUCTURE-OBSERVABILITY-DEFAULT-OFF',
        'US-INFRASTRUCTURE-OBSERVABILITY-ERROR-REPORTING',
        'US-INFRASTRUCTURE-OBSERVABILITY-LOG-EXPORT',
        'US-INFRASTRUCTURE-OBSERVABILITY-METRICS',
        'US-INFRASTRUCTURE-OBSERVABILITY-PERFORMANCE',
        'US-INFRASTRUCTURE-OBSERVABILITY-TRACING',
      ],
    }),
    defineArticle({
      slug: 'json-schema',
      title: 'JSON Schema',
      description:
        'The config schema published as a standard JSON Schema document — where it comes from, how to generate it, and which URL to point a pipeline at.',
      keywords: [
        'sovrium',
        'JSON Schema',
        'Draft 2020-12',
        'sovrium schema',
        'schema URL',
        'pinned version',
      ],
      order: 1220,
      sidebarLabel: 'JSON Schema',
      body: jsonSchemaBody,
      documents: [],
      stories: ['US-APP-SCHEMA-JSON-SCHEMA-GENERATION'],
    }),
    defineArticle({
      slug: 'json-schema-editors',
      title: 'Editor Setup',
      description:
        'Wiring the JSON Schema into VS Code or a JetBrains IDE for autocomplete and inline errors — and what that structural check cannot catch.',
      keywords: [
        'sovrium',
        'editor setup',
        'VS Code',
        'JetBrains',
        'yaml-language-server',
        'yaml.schemas',
        'autocomplete',
      ],
      order: 1224,
      sidebarLabel: 'Editor Setup',
      body: jsonSchemaEditorsBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'config-validation',
      title: 'Validating a Config',
      description:
        'The decode that runs without a database, a port or an environment — the four classes of error it reports, and the contract that nothing in a config is silently ignored.',
      keywords: [
        'sovrium validate',
        'validation',
        'unknown property',
        'unknown field type',
        'exit code',
        'validateConfig',
      ],
      order: 1228,
      sidebarLabel: 'Validating a Config',
      body: configValidationBody,
      documents: [],
      stories: ['US-CLI-CONFIG-CONTRACT'],
    }),
  ],
})
