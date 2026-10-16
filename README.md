# BreastScan API (backend)

Express + MySQL (Sequelize) API for the screening-centre locations shown on the BreastScan website ([../BreastScan](../BreastScan)). Structured like the Evolve Pharma backend: CommonJS for cPanel/Passenger, schema synced on boot, listen-first warm-up with `/api/health`, and one `{ error, details }` error shape.

Locations are **not** seeded. The tables start empty, and every city and centre is entered on the website's admin page (`/en/admin`). The only thing created on boot is the admin account.

## Run it locally

```bash
# 1. A database (utf8mb4, for the Nepali names)
mysql -u root -p -e "CREATE DATABASE breastscan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 2. Config
cp .env.example .env      # set DB_USER / DB_PWD, and JWT_SECRET

# 3. Start
npm install
npm run dev               # http://localhost:4000 — tables and the admin account are created on first boot
```

Then run the website (`cd ../BreastScan && npm run dev`), open http://localhost:3000/en/admin and sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Change the password from the admin header.

| Script | What it does |
| --- | --- |
| `npm run dev` | API with nodemon |
| `npm start` | API |
| `npm run seed` | create missing tables/columns and the admin account, then exit (for cPanel's "Run JS script") |
| `npm run db:reset` | **drops every table** and recreates them empty |

## Data

| Table | Columns |
| --- | --- |
| `cities` | `slug` (unique, public id), `name_en`, `name_ne`, `province`, `sort_order`, `is_active` |
| `centres` | `slug` (unique, public id), `city_id` → cities, `name_en`, `name_ne`, `address_en`, `address_ne`, `phone`, `type`, `sort_order`, `is_active` |
| `users` | `name`, `email`, `password` (bcrypt), `is_active`, `last_login_at` |

- **Provinces** (Nepal's seven, east → west) and **centre types** (clinic, hospital, diagnostic centre) are fixed lists in `src/models/locations.js`, with English and Nepali names. They are reference data, not locations.
- **Slugs** are made from the English name once, at creation (`kathmandu`, `kathmandu-breastscan-baneshwor`), and never change, so `?city=` and `?centre=` links keep working when a name is corrected.
- **Nepali names are optional.** Until one is filled in, the public API sends the English name in its place.
- A city cannot be deleted while it still has centres, and two cities with the same name in one province are refused.

## API

All bodies are JSON. Errors are `{ "error": "message", "details": { "field": "message" } }`.

### Public

`GET /api/locations` — what the website renders. Only visible centres in visible cities, and only cities that have one; all seven provinces are always included.

```json
{
  "provinces": [{ "id": "koshi", "en": "Koshi", "ne": "कोशी" }],
  "types": [{ "id": "clinic", "en": "Clinic", "ne": "क्लिनिक" }],
  "cities": [{ "id": "kathmandu", "en": "Kathmandu", "ne": "काठमाडौं", "province": "bagmati" }],
  "centres": [{
    "id": "kathmandu-breastscan-baneshwor", "city": "kathmandu",
    "name": { "en": "BreastScan Baneshwor", "ne": "BreastScan बानेश्वर" },
    "address": { "en": "New Baneshwor, Kathmandu 44600", "ne": "नयाँ बानेश्वर, काठमाडौं ४४६००" },
    "phone": "+977-9800000001", "type": "clinic"
  }]
}
```

`GET /api/health` — `{"status":"ok"}` once the database is ready; `starting` or `failed` (with the reason) and a 503 before that.

### Auth

| Method | Path | Body |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | — |
| POST | `/api/auth/change-password` | `{ currentPassword, newPassword }` (8+ characters) |

Send the token as `Authorization: Bearer <token>` on everything below.

### Admin

| Method | Path | Body |
| --- | --- | --- |
| GET | `/api/admin/locations` | — every city and centre, hidden ones included, snake_case with database ids |
| POST | `/api/admin/cities` | `{ nameEn, nameNe?, province, sortOrder?, isActive? }` |
| PATCH | `/api/admin/cities/:id` | any of the above |
| DELETE | `/api/admin/cities/:id` | — 409 while it still has centres |
| POST | `/api/admin/centres` | `{ cityId, nameEn, nameNe?, addressEn, addressNe?, phone, type?, sortOrder?, isActive? }` |
| PATCH | `/api/admin/centres/:id` | any of the above |
| DELETE | `/api/admin/centres/:id` | — |

## Structure

```
app.js                      cPanel / Passenger entry (requires src/server.js)
src/
  server.js                 middleware, CORS, routes; listens first, then connects + syncs + seeds
  config/                   config.js (all env), db.js (Sequelize)
  models/                   locations.js (City, Centre, provinces, types), User.js, index.js (associations, sync)
  controllers/              location.controller.js, auth.controller.js
  routes/                   public, auth, admin (requireAuth on all)
  middleware/               auth.js (JWT), errorHandler.js
  utils/                    ApiError, Validator, slugify, serialize, readiness
  seed/                     the admin account only
```

## Deploy (cPanel)

Same pattern as the Evolve backend:

1. **MySQL® Databases:** create the database and a user with all privileges on it.
2. **Setup Node.js App:** application root `BreastScanBackend`, startup file `app.js`, Node 20+. Map it to the API's URL (e.g. `api.breastscan.health`).
3. Upload the files, run **NPM Install**, and set the `.env` values (or the app's environment variables): `NODE_ENV=production`, the `DB_*` values, a long random `JWT_SECRET`, the admin email/password, and `CLIENT_URL=https://breastscan.health`.
4. Restart the app and check `https://<api host>/api/health` says `"ok"`.
5. Build the website with `NEXT_PUBLIC_API_URL=https://<api host>/api` (the website's deploy workflow reads the repo variable of that name).
