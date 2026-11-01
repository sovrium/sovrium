/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import connectClaudeMcpBody from '@/docs/guides/connect-claude-mcp.md' with { type: 'file' }
import connectDesktopAiBody from '@/docs/guides/connect-desktop-ai.md' with { type: 'file' }
import integrateEmailBody from '@/docs/guides/integrate-email.md' with { type: 'file' }
import integrateOllamaBody from '@/docs/guides/integrate-ollama.md' with { type: 'file' }
import integratePostgresBody from '@/docs/guides/integrate-postgres.md' with { type: 'file' }
import integrateS3StorageBody from '@/docs/guides/integrate-s3-storage.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * Guides: integrations — the section manifest.
 *
 * Why these are guides and why the two MCP guides are not duplicates:
 * `[internal ref]`, § `the four guides-* sections`.
 * Shape, ordering and the gates that hold a manifest: the same page,
 * "The conventions every manifest follows".
 */
export const section = defineSection({
  slug: 'guides-integrations',
  title: 'Guides: Integrations',
  order: 10_400,
  tab: 'guides',
  articles: [
    defineArticle({
      slug: 'integrate-postgres',
      title: 'Connect Sovrium to PostgreSQL',
      description:
        'Point Sovrium at a PostgreSQL database instead of the SQLite default, with automatic schema migration on boot.',
      keywords: [
        'sovrium',
        'postgresql',
        'database_url',
        'postgres',
        'database',
        'sqlite alternative',
        'scale',
      ],
      order: 10_400,
      sidebarLabel: 'PostgreSQL',
      body: integratePostgresBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'integrate-s3-storage',
      title: 'Store Sovrium files in S3-compatible storage',
      description:
        'Send bucket uploads to any S3-compatible store with a handful of STORAGE_S3_ variables.',
      keywords: [
        'sovrium',
        's3',
        'object storage',
        'minio',
        'file storage',
        'buckets',
        'uploads',
        'STORAGE_PROVIDER',
      ],
      order: 10_410,
      sidebarLabel: 'S3 storage',
      body: integrateS3StorageBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'integrate-email',
      title: 'Send transactional email from Sovrium',
      description:
        'Wire Sovrium to an SMTP provider so auth emails and automation email actions send for real.',
      keywords: [
        'sovrium',
        'transactional email',
        'smtp',
        'email',
        'password reset',
        'verification',
        'automation email',
      ],
      order: 10_420,
      sidebarLabel: 'Transactional email',
      body: integrateEmailBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'integrate-ollama',
      title: 'Run Sovrium AI locally with Ollama',
      description:
        'Power AI fields and agents with a local model — private, free, and the sovereignty-first default.',
      keywords: [
        'sovrium',
        'ollama',
        'local ai',
        'self-hosted ai',
        'ai provider',
        'private llm',
        'no api key',
      ],
      order: 10_430,
      sidebarLabel: 'Ollama (local AI)',
      body: integrateOllamaBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'connect-claude-mcp',
      title: 'Connect an AI client over MCP',
      description:
        'Expose a Sovrium app as an MCP server — enable the endpoint, mint an API key, and add an mcpServers entry.',
      keywords: [
        'sovrium',
        'mcp',
        'claude',
        'model context protocol',
        'ai client',
        'api key',
        'x-api-key',
        'claude desktop',
        'claude code',
      ],
      order: 10_440,
      sidebarLabel: 'Connect over MCP',
      body: connectClaudeMcpBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'connect-desktop-ai',
      title: 'Connect your AI to a project',
      description:
        'Point the assistant you already use at a local project folder, so it reads your configuration and its verdict — no deployment, no server, no key.',
      keywords: [
        'sovrium mcp',
        'claude code',
        'claude desktop',
        'cursor',
        'mcpServers',
        'local project',
        'config tools',
        'stdio',
      ],
      order: 10_445,
      sidebarLabel: 'Connect your AI locally',
      body: connectDesktopAiBody,
      documents: [],
      stories: [],
    }),
  ],
})
