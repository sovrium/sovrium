/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const about: Record<string, string> = {
  'about.meta.title': 'Sovrium — A propos',
  'about.meta.description':
    'Découvrez les personnes et les idées derrière Sovrium. Une plateforme pilotée par la configuration pour construire des outils internes que vous possédez entièrement.',
  'about.meta.og.title': 'Sovrium — A propos',
  'about.meta.og.description':
    'Les personnes et les idées derrière Sovrium. Une plateforme pour construire des outils internes que vous possédez entièrement.',
  'about.meta.twitter.title': 'Sovrium — A propos',
  'about.meta.twitter.description':
    'Les personnes et les idées derrière Sovrium. Une plateforme pour construire des outils internes que vous possédez entièrement.',
  'about.hero.eyebrow': 'ESSENTIAL SERVICES',
  'about.hero.title': 'Un logiciel vraiment à vous',
  'about.hero.subtitle':
    "Sovrium est une plateforme pilotée par la configuration pour construire des outils internes. Vous l'hébergez, vous contrôlez les données, et vous n'êtes jamais enfermé.",
  'about.hero.tagline': '« Vos données. Vos outils. Votre avenir. »',
  'about.mission.title': 'Notre Mission',
  'about.mission.description':
    'Construire des outils internes oblige souvent à choisir son camp. Le no-code livre vite mais enferme. Le code sur mesure donne le contrôle mais noie sous la maintenance. On pense que vous ne devriez pas avoir à choisir.',
  'about.mission.statement':
    "Sovrium donne aux équipes la rapidité du no-code et la flexibilité du code, dans une seule plateforme qu'elles possèdent et hébergent elles-mêmes.",
  'about.values.title': 'Nos Valeurs',
  'about.values.subtitle':
    "Ce qui guide nos décisions, de l'architecture au rapport avec la communauté.",
  'about.values.sovereignty.icon': '🛡️',
  'about.values.sovereignty.title': 'Maîtrise des données',
  'about.values.sovereignty.description':
    "Vos données restent sur votre infrastructure. Pas d'analytics tiers, pas de tracking d'usage, pas de changements surprises sur le stockage ou le partage de vos informations.",
  'about.values.transparency.icon': '🔍',
  'about.values.transparency.title': 'Transparence',
  'about.values.transparency.description':
    'Le code source est disponible. La feuille de route est publique. Les tarifs sont clairs. Si quelque chose change, vous le saurez avant que cela ne vous affecte.',
  'about.values.simplicity.icon': '✨',
  'about.values.simplicity.title': 'Simplicité',
  'about.values.simplicity.description':
    'Un fichier de config, une commande, une plateforme. On travaille dur pour garder les choses simples afin que vous puissiez vous concentrer sur ce qui compte pour votre équipe.',
  'about.values.ownership.icon': '🏡',
  'about.values.ownership.title': 'Propriété complète',
  'about.values.ownership.description':
    'Tout ce que nous construisons pour vous vous appartient. Accès complet au source, portabilité totale des données, zéro enfermement. Vous pouvez partir quand vous voulez et tout emporter.',
  'about.principles.title': 'Comment nous construisons',
  'about.principles.subtitle':
    'Quatre principes techniques qui façonnent le fonctionnement de Sovrium sous le capot.',
  'about.principles.configOverCode.title': 'La configuration plutôt que le code',
  'about.principles.configOverCode.description':
    'Les applications métier doivent être configurées, pas programmées. TypeScript, YAML ou JSON — choisissez votre format, obtenez une app complète en secondes.',
  'about.principles.minimalDeps.title': 'Dépendances minimales',
  'about.principles.minimalDeps.description':
    "Un runtime (Bun), une base de données (PostgreSQL), zéro SDK fournisseur. Moins de pièces en mouvement, c'est moins de choses qui peuvent casser.",
  'about.principles.businessFocus.title': 'Orienté métier',
  'about.principles.businessFocus.description':
    "Les ingénieurs doivent se concentrer sur la logique métier, pas l'infrastructure. Sovrium gère l'auth, la base de données, l'API et l'UI nativement.",
  'about.principles.configReuse.title': 'Réutilisabilité des configurations',
  'about.principles.configReuse.description':
    'Les templates de configuration deviennent des actifs organisationnels. Construisez CRM, outils projet et portails à partir de configs composables et versionnées.',
  'about.team.title': "L'équipe",
  'about.team.founder.name': 'Thomas Jeanneau',
  'about.team.founder.role': 'Fondateur',
  'about.cta.title': 'Participez au projet',
  'about.cta.description':
    'Sovrium est source-available et en développement actif. Mettez une étoile au repo, ouvrez une issue, ou construisez quelque chose avec.',
  'about.cta.github': 'Voir sur GitHub',
  'about.cta.partner': 'Travailler avec nous',
  'about.cta.partner.href': '/fr/partner',
  'about.origin.title': 'Pourquoi Sovrium existe',
  'about.origin.paragraph1':
    "J'ai passé des années à construire des outils internes pour des organisations — en no-code, low-code et code. Je livrais vite. Les outils marchaient. Les clients étaient contents, au début.",
  'about.origin.paragraph2':
    "Avec le temps, les fissures sont apparues. Un éditeur changeait son API sans prévenir et cassait un workflow entier du jour au lendemain. Les coûts augmentaient de façon imprévisible avec l'usage. Faire communiquer cinq outils différents entre eux devenait un chantier de maintenance à part entière. Et les données vivaient sur un patchwork de plateformes SaaS, chacune avec son propre modèle tarifaire et ses propres conditions.",
  'about.origin.paragraph3':
    "Il n'y avait pas de versioning sur l'ensemble du système. Pas de tests. Pas de moyen propre de collaborer sur quelque chose construit avec une dizaine d'outils différents. Les organisations avec lesquelles je travaillais avaient une visibilité limitée sur le fonctionnement réel de leurs systèmes centraux — et une capacité limitée à changer de cap quand elles en avaient besoin.",
  'about.origin.paragraph4':
    "J'ai réalisé que le problème de fond n'était pas un outil en particulier. On peut construire des applications fonctionnelles et performantes rapidement avec la stack actuelle. Mais les maintenir dans le temps, à l'échelle, sans perdre le contrôle de ses données ni de son budget — c'est là que ça se complique.",
  'about.origin.paragraph5':
    'Sovrium est ma tentative pour résoudre ce problème. Une plateforme qui combine la rapidité du no-code avec la flexibilité du code. Pilotée par la configuration, auto-hébergée, entièrement versionnable et testable — conçue pour donner aux équipes un vrai contrôle sur les outils dont elles dépendent.',
  'about.origin.signature': '— Thomas Jeanneau, Fondateur',
}
