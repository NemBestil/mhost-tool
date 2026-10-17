<img src="README-banner.png" />

MHost is a self-hosted dashboard for managing WordPress® installations across multiple servers. It is specifically designed for **WordPress®-server administrators** running **Plesk®** or **cPanel®**.

> [!IMPORTANT]
> MHost requires **root SSH access** to your server(s) to manage your WordPress® sites. This is a power-tool for sysadmins to easily manage 100+ sites on many servers. It's thus not for webmasters on shared hosting platforms.

> [!WARNING]
> **Alpha software**: MHost is currently in alpha. There is no stable release yet, and breaking changes can happen.

## Legal Disclaimer

MHost is an independent, open-source project. It is **not** affiliated with, sponsored by, or endorsed by WordPress®, Automattic, Plesk, cPanel, or any of their trademarks. 

- WordPress® is a trademark of the WordPress Foundation.
- Plesk is a trademark of Plesk International GmbH.
- cPanel is a trademark of cPanel, L.L.C.

## Main Features

- Server inventory with SSH validation
- WordPress® site discovery (scan servers and collect sites)
- Site overview with last scan time and availability status (CVE score visibility coming soon)
- One-click WordPress® login helper
- WordPress® user operations (list users, change email, set/reset password)
- Plugin/theme management:
  - Inspect installed plugins/themes across sites
  - Upload private plugins/themes as ZIP files
  - Track versions and queue update jobs
  - Identify missing plugin/theme installations per site
- Monitoring with priority levels and event history, via e-mail, pushover and webhook
- Cron heartbeat status and Worldline capture samples, with e-mail alerts after site scans

### Cron and Worldline checks

Install and activate the updated NemBestil Core plugin on the WordPress sites. Its hourly
`nbcore_cron_heartbeat` hook records `nbcore_cron_last_run` in UTC. MHost reads this during
site scans and marks cron overdue after 24 hours. New installations have 24 hours to
record their first heartbeat; older plugins without monitoring data show an unknown status.

The Worldline sidebar lists installations with `bambora-online-checkout`. It shows the
previous seven calendar days in each site's timezone, excluding today. `OK` means at least
one sampled order has a captured amount, `Fail` means no capture was confirmed, and `-`
means no Worldline orders exist for that date. Tooltips include the sample time and failures.

The WordPress command is `wp nb-core worldline-stats --format=json`. It checks at most five
orders per date, prioritizing processing/completed orders, and stops at the first capture.
Partial captures count as a capture. Automatic scans check each date once and retain all
results, including failed lookups. The first scan can check all seven dates; later scans
only sample new dates. The per-site **Gentjek** button explicitly resamples dates without
a confirmed capture using `--recheck`; confirmed captures always stay cached.

Configure SMTP and recipients under **Setup → E-mail notifications**. Cron and Worldline
alerts are enabled by default and can be toggled separately. A separate scan-alert e-mail
is sent when cron is overdue or yesterday has at least two processing/completed Worldline
orders and a negative sample. Failed API lookups are shown as `Fail` in the UI with an
explanation, but do not trigger a missing-capture alarm. A Worldline-only recheck sends
capture alerts only. Apply database migrations with `npm run prisma:deploy` when deploying.

## Why MHost

MHost is built for **digital sovereignty**. In an era of SaaS-dependency, MHost empowers you to maintain **full control** over your own infrastructure and data. It is **fully open source** and self-hosted, ensuring that you are never locked into a proprietary platform.

- **Full Control**: You own the data, the code, and the infrastructure.
- **Single Docker image**: Easy and uncomplicated to host on your own server.
- **Persistent uploads and data via mounted volumes**: Your data stays with you.

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

- Node.js 26 (recommended; Node.js 24.15+ is also supported)
- npm

Use `nvm use` to select the project's recommended Node version. After changing Node
major versions, run `npm ci` to reinstall native modules such as `better-sqlite3`.
The Docker build and runtime both use Node.js 26.

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
