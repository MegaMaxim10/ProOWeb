# ProOWeb

Process-Oriented Web Application Builder.

## Vision

ProOWeb est un editeur web (IDE) qui aide une equipe a construire une application metier
(backend + frontend) en restant centree sur les processus, tout en gardant la main sur le code source.

## Ce que fait ce MVP

- Lance un editeur Node.js sur `http://localhost:1755` via `npm run prooweb`.
- Affiche un wizard si le workspace n'est pas initialise.
- Recupere les informations de base du projet, du super administrateur, du depot Git,
  et des options backend Swagger UI.
- Genere automatiquement le projet cible **a la racine du depot courant**:
  - `src/backend/springboot` (Spring Boot + `/api/meta` + `/actuator/health`),
  - `src/frontend/web/react` (React/Vite connecte au backend),
  - `src/frontend/mobile` (placeholder),
  - `deployment/docker` avec profils `dev`, `demo`, `test`, `preprod`, `prod`,
  - scripts raccourcis racine (build/test/start).
- Versionne les sources generees via `.prooweb-managed.json`.
- Expose un endpoint de migration (`POST /api/migrate`) pour re-aligner un projet sur
  la version courante de l'editeur (migration infra non destructive).

## Regle Git du wizard

- Si l'utilisateur renseigne un lien Git:
  - l'ancien `.git` est remplace,
  - un nouveau depot Git est initialise,
  - `origin` pointe sur le lien fourni.
- Si aucun lien n'est renseigne:
  - le dossier `.git` courant est supprime.

## Swagger UI

Le wizard permet d'activer Swagger UI uniquement pour les profils non preprod/prod (`dev`, `demo`, `test`).
Quand active, ProOWeb:

- ajoute la dependance `springdoc-openapi-starter-webmvc-ui`,
- garde Swagger desactive par defaut,
- active Swagger sur les profils selectionnes via `application-<profile>.yml`.

## Utilisation

1. Demarrer l'editeur:

```bash
npm run prooweb
```

2. Ouvrir `http://localhost:1755` et terminer le wizard.

3. Utiliser les raccourcis npm (depuis la racine):

```bash
npm run compile
npm test
npm run start:dev
npm run start:demo
npm run start:test
npm run start:preprod
npm run start:prod
```

## Fichiers clefs

- `ProOWeb/src/server.js`: serveur editor + API wizard/dashboard/migration.
- `ProOWeb/src/lib/workspace.js`: validation + persistance + versionnage management.
- `ProOWeb/src/lib/generator.js`: generation backend/frontend/docker/scripts + manifest managé.
- `ProOWeb/src/lib/git.js`: politique Git appliquee par le wizard.
- `ProOWeb/public/*`: interface wizard et dashboard.
