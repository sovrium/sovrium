/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The French twin of `chrome.ts`: the shell, the breadcrumb vocabulary and the
// document titles.
//
// Exact key parity with `chrome.ts`, in its key order. The rules every French
// string here follows (voice, no-break spaces) are in `fr.ts`, which merges
// the four.

export default {
  // `admin.shell.navLoading` is GONE from the English table — the placeholder
  // line it named was deleted when the sidebar stopped rendering one. It is
  // dropped here too rather than kept "in case": a French key with no English
  // sibling is a string nothing can ever resolve, and it is exactly what makes
  // a parity check report a difference that is not one.
  'admin.shell.openMenu': 'Ouvrir le menu',
  'admin.shell.openSite': 'Ouvrir le site dans un nouvel onglet',
  'admin.shell.search': 'Rechercher',
  'admin.shell.searchPlaceholder': 'Rechercher…',
  // The operator menu. `account` names the trigger, `myAccount` the row inside
  // it — "Mon compte" on both would make the menu say its own name twice.
  'admin.shell.account': 'Compte',
  'admin.shell.myAccount': 'Mon compte',
  'admin.shell.giveFeedback': 'Donner un avis',
  'admin.shell.reportBug': 'Signaler un bug',
  'admin.shell.signOut': 'Se déconnecter',

  // « Design » et « Overview » — le premier reste, le second non. Design est
  // le nom courant de la discipline en français et celui que porte la section ;
  // Overview a « Vue d’ensemble », qui dit la même chose sans emprunt.
  'admin.nav.welcome': 'Bienvenue',
  'admin.nav.group.system': 'Système',
  'admin.nav.group.application': 'Application',
  'admin.nav.group.developers': 'Développeurs',
  'admin.nav.landmark.data': 'Données',
  'admin.nav.design': 'Design',
  'admin.nav.design.overview': 'Vue d’ensemble',
  'admin.nav.design.foundations': 'Fondations',
  'admin.nav.design.uiKit': 'Kit d’interface',
  'admin.nav.design.components': 'Composants',
  'admin.nav.design.brand': 'Marque',
  'admin.nav.design.voice': 'Voix',

  'admin.crumb.profile': 'Mon profil',
  'admin.crumb.gdpr': 'Mes données',
  'admin.crumb.apiKeys': 'Clés API',
  'admin.crumb.env': 'Environnement',
  'admin.crumb.api': 'API',
  'admin.crumb.mcp': 'MCP',
  'admin.crumb.changelog': 'Journal des versions',
  'admin.crumb.tables': 'Enregistrements',
  'admin.crumb.buckets': 'Fichiers',
  'admin.crumb.agents': 'Conversations',
  'admin.crumb.forms': 'Réponses',
  'admin.crumb.connections': 'Connexions',
  'admin.crumb.organisation': 'Organisation',
  'admin.crumb.users': 'Utilisateurs',
  'admin.crumb.invitations': 'Invitations',
  'admin.crumb.pages': 'Analytique',
  'admin.crumb.automations': 'Exécutions',
  'admin.crumb.automationRun': 'Exécution',
  'admin.crumb.links': 'Liens',
  'admin.crumb.templates': 'Modèles',
  'admin.crumb.footprint': 'Empreinte',
  'admin.crumb.decisions': 'Décisions',

  // The "Sovrium — " stem is untranslated on purpose: it names whose surface
  // this is, and a product name is not a word to localise.
  'admin.meta.welcome': 'Sovrium — Bienvenue',
  'admin.meta.profile': 'Sovrium — Mon profil',
  'admin.meta.gdpr': 'Sovrium — Mes données',
  'admin.meta.apiKeys': 'Sovrium — Clés API',
  'admin.meta.env': 'Sovrium — Environnement',
  'admin.meta.api': 'Sovrium — API',
  'admin.meta.mcp': 'Sovrium — MCP',
  'admin.meta.changelog': 'Sovrium — Journal des versions',
  'admin.meta.release': 'Sovrium — Journal des versions · Version',
  'admin.meta.tables': 'Sovrium — Données · Enregistrements',
  'admin.meta.buckets': 'Sovrium — Données · Fichiers',
  'admin.meta.agents': 'Sovrium — Données · Conversations',
  'admin.meta.forms': 'Sovrium — Données · Réponses',
  'admin.meta.connections': 'Sovrium — Données · Connexions',
  'admin.meta.organisation': 'Sovrium — Organisation',
  'admin.meta.users': 'Sovrium — Données · Utilisateurs',
  'admin.meta.invitations': 'Sovrium — Données · Invitations',
  'admin.meta.userAccount': 'Sovrium — Données · Compte',
  'admin.meta.pages': 'Sovrium — Données · Analytique',
  'admin.meta.automations': 'Sovrium — Données · Exécutions',
  'admin.meta.automationRun': 'Sovrium — Données · Exécution',
  'admin.meta.links': 'Sovrium — Données · Liens',
  'admin.meta.templates': 'Sovrium — Données · Modèles',
  'admin.meta.footprint': 'Sovrium — Empreinte',
  'admin.meta.decisions': 'Sovrium — Décisions',
  'admin.meta.decision': 'Sovrium — Décision',
  'admin.meta.login': 'Sovrium — Connexion',
  'admin.meta.forgotPassword': 'Sovrium — Mot de passe oublié',
  'admin.meta.resetPassword': 'Sovrium — Nouveau mot de passe',
} as const
