# Deploying the BreastScan API to cPanel

The API runs as its own cPanel **Node.js app** at `https://api.breastscan.health`,
on the same cPanel account as Evolve Pharma (`evolveph`). The website,
`https://breastscan.health`, is static files deployed by the `breastHealth`
repo and calls this API from the browser.

```
/home/evolveph/
├── breastscan.health/        ← the website (frontend repo deploys here over FTPS)
└── breastscan_backend/       ← this repo (deployed here over SFTP)
    ├── app.js, package.json, src/   ← uploaded by GitHub Actions
    ├── .env                         ← created by hand, never uploaded
    ├── node_modules/                ← installed by cPanel's "Run NPM Install"
    └── tmp/restart.txt              ← touched by each deploy to reload Passenger
```

News photos are stored in MySQL, not on disk, so there is no uploads folder to
back up or to lose on a redeploy. Back up the database (phpMyAdmin → Export).

## How a deploy works

Push to the `PRODUCTION` branch. `.github/workflows/deploy.yml` then:

1. installs dependencies and syntax-checks every file,
2. uploads `app.js`, `package*.json` and `src/` over SFTP into `breastscan_backend`,
3. touches `tmp/restart.txt` so Passenger reloads the app,
4. polls `https://api.breastscan.health/api/health` until it answers `"status":"ok"`.

Pushes to any other branch only run `ci.yml` (install + syntax check).

**When `package.json` changes** the deploy warns you: the account has no shell,
so open cPanel → *Setup Node.js App* → `breastscan_backend` → **Run NPM Install**,
then **Restart**, then re-run the workflow from the Actions tab.

**New tables and columns** are created automatically on boot. Nothing to run.

## One-time setup

### 1. Subdomain and DNS
- cPanel → *Domains* → create `api.breastscan.health`.
- The domain's DNS is at GoDaddy, so also add there: **A** record, host `api`,
  pointing at the server's IP (the same IP as `breastscan.health`).
- cPanel → *SSL/TLS Status* → **Run AutoSSL** once the DNS resolves.

### 2. Database
cPanel → *MySQL® Databases*: create a database and a user, and add the user to
the database with **ALL PRIVILEGES**. cPanel prefixes both with `evolveph_`; use
the full prefixed names in `.env`. No SQL import is needed.

### 3. Node.js app
cPanel → *Setup Node.js App* → **Create Application**

| Field | Value |
| --- | --- |
| Node.js version | 22.x (or the highest offered) |
| Application mode | Production |
| Application root | `breastscan_backend` |
| Application URL | `api.breastscan.health` |
| Application startup file | `app.js` |

### 4. `.env` on the server
File Manager → `breastscan_backend/.env` (use `.env.example` as the reference):

```
NODE_ENV=production
CLIENT_URL=https://breastscan.health,https://www.breastscan.health
DB_HOST=localhost
DB_PORT=3306
DB_NAME=evolveph_<database>
DB_USER=evolveph_<user>
DB_PWD="<password>"
DB_POOL_MAX=5
JWT_SECRET=<long random string>
JWT_EXPIRES_IN=8h
SEED_ADMIN_NAME=BreastScan Admin
SEED_ADMIN_EMAIL=<admin email>
SEED_ADMIN_PASSWORD="<first password — change it after signing in>"
WELL_KNOWN_DIR=/home/evolveph/api.breastscan.health/.well-known
```

- Keep passwords in **double quotes**: without them, everything after a `#` is
  silently dropped and MySQL answers *Access denied*.
- `JWT_SECRET` must be unique to production. Generate one with
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- Changing `JWT_SECRET` later signs every admin out; that is expected.
- `WELL_KNOWN_DIR` is the subdomain's document root (cPanel → *Domains* shows
  it) plus `/.well-known`. The Node app answers every path on its domain, so
  without it AutoSSL cannot validate the domain and the certificate is never
  issued or renewed.

### 5. GitHub secrets
Repo → *Settings* → *Secrets and variables* → *Actions* → **Secrets** — the same
four values the `evolve-pharma-backend` repo uses:
`SERVER_HOST`, `SERVER_PORT`, `SERVER_USER`, `SERVER_SSH_KEY`.

### 6. First deploy
Push to `PRODUCTION`, then **Run NPM Install** and **Restart** in cPanel, then
re-run the workflow. The health check should pass and the log should show
`Seeded admin …`. Sign in at `https://breastscan.health/en/admin` and change
the password.

### 7. Point the website at the API
In the `breastHealth` (frontend) repo → *Settings* → *Secrets and variables* →
*Actions* → **Variables**: `NEXT_PUBLIC_API_URL` = `https://api.breastscan.health/api`,
then redeploy the frontend.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Health check returns HTML / 503 | The app never started: `node_modules` missing (Run NPM Install), `.env` missing, or wrong application root / startup file. See the app's log in cPanel. |
| `"status":"failed"` with *Access denied* | `.env` DB name/user missing the `evolveph_` prefix, user not added to the database, or an unquoted password containing `#`. |
| Website says it cannot reach the server | `NEXT_PUBLIC_API_URL` not set before the frontend build, or `CLIENT_URL` here does not list the website's exact origin (CORS). |
| Deploy fails at "Upload code" | A wrong SSH secret, or the key is not authorized in cPanel → *SSH Access*. |
| Certificate stays self-signed / AutoSSL log shows a DCV failure | `WELL_KNOWN_DIR` is missing from `.env` or points at the wrong folder. Fix it, restart the app, run AutoSSL again. |
| Every request 401s after a deploy | `JWT_SECRET` changed. Sign in again. |
