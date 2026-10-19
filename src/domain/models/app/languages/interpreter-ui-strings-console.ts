/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The interpreter strings of the console's own islands mounted from a plain
 * container: the API-key manager (`apiKeys.*`) and the agents' conversation
 * viewer's controls, composer and run trail (`agentConversations.*`, beside
 * the list states the components table holds), and the search palette's kind
 * words (`commandPalette.kind.*` for a group, `commandPalette.kindOne.*` for a
 * row). Part of
 * {@link INTERPRETER_UI_STRINGS} through the components table; kept apart only
 * so no file outgrows its ceiling. English is today's literal word for word,
 * French is built in, and an author renames any key under `sovrium.<key>`.
 */
export const CONSOLE_UI_STRINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // ---- API-key manager: the list, the create dialog, the one-time reveal, revoking ----
  'apiKeys.loading': { en: 'Loading your keys…', fr: 'Chargement de vos clés…' },
  'apiKeys.loadFailed': {
    en: 'Could not load your API keys. Reload to try again.',
    fr: 'Impossible de charger vos clés d’API. Rechargez la page pour réessayer.',
  },
  'apiKeys.empty': { en: 'You have no API keys yet.', fr: 'Vous n’avez encore aucune clé d’API.' },
  'apiKeys.emptyBody': {
    en: 'Create one to let a script or a scheduled job call the API as you.',
    fr: 'Créez-en une pour qu’un script ou une tâche planifiée appelle l’API en votre nom.',
  },
  'apiKeys.list': { en: 'Your API keys', fr: 'Vos clés d’API' },
  'apiKeys.name': { en: 'Name', fr: 'Nom' },
  'apiKeys.prefix': { en: 'Prefix', fr: 'Préfixe' },
  'apiKeys.created': { en: 'Created', fr: 'Créée le' },
  'apiKeys.actions': { en: 'Actions', fr: 'Actions' },
  'apiKeys.unnamed': { en: 'Unnamed key', fr: 'Clé sans nom' },
  'apiKeys.revoke': { en: 'Revoke', fr: 'Révoquer' },
  'apiKeys.revokeTitle': { en: 'Revoke API key', fr: 'Révoquer la clé d’API' },
  /** `{name}` is the key's name. */
  'apiKeys.revokePrompt': {
    en: 'Revoke “{name}”? Anything still presenting it stops working immediately, and it cannot be restored.',
    fr: 'Révoquer « {name} » ? Tout ce qui l’utilise encore cesse aussitôt de fonctionner, et elle ne pourra pas être restaurée.',
  },
  'apiKeys.revokeKey': { en: 'Revoke key', fr: 'Révoquer la clé' },
  'apiKeys.cancel': { en: 'Cancel', fr: 'Annuler' },
  'apiKeys.create': { en: 'Create key', fr: 'Créer une clé' },
  'apiKeys.createTitle': { en: 'Create an API key', fr: 'Créer une clé d’API' },
  'apiKeys.createBody': {
    en: 'The key acts as you. You see its value once, right after you create it.',
    fr: 'La clé agit en votre nom. Sa valeur ne s’affiche qu’une fois, juste après sa création.',
  },
  'apiKeys.namePlaceholder': {
    en: 'e.g. Zapier sync',
    fr: 'ex. synchro Zapier',
  },
  'apiKeys.nameHint': {
    en: 'Name it after the job that will use it — that name is how you will recognise it later.',
    fr: 'Nommez-la d’après la tâche qui l’utilisera : c’est à ce nom que vous la reconnaîtrez.',
  },
  'apiKeys.generate': { en: 'Generate key', fr: 'Générer la clé' },
  'apiKeys.generating': { en: 'Generating…', fr: 'Génération…' },
  'apiKeys.createFailed': {
    en: 'Could not create the key. Check you are still signed in and try again.',
    fr: 'Impossible de créer la clé. Vérifiez que vous êtes toujours connecté, puis réessayez.',
  },
  'apiKeys.newKey': { en: 'Your new API key', fr: 'Votre nouvelle clé d’API' },
  'apiKeys.value': { en: 'API key value', fr: 'Valeur de la clé d’API' },
  'apiKeys.copyNow': {
    en: 'Copy this key now — it is shown once and cannot be recovered.',
    fr: 'Copiez cette clé maintenant : elle ne s’affiche qu’une fois et ne peut pas être récupérée.',
  },
  'apiKeys.copy': { en: 'Copy', fr: 'Copier' },
  'apiKeys.copied': { en: 'Copied to your clipboard.', fr: 'Copiée dans le presse-papiers.' },
  'apiKeys.copyFailed': {
    en: 'Could not copy — select the key above and copy it manually.',
    fr: 'Copie impossible : sélectionnez la clé ci-dessus et copiez-la vous-même.',
  },
  'apiKeys.done': { en: 'Done', fr: 'Terminé' },

  // ---- Agents' conversations: the controls above the list ----
  'agentConversations.agent': { en: 'Agent', fr: 'Agent' },
  'agentConversations.filterByAgent': { en: 'Filter by agent', fr: 'Filtrer par agent' },
  'agentConversations.allAgents': { en: 'All agents', fr: 'Tous les agents' },
  'agentConversations.search': {
    en: 'Search conversations…',
    fr: 'Rechercher des conversations…',
  },
  'agentConversations.searchLabel': {
    en: 'Search conversations',
    fr: 'Rechercher des conversations',
  },
  'agentConversations.list': { en: 'Conversations', fr: 'Conversations' },
  'agentConversations.thread': { en: 'Message thread', fr: 'Fil des messages' },
  /** The speaker tag of each message in a transcript. */
  'agentConversations.roleUser': { en: 'User', fr: 'Utilisateur' },
  'agentConversations.roleAssistant': { en: 'Agent', fr: 'Agent' },
  'agentConversations.roleTool': { en: 'Tool', fr: 'Outil' },
  'agentConversations.roleSystem': { en: 'System', fr: 'Système' },

  // ---- The console search palette: each result kind's group heading and its row badge ----
  'commandPalette.kind.record': { en: 'Records', fr: 'Enregistrements' },
  'commandPalette.kind.submission': { en: 'Submissions', fr: 'Réponses' },
  'commandPalette.kind.run': { en: 'Runs', fr: 'Exécutions' },
  'commandPalette.kind.user': { en: 'Users', fr: 'Utilisateurs' },
  'commandPalette.kind.file': { en: 'Files', fr: 'Fichiers' },
  'commandPalette.kind.conversation': { en: 'Conversations', fr: 'Conversations' },
  'commandPalette.kind.connection': { en: 'Connections', fr: 'Connexions' },
  'commandPalette.kind.design-console': { en: 'Design system', fr: 'Système de design' },
  'commandPalette.kind.component-type': { en: 'Component types', fr: 'Types de composants' },
  'commandPalette.kindOne.record': { en: 'Record', fr: 'Enregistrement' },
  'commandPalette.kindOne.submission': { en: 'Submission', fr: 'Réponse' },
  'commandPalette.kindOne.run': { en: 'Run', fr: 'Exécution' },
  'commandPalette.kindOne.user': { en: 'User', fr: 'Utilisateur' },
  'commandPalette.kindOne.file': { en: 'File', fr: 'Fichier' },
  'commandPalette.kindOne.conversation': { en: 'Conversation', fr: 'Conversation' },
  'commandPalette.kindOne.connection': { en: 'Connection', fr: 'Connexion' },
  'commandPalette.kindOne.design-console': { en: 'Console page', fr: 'Page de la console' },
  'commandPalette.kindOne.component-type': { en: 'Component type', fr: 'Type de composant' },
}
