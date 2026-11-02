# Jalons

Calendriers de surveillance après chirurgie urologique, selon les recommandations du Comité de cancérologie de l'AFU (CCAFU). Application web installable sur téléphone et ordinateur. Les données restent sur l'appareil.

**Prototype. Les protocoles ne sont pas validés pour un usage en soins** : ils doivent être relus par un second praticien avant toute utilisation clinique.

Protocoles disponibles :
- RTUV pour TVNIM (CCAFU 2024-2026, tableaux III et IV), avec programmation des instillations : BCG-thérapie (induction et entretien de 1 ou 3 ans) et mitomycine C
- Prostatectomie totale (CCAFU 2024-2026, surveillance du PSA, conduite selon l'anatomopathologie)
- Cancer du rein localisé : néphrectomie partielle ou élargie (UISS, tableau IV) et ablation thermique (CCAFU 2024-2026)
- Tumeur germinale du testicule de stade I, après orchidectomie (tableau IX), et tumeur germinale métastatique en rémission après chimiothérapie (tableau X) (CCAFU 2024-2026)

## Mettre l'application en ligne sur GitHub (sans ligne de commande)

1. Sur github.com, connecté à votre compte, cliquez sur **+** en haut à droite, puis **New repository**. Nom : `jalons`. Laissez **Public**. Ne cochez rien d'autre. Cliquez sur **Create repository**.
2. Sur la page du dépôt vide, cliquez sur le lien **uploading an existing file**. Ouvrez le dossier `jalons` sur votre Mac, sélectionnez **tout son contenu** (Cmd + A) et glissez-le dans la page. Glissez le contenu, pas le dossier lui-même : `index.html` doit se retrouver à la racine du dépôt. Cliquez sur **Commit changes**.
3. Allez dans **Settings**, puis **Pages** dans la colonne de gauche. Source : **Deploy from a branch**. Branch : **main**, dossier **/ (root)**. Cliquez sur **Save**.
4. Attendez une à deux minutes. L'adresse apparaît en haut de la page Pages, de la forme `https://votre-identifiant.github.io/jalons/`.
5. Sur l'iPhone : ouvrez cette adresse dans Safari, touchez **Partager**, puis **Sur l'écran d'accueil**. Jalons s'ouvre alors comme une application et fonctionne hors connexion.

## Mettre à jour l'application

Sur la page du dépôt : **Add file**, puis **Upload files**, et glissez les fichiers modifiés (un fichier du même nom est remplacé). Ensuite, ouvrez `sw.js`, cliquez sur le crayon, changez `jalons-1` en `jalons-2` (puis 3, 4…) et validez. Sans ce changement de version, les téléphones gardent l'ancienne version en cache.

## Tester sur le Mac

Dans Terminal, depuis le dossier `jalons` :

```
python3 -m http.server 8000
```

puis ouvrez `http://localhost:8000` dans Safari ou Chrome. Pour les tests automatiques (Node.js requis, installeur sur nodejs.org) :

```
node tests/run.js
```

Résultat attendu : « 0 échec ».

## Données et confidentialité

- Les patients sont stockés dans le navigateur de l'appareil. Rien n'est envoyé sur internet : ni serveur, ni statistiques, ni police externe. Une politique de sécurité (CSP) interdit toute requête vers un autre site.
- Chaque appareil a ses propres données : l'iPhone et le Mac ne se synchronisent pas. Pour transférer, utilisez la sauvegarde chiffrée.
- Sur iPhone, utilisez toujours l'icône de l'écran d'accueil : les données saisies dans Safari et dans l'application installée sont séparées, et Safari peut effacer les données d'un site non consulté pendant plusieurs jours.
- Le patient est désigné par un **repère libre** (initiales, numéro interne). Évitez le nom complet et la date de naissance. Seul l'âge à l'intervention est demandé.
- Les rappels exportés vers l'agenda (fichier .ics) ne portent qu'un **code opaque** (ex. J-7K2Q), jamais le repère du patient.
- La **sauvegarde** est chiffrée (AES-256-GCM, clé dérivée du mot de passe par PBKDF2-SHA256, 310 000 itérations). Sans le mot de passe, elle est illisible.
- Le **verrouillage** (Touch ID, Face ID ou code de l'appareil) protège l'accès à l'écran. La protection de fond reste le code du téléphone.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Page de l'application |
| `css/app.css` | Présentation, mode clair et sombre |
| `js/engine.js` | Dates, registre des protocoles, calcul du calendrier. Aucune règle clinique |
| `js/app.js` | Interface, stockage, export agenda, sauvegarde, verrouillage |
| `protocols/*.js` | Un fichier par pathologie : toutes les règles cliniques sont là |
| `tests/run.js` | Tests, calendriers attendus écrits à la main depuis les recommandations |
| `sw.js` | Fonctionnement hors connexion |

## Ajouter une pathologie

1. **Fiche clinique d'abord** : source exacte (société savante, version, tableau), informations à saisir, règles de classement, calendrier par groupe, alertes, choix locaux séparés de la recommandation.
2. **Créer `protocols/<nom>.js`** en partant de `prostatectomie.js` (simple) ou `tvnim.js` (stratification, suivi à vie). L'identifiant `id` est définitif : il est enregistré dans chaque dossier patient.
3. **Déclarer le fichier** : une balise `<script src="protocols/<nom>.js"></script>` dans `index.html` (avant `js/app.js`), et le chemin dans la liste `FILES` de `sw.js`. Changer `VERSION` dans `sw.js`.
4. **Écrire les cas tests** dans `tests/run.js` à partir de la recommandation, puis lancer `node tests/run.js`.
5. **Valider** : passer `validated: true` seulement après relecture, en indiquant le valideur et la date dans `local`.

Modifier un protocole existant : incrémenter `version`. Les patients déjà saisis gardent leur calendrier enregistré ; la fiche patient signale que le protocole a changé.

## Statut

Outil d'organisation du suivi, il ne remplace pas la décision clinique. Un logiciel qui produit un calendrier individualisé à partir des données d'un patient peut relever de la réglementation des dispositifs médicaux : à évaluer avant tout déploiement au-delà d'un usage personnel de test.

Aucune licence n'est jointe : par défaut, tous droits réservés. Pour autoriser la réutilisation, ajoutez un fichier `LICENSE` depuis GitHub (**Add file**, **Create new file**, nom `LICENSE`, bouton **Choose a license template**).
