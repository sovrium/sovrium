/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the console calls a built-in tool, per console language.
 *
 * The tool names are the engine's own identifiers (`record.read`, the built-in
 * agent's `query_<table>`, the `chat.<type>` lines a chat turn stores for an
 * answer the server composed itself). An English console reads each made
 * readable (`Record read`), except the `chat.<type>` steps, which read as the
 * record operation they ran (`Record query`) rather than as the word "chat". A
 * French console reads them from the catalogue below, in the words its other
 * strings use. A name the catalogue does not hold reads made readable in
 * either language.
 *
 * Kept beside `SYSTEM_AGENT_WORDS` in the agent index read, on the same
 * precedent: these are the console's words for the engine's own names, which
 * no app config declares and so no app dictionary can translate.
 */

import { readableName } from '@/domain/models/app/auth/readable-name-service'
import type { ConsoleLanguage } from './operator-language'

/** The French names of the agent actions and the chat steps, by identifier. */
const FRENCH_TOOL_WORDS: Readonly<Record<string, string>> = {
  'record.read': 'Lire un enregistrement',
  'record.list': 'Lister les enregistrements',
  'record.create': 'Créer un enregistrement',
  'record.update': 'Modifier un enregistrement',
  'record.delete': 'Supprimer un enregistrement',
  'record.query': 'Rechercher des enregistrements',
  'state.get': 'Lire une valeur mémorisée',
  'state.set': 'Mémoriser une valeur',
  'state.increment': 'Incrémenter une valeur mémorisée',
  'state.delete': 'Oublier une valeur mémorisée',
  'state.list': 'Lister les valeurs mémorisées',
  'http.request': 'Appeler une API',
  'ai.generate': 'Générer un texte',
  'ai.classify': 'Classer un texte',
  'ai.extract': 'Extraire des données',
  'code.runTypescript': 'Exécuter du TypeScript',
  'email.send': 'Envoyer un e-mail',
  'auth.createUser': 'Créer un compte',
  'auth.assignRole': 'Attribuer un rôle',
  'auth.banUser': 'Bannir un compte',
  'auth.unbanUser': 'Lever un bannissement',
  'file.upload': 'Téléverser un fichier',
  'file.download': 'Télécharger un fichier',
  'file.delete': 'Supprimer un fichier',
  'file.list': 'Lister les fichiers',
  'file.getMetadata': 'Lire les informations d’un fichier',
  'browser.use': 'Utiliser le navigateur',
  'automation.run': 'Lancer une automatisation',
}

/** The built-in agent's per-table read tools, `query_<table>` and `count_<table>`, in French. */
const FRENCH_TABLE_TOOL_VERBS: Readonly<Record<string, string>> = {
  query: 'Interroger',
  count: 'Compter',
}

/** A `chat.<type>` step as the operation it ran: `chat.query` is a record query. */
const asOperation = (name: string): string => {
  if (!name.startsWith('chat.')) return name
  const type = name.slice('chat.'.length)
  return type === 'automation' ? 'automation.run' : `record.${type}`
}

/** The French name of a `query_<table>` / `count_<table>` tool, or `undefined`. */
const frenchTableTool = (name: string): string | undefined => {
  const cut = name.indexOf('_')
  if (cut <= 0) return undefined
  const verb = FRENCH_TABLE_TOOL_VERBS[name.slice(0, cut)]
  return verb === undefined ? undefined : `${verb} ${name.slice(cut + 1)}`
}

/** What the console prints for the built-in tool `name`, in `language`. */
export const toolLabelOf = (name: string, language: ConsoleLanguage): string => {
  const operation = asOperation(name)
  if (language === 'fr') {
    return FRENCH_TOOL_WORDS[operation] ?? frenchTableTool(name) ?? readableName(operation)
  }
  return readableName(operation)
}
