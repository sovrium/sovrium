/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  calloutTip,
  codeBlock,
  docsPage,
  propertyTable,
  sectionHeader,
  subsectionHeader,
} from './shared'

// ─── Code Snippets ──────────────────────────────────────────────────────────

const envFileExample = [
  '# .env',
  '',
  '# Application',
  "APP_SCHEMA='app.yaml'",
  '',
  '# Server',
  'PORT=3000',
  'BASE_URL=http://localhost:3000',
  '',
  '# Database',
  'DATABASE_URL=postgresql://user:password@localhost:5432/dbname',
  '',
  '# Authentication',
  'AUTH_SECRET=your-secret-key-here',
  '',
  '# Default Admin',
  'AUTH_ADMIN_EMAIL=admin@example.com',
  'AUTH_ADMIN_PASSWORD=secure-admin-password',
  '',
  '# OAuth (Google example)',
  'GOOGLE_CLIENT_ID=your-client-id',
  'GOOGLE_CLIENT_SECRET=your-client-secret',
  '',
  '# Email (SMTP)',
  'SMTP_HOST=smtp.gmail.com',
  'SMTP_PORT=587',
  'SMTP_USER=your-email@gmail.com',
  'SMTP_PASS=your-app-password',
].join('\n')

// ─── Page Definition ────────────────────────────────────────────────────────

export const docsEnvVars = docsPage({
  activeId: 'env-vars',
  path: '/docs/env-vars',
  metaTitle: '$t:docs.envVars.meta.title',
  metaDescription: '$t:docs.envVars.meta.description',
  keywords:
    'sovrium, environment variables, configuration, database URL, auth secret, SMTP, server settings',
  toc: [
    { label: '$t:docs.envVars.app.title', anchor: 'application' },
    { label: '$t:docs.envVars.server.title', anchor: 'server' },
    { label: '$t:docs.envVars.database.title', anchor: 'database' },
    {
      label: '$t:docs.envVars.auth.title',
      anchor: 'authentication',
      children: [
        { label: '$t:docs.envVars.auth.admin.title', anchor: 'auth-admin' },
        { label: '$t:docs.envVars.auth.oauth.title', anchor: 'auth-oauth' },
      ],
    },
    { label: '$t:docs.envVars.smtp.title', anchor: 'email-smtp' },
    { label: '$t:docs.envVars.build.title', anchor: 'build' },
    { label: '$t:docs.envVars.debug.title', anchor: 'debug' },
  ],
  content: [
    // ── Header ──────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        {
          type: 'h1',
          content: '$t:docs.envVars.header.title',
          props: { className: 'text-3xl sm:text-4xl font-bold mb-4 text-sovereignty-light' },
        },
        {
          type: 'paragraph',
          content: '$t:docs.envVars.header.description',
          props: {
            className: 'text-base text-sovereignty-gray-300 max-w-3xl leading-relaxed',
          },
        },
      ],
    },

    // ── Example .env file ───────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [codeBlock(envFileExample, 'bash')],
    },

    // ── Application ─────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.envVars.app.title',
          '$t:docs.envVars.app.description',
          'application'
        ),
        propertyTable([{ name: 'APP_SCHEMA', description: '$t:docs.envVars.app.appSchema' }]),
      ],
    },

    // ── Server ──────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.envVars.server.title',
          '$t:docs.envVars.server.description',
          'server'
        ),
        propertyTable([
          { name: 'PORT', description: '$t:docs.envVars.server.port' },
          { name: 'HOSTNAME', description: '$t:docs.envVars.server.hostname' },
          { name: 'BASE_URL', description: '$t:docs.envVars.server.baseUrl' },
          { name: 'NODE_ENV', description: '$t:docs.envVars.server.nodeEnv' },
        ]),
      ],
    },

    // ── Database ────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.envVars.database.title',
          '$t:docs.envVars.database.description',
          'database'
        ),
        propertyTable([
          { name: 'DATABASE_URL', description: '$t:docs.envVars.database.databaseUrl' },
        ]),
      ],
    },

    // ── Authentication ──────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.envVars.auth.title',
          '$t:docs.envVars.auth.description',
          'authentication'
        ),
        propertyTable([{ name: 'AUTH_SECRET', description: '$t:docs.envVars.auth.secret' }]),

        // Default admin user
        subsectionHeader(
          '$t:docs.envVars.auth.admin.title',
          '$t:docs.envVars.auth.admin.description',
          'auth-admin'
        ),
        propertyTable([
          { name: 'AUTH_ADMIN_EMAIL', description: '$t:docs.envVars.auth.admin.email' },
          { name: 'AUTH_ADMIN_PASSWORD', description: '$t:docs.envVars.auth.admin.password' },
          { name: 'AUTH_ADMIN_NAME', description: '$t:docs.envVars.auth.admin.name' },
        ]),

        // OAuth providers
        subsectionHeader(
          '$t:docs.envVars.auth.oauth.title',
          '$t:docs.envVars.auth.oauth.description',
          'auth-oauth'
        ),
        propertyTable([
          {
            name: '{PROVIDER}_CLIENT_ID',
            description: '$t:docs.envVars.auth.oauth.clientId',
          },
          {
            name: '{PROVIDER}_CLIENT_SECRET',
            description: '$t:docs.envVars.auth.oauth.clientSecret',
          },
        ]),
        calloutTip('$t:docs.envVars.auth.oauth.tip.title', '$t:docs.envVars.auth.oauth.tip.body'),
      ],
    },

    // ── Email (SMTP) ────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader(
          '$t:docs.envVars.smtp.title',
          '$t:docs.envVars.smtp.description',
          'email-smtp'
        ),
        propertyTable([
          { name: 'SMTP_HOST', description: '$t:docs.envVars.smtp.host' },
          { name: 'SMTP_PORT', description: '$t:docs.envVars.smtp.port' },
          { name: 'SMTP_SECURE', description: '$t:docs.envVars.smtp.secure' },
          { name: 'SMTP_USER', description: '$t:docs.envVars.smtp.user' },
          { name: 'SMTP_PASS', description: '$t:docs.envVars.smtp.pass' },
          { name: 'SMTP_FROM', description: '$t:docs.envVars.smtp.from' },
          { name: 'SMTP_FROM_NAME', description: '$t:docs.envVars.smtp.fromName' },
        ]),
        calloutTip('$t:docs.envVars.smtp.tip.title', '$t:docs.envVars.smtp.tip.body'),
      ],
    },

    // ── Build ───────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader('$t:docs.envVars.build.title', '$t:docs.envVars.build.description', 'build'),
        propertyTable([
          { name: 'SOVRIUM_OUTPUT_DIR', description: '$t:docs.envVars.build.outputDir' },
          { name: 'SOVRIUM_BASE_URL', description: '$t:docs.envVars.build.baseUrl' },
          { name: 'SOVRIUM_BASE_PATH', description: '$t:docs.envVars.build.basePath' },
          { name: 'SOVRIUM_DEPLOYMENT', description: '$t:docs.envVars.build.deployment' },
          { name: 'SOVRIUM_LANGUAGES', description: '$t:docs.envVars.build.languages' },
          {
            name: 'SOVRIUM_DEFAULT_LANGUAGE',
            description: '$t:docs.envVars.build.defaultLanguage',
          },
          {
            name: 'SOVRIUM_GENERATE_SITEMAP',
            description: '$t:docs.envVars.build.generateSitemap',
          },
          {
            name: 'SOVRIUM_GENERATE_ROBOTS',
            description: '$t:docs.envVars.build.generateRobots',
          },
          { name: 'SOVRIUM_HYDRATION', description: '$t:docs.envVars.build.hydration' },
          {
            name: 'SOVRIUM_GENERATE_MANIFEST',
            description: '$t:docs.envVars.build.generateManifest',
          },
          {
            name: 'SOVRIUM_BUNDLE_OPTIMIZATION',
            description: '$t:docs.envVars.build.bundleOptimization',
          },
          { name: 'SOVRIUM_PUBLIC_DIR', description: '$t:docs.envVars.build.publicDir' },
        ]),
      ],
    },

    // ── Debug ───────────────────────────────────────────────────────────
    {
      type: 'div',
      props: {},
      children: [
        sectionHeader('$t:docs.envVars.debug.title', '$t:docs.envVars.debug.description', 'debug'),
        propertyTable([
          { name: 'LOG_LEVEL', description: '$t:docs.envVars.debug.logLevel' },
          { name: 'EFFECT_DEVTOOLS', description: '$t:docs.envVars.debug.effectDevtools' },
          {
            name: 'RATE_LIMIT_WINDOW_SECONDS',
            description: '$t:docs.envVars.debug.rateLimitWindow',
          },
        ]),
      ],
    },
  ],
})
