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
})
