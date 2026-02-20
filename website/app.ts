/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type App } from '@/index'
import { brandCharter } from './pages/brand-charter'
import { company } from './pages/company'
import { dataDeletion } from './pages/data-deletion'
import { home } from './pages/home'
import { partners } from './pages/partners'
import { privacyPolicy } from './pages/privacy-policy'
import { termsOfService } from './pages/terms-of-service'

export const app: App = {
  name: 'sovrium-website',
  theme: {
    colors: {
      // Primary palette - Deep blues conveying trust and control
      'sovereignty-dark': '#0a0e1a', // Background dark
      'sovereignty-darker': '#050810', // Background darker
      'sovereignty-light': '#e8ecf4', // Primary text
      'sovereignty-accent': '#3b82f6', // Primary blue accent (CTA, highlights)
      'sovereignty-accent-hover': '#2563eb', // Hover state

      // Secondary palette - Teal for technical credibility
      'sovereignty-teal': '#14b8a6', // Secondary accent
      'sovereignty-teal-dark': '#0d9488', // Secondary dark

      // Neutral palette - Grays for content hierarchy
      'sovereignty-gray-100': '#f3f4f6',
      'sovereignty-gray-200': '#e5e7eb',
      'sovereignty-gray-300': '#d1d5db',
      'sovereignty-gray-400': '#9ca3af',
      'sovereignty-gray-500': '#6b7280',
      'sovereignty-gray-600': '#4b5563',
      'sovereignty-gray-700': '#374151',
      'sovereignty-gray-800': '#1f2937',
      'sovereignty-gray-900': '#111827',

      // Semantic colors
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',

      // Gradient stops
      'gradient-start': '#0a0e1a',
      'gradient-end': '#050810',
    },
    fonts: {
      heading: {
        family: 'Inter',
        fallback: 'system-ui, -apple-system, sans-serif',
        weights: [600, 700, 800],
        lineHeight: '1.2',
        url: 'https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800&display=swap',
      },
      body: {
        family: 'Inter',
        fallback: 'system-ui, -apple-system, sans-serif',
        weights: [400, 500, 600],
        size: '16px',
        lineHeight: '1.6',
        url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
      },
      mono: {
        family: 'Fira Code',
        fallback: 'Monaco, Courier New, monospace',
        weights: [400, 500],
        size: '14px',
        lineHeight: '1.5',
        url: 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&display=swap',
      },
    },
    spacing: {
      // Container variations
      container: 'max-w-7xl mx-auto px-4',
      'container-small': 'max-w-4xl mx-auto px-4',
      'container-xsmall': 'max-w-2xl mx-auto px-4',

      // Section padding
      section: 'py-16 sm:py-20 lg:py-24',
      'section-small': 'py-8 sm:py-12 lg:py-16',
      'section-large': 'py-24 sm:py-32 lg:py-40',

      // Component spacing
      gap: 'gap-6',
      'gap-small': 'gap-4',
      'gap-large': 'gap-8',
      padding: 'p-6',
      'padding-small': 'p-4',
      'padding-large': 'p-8',
    },
    animations: {
      marqueescroll: {
        enabled: false,
        keyframes: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  languages: {
    default: 'en',
    supported: [
      { code: 'en', locale: 'en-US', label: 'English', direction: 'ltr' },
      { code: 'fr', locale: 'fr-FR', label: 'Fran\u00E7ais', direction: 'ltr' },
    ],
    translations: {
      en: {
        // ════════════════════════════════════════════════════════════════════
        //  GLOBAL NAVIGATION
        // ════════════════════════════════════════════════════════════════════
        'nav.partners': 'Our Partner Service',
        'nav.partners.href': '/en/partners',
        'nav.company': 'About',
        'nav.company.href': '/en/company',
        'nav.lang.label': 'FR',
        'nav.lang.code': 'fr',

        // ════════════════════════════════════════════════════════════════════
        //  GLOBAL FOOTER
        // ════════════════════════════════════════════════════════════════════
        'footer.description':
          'A self-hosted, configuration-driven platform that puts you back in control of your software.',
        'footer.col.product': 'Product',
        'footer.col.product.docs': 'Documentation',
        'footer.col.product.github': 'GitHub',
        'footer.col.product.license': 'License',
        'footer.col.company': 'Company',
        'footer.col.company.about': 'About',
        'footer.col.company.about.href': '/en/company',
        'footer.col.company.partners': 'Our Partner Service',
        'footer.col.company.partners.href': '/en/partners',
        'footer.col.company.trademark': 'Trademark',
        'footer.col.legal': 'Legal',
        'footer.col.legal.privacy': 'Privacy Policy',
        'footer.col.legal.privacy.href': '/en/privacy-policy',
        'footer.col.legal.terms': 'Terms of Service',
        'footer.col.legal.terms.href': '/en/terms-of-service',
        'footer.col.legal.dataDeletion': 'Data Deletion',
        'footer.col.legal.dataDeletion.href': '/en/data-deletion',
        'footer.copyright':
          '\u00A9 2025-2026 ESSENTIAL SERVICES. Sovrium\u00AE is a registered trademark of ESSENTIAL SERVICES.',

        // ════════════════════════════════════════════════════════════════════
        //  HOME PAGE
        // ════════════════════════════════════════════════════════════════════

        // ── Home: Meta ──────────────────────────────────────────────────────
        'home.meta.title': 'Sovrium \u2014 Build Apps with Configuration, Not Code',
        'home.meta.description':
          'Build complete business applications with a single configuration file. The open-source, self-hosted SaaS alternative \u2014 no vendor lock-in.',
        'home.meta.og.title': 'Sovrium \u2014 Build Apps with Configuration, Not Code',
        'home.meta.og.description':
          'Open-source, configuration-driven application platform. The self-hosted SaaS alternative with no vendor lock-in.',
        'home.meta.twitter.title': 'Sovrium \u2014 Build Apps with Configuration, Not Code',
        'home.meta.twitter.description':
          'Open-source, configuration-driven application platform. The self-hosted SaaS alternative with no vendor lock-in.',

        // ── Home: Hero ──────────────────────────────────────────────────────
        'home.hero.title': 'Sovrium, the sovereignty element',
        'home.hero.subtitle': 'Own your data. Own your tools. Own your future.',
        'home.hero.description':
          'Break free from SaaS dependency with a self-hosted, configuration-driven platform that puts you back in control.',
        'home.hero.cta.primary': 'Get Started',
        'home.hero.cta.secondary': 'View on GitHub',

        // ── Home: Problem Statement ─────────────────────────────────────────
        'home.problem.title': 'The SaaS Trap',
        'home.problem.stat1.value': '$10K+',
        'home.problem.stat1.label': 'Average annual SaaS spend per employee',
        'home.problem.stat2.value': '0%',
        'home.problem.stat2.label': 'Data you actually own on SaaS platforms',
        'home.problem.stat3.value': '73%',
        'home.problem.stat3.label': 'Companies worried about vendor lock-in',
        'home.problem.hidden.title': 'The Hidden Costs of SaaS Dependency',
        'home.problem.hidden.cost1.title': 'Vendor Lock-in \u2014 ',
        'home.problem.hidden.cost1.description':
          'Your data, workflows, and team habits are trapped in someone else\u2019s platform.',
        'home.problem.hidden.cost2.title': 'Per-Seat Pricing \u2014 ',
        'home.problem.hidden.cost2.description':
          'Costs scale with headcount, not value. Growing your team means growing your SaaS bill.',
        'home.problem.hidden.cost3.title': 'Feature Bloat \u2014 ',
        'home.problem.hidden.cost3.description':
          'You pay for thousands of features you never use, while the ones you need are behind enterprise paywalls.',
        'home.problem.hidden.cost4.title': 'Data Sovereignty \u2014 ',
        'home.problem.hidden.cost4.description':
          'Your business data lives on servers you don\u2019t control, in jurisdictions you didn\u2019t choose.',
        'home.problem.hidden.cost5.title': 'Integration Tax \u2014 ',
        'home.problem.hidden.cost5.description':
          'Connecting SaaS tools requires middleware, custom APIs, and constant maintenance.',

        // ── Home: Solution Overview ─────────────────────────────────────────
        'home.solution.title': 'One Config. Full Application.',
        'home.solution.description':
          'Sovrium turns a simple configuration file into a complete business application \u2014 authentication, database, API, pages, and admin panel included.',
        'home.solution.code.alsoWorks': 'Also works with YAML and JSON configs:',
        'home.solution.howItWorks.title': 'How It Works',
        'home.solution.howItWorks.step1.title': 'Configure',
        'home.solution.howItWorks.step1.description':
          'Define your app schema in TypeScript, YAML, or JSON.',
        'home.solution.howItWorks.step2.title': 'Deploy',
        'home.solution.howItWorks.step2.description':
          'Run on your server, your cloud, your laptop.',
        'home.solution.howItWorks.step3.title': 'Own',
        'home.solution.howItWorks.step3.description': 'Full source code access, full data control.',
        'home.solution.howItWorks.step4.title': 'Evolve',
        'home.solution.howItWorks.step4.description':
          'Add features by updating your config. No migration pain.',

        // ── Home: Comparison ────────────────────────────────────────────────
        'home.comparison.title': 'Why Not Just Use SaaS?',
        'home.comparison.stat1': '90% less cost than equivalent SaaS tools',
        'home.comparison.stat2': '100% data ownership, forever',
        'home.comparison.table.title': 'Sovrium vs Traditional SaaS',
        'home.comparison.table.header.aspect': 'Aspect',
        'home.comparison.table.row1.aspect': 'Data Ownership',
        'home.comparison.table.row1.sovrium': '\u2705 100% yours',
        'home.comparison.table.row1.saas': '\u274C Vendor-owned',
        'home.comparison.table.row2.aspect': 'Source Code',
        'home.comparison.table.row2.sovrium': '\u2705 Full access',
        'home.comparison.table.row2.saas': '\u274C Closed source',
        'home.comparison.table.row3.aspect': 'Monthly Cost',
        'home.comparison.table.row3.sovrium': '\u2705 Server costs only',
        'home.comparison.table.row3.saas': '\u274C $50\u2013500+/user/mo',
        'home.comparison.table.row4.aspect': 'Vendor Lock-in',
        'home.comparison.table.row4.sovrium': '\u2705 Zero',
        'home.comparison.table.row4.saas': '\u274C High',
        'home.comparison.table.row5.aspect': 'Customization',
        'home.comparison.table.row5.sovrium': '\u2705 Unlimited',
        'home.comparison.table.row5.saas': '\u26A0\uFE0F Limited',
        'home.comparison.table.row6.aspect': 'Version Control',
        'home.comparison.table.row6.sovrium': '\u2705 Git-native',
        'home.comparison.table.row6.saas': '\u26A0\uFE0F Limited/None',
        'home.comparison.table.row7.aspect': 'Privacy',
        'home.comparison.table.row7.sovrium': '\u2705 Your servers',
        'home.comparison.table.row7.saas': '\u274C Third-party',

        // ── Home: Use Cases ─────────────────────────────────────────────────
        'home.useCases.title': 'Built For Real Work',
        'home.useCases.internal.title': 'Internal Tools',
        'home.useCases.internal.description':
          'CRM, project management, inventory tracking \u2014 built specifically for how your team works.',
        'home.useCases.portals.title': 'Client Portals',
        'home.useCases.portals.description':
          'Secure dashboards for clients to view reports, submit requests, and track progress.',
        'home.useCases.business.title': 'Business Apps',
        'home.useCases.business.description':
          'Custom applications for workflows that off-the-shelf SaaS can\u2019t handle.',
        'home.useCases.api.title': 'API Backends',
        'home.useCases.api.description':
          'REST APIs with authentication, validation, and database \u2014 zero boilerplate.',
        'home.useCases.static.title': 'Static Sites',
        'home.useCases.static.description':
          'Marketing pages, documentation sites, and landing pages with i18n support.',
        'home.useCases.mvp.title': 'MVPs & Prototypes',
        'home.useCases.mvp.description':
          'From idea to working product in hours, not weeks. Iterate with config changes.',

        // ── Home: Platform Features ─────────────────────────────────────────
        'home.features.title': 'Everything You Need',
        'home.features.subtitle': 'A complete platform, not another framework to learn.',
        'home.features.auth.title': '\uD83D\uDD10 Authentication',
        'home.features.auth.point1': '\u2022 Email/password & social OAuth',
        'home.features.auth.point2': '\u2022 Role-based access (admin, member, viewer)',
        'home.features.auth.point3': '\u2022 Session management',
        'home.features.auth.point4': '\u2022 Two-factor authentication',
        'home.features.auth.point5': '\u2022 Passkeys support',
        'home.features.auth.point6': '\u2022 Custom user fields',
        'home.features.tables.title': '\uD83D\uDDC2\uFE0F Tables & Data',
        'home.features.tables.point1': '\u2022 15+ field types (text, email, number, \u2026)',
        'home.features.tables.point2': '\u2022 Automatic CRUD API',
        'home.features.tables.point3': '\u2022 Relations and lookups',
        'home.features.tables.point4': '\u2022 Sorting, filtering, pagination',
        'home.features.tables.point5': '\u2022 Formula fields',
        'home.features.tables.point6': '\u2022 Import/export',
        'home.features.api.title': '\uD83D\uDD0C Records API',
        'home.features.api.point1': '\u2022 Auto-generated REST endpoints',
        'home.features.api.point2': '\u2022 OpenAPI documentation',
        'home.features.api.point3': '\u2022 Type-safe client SDK',
        'home.features.api.point4': '\u2022 Filtering and sorting',
        'home.features.api.point5': '\u2022 Bulk operations',
        'home.features.api.point6': '\u2022 Webhook support',
        'home.features.pages.title': '\uD83D\uDCBB Pages & UI',
        'home.features.pages.point1': '\u2022 Server-rendered React pages',
        'home.features.pages.point2': '\u2022 Component library included',
        'home.features.pages.point3': '\u2022 Responsive by default',
        'home.features.pages.point4': '\u2022 Custom layouts',
        'home.features.pages.point5': '\u2022 Form builder',
        'home.features.pages.point6': '\u2022 Navigation system',
        'home.features.theming.title': '\uD83C\uDFA8 Theming & i18n',
        'home.features.theming.point1': '\u2022 Custom color schemes',
        'home.features.theming.point2': '\u2022 Typography system',
        'home.features.theming.point3': '\u2022 Dark mode support',
        'home.features.theming.point4': '\u2022 Multi-language (i18n)',
        'home.features.theming.point5': '\u2022 CSS variable theming',
        'home.features.theming.point6': '\u2022 Brand-consistent design',
        'home.features.admin.title': '\u2699\uFE0F Admin & Operations',
        'home.features.admin.point1': '\u2022 Admin dashboard',
        'home.features.admin.point2': '\u2022 User management',
        'home.features.admin.point3': '\u2022 Activity logs',
        'home.features.admin.point4': '\u2022 Database studio',
        'home.features.admin.point5': '\u2022 CLI tools',
        'home.features.admin.point6': '\u2022 Health monitoring',

        // ── Home: Tech Stack ────────────────────────────────────────────────
        'home.techStack.title': 'Modern Stack. No Compromises.',
        'home.techStack.subtitle':
          'Built on battle-tested technologies chosen for performance, reliability, and developer experience.',

        // ── Home: Getting Started ───────────────────────────────────────────
        'home.gettingStarted.title': 'Get Started in Minutes',
        'home.gettingStarted.step1.title': 'Install',
        'home.gettingStarted.step2.title': 'Configure',
        'home.gettingStarted.step2.description': 'Define your app schema in a config file',
        'home.gettingStarted.step3.title': 'Launch',
        'home.gettingStarted.step4.title': 'Customize',
        'home.gettingStarted.step4.description':
          'Add tables, pages, auth \u2014 all through configuration',
        'home.gettingStarted.status.title': 'Early Access',
        'home.gettingStarted.status.description':
          'Sovrium is in active development. Star the repo and follow along as we build the future of self-hosted applications.',
        'home.gettingStarted.status.cta': 'Star on GitHub',

        // ════════════════════════════════════════════════════════════════════
        //  PARTNERS PAGE
        // ════════════════════════════════════════════════════════════════════

        // ── Partners: Meta ──────────────────────────────────────────────────
        'partners.meta.title': 'Sovrium Partners - Custom Software Solutions',
        'partners.meta.description':
          'ESSENTIAL SERVICES builds tailor-made software solutions with Sovrium. 50+ clients served, 200+ tools built, 10,000+ hours saved.',
        'partners.meta.og.title': 'Sovrium Partners - Custom Software Solutions',
        'partners.meta.og.description':
          'Tailor-made solutions to your software challenges. Built on Sovrium, deployed on your infrastructure.',
        'partners.meta.twitter.title': 'Sovrium Partners - Custom Software Solutions',
        'partners.meta.twitter.description':
          'Tailor-made solutions to your software challenges. Built with Sovrium.',

        // ── Partners: Hero ──────────────────────────────────────────────────
        'partners.hero.title': 'Tailor-made solutions to your software challenges',
        'partners.hero.subtitle':
          'We design, build, and maintain custom internal tools, AI-powered solutions, and automated workflows on your infrastructure. No vendor lock-in, no surprise bills \u2014 just software that works for your team.',
        'partners.hero.cta.primary': 'Join the Waitlist',
        'partners.hero.cta.secondary': 'Our Methodology',

        // ── Partners: Trusted By ────────────────────────────────────────────
        'partners.trust.title': 'Trusted By',

        // ── Partners: Stats ─────────────────────────────────────────────────
        'partners.stats.title': 'Proven Track Record',
        'partners.stats.clients.stat': '50+',
        'partners.stats.clients.title': 'Clients Served',
        'partners.stats.clients.description':
          'Startups, SMEs, and enterprises trust us to streamline their operations with custom-built tools.',
        'partners.stats.tools.stat': '200+',
        'partners.stats.tools.title': 'Tools Built',
        'partners.stats.tools.description':
          'From internal dashboards to full business applications, tailored to each client\u2019s unique workflows.',
        'partners.stats.hours.stat': '10,000+',
        'partners.stats.hours.title': 'Hours Saved',
        'partners.stats.hours.description':
          'Automating repetitive tasks and consolidating scattered tools into cohesive platforms.',

        // ── Partners: Process (5 steps) ─────────────────────────────────────
        'partners.process.title': 'Our Process',
        'partners.process.subtitle':
          'A proven 5-step approach to deliver software that fits your needs perfectly.',
        'partners.process.step1.title': 'Listen',
        'partners.process.step1.description':
          'Understand your workflows, pain points, and goals through in-depth discovery sessions.',
        'partners.process.step2.title': 'Advise',
        'partners.process.step2.description':
          'Design the optimal solution architecture based on your specific constraints and objectives.',
        'partners.process.step3.title': 'Develop',
        'partners.process.step3.description':
          'Build with Sovrium on your infrastructure. Clean code, tested, deployed on your terms.',
        'partners.process.step4.title': 'Adjust',
        'partners.process.step4.description':
          'Iterate based on real usage and feedback. We refine until it fits perfectly.',
        'partners.process.step5.title': 'Maintain',
        'partners.process.step5.description':
          'Ongoing support and evolution as your needs grow. We stay with you for the long run.',

        // ── Partners: Methodology (13 principles) ──────────────────────────
        'partners.methodology.title': 'Our Methodology',
        'partners.methodology.subtitle': '10 principles that guide every project we deliver.',
        'partners.methodology.1.title':
          '\u2699\uFE0F We automate processes, build internal tools, and leverage AI to amplify your team',
        'partners.methodology.1.description':
          'We analyze your workflows to identify repetitive tasks, design end-to-end automations, and integrate AI where it accelerates delivery.',
        'partners.methodology.2.title':
          '\uD83D\uDCAC We are available to answer your questions, needs, and technical support',
        'partners.methodology.2.description':
          'Our team is here to understand your specific needs and support you in your projects.',
        'partners.methodology.3.title': '\uD83E\uDD47 We use the best of Code, No Code, and AI',
        'partners.methodology.3.description':
          'We combine traditional code, No Code platforms, and AI-powered tools to deliver the right solution for each use case.',
        'partners.methodology.4.title':
          '\uD83D\uDCBB We work remotely and asynchronously, using video conferencing when necessary',
        'partners.methodology.4.description':
          'Our remote work approach is based on clear and effective communication.',
        'partners.methodology.5.title':
          '\u23F1\uFE0F You pay for the time we spend on all your requests',
        'partners.methodology.5.description':
          'Our billing system is transparent and based on actual time spent on your projects.',
        'partners.methodology.6.title': '\u274C We don\u2019t do estimates',
        'partners.methodology.6.description':
          'We prefer a pragmatic approach based on action rather than approximate predictions.',
        'partners.methodology.7.title':
          '\uD83D\uDC8E We take the time to do quality work, focusing on what matters',
        'partners.methodology.7.description':
          'Our commitment to quality guides every aspect of our work.',
        'partners.methodology.8.title': '\uD83C\uDFE1 You own everything we develop for you',
        'partners.methodology.8.description':
          'All code, applications, and solutions developed as part of our services belong entirely to you.',
        'partners.methodology.9.title': '\uD83D\uDD4A\uFE0F You are not committed to anything',
        'partners.methodology.9.description':
          'Our flexible approach allows you to work with us according to your needs, without long-term contractual commitment.',
        'partners.methodology.10.title': '\u2764\uFE0F We take care of you',
        'partners.methodology.10.description':
          'Your satisfaction is our priority. We don\u2019t just deliver a project: we commit to supporting you at every step.',

        // ── Partners: Testimonials (exact LTF Engine quotes) ────────────────
        'partners.testimonials.title': 'What Our Clients Say',
        'partners.testimonials.1.quote':
          'Very satisfying work, it\u2019s a very positive and enriching experience. The La Tech Force team helped us quickly gain expertise.',
        'partners.testimonials.1.author': 'Marco PERONE',
        'partners.testimonials.1.role': 'Co-founder at CAPITAL PV',
        'partners.testimonials.2.quote':
          'Excellent support, great responsiveness and availability of the team, high quality deliverables, proactive suggestions.',
        'partners.testimonials.2.author': 'Simon SALLANDRE',
        'partners.testimonials.2.role': 'Operations Director at AGORASTORE',
        'partners.testimonials.3.quote':
          'Competent team & effective work. I learned a lot and developed a better understanding of automation logic.',
        'partners.testimonials.3.author': 'Mbemba DANSOKO',
        'partners.testimonials.3.role': 'Co-founder at ACTIVPRENEUR',
        'partners.testimonials.4.quote':
          'A great collaboration, we were able to make a giant leap and support across multiple business areas.',
        'partners.testimonials.4.author': 'Meryem BENMOUAZ',
        'partners.testimonials.4.role': 'Co-founder at LINTENDANCE',

        // ── Partners: Waitlist CTA ──────────────────────────────────────────
        'partners.waitlist.title': 'Supercharge Your Team',
        'partners.waitlist.description':
          'We work with a limited number of clients to ensure quality. Join our waitlist to be the first to know when a spot opens.',
        'partners.waitlist.cta': 'Join the Waitlist',

        // ════════════════════════════════════════════════════════════════════
        //  COMPANY PAGE
        // ════════════════════════════════════════════════════════════════════

        // ── Company: Meta ──────────────────────────────────────────────────
        'company.meta.title': 'Sovrium \u2014 Company',
        'company.meta.description':
          'Learn about the vision, values, and team behind Sovrium. Building digital sovereignty for every organization.',
        'company.meta.og.title': 'Sovrium \u2014 Company',
        'company.meta.og.description':
          'The vision, values, and team behind Sovrium. Digital sovereignty for every organization.',
        'company.meta.twitter.title': 'Sovrium \u2014 Company',
        'company.meta.twitter.description':
          'The vision, values, and team behind Sovrium. Digital sovereignty for every organization.',

        // ── Company: Hero ──────────────────────────────────────────────────
        'company.hero.eyebrow': 'ESSENTIAL SERVICES',
        'company.hero.title': 'Building digital sovereignty',
        'company.hero.subtitle':
          'We believe every organization deserves to own its software, its data, and its future. Sovrium is the platform that makes it possible.',
        'company.hero.tagline': '\u201COwn your data. Own your tools. Own your future.\u201D',

        // ── Company: Mission ───────────────────────────────────────────────
        'company.mission.title': 'Our Mission',
        'company.mission.description':
          'Modern organizations are drowning in SaaS dependencies \u2014 paying monthly fees, losing data control, and adapting their business to vendor limitations. We are building the alternative.',
        'company.mission.statement':
          'To make every organization sovereign in their information systems \u2014 free from SaaS lock-in, in complete control of their data, and empowered to build business applications through configuration-as-code.',

        // ── Company: Values ────────────────────────────────────────────────
        'company.values.title': 'Our Values',
        'company.values.subtitle':
          'The principles that guide every decision we make, from code architecture to community engagement.',
        'company.values.sovereignty.icon': '\uD83D\uDEE1\uFE0F',
        'company.values.sovereignty.title': 'Digital Sovereignty',
        'company.values.sovereignty.description':
          'Organizations should own their information systems, not rent them. Your data, your infrastructure, your rules.',
        'company.values.transparency.icon': '\uD83D\uDD0D',
        'company.values.transparency.title': 'Radical Transparency',
        'company.values.transparency.description':
          'Source-available code, open roadmap, honest communication. No hidden agendas, no surprise pricing, no vendor lock-in.',
        'company.values.openSource.icon': '\uD83C\uDF10',
        'company.values.openSource.title': 'Open Source Spirit',
        'company.values.openSource.description':
          'Built on open standards and open-source technologies. Contributing back to the ecosystem that enables us.',
        'company.values.simplicity.icon': '\u2728',
        'company.values.simplicity.title': 'Elegant Simplicity',
        'company.values.simplicity.description':
          'Complex problems deserve simple solutions. One config file, one command, one platform \u2014 no unnecessary complexity.',
        'company.values.ownership.icon': '\uD83C\uDFE1',
        'company.values.ownership.title': 'True Ownership',
        'company.values.ownership.description':
          'Everything we build for you belongs to you. Full source access, full data portability, zero lock-in.',
        'company.values.longTerm.icon': '\uD83C\uDF31',
        'company.values.longTerm.title': 'Long-Term Thinking',
        'company.values.longTerm.description':
          'We build for sustainability, not hype cycles. Sovrium is designed to grow with your organization for years to come.',

        // ── Company: Principles ────────────────────────────────────────────
        'company.principles.title': 'How We Build',
        'company.principles.subtitle':
          'Five core principles shape the technical decisions behind Sovrium.',
        'company.principles.configOverCode.title': 'Configuration Over Coding',
        'company.principles.configOverCode.description':
          'Business applications should be configured, not programmed. TypeScript, YAML, or JSON \u2014 choose your format, get a complete app in seconds.',
        'company.principles.minimalDeps.title': 'Minimal Dependencies',
        'company.principles.minimalDeps.description':
          'One runtime (Bun), one database (PostgreSQL), zero vendor SDKs. Reduce your dependency surface to only essential infrastructure.',
        'company.principles.businessFocus.title': 'Business Focus',
        'company.principles.businessFocus.description':
          'Engineers should focus on business logic, not infrastructure. Sovrium handles auth, database, API, and UI out of the box.',
        'company.principles.configReuse.title': 'Configuration Reusability',
        'company.principles.configReuse.description':
          'Configuration templates become organizational assets. Build CRM, project tools, and portals from composable, version-controlled configs.',

        // ── Company: Team ──────────────────────────────────────────────────
        'company.team.title': 'The Team',
        'company.team.subtitle':
          'Sovrium is built by ESSENTIAL SERVICES, a company dedicated to giving organizations control over their software.',
        'company.team.founder.name': 'Thomas Jeanneau',
        'company.team.founder.role': 'Founder & CEO',
        'company.team.founder.bio':
          'Software engineer and entrepreneur with 8 years of expertise, passionate about building tools that empower organizations. Previously built automation tools serving 50+ clients across France and Europe.',

        // ── Company: CTA ───────────────────────────────────────────────────
        'company.cta.title': 'Join the Movement',
        'company.cta.description':
          'Sovrium is open source and actively developed. Star the repo, contribute code, or build with us.',
        'company.cta.github': 'View on GitHub',
        'company.cta.partners': 'Work With Us',
        'company.cta.partners.href': '/en/partners',

        // ════════════════════════════════════════════════════════════════════
        //  TERMS OF SERVICE PAGE
        // ════════════════════════════════════════════════════════════════════

        // ── Terms: Meta ───────────────────────────────────────────────────
        'terms.meta.title': 'Terms of Service - Sovrium',
        'terms.meta.description':
          'Terms of service and license information for Sovrium, the self-hosted configuration-driven platform.',
        'terms.meta.og.title': 'Terms of Service - Sovrium',
        'terms.meta.og.description':
          'Terms of service and license information for Sovrium, the self-hosted configuration-driven platform by ESSENTIAL SERVICES.',
        'terms.meta.twitter.title': 'Terms of Service - Sovrium',
        'terms.meta.twitter.description':
          'Terms of service and license information for Sovrium, the self-hosted configuration-driven platform by ESSENTIAL SERVICES.',

        // ── Terms: Header ─────────────────────────────────────────────────
        'terms.header.title': 'Terms of Service',
        'terms.header.lastUpdated': 'Last Updated: February 20, 2026',

        // ── Terms: 1. Agreement ───────────────────────────────────────────
        'terms.s1.title': '1. Agreement to Terms',
        'terms.s1.p1':
          'By accessing or using the Sovrium software, website, or any related services (collectively, the "Services"), you agree to be bound by these Terms of Service ("Terms") and all applicable laws and regulations. If you do not agree with these Terms, you may not use our Services.',

        // ── Terms: 2. Software License ────────────────────────────────────
        'terms.s2.title': '2. Software License',
        'terms.s2.p1':
          'Sovrium is licensed under the Business Source License 1.1 (BSL 1.1). The full license terms are available in the LICENSE.md file in the source repository.',
        'terms.s2.permitted.title': '2.1 Permitted Uses',
        'terms.s2.permitted.intro': 'You may use Sovrium for:',
        'terms.s2.permitted.item1': '\u2713 Internal business use within your organization',
        'terms.s2.permitted.item2': '\u2713 Personal projects and development',
        'terms.s2.permitted.item3': '\u2713 Educational and academic purposes',
        'terms.s2.permitted.item4': '\u2713 Non-competing client deployments',
        'terms.s2.permitted.item5':
          '\u2713 Creating applications for your own use or your direct clients',
        'terms.s2.prohibited.title': '2.2 Prohibited Uses',
        'terms.s2.prohibited.intro': 'Without a commercial license, you may NOT:',
        'terms.s2.prohibited.item1':
          '\u274C Offer Sovrium as a commercial hosted or managed service to third parties',
        'terms.s2.prohibited.item2': '\u274C Create a competitive SaaS offering based on Sovrium',
        'terms.s2.prohibited.item3':
          '\u274C Resell, sublicense, or distribute Sovrium as a commercial product',
        'terms.s2.prohibited.item4': '\u274C Remove or modify copyright notices or license terms',
        'terms.s2.changeDate.title': '2.3 Change Date',
        'terms.s2.changeDate.p1':
          'On January 1, 2029, the BSL 1.1 license will automatically convert to Apache License 2.0, making Sovrium fully open source.',
        'terms.s2.commercial.title': '2.4 Commercial Licensing',
        'terms.s2.commercial.p1':
          'For commercial hosting, managed services, or competitive use cases, please contact license@sovrium.com to obtain a commercial license.',

        // ── Terms: 3. Trademark ───────────────────────────────────────────
        'terms.s3.title': '3. Trademark and Branding',
        'terms.s3.p1':
          'Sovrium\u00AE is a registered trademark of ESSENTIAL SERVICES, registered with the Institut National de la Propri\u00E9t\u00E9 Industrielle (INPI) in France under registration number FR5200287.',
        'terms.s3.p2': 'The trademark registration can be verified on the INPI public registry:',
        'terms.s3.mayIntro': 'You may:',
        'terms.s3.may1': '\u2713 State that your application is "Powered by Sovrium"',
        'terms.s3.may2': '\u2713 Use the Sovrium name in factual statements about the software',
        'terms.s3.may3': '\u2713 Include Sovrium in technical documentation',
        'terms.s3.mayNotIntro': 'You may NOT:',
        'terms.s3.mayNot1': '\u274C Use Sovrium in your product name without permission',
        'terms.s3.mayNot2': '\u274C Imply endorsement by ESSENTIAL SERVICES',
        'terms.s3.mayNot3': '\u274C Modify the Sovrium logo without authorization',
        'terms.s3.guidelinesNote':
          'For detailed trademark guidelines, see TRADEMARK.md in the source repository.',

        // ── Terms: 4. Warranty ────────────────────────────────────────────
        'terms.s4.title': '4. Warranty Disclaimer',
        'terms.s4.p1':
          'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.',
        'terms.s4.p2': 'ESSENTIAL SERVICES does not warrant that:',
        'terms.s4.item1': '\u2022 The software will meet your requirements',
        'terms.s4.item2': '\u2022 The software will be uninterrupted or error-free',
        'terms.s4.item3': '\u2022 Any defects will be corrected',
        'terms.s4.item4': '\u2022 The software is free of vulnerabilities',

        // ── Terms: 5. Liability ───────────────────────────────────────────
        'terms.s5.title': '5. Limitation of Liability',
        'terms.s5.p1':
          'IN NO EVENT SHALL ESSENTIAL SERVICES, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, OR OTHER INTANGIBLE LOSSES.',
        'terms.s5.p2':
          'This limitation applies even if ESSENTIAL SERVICES has been advised of the possibility of such damages.',

        // ── Terms: 6. Indemnification ─────────────────────────────────────
        'terms.s6.title': '6. Indemnification',
        'terms.s6.p1':
          'You agree to indemnify and hold harmless ESSENTIAL SERVICES from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:',
        'terms.s6.item1': '\u2022 Your use of the software',
        'terms.s6.item2': '\u2022 Your violation of these Terms',
        'terms.s6.item3': '\u2022 Your violation of any third-party rights',
        'terms.s6.item4': '\u2022 Your applications built with Sovrium',

        // ── Terms: 7. Modifications ───────────────────────────────────────
        'terms.s7.title': '7. Modifications to Terms',
        'terms.s7.p1':
          'We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting to the website. Your continued use of the Services after changes constitutes acceptance of the modified Terms.',

        // ── Terms: 8. Termination ─────────────────────────────────────────
        'terms.s8.title': '8. Termination',
        'terms.s8.p1':
          'We may terminate or suspend your access to the Services immediately, without prior notice, for any reason, including:',
        'terms.s8.item1': '\u2022 Breach of these Terms',
        'terms.s8.item2': '\u2022 Violation of the BSL 1.1 license',
        'terms.s8.item3': '\u2022 Unauthorized commercial use',
        'terms.s8.item4': '\u2022 Harmful or malicious use',

        // ── Terms: 9. Governing Law ───────────────────────────────────────
        'terms.s9.title': '9. Governing Law',
        'terms.s9.p1':
          'These Terms shall be governed by and construed in accordance with the laws of France, without regard to its conflict of law provisions. Any disputes shall be resolved in the courts of France.',

        // ── Terms: 10. Severability ───────────────────────────────────────
        'terms.s10.title': '10. Severability',
        'terms.s10.p1':
          'If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.',

        // ── Terms: 11. Entire Agreement ───────────────────────────────────
        'terms.s11.title': '11. Entire Agreement',
        'terms.s11.p1':
          'These Terms, together with the BSL 1.1 license and any commercial license agreements, constitute the entire agreement between you and ESSENTIAL SERVICES regarding the use of Sovrium.',

        // ── Terms: 12. User Data ──────────────────────────────────────────
        'terms.s12.title': '12. User Data and Privacy',
        'terms.s12.p1':
          'Your use of Sovrium may involve the collection, processing, and storage of personal data. Our handling of personal data is governed by our Privacy Policy, available at sovrium.com/privacy-policy.',
        'terms.s12.p2':
          'For self-hosted installations, the organization operating the Sovrium instance is the data controller and is responsible for compliance with applicable data protection laws (e.g., GDPR). ESSENTIAL SERVICES does not access, process, or store data from self-hosted installations.',
        'terms.s12.p3':
          'You may request the deletion of your personal data in accordance with our Data Deletion policy at sovrium.com/data-deletion.',

        // ── Terms: 13. Contact ────────────────────────────────────────────
        'terms.s13.title': '13. Contact Information',
        'terms.s13.intro': 'For questions about these Terms or licensing:',
        'terms.s13.item1': '\u2022 License inquiries: license@sovrium.com',
        'terms.s13.item2': '\u2022 General questions: GitHub Issues',
        'terms.s13.item3': '\u2022 Company: ESSENTIAL SERVICES, SAS au capital de 10 000 \u20AC',
        'terms.s13.item4': '\u2022 RCS Paris \u2014 SIREN: 834 241 481',
        'terms.s13.item5': '\u2022 SIRET: 834 241 481 00029',
        'terms.s13.item6': '\u2022 TVA: FR04834241481',
        'terms.s13.item7': '\u2022 Address: 128 Rue La Bo\u00E9tie, 75008 Paris, France',
        'terms.s13.item8': '\u2022 President: Thomas Jeanneau',
        'terms.s13.item9': '\u2022 Website: sovrium.com',

        // ── Terms: Notice ─────────────────────────────────────────────────
        'terms.notice.title': '\u26A0\uFE0F Important Notice',
        'terms.notice.p1':
          'By downloading, installing, or using Sovrium, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service and the Business Source License 1.1.',

        // ════════════════════════════════════════════════════════════════════
        //  PRIVACY POLICY PAGE
        // ════════════════════════════════════════════════════════════════════

        // ── Privacy: Meta ─────────────────────────────────────────────────
        'privacy.meta.title': 'Privacy Policy - Sovrium',
        'privacy.meta.description':
          'Privacy policy for Sovrium, the self-hosted configuration-driven platform by ESSENTIAL SERVICES.',
        'privacy.meta.og.title': 'Privacy Policy - Sovrium',
        'privacy.meta.og.description':
          'Privacy policy for Sovrium, the self-hosted configuration-driven platform by ESSENTIAL SERVICES.',
        'privacy.meta.twitter.title': 'Privacy Policy - Sovrium',
        'privacy.meta.twitter.description':
          'Privacy policy for Sovrium, the self-hosted configuration-driven platform by ESSENTIAL SERVICES.',

        // ── Privacy: Header ───────────────────────────────────────────────
        'privacy.header.title': 'Privacy Policy',
        'privacy.header.lastUpdated': 'Last Updated: February 20, 2026',

        // ── Privacy: 1. Introduction ──────────────────────────────────────
        'privacy.s1.title': '1. Introduction',
        'privacy.s1.p1':
          'ESSENTIAL SERVICES ("we", "us", "our") respects your privacy. This Privacy Policy explains how we collect, use, and protect information related to sovrium.com (the "Website") and the Sovrium software (the "Software").',
        'privacy.s1.p2':
          'Sovrium is designed with digital sovereignty in mind. As a self-hosted platform, we believe your data should remain under your control.',

        // ── Privacy: 2. Data Collection ───────────────────────────────────
        'privacy.s2.title': '2. Data Collection',
        'privacy.s2.analytics.title': '2.1 Website Analytics',
        'privacy.s2.analytics.p1':
          'We may use privacy-respecting analytics services (such as Plausible Analytics) to understand website traffic and usage patterns. These services:',
        'privacy.s2.analytics.item1': '\u2022 Do not use cookies',
        'privacy.s2.analytics.item2': '\u2022 Do not collect personal data',
        'privacy.s2.analytics.item3': '\u2022 Do not track users across sites',
        'privacy.s2.analytics.item4': '\u2022 Are fully GDPR compliant',
        'privacy.s2.cookies.title': '2.2 Cookies',
        'privacy.s2.cookies.p1':
          'The sovrium.com website does not use cookies. We do not set any first-party or third-party cookies. No cookie consent banner is necessary because no cookies are used.',
        'privacy.s2.selfHosted.title': '2.3 Self-Hosted Software',
        'privacy.s2.selfHosted.p1':
          'Sovrium is self-hosted software that runs on your infrastructure. We do not:',
        'privacy.s2.selfHosted.item1': '\u2022 Collect data from your Sovrium installations',
        'privacy.s2.selfHosted.item2': '\u2022 Store or process your application data',
        'privacy.s2.selfHosted.item3': '\u2022 Have access to your configurations',
        'privacy.s2.selfHosted.item4': '\u2022 Monitor your usage or deployments',
        'privacy.s2.selfHosted.note':
          'You are the data controller for all data processed by your Sovrium installation.',
        'privacy.s2.github.title': '2.4 GitHub and Open Source',
        'privacy.s2.github.p1':
          'When you interact with our GitHub repository (issues, pull requests, discussions), GitHub collects data according to their privacy policy. We may see public information you share on GitHub.',
        'privacy.s2.facebook.title': '2.5 Facebook and Social Login',
        'privacy.s2.facebook.p1':
          'Sovrium-powered applications may integrate Facebook Login (or other social authentication providers) as an optional sign-in method. When a user authenticates via Facebook Login, the following data may be received by the Sovrium application:',
        'privacy.s2.facebook.item1': '\u2022 Name and profile picture',
        'privacy.s2.facebook.item2': '\u2022 Email address',
        'privacy.s2.facebook.item3': '\u2022 Facebook user ID',
        'privacy.s2.facebook.legal':
          'Legal basis: This data is processed under GDPR Art. 6(1)(b) (performance of a contract) when you choose to sign in via Facebook Login, and Art. 6(1)(a) (consent) as you explicitly authorize the data sharing through Facebook\u2019s authorization dialog.',
        'privacy.s2.facebook.purpose':
          'This data is used solely for the purpose of authenticating your identity and creating your user account within the Sovrium-powered application. For self-hosted installations, this data is stored on the infrastructure controlled by the organization operating the application. ESSENTIAL SERVICES does not have access to this data unless it directly operates the application.',
        'privacy.s2.facebook.deletion':
          'You may request deletion of your data at any time. See our Data Deletion page at sovrium.com/data-deletion for detailed instructions.',

        // ── Privacy: 3. Use of Information ────────────────────────────────
        'privacy.s3.title': '3. Use of Information',
        'privacy.s3.p1': 'Any analytics data we collect is used solely to:',
        'privacy.s3.item1': '\u2022 Improve our website and documentation',
        'privacy.s3.item2': '\u2022 Understand which features interest users',
        'privacy.s3.item3': '\u2022 Fix technical issues with the website',
        'privacy.s3.item4': '\u2022 Plan development priorities',
        'privacy.s3.retention.title': '3.1 Data Retention',
        'privacy.s3.retention.item1':
          '\u2022 Website analytics: Aggregated and anonymized. No personal data is retained.',
        'privacy.s3.retention.item2':
          '\u2022 Facebook Login data (for ESSENTIAL SERVICES-operated applications): Retained as long as your user account is active. Deleted within 30 days of a valid deletion request.',
        'privacy.s3.retention.item3':
          '\u2022 Self-hosted installations: Data retention is determined by the organization operating the Sovrium instance.',

        // ── Privacy: 4. Third-Party Services ──────────────────────────────
        'privacy.s4.title': '4. Third-Party Services',
        'privacy.s4.p1': 'Our website may link to or interact with third-party services:',
        'privacy.s4.item1': '\u2022 GitHub (for source code and issues)',
        'privacy.s4.item2': '\u2022 Google Fonts (for typography)',
        'privacy.s4.item3':
          '\u2022 Facebook/Meta (for social authentication in Sovrium-powered applications)',
        'privacy.s4.item4': '\u2022 CDN services (for faster content delivery)',
        'privacy.s4.note':
          'These services have their own privacy policies and data practices. We encourage you to review their policies, in particular the Meta Privacy Policy at https://www.facebook.com/privacy/policy/.',
        'privacy.s4.sharing.title': '4.1 Data Sharing',
        'privacy.s4.sharing.p1':
          'ESSENTIAL SERVICES does not sell, rent, or trade your personal data to third parties. We do not share your personal data with third parties for their marketing purposes. Data may only be shared with third parties in the following limited circumstances:',
        'privacy.s4.sharing.item1':
          '\u2022 With your explicit consent (e.g., when you authorize a social login)',
        'privacy.s4.sharing.item2':
          '\u2022 To comply with legal obligations or respond to lawful government requests',
        'privacy.s4.sharing.item3':
          '\u2022 To protect the rights, property, or safety of ESSENTIAL SERVICES, our users, or the public',

        // ── Privacy: 5. International Transfers ───────────────────────────
        'privacy.s5.title': '5. International Data Transfers',
        'privacy.s5.p1':
          'When you use Facebook Login or other social authentication providers, your data may be transferred to and processed in countries outside the European Economic Area (EEA), including the United States. These transfers are necessary for the performance of the authentication service and are conducted in accordance with applicable data protection laws.',
        'privacy.s5.p2':
          'Where data is transferred outside the EEA, we rely on appropriate safeguards such as the EU-US Data Privacy Framework, Standard Contractual Clauses (SCCs), or other lawful transfer mechanisms to ensure your data is adequately protected.',
        'privacy.s5.p3':
          'For self-hosted Sovrium installations, data transfers are determined by the organization operating the instance. ESSENTIAL SERVICES has no involvement in those transfers.',

        // ── Privacy: 6. Your Rights ───────────────────────────────────────
        'privacy.s6.title': '6. Your Rights',
        'privacy.s6.p1': 'Under GDPR and other privacy laws, you have the right to:',
        'privacy.s6.item1': '\u2022 Access any personal data we hold about you',
        'privacy.s6.item2': '\u2022 Request correction of inaccurate data',
        'privacy.s6.item3': '\u2022 Request deletion of your data',
        'privacy.s6.item4': '\u2022 Object to data processing',
        'privacy.s6.item5': '\u2022 Request data portability',
        'privacy.s6.contact': 'To exercise these rights, contact us at privacy@sovrium.com.',

        // ── Privacy: 7. Security ──────────────────────────────────────────
        'privacy.s7.title': '7. Security',
        'privacy.s7.p1':
          'We take reasonable measures to protect any information we collect. However, as we collect minimal data and the Sovrium software is self-hosted, your primary security responsibility lies with your own infrastructure and deployment practices.',

        // ── Privacy: 8. Children ──────────────────────────────────────────
        'privacy.s8.title': "8. Children's Privacy",
        'privacy.s8.p1':
          'Our website and software are not directed to children under 13. We do not knowingly collect personal information from children under 13.',

        // ── Privacy: 9. Changes ───────────────────────────────────────────
        'privacy.s9.title': '9. Changes to This Policy',
        'privacy.s9.p1':
          'We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last Updated" date. Your continued use of the website after changes constitutes acceptance of the updated policy.',

        // ── Privacy: 10. Contact ──────────────────────────────────────────
        'privacy.s10.title': '10. Contact Information',
        'privacy.s10.intro': 'For privacy-related inquiries:',
        'privacy.s10.item1': '\u2022 Email: privacy@sovrium.com',
        'privacy.s10.item2': '\u2022 GitHub Issues: https://github.com/sovrium/sovrium/issues',
        'privacy.s10.item3': '\u2022 Company: ESSENTIAL SERVICES, SAS au capital de 10 000 \u20AC',
        'privacy.s10.item4': '\u2022 RCS Paris \u2014 SIREN: 834 241 481',
        'privacy.s10.item5': '\u2022 SIRET: 834 241 481 00029',
        'privacy.s10.item6': '\u2022 TVA: FR04834241481',
        'privacy.s10.item7': '\u2022 Address: 128 Rue La Bo\u00E9tie, 75008 Paris, France',
        'privacy.s10.item8': '\u2022 President: Thomas Jeanneau',
        'privacy.s10.item9': '\u2022 Data Deletion: sovrium.com/data-deletion',

        // ── Privacy: 11. Data Protection ──────────────────────────────────
        'privacy.s11.title': '11. Data Protection',
        'privacy.s11.p1':
          'As a company committed to digital sovereignty, we practice data minimization. We collect the absolute minimum data necessary and encourage you to maintain control of your own data through self-hosting.',

        // ════════════════════════════════════════════════════════════════════
        //  DATA DELETION PAGE
        // ════════════════════════════════════════════════════════════════════

        // ── DataDeletion: Meta ────────────────────────────────────────────
        'dataDeletion.meta.title': 'Data Deletion Request - Sovrium',
        'dataDeletion.meta.description':
          'Instructions for requesting deletion of your data related to Sovrium software and services by ESSENTIAL SERVICES.',
        'dataDeletion.meta.og.title': 'Data Deletion Request - Sovrium',
        'dataDeletion.meta.og.description':
          'Instructions for requesting deletion of your data related to Sovrium software and services by ESSENTIAL SERVICES.',
        'dataDeletion.meta.twitter.title': 'Data Deletion Request - Sovrium',
        'dataDeletion.meta.twitter.description':
          'Instructions for requesting deletion of your data related to Sovrium software and services by ESSENTIAL SERVICES.',

        // ── DataDeletion: Header ──────────────────────────────────────────
        'dataDeletion.header.title': 'Data Deletion Request',
        'dataDeletion.header.lastUpdated': 'Last Updated: February 20, 2026',

        // ── DataDeletion: Intro ───────────────────────────────────────────
        'dataDeletion.intro.p1':
          'This page explains how to request the deletion of your personal data in connection with Sovrium software and services operated by ESSENTIAL SERVICES. Depending on how you interact with Sovrium, the process may differ.',

        // ── DataDeletion: 1. Self-Hosted ──────────────────────────────────
        'dataDeletion.s1.title': '1. Sovrium Software (Self-Hosted Installations)',
        'dataDeletion.s1.p1':
          'Sovrium is a self-hosted, configuration-driven application platform. When an organization deploys Sovrium on their own infrastructure, they are the data controller for all user data processed by that installation. ESSENTIAL SERVICES does not have access to data stored in self-hosted Sovrium instances.',
        'dataDeletion.s1.p2': 'If you are a user of a Sovrium-powered application:',
        'dataDeletion.s1.item1':
          '\u2022 Contact the administrator of the organization that operates the application',
        'dataDeletion.s1.item2':
          '\u2022 The organization is responsible for handling your data deletion request under applicable data protection laws (e.g., GDPR)',
        'dataDeletion.s1.item3':
          '\u2022 ESSENTIAL SERVICES cannot delete data from self-hosted installations as we do not have access to them',

        // ── DataDeletion: 2. Facebook Login ───────────────────────────────
        'dataDeletion.s2.title': '2. Facebook Login and Social Authentication',
        'dataDeletion.s2.p1':
          'Sovrium-powered applications may integrate Facebook Login as an authentication method. When you use Facebook Login to sign in to a Sovrium-powered application, certain data from your Facebook profile may be shared with that application.',
        'dataDeletion.s2.p2':
          'The following data types may be stored and are subject to deletion upon request:',
        'dataDeletion.s2.item1': '\u2022 Your name (as provided by Facebook)',
        'dataDeletion.s2.item2': '\u2022 Your email address',
        'dataDeletion.s2.item3': '\u2022 Your profile picture URL',
        'dataDeletion.s2.item4': '\u2022 Your Facebook user ID',
        'dataDeletion.s2.item5':
          '\u2022 Any application-specific data created during your use of the Sovrium-powered application',
        'dataDeletion.s2.deleteIntro': 'To delete your data associated with Facebook Login:',
        'dataDeletion.s2.step1.title': 'Step 1: Remove the app from Facebook',
        'dataDeletion.s2.step1.item1': '\u2022 Go to your Facebook Settings',
        'dataDeletion.s2.step1.item2':
          '\u2022 Navigate to Settings & Privacy > Settings > Apps and Websites',
        'dataDeletion.s2.step1.item3':
          '\u2022 Find the Sovrium-powered application and click "Remove" to revoke access',
        'dataDeletion.s2.step1.item4':
          '\u2022 Check the box to delete any data the app may have received from Facebook',
        'dataDeletion.s2.step2.title': 'Step 2: Contact the application administrator',
        'dataDeletion.s2.step2.item1':
          '\u2022 Contact the organization that operates the Sovrium-powered application',
        'dataDeletion.s2.step2.item2':
          '\u2022 Request deletion of all personal data stored in their Sovrium installation, including data received via Facebook Login',
        'dataDeletion.s2.step3.title': 'Step 3: For applications operated by ESSENTIAL SERVICES',
        'dataDeletion.s2.step3.p1':
          'If the application is directly operated by ESSENTIAL SERVICES, you can request data deletion by emailing privacy@sovrium.com with the subject line "Data Deletion Request". Please include the email address associated with your account.',

        // ── DataDeletion: 3. Website ──────────────────────────────────────
        'dataDeletion.s3.title': '3. sovrium.com Website',
        'dataDeletion.s3.p1':
          'The sovrium.com website collects minimal data. We do not use cookies, do not require user accounts, and do not collect personal information through our website. If you believe we hold any personal data about you from your interactions with our website, you may contact us at privacy@sovrium.com to request its deletion.',

        // ── DataDeletion: 4. Confirmation ─────────────────────────────────
        'dataDeletion.s4.title': '4. Data Deletion Confirmation',
        'dataDeletion.s4.p1':
          'When we receive a valid data deletion request for services operated by ESSENTIAL SERVICES:',
        'dataDeletion.s4.item1': '\u2022 We will process your request within 30 days of receipt',
        'dataDeletion.s4.item2':
          '\u2022 We will send you a confirmation once your data has been deleted',
        'dataDeletion.s4.item3':
          '\u2022 Some data may be retained if required by law or legitimate legal obligations',
        'dataDeletion.s4.item4':
          '\u2022 You will receive a confirmation code via email that you can use to verify the status of your deletion request',

        // ── DataDeletion: 5. Contact ──────────────────────────────────────
        'dataDeletion.s5.title': '5. Contact',
        'dataDeletion.s5.intro': 'For data deletion requests or questions about your data:',
        'dataDeletion.s5.item1': '\u2022 Email: privacy@sovrium.com',
        'dataDeletion.s5.item2':
          '\u2022 Company: ESSENTIAL SERVICES, SAS au capital de 10 000 \u20AC',
        'dataDeletion.s5.item3': '\u2022 RCS Paris \u2014 SIREN: 834 241 481',
        'dataDeletion.s5.item4': '\u2022 SIRET: 834 241 481 00029',
        'dataDeletion.s5.item5': '\u2022 TVA: FR04834241481',
        'dataDeletion.s5.item6': '\u2022 Address: 128 Rue La Bo\u00E9tie, 75008 Paris, France',
        'dataDeletion.s5.item7': '\u2022 President: Thomas Jeanneau',
      },
      fr: {
        // ════════════════════════════════════════════════════════════════════
        //  GLOBAL NAVIGATION
        // ════════════════════════════════════════════════════════════════════
        'nav.partners': 'Notre service partenaire',
        'nav.partners.href': '/fr/partners',
        'nav.company': '\u00C0 propos',
        'nav.company.href': '/fr/company',
        'nav.lang.label': 'EN',
        'nav.lang.code': 'en',

        // ════════════════════════════════════════════════════════════════════
        //  GLOBAL FOOTER
        // ════════════════════════════════════════════════════════════════════
        'footer.description':
          'Une plateforme auto-h\u00E9berg\u00E9e et pilot\u00E9e par la configuration qui vous redonne le contr\u00F4le de votre logiciel.',
        'footer.col.product': 'Produit',
        'footer.col.product.docs': 'Documentation',
        'footer.col.product.github': 'GitHub',
        'footer.col.product.license': 'Licence',
        'footer.col.company': 'Entreprise',
        'footer.col.company.about': 'À propos',
        'footer.col.company.about.href': '/fr/company',
        'footer.col.company.partners': 'Notre service partenaire',
        'footer.col.company.partners.href': '/fr/partners',
        'footer.col.company.trademark': 'Marque d\u00E9pos\u00E9e',
        'footer.col.legal': 'L\u00E9gal',
        'footer.col.legal.privacy': 'Politique de confidentialit\u00E9',
        'footer.col.legal.privacy.href': '/fr/privacy-policy',
        'footer.col.legal.terms': 'Conditions d\u2019utilisation',
        'footer.col.legal.terms.href': '/fr/terms-of-service',
        'footer.col.legal.dataDeletion': 'Suppression des donn\u00E9es',
        'footer.col.legal.dataDeletion.href': '/fr/data-deletion',
        'footer.copyright':
          '\u00A9 2025-2026 ESSENTIAL SERVICES. Sovrium\u00AE est une marque enregistr\u00E9e d\u2019ESSENTIAL SERVICES.',

        // ════════════════════════════════════════════════════════════════════
        //  HOME PAGE
        // ════════════════════════════════════════════════════════════════════

        // ── Home: Meta ──────────────────────────────────────────────────────
        'home.meta.title': 'Sovrium \u2014 Cr\u00E9ez des apps par configuration, sans code',
        'home.meta.description':
          'Construisez des applications m\u00E9tier compl\u00E8tes avec un simple fichier de configuration. L\u0027alternative SaaS open-source et auto-h\u00E9berg\u00E9e \u2014 sans d\u00E9pendance fournisseur.',
        'home.meta.og.title': 'Sovrium \u2014 Cr\u00E9ez des apps par configuration, sans code',
        'home.meta.og.description':
          'Plateforme applicative open-source pilot\u00E9e par la configuration. L\u0027alternative SaaS auto-h\u00E9berg\u00E9e, sans d\u00E9pendance fournisseur.',
        'home.meta.twitter.title':
          'Sovrium \u2014 Cr\u00E9ez des apps par configuration, sans code',
        'home.meta.twitter.description':
          'Plateforme applicative open-source pilot\u00E9e par la configuration. L\u0027alternative SaaS auto-h\u00E9berg\u00E9e, sans d\u00E9pendance fournisseur.',

        // ── Home: Hero ──────────────────────────────────────────────────────
        'home.hero.title': 'Sovrium, l\u0027\u00E9l\u00E9ment de souverainet\u00E9',
        'home.hero.subtitle': 'Vos donn\u00E9es. Vos outils. Votre avenir.',
        'home.hero.description':
          'Lib\u00E9rez-vous de la d\u00E9pendance au SaaS gr\u00E2ce \u00E0 une plateforme auto-h\u00E9berg\u00E9e et pilot\u00E9e par la configuration, qui vous redonne le contr\u00F4le.',
        'home.hero.cta.primary': 'Commencer',
        'home.hero.cta.secondary': 'Voir sur GitHub',

        // ── Home: Problem Statement ─────────────────────────────────────────
        'home.problem.title': 'Le pi\u00E8ge du SaaS',
        'home.problem.stat1.value': '10 000 \u20AC+',
        'home.problem.stat1.label': 'D\u00E9pense SaaS annuelle moyenne par employ\u00E9',
        'home.problem.stat2.value': '0%',
        'home.problem.stat2.label':
          'Des donn\u00E9es que vous poss\u00E9dez r\u00E9ellement sur les plateformes SaaS',
        'home.problem.stat3.value': '73%',
        'home.problem.stat3.label':
          'Des entreprises pr\u00E9occup\u00E9es par la d\u00E9pendance fournisseur',
        'home.problem.hidden.title': 'Les co\u00FBts cach\u00E9s de la d\u00E9pendance au SaaS',
        'home.problem.hidden.cost1.title': 'D\u00E9pendance fournisseur \u2014 ',
        'home.problem.hidden.cost1.description':
          'Vos donn\u00E9es, workflows et habitudes d\u2019\u00E9quipe sont pris au pi\u00E8ge dans la plateforme d\u2019un autre.',
        'home.problem.hidden.cost2.title': 'Tarification par utilisateur \u2014 ',
        'home.problem.hidden.cost2.description':
          'Les co\u00FBts augmentent avec les effectifs, pas la valeur. Agrandir votre \u00E9quipe signifie augmenter votre facture SaaS.',
        'home.problem.hidden.cost3.title': 'Surcharge fonctionnelle \u2014 ',
        'home.problem.hidden.cost3.description':
          'Vous payez des milliers de fonctionnalit\u00E9s que vous n\u2019utilisez jamais, tandis que celles dont vous avez besoin sont derri\u00E8re des offres enterprise.',
        'home.problem.hidden.cost4.title': 'Souverainet\u00E9 des donn\u00E9es \u2014 ',
        'home.problem.hidden.cost4.description':
          'Vos donn\u00E9es m\u00E9tier sont sur des serveurs que vous ne contr\u00F4lez pas, dans des juridictions que vous n\u2019avez pas choisies.',
        'home.problem.hidden.cost5.title': 'Taxe d\u2019int\u00E9gration \u2014 ',
        'home.problem.hidden.cost5.description':
          'Connecter des outils SaaS n\u00E9cessite des middlewares, des APIs custom et une maintenance constante.',

        // ── Home: Solution Overview ─────────────────────────────────────────
        'home.solution.title': 'Une config. Une application compl\u00E8te.',
        'home.solution.description':
          'Sovrium transforme un simple fichier de configuration en une application m\u00E9tier compl\u00E8te \u2014 authentification, base de donn\u00E9es, API, pages et panneau d\u2019administration inclus.',
        'home.solution.code.alsoWorks': 'Fonctionne aussi avec des configs YAML et JSON :',
        'home.solution.howItWorks.title': 'Comment \u00E7a marche',
        'home.solution.howItWorks.step1.title': 'Configurer',
        'home.solution.howItWorks.step1.description':
          'D\u00E9finissez votre sch\u00E9ma d\u2019application en TypeScript, YAML ou JSON.',
        'home.solution.howItWorks.step2.title': 'D\u00E9ployer',
        'home.solution.howItWorks.step2.description':
          'Ex\u00E9cutez sur votre serveur, votre cloud, votre portable.',
        'home.solution.howItWorks.step3.title': 'Poss\u00E9der',
        'home.solution.howItWorks.step3.description':
          'Acc\u00E8s complet au code source, contr\u00F4le total des donn\u00E9es.',
        'home.solution.howItWorks.step4.title': '\u00C9voluer',
        'home.solution.howItWorks.step4.description':
          'Ajoutez des fonctionnalit\u00E9s en mettant \u00E0 jour votre config. Sans douleur de migration.',

        // ── Home: Comparison ────────────────────────────────────────────────
        'home.comparison.title': 'Pourquoi ne pas simplement utiliser du SaaS ?',
        'home.comparison.stat1': '90% moins cher que les outils SaaS \u00E9quivalents',
        'home.comparison.stat2': '100% de propri\u00E9t\u00E9 des donn\u00E9es, pour toujours',
        'home.comparison.table.title': 'Sovrium vs SaaS traditionnel',
        'home.comparison.table.header.aspect': 'Aspect',
        'home.comparison.table.row1.aspect': 'Propri\u00E9t\u00E9 des donn\u00E9es',
        'home.comparison.table.row1.sovrium': '\u2705 100% les v\u00F4tres',
        'home.comparison.table.row1.saas': '\u274C Propri\u00E9t\u00E9 du fournisseur',
        'home.comparison.table.row2.aspect': 'Code source',
        'home.comparison.table.row2.sovrium': '\u2705 Acc\u00E8s complet',
        'home.comparison.table.row2.saas': '\u274C Code ferm\u00E9',
        'home.comparison.table.row3.aspect': 'Co\u00FBt mensuel',
        'home.comparison.table.row3.sovrium': '\u2705 Co\u00FBts serveur uniquement',
        'home.comparison.table.row3.saas': '\u274C 50\u2013500+ \u20AC/utilisateur/mois',
        'home.comparison.table.row4.aspect': 'D\u00E9pendance fournisseur',
        'home.comparison.table.row4.sovrium': '\u2705 Z\u00E9ro',
        'home.comparison.table.row4.saas': '\u274C \u00C9lev\u00E9e',
        'home.comparison.table.row5.aspect': 'Personnalisation',
        'home.comparison.table.row5.sovrium': '\u2705 Illimit\u00E9e',
        'home.comparison.table.row5.saas': '\u26A0\uFE0F Limit\u00E9e',
        'home.comparison.table.row6.aspect': 'Contr\u00F4le de version',
        'home.comparison.table.row6.sovrium': '\u2705 Natif Git',
        'home.comparison.table.row6.saas': '\u26A0\uFE0F Limit\u00E9/Aucun',
        'home.comparison.table.row7.aspect': 'Confidentialit\u00E9',
        'home.comparison.table.row7.sovrium': '\u2705 Vos serveurs',
        'home.comparison.table.row7.saas': '\u274C Tiers',

        // ── Home: Use Cases ─────────────────────────────────────────────────
        'home.useCases.title': 'Con\u00E7u pour le travail r\u00E9el',
        'home.useCases.internal.title': 'Outils internes',
        'home.useCases.internal.description':
          'CRM, gestion de projets, suivi d\u2019inventaire \u2014 con\u00E7us sp\u00E9cifiquement pour le fonctionnement de votre \u00E9quipe.',
        'home.useCases.portals.title': 'Portails clients',
        'home.useCases.portals.description':
          'Tableaux de bord s\u00E9curis\u00E9s pour que vos clients consultent des rapports, soumettent des demandes et suivent leur progression.',
        'home.useCases.business.title': 'Applications m\u00E9tier',
        'home.useCases.business.description':
          'Applications personnalis\u00E9es pour des workflows que le SaaS standard ne peut pas g\u00E9rer.',
        'home.useCases.api.title': 'Backends API',
        'home.useCases.api.description':
          'APIs REST avec authentification, validation et base de donn\u00E9es \u2014 z\u00E9ro boilerplate.',
        'home.useCases.static.title': 'Sites statiques',
        'home.useCases.static.description':
          'Pages marketing, sites de documentation et landing pages avec support i18n.',
        'home.useCases.mvp.title': 'MVPs & Prototypes',
        'home.useCases.mvp.description':
          'De l\u2019id\u00E9e au produit fonctionnel en heures, pas en semaines. It\u00E9rez par changements de config.',

        // ── Home: Platform Features ─────────────────────────────────────────
        'home.features.title': 'Tout ce dont vous avez besoin',
        'home.features.subtitle':
          'Une plateforme compl\u00E8te, pas un \u00E9ni\u00E8me framework \u00E0 apprendre.',
        'home.features.auth.title': '\uD83D\uDD10 Authentification',
        'home.features.auth.point1': '\u2022 Email/mot de passe & OAuth social',
        'home.features.auth.point2': '\u2022 Acc\u00E8s par r\u00F4le (admin, membre, lecteur)',
        'home.features.auth.point3': '\u2022 Gestion des sessions',
        'home.features.auth.point4': '\u2022 Authentification \u00E0 deux facteurs',
        'home.features.auth.point5': '\u2022 Support des passkeys',
        'home.features.auth.point6': '\u2022 Champs utilisateur personnalis\u00E9s',
        'home.features.tables.title': '\uD83D\uDDC2\uFE0F Tables & Donn\u00E9es',
        'home.features.tables.point1': '\u2022 15+ types de champs (texte, email, nombre, \u2026)',
        'home.features.tables.point2': '\u2022 API CRUD automatique',
        'home.features.tables.point3': '\u2022 Relations et lookups',
        'home.features.tables.point4': '\u2022 Tri, filtrage, pagination',
        'home.features.tables.point5': '\u2022 Champs formule',
        'home.features.tables.point6': '\u2022 Import/export',
        'home.features.api.title': '\uD83D\uDD0C API Records',
        'home.features.api.point1': '\u2022 Endpoints REST auto-g\u00E9n\u00E9r\u00E9s',
        'home.features.api.point2': '\u2022 Documentation OpenAPI',
        'home.features.api.point3': '\u2022 SDK client typ\u00E9',
        'home.features.api.point4': '\u2022 Filtrage et tri',
        'home.features.api.point5': '\u2022 Op\u00E9rations en masse',
        'home.features.api.point6': '\u2022 Support des webhooks',
        'home.features.pages.title': '\uD83D\uDCBB Pages & UI',
        'home.features.pages.point1': '\u2022 Pages React rendues c\u00F4t\u00E9 serveur',
        'home.features.pages.point2': '\u2022 Biblioth\u00E8que de composants incluse',
        'home.features.pages.point3': '\u2022 Responsive par d\u00E9faut',
        'home.features.pages.point4': '\u2022 Layouts personnalis\u00E9s',
        'home.features.pages.point5': '\u2022 Constructeur de formulaires',
        'home.features.pages.point6': '\u2022 Syst\u00E8me de navigation',
        'home.features.theming.title': '\uD83C\uDFA8 Th\u00E8mes & i18n',
        'home.features.theming.point1': '\u2022 Sch\u00E9mas de couleurs personnalis\u00E9s',
        'home.features.theming.point2': '\u2022 Syst\u00E8me typographique',
        'home.features.theming.point3': '\u2022 Support du mode sombre',
        'home.features.theming.point4': '\u2022 Multi-langue (i18n)',
        'home.features.theming.point5': '\u2022 Th\u00E9matisation par variables CSS',
        'home.features.theming.point6': '\u2022 Design coh\u00E9rent avec votre marque',
        'home.features.admin.title': '\u2699\uFE0F Admin & Op\u00E9rations',
        'home.features.admin.point1': '\u2022 Tableau de bord admin',
        'home.features.admin.point2': '\u2022 Gestion des utilisateurs',
        'home.features.admin.point3': '\u2022 Journaux d\u2019activit\u00E9',
        'home.features.admin.point4': '\u2022 Studio base de donn\u00E9es',
        'home.features.admin.point5': '\u2022 Outils CLI',
        'home.features.admin.point6': '\u2022 Monitoring de sant\u00E9',

        // ── Home: Tech Stack ────────────────────────────────────────────────
        'home.techStack.title': 'Stack moderne. Sans compromis.',
        'home.techStack.subtitle':
          'Construit sur des technologies \u00E9prouv\u00E9es choisies pour la performance, la fiabilit\u00E9 et l\u2019exp\u00E9rience d\u00E9veloppeur.',

        // ── Home: Getting Started ───────────────────────────────────────────
        'home.gettingStarted.title': 'D\u00E9marrez en quelques minutes',
        'home.gettingStarted.step1.title': 'Installer',
        'home.gettingStarted.step2.title': 'Configurer',
        'home.gettingStarted.step2.description':
          'D\u00E9finissez votre sch\u00E9ma d\u2019app dans un fichier de config',
        'home.gettingStarted.step3.title': 'Lancer',
        'home.gettingStarted.step4.title': 'Personnaliser',
        'home.gettingStarted.step4.description':
          'Ajoutez des tables, pages, auth \u2014 le tout par configuration',
        'home.gettingStarted.status.title': 'Acc\u00E8s anticipé',
        'home.gettingStarted.status.description':
          'Sovrium est en d\u00E9veloppement actif. Mettez une \u00E9toile au repo et suivez la construction de l\u2019avenir des applications auto-h\u00E9berg\u00E9es.',
        'home.gettingStarted.status.cta': '\u00C9toiler sur GitHub',

        // ════════════════════════════════════════════════════════════════════
        //  PARTNERS PAGE
        // ════════════════════════════════════════════════════════════════════

        // ── Partners: Meta ──────────────────────────────────────────────────
        'partners.meta.title': 'Sovrium Partners - Solutions logicielles sur mesure',
        'partners.meta.description':
          'ESSENTIAL SERVICES con\u00E7oit des solutions logicielles sur mesure avec Sovrium. 50+ clients, 200+ outils cr\u00E9\u00E9s, 10 000+ heures \u00E9conomis\u00E9es.',
        'partners.meta.og.title': 'Sovrium Partners - Solutions logicielles sur mesure',
        'partners.meta.og.description':
          'Des solutions sur mesure pour vos d\u00E9fis logiciels. Construites sur Sovrium, d\u00E9ploy\u00E9es sur votre infrastructure.',
        'partners.meta.twitter.title': 'Sovrium Partners - Solutions logicielles sur mesure',
        'partners.meta.twitter.description':
          'Des solutions sur mesure pour vos d\u00E9fis logiciels. Construites avec Sovrium.',

        // ── Partners: Hero ──────────────────────────────────────────────────
        'partners.hero.title': 'Des solutions sur mesure pour vos d\u00E9fis logiciels',
        'partners.hero.subtitle':
          'Nous concevons, construisons et maintenons des outils internes, des solutions pilot\u00E9es par l\u2019IA et des workflows automatis\u00E9s sur votre infrastructure. Aucun vendor lock-in, aucune facture surprise \u2014 juste du logiciel qui fonctionne pour votre \u00E9quipe.',
        'partners.hero.cta.primary': 'Rejoindre la liste d\u2019attente',
        'partners.hero.cta.secondary': 'Notre m\u00E9thodologie',

        // ── Partners: Trusted By ────────────────────────────────────────────
        'partners.trust.title': 'Ils nous font confiance',

        // ── Partners: Stats ─────────────────────────────────────────────────
        'partners.stats.title': 'Un parcours \u00E9prouv\u00E9',
        'partners.stats.clients.stat': '50+',
        'partners.stats.clients.title': 'Clients accompagn\u00E9s',
        'partners.stats.clients.description':
          'Startups, PME et grands groupes nous font confiance pour optimiser leurs op\u00E9rations avec des outils sur mesure.',
        'partners.stats.tools.stat': '200+',
        'partners.stats.tools.title': 'Outils construits',
        'partners.stats.tools.description':
          'Des tableaux de bord internes aux applications m\u00E9tier compl\u00E8tes, adapt\u00E9s aux workflows de chaque client.',
        'partners.stats.hours.stat': '10 000+',
        'partners.stats.hours.title': 'Heures \u00E9conomis\u00E9es',
        'partners.stats.hours.description':
          'En automatisant les t\u00E2ches r\u00E9p\u00E9titives et en consolidant les outils \u00E9parpill\u00E9s en plateformes coh\u00E9rentes.',

        // ── Partners: Process (5 steps) ─────────────────────────────────────
        'partners.process.title': 'Notre processus',
        'partners.process.subtitle':
          'Une approche en 5 \u00E9tapes \u00E9prouv\u00E9e pour livrer un logiciel parfaitement adapt\u00E9 \u00E0 vos besoins.',
        'partners.process.step1.title': '\u00C9couter',
        'partners.process.step1.description':
          'Comprendre vos workflows, points de friction et objectifs lors de sessions de d\u00E9couverte approfondies.',
        'partners.process.step2.title': 'Conseiller',
        'partners.process.step2.description':
          'Concevoir l\u2019architecture de solution optimale en fonction de vos contraintes et objectifs sp\u00E9cifiques.',
        'partners.process.step3.title': 'D\u00E9velopper',
        'partners.process.step3.description':
          'Construire avec Sovrium sur votre infrastructure. Code propre, test\u00E9, d\u00E9ploy\u00E9 selon vos conditions.',
        'partners.process.step4.title': 'Ajuster',
        'partners.process.step4.description':
          'It\u00E9rer en fonction de l\u2019usage r\u00E9el et des retours. Nous affinons jusqu\u2019\u00E0 ce que ce soit parfait.',
        'partners.process.step5.title': 'Maintenir',
        'partners.process.step5.description':
          'Support continu et \u00E9volution au fil de vos besoins. Nous restons \u00E0 vos c\u00F4t\u00E9s sur le long terme.',

        // ── Partners: Methodology (13 principles) ──────────────────────────
        'partners.methodology.title': 'Notre m\u00E9thodologie',
        'partners.methodology.subtitle': '10 principes qui guident chaque projet que nous livrons.',
        'partners.methodology.1.title':
          '\u2699\uFE0F Nous automatisons les processus, construisons des outils internes et exploitons l\u2019IA pour amplifier votre \u00E9quipe',
        'partners.methodology.1.description':
          'Nous analysons vos workflows pour identifier les t\u00E2ches r\u00E9p\u00E9titives, concevons des automatisations de bout en bout et int\u00E9grons l\u2019IA l\u00E0 o\u00F9 elle acc\u00E9l\u00E8re la livraison.',
        'partners.methodology.2.title':
          '\uD83D\uDCAC Nous sommes disponibles pour r\u00E9pondre \u00E0 vos questions, besoins et support technique',
        'partners.methodology.2.description':
          'Notre \u00E9quipe est l\u00E0 pour comprendre vos besoins sp\u00E9cifiques et vous accompagner dans vos projets.',
        'partners.methodology.3.title':
          '\uD83E\uDD47 Nous utilisons le meilleur du Code, du No Code et de l\u2019IA',
        'partners.methodology.3.description':
          'Nous combinons le code traditionnel, les plateformes No Code et les outils d\u2019IA pour d\u00E9livrer la bonne solution \u00E0 chaque cas d\u2019usage.',
        'partners.methodology.4.title':
          '\uD83D\uDCBB Nous travaillons \u00E0 distance et de mani\u00E8re asynchrone, en utilisant la visioconf\u00E9rence lorsque n\u00E9cessaire',
        'partners.methodology.4.description':
          'Notre approche du travail \u00E0 distance repose sur une communication claire et efficace.',
        'partners.methodology.5.title':
          '\u23F1\uFE0F Vous payez le temps que nous consacrons \u00E0 toutes vos demandes',
        'partners.methodology.5.description':
          'Notre syst\u00E8me de facturation est transparent et bas\u00E9 sur le temps r\u00E9ellement pass\u00E9 sur vos projets.',
        'partners.methodology.6.title': '\u274C Nous ne faisons pas de devis',
        'partners.methodology.6.description':
          'Nous pr\u00E9f\u00E9rons une approche pragmatique bas\u00E9e sur l\u2019action plut\u00F4t que sur des pr\u00E9dictions approximatives.',
        'partners.methodology.7.title':
          '\uD83D\uDC8E Nous prenons le temps de faire un travail de qualit\u00E9, en nous concentrant sur ce qui compte',
        'partners.methodology.7.description':
          'Notre engagement envers la qualit\u00E9 guide chaque aspect de notre travail.',
        'partners.methodology.8.title':
          '\uD83C\uDFE1 Vous \u00EAtes propri\u00E9taire de tout ce que nous d\u00E9veloppons pour vous',
        'partners.methodology.8.description':
          'Tout le code, les applications et les solutions d\u00E9velopp\u00E9s dans le cadre de nos services vous appartiennent enti\u00E8rement.',
        'partners.methodology.9.title':
          '\uD83D\uDD4A\uFE0F Vous n\u2019\u00EAtes engag\u00E9 \u00E0 rien',
        'partners.methodology.9.description':
          'Notre approche flexible vous permet de travailler avec nous selon vos besoins, sans engagement contractuel \u00E0 long terme.',
        'partners.methodology.10.title': '\u2764\uFE0F Nous prenons soin de vous',
        'partners.methodology.10.description':
          'Votre satisfaction est notre priorit\u00E9. Nous ne livrons pas seulement un projet : nous nous engageons \u00E0 vous accompagner \u00E0 chaque \u00E9tape.',

        // ── Partners: Testimonials (exact LTF Engine quotes) ────────────────
        'partners.testimonials.title': 'Ce que disent nos clients',
        'partners.testimonials.1.quote':
          'Un travail tr\u00E8s satisfaisant, c\u2019est une exp\u00E9rience tr\u00E8s positive et enrichissante. L\u2019\u00E9quipe La Tech Force nous a aid\u00E9s \u00E0 monter rapidement en comp\u00E9tence.',
        'partners.testimonials.1.author': 'Marco PERONE',
        'partners.testimonials.1.role': 'Co-fondateur chez CAPITAL PV',
        'partners.testimonials.2.quote':
          'Un accompagnement excellent, une grande r\u00E9activit\u00E9 et disponibilit\u00E9 de l\u2019\u00E9quipe, des livrables de grande qualit\u00E9, des suggestions proactives.',
        'partners.testimonials.2.author': 'Simon SALLANDRE',
        'partners.testimonials.2.role': 'Directeur des op\u00E9rations chez AGORASTORE',
        'partners.testimonials.3.quote':
          '\u00C9quipe comp\u00E9tente & travail efficace. J\u2019ai beaucoup appris et d\u00E9velopp\u00E9 une meilleure compr\u00E9hension de la logique d\u2019automatisation.',
        'partners.testimonials.3.author': 'Mbemba DANSOKO',
        'partners.testimonials.3.role': 'Co-fondateur chez ACTIVPRENEUR',
        'partners.testimonials.4.quote':
          'Une tr\u00E8s belle collaboration, nous avons pu faire un bond de g\u00E9ant et un accompagnement sur plusieurs domaines m\u00E9tiers.',
        'partners.testimonials.4.author': 'Meryem BENMOUAZ',
        'partners.testimonials.4.role': 'Co-fondatrice chez LINTENDANCE',

        // ── Partners: Waitlist CTA ──────────────────────────────────────────
        'partners.waitlist.title': 'Boostez votre \u00E9quipe',
        'partners.waitlist.description':
          'Nous travaillons avec un nombre limit\u00E9 de clients pour garantir la qualit\u00E9. Rejoignez notre liste d\u2019attente pour \u00EAtre inform\u00E9 d\u00E8s qu\u2019une place se lib\u00E8re.',
        'partners.waitlist.cta': 'Rejoindre la liste d\u2019attente',

        // ════════════════════════════════════════════════════════════════════
        //  COMPANY PAGE
        // ════════════════════════════════════════════════════════════════════

        // ── Company: Meta ──────────────────────────────────────────────────
        'company.meta.title': 'Sovrium \u2014 Entreprise',
        'company.meta.description':
          'D\u00E9couvrez la vision, les valeurs et l\u2019\u00E9quipe derri\u00E8re Sovrium. Construire la souverainet\u00E9 num\u00E9rique pour chaque organisation.',
        'company.meta.og.title': 'Sovrium \u2014 Entreprise',
        'company.meta.og.description':
          'La vision, les valeurs et l\u2019\u00E9quipe derri\u00E8re Sovrium. La souverainet\u00E9 num\u00E9rique pour chaque organisation.',
        'company.meta.twitter.title': 'Sovrium \u2014 Entreprise',
        'company.meta.twitter.description':
          'La vision, les valeurs et l\u2019\u00E9quipe derri\u00E8re Sovrium. La souverainet\u00E9 num\u00E9rique pour chaque organisation.',

        // ── Company: Hero ──────────────────────────────────────────────────
        'company.hero.eyebrow': 'ESSENTIAL SERVICES',
        'company.hero.title': 'Construire la souverainet\u00E9 num\u00E9rique',
        'company.hero.subtitle':
          'Nous croyons que chaque organisation m\u00E9rite de poss\u00E9der son logiciel, ses donn\u00E9es et son avenir. Sovrium est la plateforme qui le rend possible.',
        'company.hero.tagline': '\u00AB Vos donn\u00E9es. Vos outils. Votre avenir. \u00BB',

        // ── Company: Mission ───────────────────────────────────────────────
        'company.mission.title': 'Notre Mission',
        'company.mission.description':
          'Les organisations modernes sont submerg\u00E9es par les d\u00E9pendances SaaS \u2014 payant des frais mensuels, perdant le contr\u00F4le de leurs donn\u00E9es et adaptant leur activit\u00E9 aux limitations des fournisseurs. Nous construisons l\u2019alternative.',
        'company.mission.statement':
          'Rendre chaque organisation souveraine dans ses syst\u00E8mes d\u2019information \u2014 libre de toute d\u00E9pendance SaaS, en contr\u00F4le total de ses donn\u00E9es, et capable de construire des applications m\u00E9tier par la configuration-as-code.',

        // ── Company: Values ────────────────────────────────────────────────
        'company.values.title': 'Nos Valeurs',
        'company.values.subtitle':
          'Les principes qui guident chaque d\u00E9cision que nous prenons, de l\u2019architecture du code \u00E0 l\u2019engagement communautaire.',
        'company.values.sovereignty.icon': '\uD83D\uDEE1\uFE0F',
        'company.values.sovereignty.title': 'Souverainet\u00E9 num\u00E9rique',
        'company.values.sovereignty.description':
          'Les organisations doivent poss\u00E9der leurs syst\u00E8mes d\u2019information, pas les louer. Vos donn\u00E9es, votre infrastructure, vos r\u00E8gles.',
        'company.values.transparency.icon': '\uD83D\uDD0D',
        'company.values.transparency.title': 'Transparence radicale',
        'company.values.transparency.description':
          'Code source disponible, feuille de route ouverte, communication honn\u00EAte. Pas d\u2019agendas cach\u00E9s, pas de prix surprise, pas de d\u00E9pendance fournisseur.',
        'company.values.openSource.icon': '\uD83C\uDF10',
        'company.values.openSource.title': 'Esprit open source',
        'company.values.openSource.description':
          'Construit sur des standards ouverts et des technologies open source. Contribuant \u00E0 l\u2019\u00E9cosyst\u00E8me qui nous permet d\u2019exister.',
        'company.values.simplicity.icon': '\u2728',
        'company.values.simplicity.title': 'Simplicit\u00E9 \u00E9l\u00E9gante',
        'company.values.simplicity.description':
          'Les probl\u00E8mes complexes m\u00E9ritent des solutions simples. Un fichier de config, une commande, une plateforme \u2014 sans complexit\u00E9 inutile.',
        'company.values.ownership.icon': '\uD83C\uDFE1',
        'company.values.ownership.title': 'V\u00E9ritable propri\u00E9t\u00E9',
        'company.values.ownership.description':
          'Tout ce que nous construisons pour vous vous appartient. Acc\u00E8s complet au source, portabilit\u00E9 totale des donn\u00E9es, z\u00E9ro d\u00E9pendance.',
        'company.values.longTerm.icon': '\uD83C\uDF31',
        'company.values.longTerm.title': 'Vision long terme',
        'company.values.longTerm.description':
          'Nous construisons pour la durabilit\u00E9, pas pour les tendances. Sovrium est con\u00E7u pour grandir avec votre organisation pendant des ann\u00E9es.',

        // ── Company: Principles ────────────────────────────────────────────
        'company.principles.title': 'Comment nous construisons',
        'company.principles.subtitle':
          'Cinq principes fondamentaux fa\u00E7onnent les d\u00E9cisions techniques derri\u00E8re Sovrium.',
        'company.principles.configOverCode.title': 'La configuration plut\u00F4t que le code',
        'company.principles.configOverCode.description':
          'Les applications m\u00E9tier doivent \u00EAtre configur\u00E9es, pas programm\u00E9es. TypeScript, YAML ou JSON \u2014 choisissez votre format, obtenez une app compl\u00E8te en secondes.',
        'company.principles.minimalDeps.title': 'D\u00E9pendances minimales',
        'company.principles.minimalDeps.description':
          'Un runtime (Bun), une base de donn\u00E9es (PostgreSQL), z\u00E9ro SDK fournisseur. R\u00E9duisez votre surface de d\u00E9pendance \u00E0 l\u2019infrastructure essentielle.',
        'company.principles.businessFocus.title': 'Orient\u00E9 m\u00E9tier',
        'company.principles.businessFocus.description':
          'Les ing\u00E9nieurs doivent se concentrer sur la logique m\u00E9tier, pas l\u2019infrastructure. Sovrium g\u00E8re l\u2019auth, la base de donn\u00E9es, l\u2019API et l\u2019UI nativement.',
        'company.principles.configReuse.title': 'R\u00E9utilisabilit\u00E9 des configurations',
        'company.principles.configReuse.description':
          'Les templates de configuration deviennent des actifs organisationnels. Construisez CRM, outils projet et portails \u00E0 partir de configs composables et versionn\u00E9es.',

        // ── Company: Team ──────────────────────────────────────────────────
        'company.team.title': 'L\u2019\u00E9quipe',
        'company.team.subtitle':
          'Sovrium est construit par ESSENTIAL SERVICES, une entreprise d\u00E9di\u00E9e \u00E0 donner aux organisations le contr\u00F4le de leur logiciel.',
        'company.team.founder.name': 'Thomas Jeanneau',
        'company.team.founder.role': 'Fondateur & CEO',
        'company.team.founder.bio':
          'Ing\u00E9nieur logiciel et entrepreneur avec 8 ans d\u2019expérience, passionn\u00E9 par la cr\u00E9ation d\u2019outils qui autonomisent les organisations. A pr\u00E9c\u00E9demment construit des outils d\u2019automatisation pour plus de 50 clients en France et en Europe.',

        // ── Company: CTA ───────────────────────────────────────────────────
        'company.cta.title': 'Rejoignez le mouvement',
        'company.cta.description':
          'Sovrium est open source et en d\u00E9veloppement actif. Mettez une \u00E9toile au repo, contribuez du code, ou construisez avec nous.',
        'company.cta.github': 'Voir sur GitHub',
        'company.cta.partners': 'Travailler avec nous',
        'company.cta.partners.href': '/fr/partners',

        // ════════════════════════════════════════════════════════════════════
        //  TERMS OF SERVICE PAGE
        // ════════════════════════════════════════════════════════════════════

        // ── Terms: Meta ───────────────────────────────────────────────────
        'terms.meta.title': 'Conditions d\u2019utilisation - Sovrium',
        'terms.meta.description':
          'Conditions d\u2019utilisation et informations de licence pour Sovrium, la plateforme auto-h\u00E9berg\u00E9e pilot\u00E9e par la configuration.',
        'terms.meta.og.title': 'Conditions d\u2019utilisation - Sovrium',
        'terms.meta.og.description':
          'Conditions d\u2019utilisation et informations de licence pour Sovrium, la plateforme auto-h\u00E9berg\u00E9e pilot\u00E9e par la configuration par ESSENTIAL SERVICES.',
        'terms.meta.twitter.title': 'Conditions d\u2019utilisation - Sovrium',
        'terms.meta.twitter.description':
          'Conditions d\u2019utilisation et informations de licence pour Sovrium, la plateforme auto-h\u00E9berg\u00E9e pilot\u00E9e par la configuration par ESSENTIAL SERVICES.',

        // ── Terms: Header ─────────────────────────────────────────────────
        'terms.header.title': 'Conditions d\u2019utilisation',
        'terms.header.lastUpdated': 'Derni\u00E8re mise \u00E0 jour\u00A0: 20 f\u00E9vrier 2026',

        // ── Terms: 1. Agreement ───────────────────────────────────────────
        'terms.s1.title': '1. Acceptation des conditions',
        'terms.s1.p1':
          'En acc\u00E9dant ou en utilisant le logiciel Sovrium, le site web ou tout service associ\u00E9 (collectivement, les \u00AB\u00A0Services\u00A0\u00BB), vous acceptez d\u2019\u00EAtre li\u00E9 par les pr\u00E9sentes Conditions d\u2019utilisation (\u00AB\u00A0Conditions\u00A0\u00BB) et par toutes les lois et r\u00E9glementations applicables. Si vous n\u2019acceptez pas ces Conditions, vous ne pouvez pas utiliser nos Services.',

        // ── Terms: 2. Software License ────────────────────────────────────
        'terms.s2.title': '2. Licence logicielle',
        'terms.s2.p1':
          'Sovrium est distribu\u00E9 sous la Business Source License 1.1 (BSL 1.1). Les termes complets de la licence sont disponibles dans le fichier LICENSE.md du d\u00E9p\u00F4t source.',
        'terms.s2.permitted.title': '2.1 Utilisations autoris\u00E9es',
        'terms.s2.permitted.intro': 'Vous pouvez utiliser Sovrium pour\u00A0:',
        'terms.s2.permitted.item1': '\u2713 Usage interne au sein de votre organisation',
        'terms.s2.permitted.item2': '\u2713 Projets personnels et d\u00E9veloppement',
        'terms.s2.permitted.item3': '\u2713 Objectifs \u00E9ducatifs et acad\u00E9miques',
        'terms.s2.permitted.item4': '\u2713 D\u00E9ploiements clients non concurrents',
        'terms.s2.permitted.item5':
          '\u2713 Cr\u00E9ation d\u2019applications pour votre propre usage ou vos clients directs',
        'terms.s2.prohibited.title': '2.2 Utilisations interdites',
        'terms.s2.prohibited.intro': 'Sans licence commerciale, vous ne pouvez PAS\u00A0:',
        'terms.s2.prohibited.item1':
          '\u274C Proposer Sovrium comme service h\u00E9berg\u00E9 ou g\u00E9r\u00E9 commercial \u00E0 des tiers',
        'terms.s2.prohibited.item2':
          '\u274C Cr\u00E9er une offre SaaS concurrente bas\u00E9e sur Sovrium',
        'terms.s2.prohibited.item3':
          '\u274C Revendre, sous-licencier ou distribuer Sovrium comme produit commercial',
        'terms.s2.prohibited.item4':
          '\u274C Supprimer ou modifier les mentions de droits d\u2019auteur ou les termes de licence',
        'terms.s2.changeDate.title': '2.3 Date de changement',
        'terms.s2.changeDate.p1':
          'Le 1er janvier 2029, la licence BSL 1.1 se convertira automatiquement en Apache License 2.0, rendant Sovrium enti\u00E8rement open source.',
        'terms.s2.commercial.title': '2.4 Licence commerciale',
        'terms.s2.commercial.p1':
          'Pour l\u2019h\u00E9bergement commercial, les services g\u00E9r\u00E9s ou les cas d\u2019usage concurrentiels, veuillez contacter license@sovrium.com pour obtenir une licence commerciale.',

        // ── Terms: 3. Trademark ───────────────────────────────────────────
        'terms.s3.title': '3. Marque et image de marque',
        'terms.s3.p1':
          'Sovrium\u00AE est une marque d\u00E9pos\u00E9e d\u2019ESSENTIAL SERVICES, enregistr\u00E9e aupr\u00E8s de l\u2019Institut National de la Propri\u00E9t\u00E9 Industrielle (INPI) en France sous le num\u00E9ro d\u2019enregistrement FR5200287.',
        'terms.s3.p2':
          'L\u2019enregistrement de la marque peut \u00EAtre v\u00E9rifi\u00E9 sur le registre public de l\u2019INPI\u00A0:',
        'terms.s3.mayIntro': 'Vous pouvez\u00A0:',
        'terms.s3.may1':
          '\u2713 Indiquer que votre application est \u00AB\u00A0Powered by Sovrium\u00A0\u00BB',
        'terms.s3.may2':
          '\u2713 Utiliser le nom Sovrium dans des d\u00E9clarations factuelles sur le logiciel',
        'terms.s3.may3': '\u2713 Inclure Sovrium dans la documentation technique',
        'terms.s3.mayNotIntro': 'Vous ne pouvez PAS\u00A0:',
        'terms.s3.mayNot1':
          '\u274C Utiliser Sovrium dans le nom de votre produit sans autorisation',
        'terms.s3.mayNot2': '\u274C Impliquer une approbation d\u2019ESSENTIAL SERVICES',
        'terms.s3.mayNot3': '\u274C Modifier le logo Sovrium sans autorisation',
        'terms.s3.guidelinesNote':
          'Pour les directives d\u00E9taill\u00E9es sur la marque, consultez TRADEMARK.md dans le d\u00E9p\u00F4t source.',

        // ── Terms: 4. Warranty ────────────────────────────────────────────
        'terms.s4.title': '4. Exclusion de garantie',
        'terms.s4.p1':
          'LE LOGICIEL EST FOURNI \u00AB\u00A0TEL QUEL\u00A0\u00BB, SANS GARANTIE D\u2019AUCUNE SORTE, EXPRESSE OU IMPLICITE, Y COMPRIS MAIS SANS S\u2019Y LIMITER LES GARANTIES DE QUALIT\u00C9 MARCHANDE, D\u2019AD\u00C9QUATION \u00C0 UN USAGE PARTICULIER ET D\u2019ABSENCE DE CONTREFA\u00C7ON.',
        'terms.s4.p2': 'ESSENTIAL SERVICES ne garantit pas que\u00A0:',
        'terms.s4.item1': '\u2022 Le logiciel r\u00E9pondra \u00E0 vos besoins',
        'terms.s4.item2': '\u2022 Le logiciel fonctionnera sans interruption ou sans erreur',
        'terms.s4.item3': '\u2022 Les d\u00E9fauts seront corrig\u00E9s',
        'terms.s4.item4': '\u2022 Le logiciel est exempt de vuln\u00E9rabilit\u00E9s',

        // ── Terms: 5. Liability ───────────────────────────────────────────
        'terms.s5.title': '5. Limitation de responsabilit\u00E9',
        'terms.s5.p1':
          'EN AUCUN CAS ESSENTIAL SERVICES, SES DIRIGEANTS, ADMINISTRATEURS, EMPLOY\u00C9S OU AGENTS NE POURRONT \u00CATRE TENUS RESPONSABLES DE TOUT DOMMAGE INDIRECT, ACCESSOIRE, SP\u00C9CIAL, CONS\u00C9CUTIF OU PUNITIF, Y COMPRIS SANS LIMITATION LA PERTE DE PROFITS, DE DONN\u00C9ES, D\u2019UTILISATION OU D\u2019AUTRES PERTES INTANGIBLES.',
        'terms.s5.p2':
          'Cette limitation s\u2019applique m\u00EAme si ESSENTIAL SERVICES a \u00E9t\u00E9 inform\u00E9 de la possibilit\u00E9 de tels dommages.',

        // ── Terms: 6. Indemnification ─────────────────────────────────────
        'terms.s6.title': '6. Indemnisation',
        'terms.s6.p1':
          'Vous acceptez d\u2019indemniser et de d\u00E9gager ESSENTIAL SERVICES de toute responsabilit\u00E9 en cas de r\u00E9clamations, dommages, pertes, responsabilit\u00E9s et d\u00E9penses (y compris les frais juridiques) r\u00E9sultant de\u00A0:',
        'terms.s6.item1': '\u2022 Votre utilisation du logiciel',
        'terms.s6.item2': '\u2022 Votre violation de ces Conditions',
        'terms.s6.item3': '\u2022 Votre violation des droits de tiers',
        'terms.s6.item4': '\u2022 Vos applications construites avec Sovrium',

        // ── Terms: 7. Modifications ───────────────────────────────────────
        'terms.s7.title': '7. Modifications des conditions',
        'terms.s7.p1':
          'Nous nous r\u00E9servons le droit de modifier ces Conditions \u00E0 tout moment. Les modifications prendront effet imm\u00E9diatement apr\u00E8s leur publication sur le site web. Votre utilisation continue des Services apr\u00E8s les modifications constitue une acceptation des Conditions modifi\u00E9es.',

        // ── Terms: 8. Termination ─────────────────────────────────────────
        'terms.s8.title': '8. R\u00E9siliation',
        'terms.s8.p1':
          'Nous pouvons r\u00E9silier ou suspendre votre acc\u00E8s aux Services imm\u00E9diatement, sans pr\u00E9avis, pour toute raison, y compris\u00A0:',
        'terms.s8.item1': '\u2022 Violation de ces Conditions',
        'terms.s8.item2': '\u2022 Violation de la licence BSL 1.1',
        'terms.s8.item3': '\u2022 Utilisation commerciale non autoris\u00E9e',
        'terms.s8.item4': '\u2022 Utilisation nuisible ou malveillante',

        // ── Terms: 9. Governing Law ───────────────────────────────────────
        'terms.s9.title': '9. Droit applicable',
        'terms.s9.p1':
          'Les pr\u00E9sentes Conditions sont r\u00E9gies par et interpr\u00E9t\u00E9es conform\u00E9ment au droit fran\u00E7ais, sans \u00E9gard \u00E0 ses dispositions en mati\u00E8re de conflit de lois. Tout litige sera r\u00E9solu devant les tribunaux fran\u00E7ais.',

        // ── Terms: 10. Severability ───────────────────────────────────────
        'terms.s10.title': '10. Divisibilit\u00E9',
        'terms.s10.p1':
          'Si une disposition des pr\u00E9sentes Conditions est jug\u00E9e invalide ou inapplicable, les dispositions restantes continueront de produire pleinement leurs effets.',

        // ── Terms: 11. Entire Agreement ───────────────────────────────────
        'terms.s11.title': '11. Int\u00E9gralit\u00E9 de l\u2019accord',
        'terms.s11.p1':
          'Les pr\u00E9sentes Conditions, conjointement avec la licence BSL 1.1 et tout accord de licence commerciale, constituent l\u2019int\u00E9gralit\u00E9 de l\u2019accord entre vous et ESSENTIAL SERVICES concernant l\u2019utilisation de Sovrium.',

        // ── Terms: 12. User Data ──────────────────────────────────────────
        'terms.s12.title': '12. Donn\u00E9es utilisateur et confidentialit\u00E9',
        'terms.s12.p1':
          'Votre utilisation de Sovrium peut impliquer la collecte, le traitement et le stockage de donn\u00E9es personnelles. Notre gestion des donn\u00E9es personnelles est r\u00E9gie par notre Politique de confidentialit\u00E9, disponible sur sovrium.com/privacy-policy.',
        'terms.s12.p2':
          'Pour les installations auto-h\u00E9berg\u00E9es, l\u2019organisation exploitant l\u2019instance Sovrium est le responsable du traitement des donn\u00E9es et est responsable de la conformit\u00E9 aux lois applicables en mati\u00E8re de protection des donn\u00E9es (ex.\u00A0: RGPD). ESSENTIAL SERVICES n\u2019acc\u00E8de pas, ne traite pas et ne stocke pas les donn\u00E9es des installations auto-h\u00E9berg\u00E9es.',
        'terms.s12.p3':
          'Vous pouvez demander la suppression de vos donn\u00E9es personnelles conform\u00E9ment \u00E0 notre politique de suppression des donn\u00E9es sur sovrium.com/data-deletion.',

        // ── Terms: 13. Contact ────────────────────────────────────────────
        'terms.s13.title': '13. Coordonn\u00E9es',
        'terms.s13.intro': 'Pour toute question concernant ces Conditions ou la licence\u00A0:',
        'terms.s13.item1': '\u2022 Questions de licence\u00A0: license@sovrium.com',
        'terms.s13.item2': '\u2022 Questions g\u00E9n\u00E9rales\u00A0: GitHub Issues',
        'terms.s13.item3':
          '\u2022 Soci\u00E9t\u00E9\u00A0: ESSENTIAL SERVICES, SAS au capital de 10\u00A0000\u00A0\u20AC',
        'terms.s13.item4': '\u2022 RCS Paris \u2014 SIREN\u00A0: 834 241 481',
        'terms.s13.item5': '\u2022 SIRET\u00A0: 834 241 481 00029',
        'terms.s13.item6': '\u2022 TVA\u00A0: FR04834241481',
        'terms.s13.item7': '\u2022 Adresse\u00A0: 128 Rue La Bo\u00E9tie, 75008 Paris, France',
        'terms.s13.item8': '\u2022 Pr\u00E9sident\u00A0: Thomas Jeanneau',
        'terms.s13.item9': '\u2022 Site web\u00A0: sovrium.com',

        // ── Terms: Notice ─────────────────────────────────────────────────
        'terms.notice.title': '\u26A0\uFE0F Avis important',
        'terms.notice.p1':
          'En t\u00E9l\u00E9chargeant, installant ou utilisant Sovrium, vous reconnaissez avoir lu, compris et accept\u00E9 d\u2019\u00EAtre li\u00E9 par les pr\u00E9sentes Conditions d\u2019utilisation et la Business Source License 1.1.',

        // ════════════════════════════════════════════════════════════════════
        //  PRIVACY POLICY PAGE
        // ════════════════════════════════════════════════════════════════════

        // ── Privacy: Meta ─────────────────────────────────────────────────
        'privacy.meta.title': 'Politique de confidentialit\u00E9 - Sovrium',
        'privacy.meta.description':
          'Politique de confidentialit\u00E9 pour Sovrium, la plateforme auto-h\u00E9berg\u00E9e pilot\u00E9e par la configuration par ESSENTIAL SERVICES.',
        'privacy.meta.og.title': 'Politique de confidentialit\u00E9 - Sovrium',
        'privacy.meta.og.description':
          'Politique de confidentialit\u00E9 pour Sovrium, la plateforme auto-h\u00E9berg\u00E9e pilot\u00E9e par la configuration par ESSENTIAL SERVICES.',
        'privacy.meta.twitter.title': 'Politique de confidentialit\u00E9 - Sovrium',
        'privacy.meta.twitter.description':
          'Politique de confidentialit\u00E9 pour Sovrium, la plateforme auto-h\u00E9berg\u00E9e pilot\u00E9e par la configuration par ESSENTIAL SERVICES.',

        // ── Privacy: Header ───────────────────────────────────────────────
        'privacy.header.title': 'Politique de confidentialit\u00E9',
        'privacy.header.lastUpdated': 'Derni\u00E8re mise \u00E0 jour\u00A0: 20 f\u00E9vrier 2026',

        // ── Privacy: 1. Introduction ──────────────────────────────────────
        'privacy.s1.title': '1. Introduction',
        'privacy.s1.p1':
          'ESSENTIAL SERVICES (\u00AB\u00A0nous\u00A0\u00BB, \u00AB\u00A0notre\u00A0\u00BB) respecte votre vie priv\u00E9e. La pr\u00E9sente Politique de confidentialit\u00E9 explique comment nous collectons, utilisons et prot\u00E9geons les informations li\u00E9es \u00E0 sovrium.com (le \u00AB\u00A0Site\u00A0\u00BB) et au logiciel Sovrium (le \u00AB\u00A0Logiciel\u00A0\u00BB).',
        'privacy.s1.p2':
          'Sovrium est con\u00E7u avec la souverainet\u00E9 num\u00E9rique \u00E0 l\u2019esprit. En tant que plateforme auto-h\u00E9berg\u00E9e, nous croyons que vos donn\u00E9es doivent rester sous votre contr\u00F4le.',

        // ── Privacy: 2. Data Collection ───────────────────────────────────
        'privacy.s2.title': '2. Collecte de donn\u00E9es',
        'privacy.s2.analytics.title': '2.1 Analyse du site web',
        'privacy.s2.analytics.p1':
          'Nous pouvons utiliser des services d\u2019analyse respectueux de la vie priv\u00E9e (tels que Plausible Analytics) pour comprendre le trafic et les sch\u00E9mas d\u2019utilisation du site. Ces services\u00A0:',
        'privacy.s2.analytics.item1': '\u2022 N\u2019utilisent pas de cookies',
        'privacy.s2.analytics.item2': '\u2022 Ne collectent pas de donn\u00E9es personnelles',
        'privacy.s2.analytics.item3': '\u2022 Ne suivent pas les utilisateurs entre les sites',
        'privacy.s2.analytics.item4': '\u2022 Sont enti\u00E8rement conformes au RGPD',
        'privacy.s2.cookies.title': '2.2 Cookies',
        'privacy.s2.cookies.p1':
          'Le site sovrium.com n\u2019utilise pas de cookies. Nous ne d\u00E9finissons aucun cookie premi\u00E8re partie ou tiers. Aucune banni\u00E8re de consentement aux cookies n\u2019est n\u00E9cessaire car aucun cookie n\u2019est utilis\u00E9.',
        'privacy.s2.selfHosted.title': '2.3 Logiciel auto-h\u00E9berg\u00E9',
        'privacy.s2.selfHosted.p1':
          'Sovrium est un logiciel auto-h\u00E9berg\u00E9 qui fonctionne sur votre infrastructure. Nous ne\u00A0:',
        'privacy.s2.selfHosted.item1':
          '\u2022 Collectons pas de donn\u00E9es de vos installations Sovrium',
        'privacy.s2.selfHosted.item2':
          '\u2022 Stockons ni ne traitons les donn\u00E9es de vos applications',
        'privacy.s2.selfHosted.item3': '\u2022 Avons acc\u00E8s \u00E0 vos configurations',
        'privacy.s2.selfHosted.item4':
          '\u2022 Surveillons votre utilisation ou vos d\u00E9ploiements',
        'privacy.s2.selfHosted.note':
          'Vous \u00EAtes le responsable du traitement de toutes les donn\u00E9es trait\u00E9es par votre installation Sovrium.',
        'privacy.s2.github.title': '2.4 GitHub et Open Source',
        'privacy.s2.github.p1':
          'Lorsque vous interagissez avec notre d\u00E9p\u00F4t GitHub (issues, pull requests, discussions), GitHub collecte des donn\u00E9es conform\u00E9ment \u00E0 sa politique de confidentialit\u00E9. Nous pouvons voir les informations publiques que vous partagez sur GitHub.',
        'privacy.s2.facebook.title': '2.5 Facebook et connexion sociale',
        'privacy.s2.facebook.p1':
          'Les applications pilot\u00E9es par Sovrium peuvent int\u00E9grer Facebook Login (ou d\u2019autres fournisseurs d\u2019authentification sociale) comme m\u00E9thode de connexion optionnelle. Lorsqu\u2019un utilisateur s\u2019authentifie via Facebook Login, les donn\u00E9es suivantes peuvent \u00EAtre re\u00E7ues par l\u2019application Sovrium\u00A0:',
        'privacy.s2.facebook.item1': '\u2022 Nom et photo de profil',
        'privacy.s2.facebook.item2': '\u2022 Adresse e-mail',
        'privacy.s2.facebook.item3': '\u2022 Identifiant utilisateur Facebook',
        'privacy.s2.facebook.legal':
          'Base juridique\u00A0: Ces donn\u00E9es sont trait\u00E9es au titre de l\u2019article 6(1)(b) du RGPD (ex\u00E9cution d\u2019un contrat) lorsque vous choisissez de vous connecter via Facebook Login, et de l\u2019article 6(1)(a) (consentement) car vous autorisez explicitement le partage de donn\u00E9es via la bo\u00EEte de dialogue d\u2019autorisation de Facebook.',
        'privacy.s2.facebook.purpose':
          'Ces donn\u00E9es sont utilis\u00E9es uniquement pour authentifier votre identit\u00E9 et cr\u00E9er votre compte utilisateur au sein de l\u2019application Sovrium. Pour les installations auto-h\u00E9berg\u00E9es, ces donn\u00E9es sont stock\u00E9es sur l\u2019infrastructure contr\u00F4l\u00E9e par l\u2019organisation exploitant l\u2019application. ESSENTIAL SERVICES n\u2019a pas acc\u00E8s \u00E0 ces donn\u00E9es sauf s\u2019il exploite directement l\u2019application.',
        'privacy.s2.facebook.deletion':
          'Vous pouvez demander la suppression de vos donn\u00E9es \u00E0 tout moment. Consultez notre page de suppression des donn\u00E9es sur sovrium.com/data-deletion pour des instructions d\u00E9taill\u00E9es.',

        // ── Privacy: 3. Use of Information ────────────────────────────────
        'privacy.s3.title': '3. Utilisation des informations',
        'privacy.s3.p1':
          'Toutes les donn\u00E9es analytiques que nous collectons sont utilis\u00E9es uniquement pour\u00A0:',
        'privacy.s3.item1': '\u2022 Am\u00E9liorer notre site web et notre documentation',
        'privacy.s3.item2':
          '\u2022 Comprendre quelles fonctionnalit\u00E9s int\u00E9ressent les utilisateurs',
        'privacy.s3.item3': '\u2022 R\u00E9soudre les probl\u00E8mes techniques du site',
        'privacy.s3.item4': '\u2022 Planifier les priorit\u00E9s de d\u00E9veloppement',
        'privacy.s3.retention.title': '3.1 Conservation des donn\u00E9es',
        'privacy.s3.retention.item1':
          '\u2022 Analyse du site\u00A0: Agr\u00E9g\u00E9e et anonymis\u00E9e. Aucune donn\u00E9e personnelle n\u2019est conserv\u00E9e.',
        'privacy.s3.retention.item2':
          '\u2022 Donn\u00E9es Facebook Login (pour les applications exploit\u00E9es par ESSENTIAL SERVICES)\u00A0: Conserv\u00E9es tant que votre compte utilisateur est actif. Supprim\u00E9es dans les 30 jours suivant une demande de suppression valide.',
        'privacy.s3.retention.item3':
          '\u2022 Installations auto-h\u00E9berg\u00E9es\u00A0: La conservation des donn\u00E9es est d\u00E9termin\u00E9e par l\u2019organisation exploitant l\u2019instance Sovrium.',

        // ── Privacy: 4. Third-Party Services ──────────────────────────────
        'privacy.s4.title': '4. Services tiers',
        'privacy.s4.p1':
          'Notre site peut \u00EAtre li\u00E9 \u00E0 ou interagir avec des services tiers\u00A0:',
        'privacy.s4.item1': '\u2022 GitHub (pour le code source et les issues)',
        'privacy.s4.item2': '\u2022 Google Fonts (pour la typographie)',
        'privacy.s4.item3':
          '\u2022 Facebook/Meta (pour l\u2019authentification sociale dans les applications Sovrium)',
        'privacy.s4.item4': '\u2022 Services CDN (pour une diffusion de contenu plus rapide)',
        'privacy.s4.note':
          'Ces services ont leurs propres politiques de confidentialit\u00E9 et pratiques en mati\u00E8re de donn\u00E9es. Nous vous encourageons \u00E0 consulter leurs politiques, en particulier la Politique de confidentialit\u00E9 de Meta sur https://www.facebook.com/privacy/policy/.',
        'privacy.s4.sharing.title': '4.1 Partage de donn\u00E9es',
        'privacy.s4.sharing.p1':
          'ESSENTIAL SERVICES ne vend, ne loue et n\u2019\u00E9change pas vos donn\u00E9es personnelles \u00E0 des tiers. Nous ne partageons pas vos donn\u00E9es personnelles avec des tiers \u00E0 des fins de marketing. Les donn\u00E9es ne peuvent \u00EAtre partag\u00E9es avec des tiers que dans les circonstances limit\u00E9es suivantes\u00A0:',
        'privacy.s4.sharing.item1':
          '\u2022 Avec votre consentement explicite (ex.\u00A0: lorsque vous autorisez une connexion sociale)',
        'privacy.s4.sharing.item2':
          '\u2022 Pour se conformer aux obligations l\u00E9gales ou r\u00E9pondre aux demandes l\u00E9gitimes des autorit\u00E9s',
        'privacy.s4.sharing.item3':
          '\u2022 Pour prot\u00E9ger les droits, la propri\u00E9t\u00E9 ou la s\u00E9curit\u00E9 d\u2019ESSENTIAL SERVICES, de nos utilisateurs ou du public',

        // ── Privacy: 5. International Transfers ───────────────────────────
        'privacy.s5.title': '5. Transferts internationaux de donn\u00E9es',
        'privacy.s5.p1':
          'Lorsque vous utilisez Facebook Login ou d\u2019autres fournisseurs d\u2019authentification sociale, vos donn\u00E9es peuvent \u00EAtre transf\u00E9r\u00E9es et trait\u00E9es dans des pays situ\u00E9s en dehors de l\u2019Espace \u00E9conomique europ\u00E9en (EEE), y compris les \u00C9tats-Unis. Ces transferts sont n\u00E9cessaires \u00E0 l\u2019ex\u00E9cution du service d\u2019authentification et sont effectu\u00E9s conform\u00E9ment aux lois applicables en mati\u00E8re de protection des donn\u00E9es.',
        'privacy.s5.p2':
          'Lorsque les donn\u00E9es sont transf\u00E9r\u00E9es en dehors de l\u2019EEE, nous nous appuyons sur des garanties appropri\u00E9es telles que le EU-US Data Privacy Framework, les Clauses contractuelles types (CCT) ou d\u2019autres m\u00E9canismes de transfert l\u00E9gaux pour garantir une protection ad\u00E9quate de vos donn\u00E9es.',
        'privacy.s5.p3':
          'Pour les installations Sovrium auto-h\u00E9berg\u00E9es, les transferts de donn\u00E9es sont d\u00E9termin\u00E9s par l\u2019organisation exploitant l\u2019instance. ESSENTIAL SERVICES n\u2019intervient pas dans ces transferts.',

        // ── Privacy: 6. Your Rights ───────────────────────────────────────
        'privacy.s6.title': '6. Vos droits',
        'privacy.s6.p1':
          'En vertu du RGPD et d\u2019autres lois sur la protection de la vie priv\u00E9e, vous avez le droit de\u00A0:',
        'privacy.s6.item1':
          '\u2022 Acc\u00E9der \u00E0 toute donn\u00E9e personnelle que nous d\u00E9tenons \u00E0 votre sujet',
        'privacy.s6.item2': '\u2022 Demander la correction de donn\u00E9es inexactes',
        'privacy.s6.item3': '\u2022 Demander la suppression de vos donn\u00E9es',
        'privacy.s6.item4': '\u2022 Vous opposer au traitement des donn\u00E9es',
        'privacy.s6.item5': '\u2022 Demander la portabilit\u00E9 des donn\u00E9es',
        'privacy.s6.contact': 'Pour exercer ces droits, contactez-nous \u00E0 privacy@sovrium.com.',

        // ── Privacy: 7. Security ──────────────────────────────────────────
        'privacy.s7.title': '7. S\u00E9curit\u00E9',
        'privacy.s7.p1':
          'Nous prenons des mesures raisonnables pour prot\u00E9ger toute information que nous collectons. Cependant, comme nous collectons un minimum de donn\u00E9es et que le logiciel Sovrium est auto-h\u00E9berg\u00E9, votre responsabilit\u00E9 principale en mati\u00E8re de s\u00E9curit\u00E9 concerne votre propre infrastructure et vos pratiques de d\u00E9ploiement.',

        // ── Privacy: 8. Children ──────────────────────────────────────────
        'privacy.s8.title': '8. Confidentialit\u00E9 des enfants',
        'privacy.s8.p1':
          'Notre site et notre logiciel ne sont pas destin\u00E9s aux enfants de moins de 13 ans. Nous ne collectons pas sciemment d\u2019informations personnelles aupr\u00E8s d\u2019enfants de moins de 13 ans.',

        // ── Privacy: 9. Changes ───────────────────────────────────────────
        'privacy.s9.title': '9. Modifications de cette politique',
        'privacy.s9.p1':
          'Nous pouvons mettre \u00E0 jour cette Politique de confidentialit\u00E9 de temps \u00E0 autre. Les modifications seront publi\u00E9es sur cette page avec une date de \u00AB\u00A0Derni\u00E8re mise \u00E0 jour\u00A0\u00BB actualis\u00E9e. Votre utilisation continue du site apr\u00E8s les modifications constitue une acceptation de la politique mise \u00E0 jour.',

        // ── Privacy: 10. Contact ──────────────────────────────────────────
        'privacy.s10.title': '10. Coordonn\u00E9es',
        'privacy.s10.intro': 'Pour toute question relative \u00E0 la confidentialit\u00E9\u00A0:',
        'privacy.s10.item1': '\u2022 E-mail\u00A0: privacy@sovrium.com',
        'privacy.s10.item2':
          '\u2022 GitHub Issues\u00A0: https://github.com/sovrium/sovrium/issues',
        'privacy.s10.item3':
          '\u2022 Soci\u00E9t\u00E9\u00A0: ESSENTIAL SERVICES, SAS au capital de 10\u00A0000\u00A0\u20AC',
        'privacy.s10.item4': '\u2022 RCS Paris \u2014 SIREN\u00A0: 834 241 481',
        'privacy.s10.item5': '\u2022 SIRET\u00A0: 834 241 481 00029',
        'privacy.s10.item6': '\u2022 TVA\u00A0: FR04834241481',
        'privacy.s10.item7': '\u2022 Adresse\u00A0: 128 Rue La Bo\u00E9tie, 75008 Paris, France',
        'privacy.s10.item8': '\u2022 Pr\u00E9sident\u00A0: Thomas Jeanneau',
        'privacy.s10.item9': '\u2022 Suppression des donn\u00E9es\u00A0: sovrium.com/data-deletion',

        // ── Privacy: 11. Data Protection ──────────────────────────────────
        'privacy.s11.title': '11. Protection des donn\u00E9es',
        'privacy.s11.p1':
          'En tant qu\u2019entreprise engag\u00E9e pour la souverainet\u00E9 num\u00E9rique, nous pratiquons la minimisation des donn\u00E9es. Nous collectons le strict minimum n\u00E9cessaire et vous encourageons \u00E0 garder le contr\u00F4le de vos propres donn\u00E9es gr\u00E2ce \u00E0 l\u2019auto-h\u00E9bergement.',

        // ════════════════════════════════════════════════════════════════════
        //  DATA DELETION PAGE
        // ════════════════════════════════════════════════════════════════════

        // ── DataDeletion: Meta ────────────────────────────────────────────
        'dataDeletion.meta.title': 'Demande de suppression de donn\u00E9es - Sovrium',
        'dataDeletion.meta.description':
          'Instructions pour demander la suppression de vos donn\u00E9es li\u00E9es au logiciel et aux services Sovrium par ESSENTIAL SERVICES.',
        'dataDeletion.meta.og.title': 'Demande de suppression de donn\u00E9es - Sovrium',
        'dataDeletion.meta.og.description':
          'Instructions pour demander la suppression de vos donn\u00E9es li\u00E9es au logiciel et aux services Sovrium par ESSENTIAL SERVICES.',
        'dataDeletion.meta.twitter.title': 'Demande de suppression de donn\u00E9es - Sovrium',
        'dataDeletion.meta.twitter.description':
          'Instructions pour demander la suppression de vos donn\u00E9es li\u00E9es au logiciel et aux services Sovrium par ESSENTIAL SERVICES.',

        // ── DataDeletion: Header ──────────────────────────────────────────
        'dataDeletion.header.title': 'Demande de suppression de donn\u00E9es',
        'dataDeletion.header.lastUpdated':
          'Derni\u00E8re mise \u00E0 jour\u00A0: 20 f\u00E9vrier 2026',

        // ── DataDeletion: Intro ───────────────────────────────────────────
        'dataDeletion.intro.p1':
          'Cette page explique comment demander la suppression de vos donn\u00E9es personnelles en lien avec le logiciel et les services Sovrium exploit\u00E9s par ESSENTIAL SERVICES. Selon la mani\u00E8re dont vous interagissez avec Sovrium, le processus peut diff\u00E9rer.',

        // ── DataDeletion: 1. Self-Hosted ──────────────────────────────────
        'dataDeletion.s1.title': '1. Logiciel Sovrium (installations auto-h\u00E9berg\u00E9es)',
        'dataDeletion.s1.p1':
          'Sovrium est une plateforme applicative auto-h\u00E9berg\u00E9e et pilot\u00E9e par la configuration. Lorsqu\u2019une organisation d\u00E9ploie Sovrium sur sa propre infrastructure, elle est le responsable du traitement de toutes les donn\u00E9es utilisateur trait\u00E9es par cette installation. ESSENTIAL SERVICES n\u2019a pas acc\u00E8s aux donn\u00E9es stock\u00E9es dans les instances Sovrium auto-h\u00E9berg\u00E9es.',
        'dataDeletion.s1.p2': 'Si vous \u00EAtes utilisateur d\u2019une application Sovrium\u00A0:',
        'dataDeletion.s1.item1':
          '\u2022 Contactez l\u2019administrateur de l\u2019organisation qui exploite l\u2019application',
        'dataDeletion.s1.item2':
          '\u2022 L\u2019organisation est responsable du traitement de votre demande de suppression de donn\u00E9es conform\u00E9ment aux lois applicables en mati\u00E8re de protection des donn\u00E9es (ex.\u00A0: RGPD)',
        'dataDeletion.s1.item3':
          '\u2022 ESSENTIAL SERVICES ne peut pas supprimer les donn\u00E9es des installations auto-h\u00E9berg\u00E9es car nous n\u2019y avons pas acc\u00E8s',

        // ── DataDeletion: 2. Facebook Login ───────────────────────────────
        'dataDeletion.s2.title': '2. Facebook Login et authentification sociale',
        'dataDeletion.s2.p1':
          'Les applications pilot\u00E9es par Sovrium peuvent int\u00E9grer Facebook Login comme m\u00E9thode d\u2019authentification. Lorsque vous utilisez Facebook Login pour vous connecter \u00E0 une application Sovrium, certaines donn\u00E9es de votre profil Facebook peuvent \u00EAtre partag\u00E9es avec cette application.',
        'dataDeletion.s2.p2':
          'Les types de donn\u00E9es suivants peuvent \u00EAtre stock\u00E9s et sont soumis \u00E0 suppression sur demande\u00A0:',
        'dataDeletion.s2.item1': '\u2022 Votre nom (tel que fourni par Facebook)',
        'dataDeletion.s2.item2': '\u2022 Votre adresse e-mail',
        'dataDeletion.s2.item3': '\u2022 L\u2019URL de votre photo de profil',
        'dataDeletion.s2.item4': '\u2022 Votre identifiant utilisateur Facebook',
        'dataDeletion.s2.item5':
          '\u2022 Toute donn\u00E9e sp\u00E9cifique \u00E0 l\u2019application cr\u00E9\u00E9e lors de votre utilisation de l\u2019application Sovrium',
        'dataDeletion.s2.deleteIntro':
          'Pour supprimer vos donn\u00E9es associ\u00E9es \u00E0 Facebook Login\u00A0:',
        'dataDeletion.s2.step1.title':
          '\u00C9tape 1\u00A0: Supprimer l\u2019application de Facebook',
        'dataDeletion.s2.step1.item1': '\u2022 Acc\u00E9dez \u00E0 vos Param\u00E8tres Facebook',
        'dataDeletion.s2.step1.item2':
          '\u2022 Naviguez vers Param\u00E8tres et confidentialit\u00E9 > Param\u00E8tres > Apps et sites web',
        'dataDeletion.s2.step1.item3':
          '\u2022 Trouvez l\u2019application Sovrium et cliquez sur \u00AB\u00A0Supprimer\u00A0\u00BB pour r\u00E9voquer l\u2019acc\u00E8s',
        'dataDeletion.s2.step1.item4':
          '\u2022 Cochez la case pour supprimer toute donn\u00E9e que l\u2019application a pu recevoir de Facebook',
        'dataDeletion.s2.step2.title':
          '\u00C9tape 2\u00A0: Contacter l\u2019administrateur de l\u2019application',
        'dataDeletion.s2.step2.item1':
          '\u2022 Contactez l\u2019organisation qui exploite l\u2019application Sovrium',
        'dataDeletion.s2.step2.item2':
          '\u2022 Demandez la suppression de toutes les donn\u00E9es personnelles stock\u00E9es dans leur installation Sovrium, y compris les donn\u00E9es re\u00E7ues via Facebook Login',
        'dataDeletion.s2.step3.title':
          '\u00C9tape 3\u00A0: Pour les applications exploit\u00E9es par ESSENTIAL SERVICES',
        'dataDeletion.s2.step3.p1':
          'Si l\u2019application est directement exploit\u00E9e par ESSENTIAL SERVICES, vous pouvez demander la suppression de vos donn\u00E9es en envoyant un e-mail \u00E0 privacy@sovrium.com avec l\u2019objet \u00AB\u00A0Demande de suppression de donn\u00E9es\u00A0\u00BB. Veuillez inclure l\u2019adresse e-mail associ\u00E9e \u00E0 votre compte.',

        // ── DataDeletion: 3. Website ──────────────────────────────────────
        'dataDeletion.s3.title': '3. Site web sovrium.com',
        'dataDeletion.s3.p1':
          'Le site sovrium.com collecte un minimum de donn\u00E9es. Nous n\u2019utilisons pas de cookies, ne demandons pas de comptes utilisateurs et ne collectons pas d\u2019informations personnelles via notre site. Si vous pensez que nous d\u00E9tenons des donn\u00E9es personnelles vous concernant suite \u00E0 vos interactions avec notre site, vous pouvez nous contacter \u00E0 privacy@sovrium.com pour en demander la suppression.',

        // ── DataDeletion: 4. Confirmation ─────────────────────────────────
        'dataDeletion.s4.title': '4. Confirmation de suppression des donn\u00E9es',
        'dataDeletion.s4.p1':
          'Lorsque nous recevons une demande de suppression de donn\u00E9es valide pour les services exploit\u00E9s par ESSENTIAL SERVICES\u00A0:',
        'dataDeletion.s4.item1':
          '\u2022 Nous traiterons votre demande dans un d\u00E9lai de 30 jours \u00E0 compter de la r\u00E9ception',
        'dataDeletion.s4.item2':
          '\u2022 Nous vous enverrons une confirmation une fois vos donn\u00E9es supprim\u00E9es',
        'dataDeletion.s4.item3':
          '\u2022 Certaines donn\u00E9es peuvent \u00EAtre conserv\u00E9es si la loi ou des obligations l\u00E9gales l\u00E9gitimes l\u2019exigent',
        'dataDeletion.s4.item4':
          '\u2022 Vous recevrez un code de confirmation par e-mail que vous pourrez utiliser pour v\u00E9rifier le statut de votre demande de suppression',

        // ── DataDeletion: 5. Contact ──────────────────────────────────────
        'dataDeletion.s5.title': '5. Contact',
        'dataDeletion.s5.intro':
          'Pour les demandes de suppression de donn\u00E9es ou les questions concernant vos donn\u00E9es\u00A0:',
        'dataDeletion.s5.item1': '\u2022 E-mail\u00A0: privacy@sovrium.com',
        'dataDeletion.s5.item2':
          '\u2022 Soci\u00E9t\u00E9\u00A0: ESSENTIAL SERVICES, SAS au capital de 10\u00A0000\u00A0\u20AC',
        'dataDeletion.s5.item3': '\u2022 RCS Paris \u2014 SIREN\u00A0: 834 241 481',
        'dataDeletion.s5.item4': '\u2022 SIRET\u00A0: 834 241 481 00029',
        'dataDeletion.s5.item5': '\u2022 TVA\u00A0: FR04834241481',
        'dataDeletion.s5.item6':
          '\u2022 Adresse\u00A0: 128 Rue La Bo\u00E9tie, 75008 Paris, France',
        'dataDeletion.s5.item7': '\u2022 Pr\u00E9sident\u00A0: Thomas Jeanneau',
      },
    },
  },
  blocks: [],
  pages: [home, termsOfService, privacyPolicy, dataDeletion, partners, company, brandCharter],
}
