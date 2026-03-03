/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const en: Record<string, string> = {
  // ════════════════════════════════════════════════════════════════════
  //  GLOBAL BADGE
  // ════════════════════════════════════════════════════════════════════
  'badge.text': 'Built with Sovrium',

  // ════════════════════════════════════════════════════════════════════
  //  GLOBAL NAVIGATION
  // ════════════════════════════════════════════════════════════════════
  'nav.partner': 'Our Partner Service',
  'nav.partner.href': '/en/partner',
  'nav.about': 'About',
  'nav.about.href': '/en/about',
  'nav.lang.label': 'FR',
  'nav.lang.code': 'fr',

  // ════════════════════════════════════════════════════════════════════
  //  GLOBAL FOOTER
  // ════════════════════════════════════════════════════════════════════
  'footer.description':
    'A self-hosted, configuration-driven platform that puts you back in control of your software.',
  'footer.col.product': 'Product',
  'footer.col.product.docs': 'Documentation',
  'footer.col.product.docs.href': '/en/docs/schema',
  'footer.col.product.github': 'GitHub',
  'footer.col.product.license': 'License',
  'footer.col.company': 'Company',
  'footer.col.company.about': 'About',
  'footer.col.company.about.href': '/en/about',
  'footer.col.company.partners': 'Our Partner Service',
  'footer.col.company.partners.href': '/en/partner',
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
  'home.solution.howItWorks.step2.description': 'Run on your server, your cloud, your laptop.',
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
    'Written in TypeScript, built on battle-tested technologies chosen for performance, reliability, and developer experience.',

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
  'home.gettingStarted.status.cta': '⭐ Star on GitHub',

  // ════════════════════════════════════════════════════════════════════
  //  PARTNER PAGE
  // ════════════════════════════════════════════════════════════════════

  // ── Partners: Meta ──────────────────────────────────────────────────
  'partner.meta.title': 'Sovrium Partners - Custom Software Solutions',
  'partner.meta.description':
    'ESSENTIAL SERVICES builds tailor-made software solutions with Sovrium. 50+ clients served, 200+ tools built, 10,000+ hours saved.',
  'partner.meta.og.title': 'Sovrium Partners - Custom Software Solutions',
  'partner.meta.og.description':
    'Tailor-made solutions to your software challenges. Built on Sovrium, deployed on your infrastructure.',
  'partner.meta.twitter.title': 'Sovrium Partners - Custom Software Solutions',
  'partner.meta.twitter.description':
    'Tailor-made solutions to your software challenges. Built with Sovrium.',

  // ── Partners: Hero ──────────────────────────────────────────────────
  'partner.hero.title': 'Tailor-made solutions to your software challenges',
  'partner.hero.subtitle':
    'We design, build, and maintain custom internal tools, AI-powered solutions, and automated workflows on your infrastructure. No vendor lock-in, no surprise bills \u2014 just software that works for your team.',
  'partner.hero.cta.primary': 'Join the Waitlist',
  'partner.hero.cta.secondary': 'Our Methodology',

  // ── Partners: Trusted By ────────────────────────────────────────────
  'partner.trust.title': 'Trusted By',

  // ── Partners: Stats ─────────────────────────────────────────────────
  'partner.stats.title': 'Proven Track Record',
  'partner.stats.clients.stat': '50+',
  'partner.stats.clients.title': 'Clients Served',
  'partner.stats.clients.description':
    'Startups, SMEs, and enterprises trust us to streamline their operations with custom-built tools.',
  'partner.stats.tools.stat': '200+',
  'partner.stats.tools.title': 'Tools Built',
  'partner.stats.tools.description':
    'From internal dashboards to full business applications, tailored to each client\u2019s unique workflows.',
  'partner.stats.hours.stat': '10,000+',
  'partner.stats.hours.title': 'Hours Saved',
  'partner.stats.hours.description':
    'Automating repetitive tasks and consolidating scattered tools into cohesive platforms.',

  // ── Partners: Process (5 steps) ─────────────────────────────────────
  'partner.process.title': 'Our Process',
  'partner.process.subtitle':
    'A proven 5-step approach to deliver software that fits your needs perfectly.',
  'partner.process.step1.title': 'Listen',
  'partner.process.step1.description':
    'Understand your workflows, pain points, and goals through in-depth discovery sessions.',
  'partner.process.step2.title': 'Advise',
  'partner.process.step2.description':
    'Design the optimal solution architecture based on your specific constraints and objectives.',
  'partner.process.step3.title': 'Develop',
  'partner.process.step3.description':
    'Build with Sovrium on your infrastructure. Clean code, tested, deployed on your terms.',
  'partner.process.step4.title': 'Adjust',
  'partner.process.step4.description':
    'Iterate based on real usage and feedback. We refine until it fits perfectly.',
  'partner.process.step5.title': 'Maintain',
  'partner.process.step5.description':
    'Ongoing support and evolution as your needs grow. We stay with you for the long run.',

  // ── Partners: Methodology (13 principles) ──────────────────────────
  'partner.methodology.title': 'Our Methodology',
  'partner.methodology.subtitle': '10 principles that guide every project we deliver.',
  'partner.methodology.1.title':
    '\u2699\uFE0F We automate processes, build internal tools, and leverage AI to amplify your team',
  'partner.methodology.1.description':
    'We analyze your workflows to identify repetitive tasks, design end-to-end automations, and integrate AI where it accelerates delivery.',
  'partner.methodology.2.title':
    '\uD83D\uDCAC We are available to answer your questions, needs, and technical support',
  'partner.methodology.2.description':
    'Our team is here to understand your specific needs and support you in your projects.',
  'partner.methodology.3.title': '\uD83E\uDD47 We use the best of Code, No Code, and AI',
  'partner.methodology.3.description':
    'We combine traditional code, No Code platforms, and AI-powered tools to deliver the right solution for each use case.',
  'partner.methodology.4.title':
    '\uD83D\uDCBB We work remotely and asynchronously, using video conferencing when necessary',
  'partner.methodology.4.description':
    'Our remote work approach is based on clear and effective communication.',
  'partner.methodology.5.title': '\u23F1\uFE0F You pay for the time we spend on all your requests',
  'partner.methodology.5.description':
    'Our billing system is transparent and based on actual time spent on your projects.',
  'partner.methodology.6.title': '\u274C We don\u2019t do estimates',
  'partner.methodology.6.description':
    'We prefer a pragmatic approach based on action rather than approximate predictions.',
  'partner.methodology.7.title':
    '\uD83D\uDC8E We take the time to do quality work, focusing on what matters',
  'partner.methodology.7.description': 'Our commitment to quality guides every aspect of our work.',
  'partner.methodology.8.title': '\uD83C\uDFE1 You own everything we develop for you',
  'partner.methodology.8.description':
    'All code, applications, and solutions developed as part of our services belong entirely to you.',
  'partner.methodology.9.title': '\uD83D\uDD4A\uFE0F You are not committed to anything',
  'partner.methodology.9.description':
    'Our flexible approach allows you to work with us according to your needs, without long-term contractual commitment.',
  'partner.methodology.10.title': '\u2764\uFE0F We take care of you',
  'partner.methodology.10.description':
    'Your satisfaction is our priority. We don\u2019t just deliver a project: we commit to supporting you at every step.',

  // ── Partners: Testimonials (exact LTF Engine quotes) ────────────────
  'partner.testimonials.title': 'What Our Clients Say',
  'partner.testimonials.1.quote':
    'Very satisfying work, it\u2019s a very positive and enriching experience. The La Tech Force team helped us quickly gain expertise.',
  'partner.testimonials.1.author': 'Marco PERONE',
  'partner.testimonials.1.role': 'Co-founder at CAPITAL PV',
  'partner.testimonials.2.quote':
    'Excellent support, great responsiveness and availability of the team, high quality deliverables, proactive suggestions.',
  'partner.testimonials.2.author': 'Simon SALLANDRE',
  'partner.testimonials.2.role': 'Operations Director at AGORASTORE',
  'partner.testimonials.3.quote':
    'Competent team & effective work. I learned a lot and developed a better understanding of automation logic.',
  'partner.testimonials.3.author': 'Mbemba DANSOKO',
  'partner.testimonials.3.role': 'Co-founder at ACTIVPRENEUR',
  'partner.testimonials.4.quote':
    'A great collaboration, we were able to make a giant leap and support across multiple business areas.',
  'partner.testimonials.4.author': 'Meryem BENMOUAZ',
  'partner.testimonials.4.role': 'Co-founder at LINTENDANCE',

  // ── Partners: Waitlist CTA ──────────────────────────────────────────
  'partner.waitlist.title': 'Supercharge Your Team',
  'partner.waitlist.description':
    'We work with a limited number of clients to ensure quality. Join our waitlist to be the first to know when a spot opens.',
  'partner.waitlist.cta': 'Join the Waitlist',

  // ════════════════════════════════════════════════════════════════════
  //  ABOUT PAGE
  // ════════════════════════════════════════════════════════════════════

  // ── Company: Meta ──────────────────────────────────────────────────
  'about.meta.title': 'Sovrium \u2014 Company',
  'about.meta.description':
    'Learn about the vision, values, and team behind Sovrium. Building digital sovereignty for every organization.',
  'about.meta.og.title': 'Sovrium \u2014 Company',
  'about.meta.og.description':
    'The vision, values, and team behind Sovrium. Digital sovereignty for every organization.',
  'about.meta.twitter.title': 'Sovrium \u2014 Company',
  'about.meta.twitter.description':
    'The vision, values, and team behind Sovrium. Digital sovereignty for every organization.',

  // ── Company: Hero ──────────────────────────────────────────────────
  'about.hero.eyebrow': 'ESSENTIAL SERVICES',
  'about.hero.title': 'Building digital sovereignty',
  'about.hero.subtitle':
    'We believe every organization deserves to own its software, its data, and its future. Sovrium is the platform that makes it possible.',
  'about.hero.tagline': '\u201COwn your data. Own your tools. Own your future.\u201D',

  // ── Company: Mission ───────────────────────────────────────────────
  'about.mission.title': 'Our Mission',
  'about.mission.description':
    'Modern organizations are drowning in SaaS dependencies \u2014 paying monthly fees, losing data control, and adapting their business to vendor limitations. We are building the alternative.',
  'about.mission.statement':
    'To make every organization sovereign in their information systems \u2014 free from SaaS lock-in, in complete control of their data, and empowered to build business applications through configuration-as-code.',

  // ── Company: Values ────────────────────────────────────────────────
  'about.values.title': 'Our Values',
  'about.values.subtitle':
    'The principles that guide every decision we make, from code architecture to community engagement.',
  'about.values.sovereignty.icon': '\uD83D\uDEE1\uFE0F',
  'about.values.sovereignty.title': 'Digital Sovereignty',
  'about.values.sovereignty.description':
    'Organizations should own their information systems, not rent them. Your data, your infrastructure, your rules.',
  'about.values.transparency.icon': '\uD83D\uDD0D',
  'about.values.transparency.title': 'Radical Transparency',
  'about.values.transparency.description':
    'Source-available code, open roadmap, honest communication. No hidden agendas, no surprise pricing, no vendor lock-in.',
  'about.values.openSource.icon': '\uD83C\uDF10',
  'about.values.openSource.title': 'Open Source Spirit',
  'about.values.openSource.description':
    'Built on open standards and open-source technologies. Contributing back to the ecosystem that enables us.',
  'about.values.simplicity.icon': '\u2728',
  'about.values.simplicity.title': 'Elegant Simplicity',
  'about.values.simplicity.description':
    'Complex problems deserve simple solutions. One config file, one command, one platform \u2014 no unnecessary complexity.',
  'about.values.ownership.icon': '\uD83C\uDFE1',
  'about.values.ownership.title': 'True Ownership',
  'about.values.ownership.description':
    'Everything we build for you belongs to you. Full source access, full data portability, zero lock-in.',
  'about.values.longTerm.icon': '\uD83C\uDF31',
  'about.values.longTerm.title': 'Long-Term Thinking',
  'about.values.longTerm.description':
    'We build for sustainability, not hype cycles. Sovrium is designed to grow with your organization for years to come.',

  // ── Company: Principles ────────────────────────────────────────────
  'about.principles.title': 'How We Build',
  'about.principles.subtitle': 'Five core principles shape the technical decisions behind Sovrium.',
  'about.principles.configOverCode.title': 'Configuration Over Coding',
  'about.principles.configOverCode.description':
    'Business applications should be configured, not programmed. TypeScript, YAML, or JSON \u2014 choose your format, get a complete app in seconds.',
  'about.principles.minimalDeps.title': 'Minimal Dependencies',
  'about.principles.minimalDeps.description':
    'One runtime (Bun), one database (PostgreSQL), zero vendor SDKs. Reduce your dependency surface to only essential infrastructure.',
  'about.principles.businessFocus.title': 'Business Focus',
  'about.principles.businessFocus.description':
    'Engineers should focus on business logic, not infrastructure. Sovrium handles auth, database, API, and UI out of the box.',
  'about.principles.configReuse.title': 'Configuration Reusability',
  'about.principles.configReuse.description':
    'Configuration templates become organizational assets. Build CRM, project tools, and portals from composable, version-controlled configs.',

  // ── Company: Team ──────────────────────────────────────────────────
  'about.team.title': 'The Team',
  'about.team.subtitle':
    'Sovrium is built by ESSENTIAL SERVICES, a company dedicated to giving organizations control over their software.',
  'about.team.founder.name': 'Thomas Jeanneau',
  'about.team.founder.role': 'Founder & CEO',
  'about.team.founder.bio':
    'Software engineer and entrepreneur with 8 years of expertise, passionate about building tools that empower organizations. Previously built automation tools serving 50+ clients across France and Europe.',

  // ── Company: CTA ───────────────────────────────────────────────────
  'about.cta.title': 'Join the Movement',
  'about.cta.description':
    'Sovrium is open source and actively developed. Star the repo, contribute code, or build with us.',
  'about.cta.github': 'View on GitHub',
  'about.cta.partner': 'Work With Us',
  'about.cta.partner.href': '/en/partner',

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
  'dataDeletion.s4.item2': '\u2022 We will send you a confirmation once your data has been deleted',
  'dataDeletion.s4.item3':
    '\u2022 Some data may be retained if required by law or legitimate legal obligations',
  'dataDeletion.s4.item4':
    '\u2022 You will receive a confirmation code via email that you can use to verify the status of your deletion request',

  // ── DataDeletion: 5. Contact ──────────────────────────────────────
  'dataDeletion.s5.title': '5. Contact',
  'dataDeletion.s5.intro': 'For data deletion requests or questions about your data:',
  'dataDeletion.s5.item1': '\u2022 Email: privacy@sovrium.com',
  'dataDeletion.s5.item2': '\u2022 Company: ESSENTIAL SERVICES, SAS au capital de 10 000 \u20AC',
  'dataDeletion.s5.item3': '\u2022 RCS Paris \u2014 SIREN: 834 241 481',
  'dataDeletion.s5.item4': '\u2022 SIRET: 834 241 481 00029',
  'dataDeletion.s5.item5': '\u2022 TVA: FR04834241481',
  'dataDeletion.s5.item6': '\u2022 Address: 128 Rue La Bo\u00E9tie, 75008 Paris, France',
  'dataDeletion.s5.item7': '\u2022 President: Thomas Jeanneau',

  // ════════════════════════════════════════════════════════════════════
  //  DOCS SCHEMA PAGE
  // ════════════════════════════════════════════════════════════════════

  // ── Docs: Navigation ──────────────────────────────────────────────
  'nav.docs': 'Docs',
  'nav.docs.href': '/en/docs/schema',

  // ── Docs: Meta ────────────────────────────────────────────────────
  'docs.meta.title': 'Schema Documentation - Sovrium',
  'docs.meta.description':
    'Complete reference for the Sovrium app schema. Define data models, authentication, pages, themes, and analytics in a single configuration file.',

  // ── Docs: Header ──────────────────────────────────────────────────
  'docs.header.backLink': '\u2190 sovrium.com',
  'docs.header.title': 'Schema Documentation',
  'docs.header.description':
    'Define your entire application \u2014 data models, authentication, pages, themes, analytics \u2014 in a single YAML or JSON file. This is the complete reference for the Sovrium app schema.',

  // ── Docs: Sidebar ─────────────────────────────────────────────────
  'docs.sidebar.overview': 'Overview',
  'docs.sidebar.quickStart': 'Quick Start',
  'docs.sidebar.rootProperties': 'Root Properties',
  'docs.sidebar.tables': 'Tables & Fields',
  'docs.sidebar.theme': 'Theme',
  'docs.sidebar.pages': 'Pages & Components',
  'docs.sidebar.auth': 'Authentication',
  'docs.sidebar.languages': 'Languages',
  'docs.sidebar.analytics': 'Analytics',
  'docs.sidebar.resources': 'Resources',

  // ── Docs: Section 1 — Overview ────────────────────────────────────
  'docs.overview.title': 'Overview',
  'docs.overview.description':
    'A Sovrium app is a declarative configuration object with 10 root properties. Only name is required \u2014 everything else is optional, enabling progressive complexity from a minimal app identifier to a full-stack application.',
  'docs.overview.footnote':
    'Configuration files can be written in YAML or JSON. Run sovrium start app.yaml to launch a dev server, or sovrium static app.yaml to generate a static site.',

  // ── Docs: Section 2 — Quick Start ─────────────────────────────────
  'docs.quickStart.title': 'Quick Start',
  'docs.quickStart.description':
    'Create an app.yaml file and start building. Here is a minimal example that grows from the simplest valid config to a small but complete app:',
  'docs.quickStart.runDev': 'Then run the development server:',

  // ── Docs: Section 3 — Root Properties ─────────────────────────────
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
    'Server-rendered pages with 63 component types, SEO metadata, and i18n support.',
  'docs.rootProps.auth.description':
    'Authentication strategies (email/password, magic link, OAuth), roles, and two-factor authentication.',
  'docs.rootProps.languages.description':
    'Multi-language support with $t: translation syntax, browser detection, and language persistence.',
  'docs.rootProps.components.description':
    'Reusable UI templates with $ref referencing and $variable substitution.',
  'docs.rootProps.analytics.description':
    'Privacy-friendly, cookie-free, first-party analytics. Set to true for defaults or configure with options.',

  // ── Docs: Section 4 — Tables & Fields ─────────────────────────────
  'docs.tables.title': 'Tables & Fields',
  'docs.tables.description':
    'Tables define your data models. Each table has an id, name, fields, and optional permissions, indexes, and views.',
  'docs.tables.structure.title': 'Table Structure',
  'docs.tables.baseFields.title': 'Base Field Properties',
  'docs.tables.baseFields.description':
    'Every field has these base properties: id (unique integer), name (identifier), type (one of 41 types), and optional required, unique, description, and defaultValue.',
  'docs.tables.fieldTypes.title': '41 Field Types',
  'docs.tables.fieldTypes.description': 'Field types are organized into 9 categories:',
  'docs.tables.fieldTypes.text': 'Text Fields',
  'docs.tables.fieldTypes.numeric': 'Numeric Fields',
  'docs.tables.fieldTypes.selection': 'Selection Fields',
  'docs.tables.fieldTypes.dateTime': 'Date & Time Fields',
  'docs.tables.fieldTypes.user': 'User Fields',
  'docs.tables.fieldTypes.relational': 'Relational Fields',
  'docs.tables.fieldTypes.media': 'Media Fields',
  'docs.tables.fieldTypes.computed': 'Computed Fields',
  'docs.tables.fieldTypes.advanced': 'Advanced Fields',
  'docs.tables.permissions.title': 'Permissions (RBAC)',
  'docs.tables.permissions.description':
    'Table permissions use role-based access control. Each permission (create, read, update, delete, comment) accepts: "all" (public), "authenticated" (logged-in users), or an array of role names.',

  // ── Docs: Section 5 — Theme ───────────────────────────────────────
  'docs.theme.title': 'Theme',
  'docs.theme.description':
    'The theme property defines your design system with 7 optional token categories. All tokens generate CSS custom properties and Tailwind CSS utility classes.',
  'docs.theme.colors.title': 'colors',
  'docs.theme.colors.description':
    'Named color tokens as key-value pairs. Each becomes a CSS variable (--color-{name}) and Tailwind class (bg-{name}, text-{name}).',
  'docs.theme.fonts.title': 'fonts',
  'docs.theme.fonts.description':
    'Typography configuration for heading, body, and mono fonts. Supports family, fallback, weights, size, line height, and Google Fonts URL.',
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

  // ── Docs: Section 6 — Pages & Components ──────────────────────────
  'docs.pages.title': 'Pages & Components',
  'docs.pages.description':
    'Pages are server-rendered using a component tree system. Each page has a name, path, metadata (SEO, favicons), and sections containing nested components.',
  'docs.pages.structure.title': 'Page Structure',
  'docs.pages.componentTypes.title': '63 Component Types',
  'docs.pages.componentTypes.description':
    'Components form a recursive tree \u2014 each can have type, content, props, and children.',
  'docs.pages.componentTypes.layout': 'Layout',
  'docs.pages.componentTypes.typography': 'Typography',
  'docs.pages.componentTypes.navActions': 'Navigation & Actions',
  'docs.pages.componentTypes.media': 'Media',
  'docs.pages.componentTypes.formElements': 'Form Elements',
  'docs.pages.componentTypes.dataDisplay': 'Data Display',
  'docs.pages.componentTypes.interactive': 'Interactive',
  'docs.pages.componentTypes.display': 'Display',
  'docs.pages.interactions.title': 'Interactions',
  'docs.pages.interactions.description':
    'Components support 4 interaction types via the interactions property: hover (transform, opacity, scale, shadow changes), click (navigation, scroll, toggle), scroll (parallax, fade-in, sticky behavior), and entrance (animation on first view with delay and duration).',

  // ── Docs: Section 7 — Authentication ──────────────────────────────
  'docs.auth.title': 'Authentication',
  'docs.auth.description':
    'Built-in authentication powered by Better Auth. Configure strategies, roles, two-factor authentication, and email templates.',
  'docs.auth.strategies.title': 'Strategies',
  'docs.auth.strategies.description':
    'email-password (default), magic-link (passwordless email), and OAuth providers (google, github, apple, microsoft, facebook, twitter, discord, spotify, twitch, gitlab, bitbucket, linkedin, dropbox).',
  'docs.auth.roles.title': 'Roles & Permissions',
  'docs.auth.roles.description':
    'Three built-in roles: admin, member, viewer. Define custom roles with name + description. Set defaultRole for new users. First user automatically becomes admin.',
  'docs.auth.twoFactor.title': 'Two-Factor Auth',
  'docs.auth.twoFactor.description':
    'Optional TOTP-based 2FA. Enable with twoFactor: true in the auth config. Users can set up authenticator apps.',
  'docs.auth.emails.title': 'Email Templates',
  'docs.auth.emails.description':
    'Customizable emails for verification, password reset, and magic link. Supports $name, $url, $email variable substitution in subject and body.',

  // ── Docs: Section 8 — Languages ───────────────────────────────────
  'docs.languages.title': 'Languages',
  'docs.languages.description':
    'Multi-language support with translation keys, browser language detection, and automatic URL-based language routing (/en/..., /fr/...). Reference translations in pages using the $t: prefix.',
  'docs.languages.syntax.title': '$t: Translation Syntax',
  'docs.languages.syntax.description':
    'Use $t:key.path in any page content or prop value to reference a translation. Example: $t:hero.title resolves to "Welcome" in English and "Bienvenue" in French.',

  // ── Docs: Section 9 — Analytics ───────────────────────────────────
  'docs.analytics.title': 'Analytics',
  'docs.analytics.description':
    'Built-in, privacy-friendly analytics with no cookies, no external services, and full GDPR compliance. All data stays on your server.',
  'docs.analytics.details':
    'When enabled, Sovrium injects a lightweight tracking script that records page views, sessions, referrers, and device information. Analytics data is collected at /api/analytics/collect and stored locally.',

  // ── Docs: Section 10 — Resources ──────────────────────────────────
  'docs.resources.title': 'Resources',
  'docs.resources.description': 'Additional references for working with the Sovrium schema.',
  'docs.resources.llmQuick.label': 'LLM Quick Reference',
  'docs.resources.llmQuick.description': 'Concise schema overview optimized for LLMs (~40 lines).',
  'docs.resources.llmFull.label': 'LLM Full Reference',
  'docs.resources.llmFull.description': 'Complete schema documentation for LLMs (~1700 lines).',
  'docs.resources.jsonSchema.label': 'JSON Schema',
  'docs.resources.jsonSchema.description':
    'Machine-readable JSON Schema (Draft-07) for validation and editor support.',
  'docs.resources.github.label': 'GitHub Repository',
  'docs.resources.github.description': 'Source code, issues, and contribution guidelines.',
}
