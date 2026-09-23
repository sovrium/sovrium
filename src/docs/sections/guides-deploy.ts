/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import deployDockerComposePostgresBody from '@/docs/guides/deploy-docker-compose-postgres.md' with { type: 'file' }
import deployDockerBody from '@/docs/guides/deploy-docker.md' with { type: 'file' }
import deployScalingoBody from '@/docs/guides/deploy-scalingo.md' with { type: 'file' }
import deployVpsSystemdCaddyBody from '@/docs/guides/deploy-vps-systemd-caddy.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

/**
 * Guides: deploy — the section manifest.
 *
 * Four ways to get a Sovrium app into production: the container, the binary as
 * a service, a managed platform, and the app beside its database. They share
 * `src/docs/guides/` with the other guide sections; see `guides-build.ts`
 * for why the directory and the section are different decisions.
 */
export const section = defineSection({
  slug: 'guides-deploy',
  title: 'Guides: Deploy',
  order: 10_200,
  tab: 'guides',
  articles: [
    defineArticle({
      slug: 'deploy-docker',
      title: 'Deploy Sovrium with Docker',
      description:
        'Run a Sovrium app as a Docker container — the image, the secrets, and the volume that makes state persist.',
      keywords: [
        'sovrium',
        'deploy docker',
        'self-hosted',
        'container',
        'ghcr',
        'docker run',
        'production',
      ],
      order: 10_200,
      sidebarLabel: 'Docker',
      body: deployDockerBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'deploy-docker-compose-postgres',
      title: 'Deploy Sovrium with Docker Compose and PostgreSQL',
      description:
        'Run Sovrium and PostgreSQL together as one stack, wired by a single DATABASE_URL.',
      keywords: [
        'sovrium',
        'docker compose',
        'postgres',
        'self-hosted',
        'database',
        'production',
        'stack',
      ],
      order: 10_210,
      sidebarLabel: 'Compose + Postgres',
      body: deployDockerComposePostgresBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'deploy-vps-systemd-caddy',
      title: 'Deploy Sovrium on a VPS with systemd and Caddy',
      description: 'Run the binary as a systemd service behind Caddy for automatic HTTPS.',
      keywords: [
        'sovrium',
        'deploy vps',
        'systemd',
        'caddy',
        'https',
        'reverse proxy',
        'binary',
        'production',
      ],
      order: 10_220,
      sidebarLabel: 'VPS + systemd + Caddy',
      body: deployVpsSystemdCaddyBody,
      documents: [],
      stories: [],
    }),
    defineArticle({
      slug: 'deploy-scalingo',
      title: 'Deploy Sovrium on Scalingo',
      description:
        'A git-push deploy that runs the released binary, with a managed PostgreSQL add-on.',
      keywords: [
        'sovrium',
        'deploy scalingo',
        'paas',
        'git push deploy',
        'managed postgres',
        'europe hosting',
      ],
      order: 10_230,
      sidebarLabel: 'Scalingo',
      body: deployScalingoBody,
      documents: [],
      stories: [],
    }),
  ],
})
