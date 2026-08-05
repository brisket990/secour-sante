# Déploiement sur Coolify

Le projet était déployé sur Railway (build auto via nixpacks, sans fichier de config).
Il utilise maintenant un `Dockerfile` explicite, compatible Coolify.

## 1. Créer la ressource dans Coolify

- **+ New** → **Application** → source **GitHub** → dépôt `brisket990/secour-sante`, branche `main`
- **Build Pack** : `Dockerfile` (et non Nixpacks — le `Dockerfile` à la racine sera détecté)
- **Port exposé** : `3000`
- **Domaine (FQDN)** : `https://readirect.xothiques.duckdns.org`

## 2. Variables d'environnement

À définir dans l'onglet **Environment Variables** de l'application.

| Variable | Obligatoire | Rôle |
|---|---|---|
| `TURSO_DATABASE_URL` | oui | URL de la base Turso (`libsql://...`), à recopier depuis Railway |
| `TURSO_AUTH_TOKEN` | oui | Token Turso, à recopier depuis Railway |
| `ADMIN_PASSWORD` | oui | Mot de passe admin. Sans lui, la valeur par défaut est `admin123` |
| `JWT_SECRET` | oui | Secret de signature des tokens. Sans lui, une valeur publique du dépôt est utilisée |
| `PORT` | non | `3000` par défaut, Coolify le fournit généralement |
| `DB_ALLOW_LOCAL_FALLBACK` | non | Voir « Base de données » ci-dessous. Laisser vide en production |
| `SMTP_USER`, `MAIL_TO` | non | **Sans effet aujourd'hui**, voir « Limitation connue » |

⚠️ Changer `JWT_SECRET` déconnecte tous les utilisateurs (les tokens existants
deviennent invalides). C'est normal, ils se reconnectent.

## 3. Base de données

Le code choisit son mode tout seul au démarrage :

- `TURSO_DATABASE_URL` défini → **Turso** (le mode retenu ici)
- sinon → **SQLite local** via sql.js, dans `DB_PATH` (défaut `/app/data/hopitaux.db`)

Si la connexion Turso échoue au démarrage, l'application **s'arrête maintenant avec
une erreur explicite** au lieu de basculer silencieusement sur une base locale vide.
C'était le comportement précédent, et il serait dangereux en conteneur : le disque
est éphémère, donc le site aurait affiché une base vide et perdu toute écriture au
redéploiement suivant. Le déploiement Coolify échouera visiblement, ce qui est
préférable.

Pour tout de même autoriser le repli (utile en local uniquement) :
`DB_ALLOW_LOCAL_FALLBACK=true`.

Si un jour tu veux abandonner Turso et héberger la base chez toi, il faut monter un
**volume persistant** Coolify sur `/app/data` et retirer les deux variables
`TURSO_*`. Le `Dockerfile` prépare déjà ce répertoire.

## 4. Health check

`GET /api/health` répond `{"status":"ok","db":"turso"}` sans authentification.
Le `Dockerfile` l'utilise déjà via `HEALTHCHECK`. Tu peux aussi le renseigner dans
l'onglet **Health Check** de Coolify.

## 5. Réseau (spécifique auto-hébergement)

- Les ports **80** et **443** du serveur doivent être redirigés depuis la box vers
  la machine Coolify — c'est le proxy Traefik de Coolify qui obtient le certificat
  Let's Encrypt.
- DuckDNS résout les sous-domaines (`readirect.xothiques.duckdns.org`) vers la même
  IP que le domaine racine, donc aucune configuration DNS supplémentaire.
- Si tu es derrière un CGNAT (IP non publique), Let's Encrypt en HTTP-01 échouera et
  il faudra passer par un tunnel (Cloudflare Tunnel, Tailscale Funnel...).

## 6. Application Android

`capacitor.config.json` pointe désormais vers `https://readirect.xothiques.duckdns.org`.
Après déploiement, régénérer l'APK :

```bash
npx cap sync android
```

Le certificat doit être valide : avec `cleartext: false`, l'app Android refuse le
HTTP simple et un certificat auto-signé.

## Limitation connue

`POST /api/contact` renvoie une **erreur 500** (`transporter is not defined`) :
`server.js` utilise un transporteur nodemailer qui n'a jamais été créé. Le message
est bien enregistré en base et visible dans « Messages reçus » côté admin, mais
l'utilisateur ne voit ni confirmation ni erreur — le formulaire échoue en silence.
Définir `SMTP_USER` / `MAIL_TO` ne corrige rien tant que le transporteur n'est pas
instancié. Ce bug est antérieur à la migration Coolify.
