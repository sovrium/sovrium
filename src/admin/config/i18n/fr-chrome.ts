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
  'admin.shell.toggleSidebar': 'Replier la barre latérale',
  'admin.shell.home': 'Accueil de la console',
  'admin.shell.search': 'Rechercher',
  'admin.shell.searchPlaceholder': 'Rechercher…',
  // The operator menu. `account` names the trigger, `myAccount` the row inside
  // it — "Mon compte" on both would make the menu say its own name twice.
  'admin.shell.account': 'Compte',
  'admin.offline.message': 'Tu es hors ligne. Vérifie ta connexion, puis réessaie.',
  'admin.offline.retry': 'Réessayer',
  'admin.shell.readOnly': 'Lecture seule — ton rôle est Lecteur',
  'admin.shell.role.admin': 'Admin',
  'admin.shell.role.viewer': 'Lecteur',
  'admin.shell.myAccount': 'Mon profil',
  'admin.shell.myData': 'Mes données',
  'admin.shell.signOut': 'Se déconnecter',

  // « Design » et « Overview » — le premier reste, le second non. Design est
  // le nom courant de la discipline en français et celui que porte la section ;
  // Overview a « Vue d’ensemble », qui dit la même chose sans emprunt.
  'admin.nav.overview': 'Vue d’ensemble',
  'admin.nav.group.activity': 'Activité',
  'admin.nav.group.data': 'Données',
  'admin.nav.group.people': 'Personnes',
  'admin.nav.group.audience': 'Audience',
  'admin.nav.group.developers': 'Développeurs',
  'admin.nav.group.design': 'Design',
  'admin.nav.landmark.console': 'Console',
  'admin.nav.designSystem': 'Système de design',
  'admin.nav.design.overview': 'Vue d’ensemble',
  'admin.nav.design.foundations': 'Fondations',
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
  'admin.crumb.records': 'Enregistrements',
  'admin.crumb.files': 'Fichiers',
  'admin.crumb.conversations': 'Conversations',
  'admin.crumb.submissions': 'Réponses',
  'admin.crumb.connections': 'Connexions',
  'admin.crumb.organisation': 'Organisation',
  'admin.crumb.users': 'Utilisateurs',
  'admin.crumb.analytics': 'Analytique',
  'admin.crumb.runs': 'Exécutions',
  'admin.crumb.links': 'Liens',
  'admin.crumb.templates': 'Modèles',
  'admin.crumb.decisions': 'Décisions',

  // The "Sovrium — " stem is untranslated on purpose: it names whose surface
  // this is, and a product name is not a word to localise.
  'admin.meta.welcome': 'Sovrium — Bienvenue',
  'admin.meta.acceptInvitation': 'Sovrium — Accepter l’invitation',
  'admin.meta.notFound': 'Sovrium — Page introuvable',
  'admin.meta.profile': 'Sovrium — Mon profil',
  'admin.meta.gdpr': 'Sovrium — Mes données',
  'admin.meta.apiKeys': 'Sovrium — Clés API',
  'admin.meta.env': 'Sovrium — Environnement',
  'admin.meta.api': 'Sovrium — API',
  'admin.meta.mcp': 'Sovrium — MCP',
  'admin.meta.changelog': 'Sovrium — Journal des versions',
  'admin.meta.release': 'Sovrium — Journal des versions · Version',
  'admin.meta.tables': 'Sovrium — Enregistrements',
  'admin.meta.buckets': 'Sovrium — Fichiers',
  'admin.meta.agents': 'Sovrium — Conversations',
  'admin.meta.forms': 'Sovrium — Réponses',
  'admin.meta.connections': 'Sovrium — Connexions',
  'admin.meta.organisation': 'Sovrium — Organisation',
  'admin.meta.users': 'Sovrium — Utilisateurs',
  'admin.meta.invitations': 'Sovrium — Invitations',
  'admin.meta.userAccount': 'Sovrium — Compte',
  'admin.meta.recordAccess': 'Sovrium — Qui a accès',
  'admin.meta.pages': 'Sovrium — Analytique',
  'admin.meta.automations': 'Sovrium — Exécutions',
  'admin.meta.automationRun': 'Sovrium — Exécution',
  'admin.meta.links': 'Sovrium — Liens',
  'admin.meta.templates': 'Sovrium — Modèles',
  'admin.meta.footprint': 'Sovrium — Empreinte',
  'admin.meta.decisions': 'Sovrium — Décisions',
  'admin.meta.decision': 'Sovrium — Décision',
  'admin.meta.login': 'Sovrium — Connexion',
  'admin.meta.forgotPassword': 'Sovrium — Mot de passe oublié',
  'admin.meta.resetPassword': 'Sovrium — Nouveau mot de passe',
} as const
