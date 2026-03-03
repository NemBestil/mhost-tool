<img src="README-banner.png" />

MHost is a self-hosted dashboard for managing WordPress installations across multiple servers. It is specifically designed for **WordPress-server administrators** running **Plesk** or **cPanel/WHM**.

> [!IMPORTANT]
> MHost requires **root SSH access** to your server(s) to manage your WordPress sites. This is a power-tool for sysadmins to easily manage 100+ sites on many servers. It's thus not for webmasters on shared hosting platforms.

> [!WARNING]
> **Alpha software**: MHost is currently in alpha. There is no stable release yet, and breaking changes can happen.

## Main Features

- Server inventory with SSH validation
- WordPress site discovery (scan servers and collect sites)
- Site overview with last scan time and availability status (CVE score visibility coming soon)
- One-click WordPress login helper
- WordPress user operations (list users, change email, set/reset password)
- Plugin/theme management:
  - Inspect installed plugins/themes across sites
  - Upload private plugins/themes as ZIP files
  - Track versions and queue update jobs
  - Identify missing plugin/theme installations per site
- Monitoring with priority levels and event history, via e-mail, pushover and webhook

## Why MHost

- Single deployable Docker image
- SQLite database (no separate database service required)
- Built-in DB migrations on startup
- Persistent uploads and data via mounted volumes

## Run with Docker Image

Pull and run the current image:

```bash
docker run -d \
  --name mhost-tool \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=file:/app/data/mhost.db \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=change-me \
  -v mhost_data:/app/data \
  -v mhost_uploads:/app/uploads \
  ghcr.io/nembestil/mhost-tool:main
```

Then open `http://localhost:3000`.

### Environment Variables

Required:

- `ADMIN_USERNAME`: login username for the web UI
- `ADMIN_PASSWORD`: login password for the web UI

Optional:

- `DATABASE_URL` (default: `file:./mhost.db`)
  - In Docker, prefer `file:/app/data/mhost.db` and mount `/app/data` for persistence.
- `NODE_ENV` (recommended: `production` in Docker)

If you use `docker-compose.yml` in this repo, these host env vars are this way for built-in Coolify-compatibility with
its magic variables. You must set these if you are not running Coolify.

- `SERVICE_USER_APP` -> used as `ADMIN_USERNAME`
- `SERVICE_PASSWORD_APP` -> used as `ADMIN_PASSWORD`

## Local Development

### Prerequisites

- Node.js 24+
- npm

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Create/update `.env` in the project root:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
```

### 3) Apply migrations

```bash
npm run prisma:migrate
```

### 4) Start development server

```bash
npm run dev
```

App runs at `http://localhost:3000`.
