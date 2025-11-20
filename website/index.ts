import { generateStatic, type App } from '@/index'
import { home } from './pages/home'
import { termsOfService } from './pages/terms-of-service'
import { privacyPolicy } from './pages/privacy-policy'

const app: App = {
  name: 'sovrium-website',
  pages: [home, termsOfService, privacyPolicy],
}

await generateStatic(app, {
  outputDir: './website/build',
  baseUrl: 'https://sovrium.com',
  generateSitemap: true,
  generateRobotsTxt: true,
  deployment: 'github-pages',
})
