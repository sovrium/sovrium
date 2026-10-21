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
  'admin.shell.readOnly': 'Tu peux lire, pas modifier[ — ton rôle est $session.roleLabel]',
  'admin.shell.readOnlyShort': 'Lecture seule',
  'admin.shell.role.admin': 'Admin',
  'admin.shell.role.viewer': 'Lecteur',
  'admin.shell.myAccount': 'Mon profil',
  'admin.shell.myData': 'Mes données',
  'admin.shell.openApp': 'Ouvrir l’app',
  'admin.shell.shortcuts': 'Raccourcis clavier',
  'admin.shortcuts.title': 'Raccourcis clavier',
  'admin.shortcuts.description': 'Ils marchent sur toutes les pages de la console.',
  'admin.shortcuts.search': 'Tout rechercher',
  'admin.shortcuts.sidebar': 'Afficher ou masquer la barre latérale',
  'admin.shortcuts.close': 'Fermer un menu ou une fenêtre',
  'admin.shell.theme': 'Thème',
  'admin.shell.theme.light': 'Clair',
  'admin.shell.theme.dark': 'Sombre',
  'admin.shell.theme.system': 'Système',
  'admin.shell.signOut': 'Se déconnecter',

  // « Design » et « Overview » — le premier reste, le second non. Design est
  // le nom courant de la discipline en français et celui que porte la section ;
  // Overview a « Vue d’ensemble », qui dit la même chose sans emprunt.
  'admin.nav.overview': 'Vue d’ensemble',
  'admin.nav.group.activity': 'Activité',
  'admin.nav.group.data': 'Données',
  'admin.nav.group.people': 'Personnes et accès',
  'admin.nav.group.instance': 'Instance',
  'admin.nav.group.audience': 'Audience',
  'admin.nav.group.developers': 'Développeurs',
  'admin.nav.group.design': 'Design',
  'admin.nav.landmark.console': 'Console',
  'admin.nav.design.overview': 'Système de design',
  'admin.nav.design.foundations': 'Fondations',
  'admin.nav.design.components': 'Composants',
  'admin.nav.design.brand': 'Marque',
  'admin.nav.design.voice': 'Voix',

  'admin.crumb.profile': 'Mon profil',
  'admin.crumb.gdpr': 'Mes données',
  'admin.crumb.apiKeys': 'Clés API',
  'admin.crumb.report': 'Signaler un problème',
  'admin.crumb.env': 'Environnement',
  'admin.crumb.api': 'API',
  'admin.crumb.mcp': 'MCP',
  'admin.crumb.changelog': 'Journal des versions',
  'admin.crumb.records': 'Enregistrements',
  'admin.crumb.files': 'Fichiers',
  'admin.crumb.systemBucket': 'Système',
  'admin.crumb.conversations': 'Conversations',
  'admin.crumb.submissions': 'Réponses',
  'admin.crumb.connections': 'Connexions',
  'admin.crumb.organisation': 'Accès',
  'admin.crumb.auditLog': 'Journal d’audit',
  'admin.crumb.users': 'Utilisateurs',
  'admin.crumb.analytics': 'Analytique',
  'admin.crumb.runs': 'Exécutions',
  'admin.crumb.run': 'Exécution',
  'admin.crumb.links': 'Liens',
  'admin.crumb.templates': 'Modèles',
  'admin.crumb.decisions': 'Décisions',

  // The app's own name (`$app.label`) opens every title, as in English: it is
  // a name, not a word to translate.
  'admin.meta.welcome': '$app.label — Bienvenue',
  'admin.meta.acceptInvitation': '$app.label — Accepter l’invitation',
  'admin.meta.notFound': '$app.label — Page introuvable',
  'admin.meta.profile': '$app.label — Mon profil',
  'admin.meta.gdpr': '$app.label — Mes données',
  'admin.meta.apiKeys': '$app.label — Clés API',
  'admin.meta.internalError': '$app.label — Cette page n’a pas pu se charger',
  'admin.meta.report': '$app.label — Signaler un problème',
  'admin.meta.env': '$app.label — Environnement',
  'admin.meta.auditLog': '$app.label — Journal d’audit',
  'admin.meta.api': '$app.label — API',
  'admin.meta.mcp': '$app.label — MCP',
  'admin.meta.changelog': '$app.label — Journal des versions',
  'admin.meta.release': '$app.label — Journal des versions · Version',
  'admin.meta.tables': '$app.label — Enregistrements',
  'admin.meta.buckets': '$app.label — Fichiers',
  'admin.meta.agents': '$app.label — Conversations',
  'admin.meta.forms': '$app.label — Réponses',
  'admin.meta.connections': '$app.label — Connexions',
  'admin.meta.organisation': '$app.label — Accès',
  'admin.meta.users': '$app.label — Utilisateurs',
  'admin.meta.invitations': '$app.label — Invitations',
  'admin.meta.userAccount': '$app.label — Compte',
  'admin.meta.recordAccess': '$app.label — Qui a accès',
  'admin.meta.pages': '$app.label — Analytique',
  'admin.meta.automations': '$app.label — Exécutions',
  'admin.meta.automationRun': '$app.label — Exécution',
  'admin.meta.links': '$app.label — Liens',
  'admin.meta.templates': '$app.label — Modèles',
  'admin.meta.footprint': '$app.label — Empreinte',
  'admin.meta.decisions': '$app.label — Décisions',
  'admin.meta.decision': '$app.label — Décision',
  'admin.meta.login': '$app.label — Connexion',
  'admin.meta.forgotPassword': '$app.label — Mot de passe oublié',
  'admin.meta.resetPassword': '$app.label — Nouveau mot de passe',
  'admin.meta.designSystem': '$app.label — Système de design',
  'admin.meta.foundations': '$app.label — Fondations',
  'admin.meta.components': '$app.label — Composants',
  'admin.meta.component': '$app.label — $param.name',
  'admin.meta.brand': '$app.label — Marque',
  'admin.meta.voice': '$app.label — Voix',
} as const
