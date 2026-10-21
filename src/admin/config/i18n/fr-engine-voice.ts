/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The engine's French says `vous`, because it reaches every app's end users.
// The console says `tu` (`fr.ts`, VOICE), so it overrides each engine string it
// renders under the reserved `sovrium.` prefix — the record sheet, the grid,
// the import and filter controls, the API keys manager, the palette, the AI
// chat — and the engine itself is left as it is.

export default {
  'sovrium.action.unreachable': 'L’action n’a pas pu être exécutée. Réessaie.',
  'sovrium.agentConversations.idle': 'Choisis une conversation',
  'sovrium.agentConversations.idleBody': 'Choisis-en une dans la liste pour lire ses messages.',
  'sovrium.agentConversations.loadFailedBody':
    'Les conversations n’ont pas pu se charger. Réessaie.',
  'sovrium.agentConversations.threadFailedBody': 'Les messages n’ont pas pu se charger. Réessaie.',
  'sovrium.aiChat.awaitingApproval': 'En attente de ton accord',
  'sovrium.aiChat.closed': 'Plus en attente de décision. Redemande si tu en as encore besoin.',
  'sovrium.aiChat.composer.voiceError': 'L’enregistrement n’a pas pu être transcrit. Réessaie.',
  'sovrium.aiChat.notConfigured':
    'Le chat IA n’est pas configuré ici. Définis AI_PROVIDER, et AI_API_KEY pour un fournisseur hébergé, pour l’activer.',
  'sovrium.aiChat.placeholder': 'Pose une question…',
  'sovrium.aiChat.question.closed':
    'Cette question est close. Redemande si tu en as encore besoin.',
  'sovrium.apiKeys.copyFailed':
    'Copie impossible : sélectionne la clé ci-dessus et copie-la toi-même.',
  'sovrium.apiKeys.copyNow':
    'Copie cette clé maintenant : elle ne s’affiche qu’une fois et ne peut pas être récupérée.',
  'sovrium.apiKeys.createBody':
    'La clé agit en ton nom. Sa valeur ne s’affiche qu’une fois, juste après sa création.',
  'sovrium.apiKeys.createFailed':
    'Impossible de créer la clé. Vérifie que tu es toujours connecté, puis réessaie.',
  'sovrium.apiKeys.empty': 'Tu n’as encore aucune clé d’API.',
  'sovrium.apiKeys.emptyBody':
    'Crées-en une pour qu’un script ou une tâche planifiée appelle l’API en ton nom.',
  'sovrium.apiKeys.list': 'Tes clés d’API',
  'sovrium.apiKeys.loadFailed':
    'Tes clés d’API n’ont pas pu se charger. Recharge la page pour réessayer.',
  'sovrium.apiKeys.loading': 'Chargement de tes clés…',
  'sovrium.apiKeys.nameHint':
    'Nomme-la d’après la tâche qui l’utilisera : c’est à ce nom que tu la reconnaîtras.',
  'sovrium.apiKeys.newKey': 'Ta nouvelle clé d’API',
  'sovrium.commandPalette.commandPlaceholder': 'Saisis une commande ou recherche…',
  'sovrium.commandPalette.searchAll': 'Rechercher dans toutes tes données',
  'sovrium.commandPalette.startTyping':
    'Commence à taper pour rechercher des enregistrements, des réponses, des fichiers, des automatisations et des utilisateurs.',
  'sovrium.component.configHint':
    'Ajoute-la à ce composant dans la configuration de l’application, puis redéploie.',
  'sovrium.component.refreshToRetry': 'Actualise la page pour réessayer.',
  'sovrium.csvImport.drop': 'Glisse-dépose un fichier CSV ici',
  'sovrium.datatable.createFailed': 'Impossible d’enregistrer. Réessaie.',
  'sovrium.dialog.typeToConfirm': 'Pour confirmer, saisis « {text} »',
  'sovrium.dialog.typeToConfirmAsked': 'Pour confirmer, saisis le texte demandé',
  'sovrium.filePreview.cannotShow':
    '{name} ne peut pas être affiché ici. Télécharge-le pour l’ouvrir.',
  'sovrium.fileUpload.dropPrompt': 'Dépose des fichiers ici',
  'sovrium.form.confirmPrompt': 'Tu veux vraiment continuer ?',
  'sovrium.form.dropFiles': 'Dépose des fichiers ici ou clique pour parcourir',
  'sovrium.form.selectUser': 'Choisis un utilisateur…',
  'sovrium.form.uploadFailed': 'L’envoi du fichier a échoué. Réessaie.',
  'sovrium.form.uploadTypeRefused':
    'Ce type de fichier n’est pas accepté. Choisis un autre fichier.',
  'sovrium.rateLimit.message': 'Trop de requêtes. Patiente un instant, puis réessaie.',
  'sovrium.rateLimit.retryIn': 'Trop de requêtes, réessaie dans {seconds} s.',
  'sovrium.recordDrawer.browse': 'parcours',
  'sovrium.recordDrawer.dropFiles': 'Dépose des fichiers ou {browse}',
  'sovrium.recordDrawer.invalidJson': 'Saisis un JSON valide.',
  'sovrium.recordDrawer.saveRefused':
    'Tu ne peux pas modifier cet enregistrement, ou il n’existe plus.',
  'sovrium.tree.loadFailed': '{label} n’a pas pu se charger. Recharge la page pour réessayer.',
} as const
