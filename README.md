# LUMENFALL — Arènes du Soleil Brisé

Jeu d'arène 3D jouable directement dans le navigateur. L'application qui s'ouvre **est** le jeu :
menu principal cinématographique, arène de 400 × 400 m, modes, bots, Échos, profils, progression,
personnalisation, audio synthétisé — une seule expérience continue.

> Hélios-9, dernier anneau d'une étoile brisée. Les Porteurs s'affrontent dans les Arènes d'Éclat
> pour raviver la lumière.

## Fonctionnalités livrées

| Système | État |
|---|---|
| Menu cinématographique 3D (scène live, caméra orbitale, piédestaux) | ✅ |
| Carte 400×400 m — 4 districts (Forge, Archives, Biolume, Relais) + Prisme central | ✅ |
| Rendu : bloom, étalonnage, FXAA, ombres PCF, environnement PMREM, ciel shader, instancing | ✅ |
| 4 modes réels : Confluence (équipes), Moisson (FFA éclats), Survie (vagues), Entraînement | ✅ |
| Bots : IA à états (patrouille/engagement orbite/collecte/fuite), 3 difficultés réelles | ✅ |
| TPS : visée pointer-lock, sprint, saut, propulseurs, rechargement, tête/torse, bouclier régénérant | ✅ |
| Contrôles tactiles (joystick + visée + boutons, assistance de visée) | ✅ |
| Échos : amis, recherche, demandes (reçues/envoyées/annulation), présence simulée, invitations | ✅ locaux |
| Escouade : slots, invitations, apparition 3D des membres, lancement avec l'escouade | ✅ |
| Profils, statistiques réelles, historique, défi du jour, niveaux/XP/Lumen, boutique cosmétique | ✅ |
| Personnalisation : 4 châssis, couleurs blindage/énergie, 6 bannières, titres, aperçu 3D draggable | ✅ |
| Audio 100 % synthétisé : musiques génératives menu/jeu, ~30 SFX, ambiance, 4 volumes + mute (M) | ✅ |
| Paramètres complets sauvegardés (qualité, résolution, FOV, sensibilité, langue FR/EN, etc.) | ✅ |
| Notifications, toasts, killfeed, minimap, tableau des scores, écran de fin, pause | ✅ |
| Présence réseau réelle via serveur WebSocket optionnel (`server/`) | ✅ optionnel |
| Multijoueur synchronisé (parties partagées) | ❌ non implémenté — voir Roadmap |

### Honnêteté multijoueur
Les « Échos » sont des **compagnons IA locaux**, assumés et diégétiques (indiqué dans l'interface).
GitHub Pages héberge le client statique ; il ne peut pas être un serveur de jeu.
Le dossier `server/` fournit un vrai serveur de **présence** (liste des joueurs connectés en temps réel,
relais d'invitations). La synchronisation de gameplay n'est pas implémentée et n'est jamais prétendue.

## Lancer en local
Aucun build n'est nécessaire (ES modules + import map, Three.js via CDN).
Un serveur statique est requis (les modules locaux ne se chargent pas en `file://`) :

```bash
# au choix
python3 -m http.server 8000
# ou
npx serve .

## Publier sur GitHub Pages

1. Crée un dépôt GitHub (par exemple `lumenfall`) et choisis-le public si tu utilises GitHub Pages avec l'offre gratuite.
2. Envoie **tout le contenu de ce dossier** à la racine du dépôt : `index.html`, `styles/`, `js/`, `server/` et `.github/`.
3. Dans GitHub, ouvre **Settings → Pages** et vérifie que la source de déploiement est **GitHub Actions**.
4. La publication se lance automatiquement après un push sur la branche `main` (ou via l'action manuelle dans l'onglet Actions).
5. Une fois le workflow terminé, GitHub affiche l'adresse publique du site dans **Settings → Pages**.

Le fichier `.github/workflows/deploy.yml` est déjà configuré pour publier la racine du dépôt avec GitHub Pages.

### Aperçu sur ton ordinateur

Ne double-clique pas sur `index.html` : le jeu utilise des modules JavaScript ES qui nécessitent un serveur local. Depuis ce dossier, lance `python3 -m http.server 8000`, puis ouvre `http://localhost:8000` dans ton navigateur. Une connexion Internet est nécessaire au premier chargement pour récupérer Three.js depuis le CDN.

**Note :** GitHub Pages publie le client web statique. Le serveur optionnel situé dans `server/` n'est pas hébergé par GitHub Pages et doit être déployé séparément si tu souhaites activer la présence WebSocket.
