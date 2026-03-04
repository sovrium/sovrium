import { execSync } from 'node:child_process'
import { build } from '@/index'
import { app } from './app'

// eslint-disable-next-line functional/no-expression-statements -- Entry point script
await build(app, {
  outputDir: './website/build',
  baseUrl: 'https://sovrium.com',
  generateSitemap: true,
  generateRobotsTxt: true,
  deployment: 'github-pages',
  publicDir: './website/assets',
  languages: ['en', 'fr'],
  defaultLanguage: 'en',
})

// Run Pagefind to index the built HTML and generate search assets.
// The search index is written to ./website/build/pagefind/ and loaded
// lazily by the search modal on first interaction.
// eslint-disable-next-line functional/no-expression-statements -- Post-build indexing step
execSync('bunx pagefind --site ./website/build', { stdio: 'inherit' })
