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
 * row), and the bug report link a console offers for the engine's own
 * failures (`report.*`). Part of
 * {@link INTERPRETER_UI_STRINGS} through the components table; kept apart only
 * so no file outgrows its ceiling. English is today's literal word for word,
 * French is built in, and an author renames any key under `sovrium.<key>`.
 */
export const CONSOLE_UI_STRINGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  // ---- API-key manager: the list, the create dialog, the one-time reveal, revoking ----
  'apiKeys.loading': { en: 'Loading your keys…', fr: 'Chargement de vos clés…' },
  'apiKeys.loadFailed': {
    en: 'Could not load your API keys.',
    fr: 'Impossible de charger vos clés d’API.',
  },
  'apiKeys.retry': { en: 'Retry', fr: 'Réessayer' },
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

  // ---- A failure that is the engine's fault: its request id and the bug report link ----
  // One `report.` family, drawn by the grid's failed read and by a run page alike.
  'report.problem': { en: 'Report on GitHub', fr: 'Signaler sur GitHub' },
  'report.opensInNewTab': {
    en: '(opens GitHub in a new tab)',
    fr: '(ouvre GitHub dans un nouvel onglet)',
  },
  'report.hint': {
    en: 'Opens a prefilled GitHub issue — nothing is sent until you submit it; review it first.',
    fr: 'Ouvre un ticket GitHub prérempli, rédigé en anglais — rien n’est envoyé tant que tu ne l’as pas soumis ; relis-le d’abord.',
  },
  'report.readFailed': {
    en: 'Sovrium hit an internal error while reading it. Retry; if it fails again, report it so it gets fixed.',
    fr: 'Sovrium a rencontré une erreur interne en le lisant. Réessaie ; si ça échoue encore, signale-le pour qu’il soit corrigé.',
  },
  'report.preparing': { en: 'Preparing the report…', fr: 'Préparation du signalement…' },
  'report.unavailable': {
    en: 'Couldn’t prepare the report. Copy the request ID and include it when you open an issue.',
    fr: 'Le signalement n’a pas pu être préparé. Copie l’identifiant de la requête et joins-le quand tu ouvres un ticket.',
  },
  'report.unavailableRun': {
    en: 'Couldn’t prepare the report. Copy the run ID and add it to an issue on GitHub.',
    fr: 'Le signalement n’a pas pu être préparé. Copie l’identifiant de l’exécution et ajoute-le à un ticket sur GitHub.',
  },
  'report.blankIssue': { en: 'Open a blank issue', fr: 'Ouvrir un ticket vierge' },
  'report.expired': {
    en: 'This error is no longer kept on the server, so the report can’t be prefilled. Copy the request ID; the server log still has it.',
    fr: 'Cette erreur n’est plus conservée sur le serveur, le signalement ne peut donc pas être prérempli. Copie l’identifiant de la requête ; le journal du serveur l’a encore.',
  },
  'report.expiredRun': {
    en: 'This run’s error details are no longer kept, so it can’t be reported from here. Copy the run ID instead.',
    fr: 'Les détails de l’erreur de cette exécution ne sont plus conservés, elle ne peut donc pas être signalée d’ici. Copie plutôt l’identifiant de l’exécution.',
  },
  'report.requestId': { en: 'Request ID', fr: 'Identifiant de la requête' },
  'report.copyRequestId': { en: 'Copy request ID', fr: 'Copier l’identifiant de la requête' },
  'report.runId': { en: 'Run ID', fr: 'Identifiant de l’exécution' },
  'report.copyRunId': { en: 'Copy run ID', fr: 'Copier l’identifiant de l’exécution' },
  'report.copied': { en: 'Copied', fr: 'Copié' },
  'report.reload': { en: 'Reload', fr: 'Recharger' },
  'report.lastError': {
    en: 'Report the last internal error',
    fr: 'Signaler la dernière erreur interne',
  },
  'report.noneKept': {
    en: 'No internal error has been kept. If something looks wrong, describe it in a new report.',
    fr: 'Aucune erreur interne n’a été conservée. Si quelque chose cloche, décris-le dans un nouveau signalement.',
  },
  // A failure the deployment can fix answers its code instead of a report (`report.fix.<code>`).
  'report.fix.missing-env': {
    en: 'A required environment variable isn’t set. Set it in the instance environment, then restart.',
    fr: 'Une variable d’environnement requise n’est pas définie. Définis-la dans l’environnement de l’instance, puis redémarre.',
  },
  'report.fix.invalid-env': {
    en: 'An environment variable has a value Sovrium can’t use. Correct it in the instance environment, then restart.',
    fr: 'Une variable d’environnement a une valeur que Sovrium ne peut pas utiliser. Corrige-la dans l’environnement de l’instance, puis redémarre.',
  },
  'report.fix.database-schema-drift': {
    en: 'A table this app declares is missing from the database. Restore it, or restart Sovrium so it migrates the schema, then reload.',
    fr: 'Une table que l’app déclare manque dans la base de données. Restaure-la, ou redémarre Sovrium pour qu’il migre le schéma, puis recharge.',
  },
  'report.fix.database-unreachable': {
    en: 'The database can’t be reached. Check that it’s running and that DATABASE_URL is right, then reload.',
    fr: 'La base de données est injoignable. Vérifie qu’elle tourne et que DATABASE_URL est correcte, puis recharge.',
  },
  'report.fix.database-resources': {
    en: 'The database ran out of room. Free disk space or connections, or fix the permissions of the database file.',
    fr: 'La base de données manque de place. Libère de l’espace disque ou des connexions, ou corrige les permissions du fichier de la base.',
  },
}
