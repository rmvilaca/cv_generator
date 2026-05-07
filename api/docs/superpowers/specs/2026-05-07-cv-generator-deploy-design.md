# Deploy design: cv_generator API on Fedora host

**Date:** 2026-05-07
**Status:** Approved (pending user re-review of spec)
**Target:** Public production deployment of the Rails API on the host that already runs `cloudflared` (192.168.1.172)

## Goal

Deploy `cv_generator/api/` as a public-facing service:

- App listens on `192.168.1.172:8090`
- Reached from the public internet via the existing `cloudflared` tunnel under a `*.machadovilaca.eu` subdomain (chosen later)
- Runs on the same Fedora 43 host the developer uses (no remote target)
- Modeled in spirit after a sibling Go project's bash + systemd deploy, but adapted for Rails

## Non-goals

- Containerisation (Docker / Podman / Kamal). The host has no container runtime, the app is small, and adding one introduces tools the operator does not need yet.
- Multi-host orchestration. Single host.
- CI/CD automation. Deploys are operator-triggered.
- Backups, monitoring, alerting, app-level rate limiting. Tracked separately as follow-up work.

## Constraints discovered during exploration

- Host is Fedora 43 with SELinux **enforcing**.
- The operator's account is in the `wheel` group (sudo-capable). Any service running as that user inherits a path to root if compromised.
- `cloudflared` is already running as a system service, tunnelling a sibling app (`degengambler.machadovilaca.eu` → `192.168.1.172:8080`). Same tunnel, new ingress rule, will expose the new app.
- Ruby 3.3.5 is installed via asdf only under the operator's home dir (`0700`) — unreachable by other users.
- Fedora's `dnf install ruby` ships 3.4.8 — newer than the app's pinned `.ruby-version`.
- Rails app is API-only (no asset pipeline, no `app/assets/`, no propshaft / sprockets in `Gemfile`). No `assets:precompile` step needed.
- Production DB is SQLite at `storage/production.sqlite3` (per `config/database.yml`). Solid Trifecta (cache / queue / cable) all use SQLite siblings in the same directory.
- Encrypted credentials (`config/credentials.yml.enc` + `config/master.key`) are already set up — Stripe / OpenAI / JWT secrets live there.

## Architecture

```
Internet
   │
Cloudflare edge
   │
cloudflared (system service, already running)
   │
192.168.1.172:8090
   │
Puma (cv_generator.service, runs as cv_generator system user)
   │
/opt/cv_generator/api/
   ├── vendor/bundle/                  # Rails + all gems (bundle --deployment)
   ├── storage/production.sqlite3      # primary DB
   ├── storage/production_*.sqlite3    # cache / queue / cable
   └── config/master.key               # mode 0600, owned by cv_generator
```

`RAILS_MASTER_KEY` is injected into the systemd unit via an `EnvironmentFile` at `/opt/cv_generator/api.env` (single line, mode `0600`). Rails uses it to decrypt `credentials.yml.enc` at boot.

## Component decisions

### System user
- Name: `cv_generator`
- Created with `useradd --system --create-home --home-dir /opt/cv_generator --shell /usr/sbin/nologin cv_generator`
- Not in `wheel`. No login shell. Owns `/opt/cv_generator/` recursively.

### Ruby installation
- asdf installed under `/opt/cv_generator/.asdf/` (cloned as the `cv_generator` user via sudo).
- Ruby 3.3.5 installed under that asdf, matching `cv_generator/api/.ruby-version`.
- `.tool-versions` placed at `/opt/cv_generator/api/.tool-versions` (already exists in source) so asdf resolves the right version.
- Bundler installed into that Ruby (`gem install bundler -v <Gemfile.lock pinned version>`).

**Rationale for not sharing the operator's Ruby:** the operator's asdf install lives in a `0700` home dir and is correctly inaccessible to other users. Loosening that would defeat the purpose of the dedicated user. Each user gets its own asdf and pins independently; same version installed twice is acceptable cost (~5 min, one-time).

### App tree
- Location: `/opt/cv_generator/api/`
- Source of truth: `~/rmvilaca/cv_generator/api/` on the same machine.
- Sync: `rsync -a --delete` with these excludes:
  - `tmp/` `log/` `.git/` `node_modules/` `.bundle/` `vendor/bundle/`
  - `storage/*.sqlite3*` (preserve prod DB across deploys)
  - `*.env*` (keep deploy-time env file out)
- After rsync: deploy script explicitly copies `config/master.key` from source into the destination (rsync excludes it via standard Rails `.gitignore` semantics, so it must be pushed deliberately).
- After rsync: deploy script ensures `tmp/` and `log/` directories exist (`mkdir -p`, owned by `cv_generator`) — they're rsync-excluded but referenced by systemd `ReadWritePaths`.
- Owner: `cv_generator:cv_generator`, recursively.
- After ownership fix: `restorecon -R /opt/cv_generator` for SELinux labelling.

### systemd unit

Path: `/etc/systemd/system/cv_generator.service`

```ini
[Unit]
Description=cv_generator Rails API
After=network.target

[Service]
Type=simple
User=cv_generator
Group=cv_generator
WorkingDirectory=/opt/cv_generator/api
EnvironmentFile=/opt/cv_generator/api.env
ExecStart=/opt/cv_generator/.asdf/shims/bundle exec puma -b tcp://192.168.1.172:8090 -e production
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/cv_generator/api/storage /opt/cv_generator/api/tmp /opt/cv_generator/api/log
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Hardening directives are conservative and SELinux-compatible. Widen if denials surface.

### Runtime environment

`/opt/cv_generator/api.env`:

```
RAILS_MASTER_KEY=<contents of config/master.key>
RAILS_LOG_TO_STDOUT=true
SOLID_QUEUE_IN_PUMA=true
```

- Mode `0600`, owner `cv_generator:cv_generator`.
- `RAILS_MASTER_KEY` written by the deploy script during `setup` and `full`. Never committed.
- `RAILS_LOG_TO_STDOUT=true` so `journalctl -u cv_generator` shows app logs (Rails otherwise writes to `log/production.log` and journal stays empty).
- `SOLID_QUEUE_IN_PUMA=true` so background jobs run inside the Puma process (Rails 8 single-host pattern; matches what the generated `config/deploy.yml` had).
- All other secrets (Stripe, OpenAI, JWT signing key) live in `config/credentials.yml.enc`, decrypted by `RAILS_MASTER_KEY` at runtime. No `.env` file with multiple secrets is needed.

### Firewall + SELinux (one-time, in `setup`)

- `firewall-cmd --add-port=8090/tcp --permanent && firewall-cmd --reload`
- `semanage port -a -t http_port_t -p tcp 8090` (allow Puma to bind 8090; idempotent — script tolerates "already exists")
- `restorecon -R /opt/cv_generator`

### Cloudflare tunnel (manual, deferred)

When the operator picks a hostname:

1. Edit `/etc/cloudflared/config.yml`, add an ingress rule **above** the catch-all `http_status:404`:
   ```yaml
   - hostname: <chosen>.machadovilaca.eu
     service: http://192.168.1.172:8090
   ```
2. `sudo systemctl reload cloudflared`
3. In Cloudflare dashboard, add a CNAME for `<chosen>` pointing at the tunnel UUID (or use `cloudflared tunnel route dns`).

This step is deferred from the deploy script because hostname is not yet decided. It is not required for the Rails service itself to come up.

### Deploy script

Path: `~/rmvilaca/cv_generator/api/hack/deploy.sh`

Mirrors the sibling Go script's command surface, but no SSH (deploys to localhost):

| Subcommand | Behaviour |
|---|---|
| `setup` | First-time only: creates `cv_generator` user; installs asdf + Ruby 3.3.5 for that user; creates `/opt/cv_generator/api/`; writes systemd unit; opens firewall port 8090; labels port for SELinux; runs `daemon-reload`; enables service. Idempotent — safe to re-run. |
| `full` (default) | rsyncs source; copies `master.key`; runs `bundle install --deployment --without development test`; runs `bin/rails db:prepare RAILS_ENV=production`; rewrites EnvironmentFile; `systemctl restart cv_generator`; tails health for ~5s. |
| `restart` | `sudo systemctl restart cv_generator` |
| `status` | `systemctl status cv_generator --no-pager` |
| `logs` | `sudo journalctl -u cv_generator -f --no-pager` |
| `stop` | `sudo systemctl stop cv_generator` |

Each subcommand surfaces every `sudo` invocation explicitly. Failure modes (no Ruby, missing `master.key`, port already in use) print actionable messages, not stack traces.

## Data flow

1. Public client → Cloudflare → cloudflared (UUID `c959e3f6-...`) → `http://192.168.1.172:8090` → Puma → Rails.
2. Rails reads `RAILS_MASTER_KEY` from process env (set by systemd via `EnvironmentFile`), uses it to decrypt `config/credentials.yml.enc` for Stripe / OpenAI / JWT keys.
3. SQLite reads/writes go to `/opt/cv_generator/api/storage/production*.sqlite3`. Solid Queue runs in-Puma (`SOLID_QUEUE_IN_PUMA: true`, default in Rails 8).

## Failure modes and handling

| Failure | Detection | Recovery |
|---|---|---|
| Puma fails to start | `systemctl status cv_generator` shows failed; `journalctl -u cv_generator -n 50` shows reason | Operator inspects logs; common causes: missing `master.key`, port already in use, gem install failure |
| Migration fails on deploy | `bin/rails db:prepare` exits non-zero; deploy script aborts before `systemctl restart` | Old version stays running; operator inspects, fixes migration, re-runs `full` |
| SELinux denies binding port 8090 | `journalctl -u cv_generator` shows `EACCES`; `ausearch -m AVC -ts recent` confirms | Re-run `semanage port -a -t http_port_t -p tcp 8090` (covered by `setup` but listed here for diagnosis) |
| `master.key` missing locally | Deploy script's `full` checks for it before rsync, exits with clear error | Operator restores `config/master.key` from password manager |
| Tunnel down | `systemctl status cloudflared`; public hostname returns Cloudflare error page | Out of scope of this deploy; tunnel is shared infrastructure |

## Out of scope (follow-up)

- **Backups for `storage/production.sqlite3`** — needed before this is real. Likely a `litestream` setup or a nightly rsync to off-host storage.
- **Rate limiting** — no `rack-attack` in `Gemfile`. Cloudflare gives DDoS protection but not app-level brute-force defense for `/api/login`.
- **Monitoring / alerting** — currently nothing observes service health; rely on Cloudflare error pages and manual `status` checks.
- **Stripe webhook end-to-end** — webhooks need the public hostname configured in the Stripe dashboard. Not blocked by this deploy but is a "won't work yet" until the tunnel hostname is wired.

## Open questions

- **Public hostname** — undecided. Deferred. Spec covers everything else; hostname slots in via tunnel-config edit when chosen.
