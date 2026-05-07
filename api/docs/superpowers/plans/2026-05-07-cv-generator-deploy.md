# cv_generator Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the `cv_generator` Rails 8.1 API onto its host (Fedora 43, `192.168.1.172`) as a systemd service running on port 8090, and expose it publicly via the existing `cloudflared` tunnel — by writing a single bash deploy script and running it.

**Architecture:** New `cv_generator` system user owns `/opt/cv_generator/`. Ruby 3.3.5 lives there via asdf with `ASDF_DATA_DIR=/opt/cv_generator/.asdf`. App tree at `/opt/cv_generator/api/` is rsynced from the developer's source. `RAILS_MASTER_KEY` is injected by systemd from `/opt/cv_generator/api.env`. Public traffic enters through the existing tunnel (`cloudflared` already running) — only the ingress rule needs adding when a hostname is chosen.

**Tech Stack:** bash, systemd, asdf v0.18+, Ruby 3.3.5, Rails 8.1.2, Puma, SQLite (Solid Trifecta), firewalld, SELinux, cloudflared.

**Spec:** `docs/superpowers/specs/2026-05-07-cv-generator-deploy-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `hack/deploy.sh` (NEW) | Single bash script with subcommands `setup`/`full`/`push`/`restart`/`status`/`logs`/`stop`. ~250 lines, self-contained. |
| `/etc/systemd/system/cv_generator.service` (created by script) | systemd unit. Written via heredoc inside `setup`. |
| `/opt/cv_generator/api.env` (created by script) | Runtime env: `RAILS_MASTER_KEY`, `RAILS_LOG_TO_STDOUT`, `SOLID_QUEUE_IN_PUMA`. Mode 0600. |
| `/opt/cv_generator/api/` (created by script) | rsynced app tree, owned by `cv_generator`. |

The deploy script is the only file checked into git. Everything else is host state created by running it.

---

## Phase A — Build the deploy script

### Task A1: Script skeleton + subcommand dispatch

**Files:**
- Create: `hack/deploy.sh`

- [ ] **Step 1: Create the script with config + usage + dispatch**

Write `hack/deploy.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# ---- Config -----------------------------------------------------------------

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

APP_NAME="cv_generator"
APP_USER="cv_generator"
APP_HOME="/opt/${APP_USER}"
APP_DIR="${APP_HOME}/api"
APP_SERVICE="${APP_NAME}"
APP_ENV_FILE="${APP_HOME}/api.env"
APP_BIND="${APP_BIND:-192.168.1.172}"
APP_PORT="${APP_PORT:-8090}"
RUBY_VERSION="3.3.5"
ASDF_VERSION="v0.18.1"

SOURCE_KEY="${ROOT}/config/master.key"

# ---- Helpers ----------------------------------------------------------------

usage() {
  cat <<EOF
Usage: ./hack/deploy.sh [command]

Commands:
  full        Sync source, install gems, migrate, restart (default)
  push        Sync source + restart (skip gem install / migrate)
  setup       First-time host setup (user, ruby, systemd, firewall)
  restart     Restart the service
  stop        Stop the service
  status      Show service status
  logs        Tail service logs

Env overrides:
  APP_BIND    Bind interface  [192.168.1.172]
  APP_PORT    Listen port     [8090]
EOF
  exit 1
}

# ---- Subcommands (stubs filled in later tasks) ------------------------------

cmd_setup() { echo "TODO: setup"; }
cmd_full()  { echo "TODO: full"; }
cmd_push()  { echo "TODO: push"; }

cmd_restart() { sudo systemctl restart "${APP_SERVICE}"; echo "Restarted."; }
cmd_stop()    { sudo systemctl stop    "${APP_SERVICE}"; echo "Stopped."; }
cmd_status()  { systemctl status "${APP_SERVICE}" --no-pager; }
cmd_logs()    { sudo journalctl -u "${APP_SERVICE}" -f --no-pager; }

# ---- Dispatch ---------------------------------------------------------------

case "${1:-full}" in
  setup)   cmd_setup ;;
  full)    cmd_full ;;
  push)    cmd_push ;;
  restart) cmd_restart ;;
  stop)    cmd_stop ;;
  status)  cmd_status ;;
  logs)    cmd_logs ;;
  *)       usage ;;
esac
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x hack/deploy.sh
```

- [ ] **Step 3: Verify dispatch works**

```bash
./hack/deploy.sh nonsense 2>&1 | head -3
./hack/deploy.sh full
./hack/deploy.sh setup
```

Expected: first prints usage and exits, latter two print `TODO: full` and `TODO: setup`.

- [ ] **Step 4: Commit skeleton**

```bash
git add hack/deploy.sh
git commit -m "feat(deploy): scaffold deploy.sh with subcommand dispatch"
```

---

### Task A2: `setup` — create system user

**Files:**
- Modify: `hack/deploy.sh` (replace `cmd_setup` stub, add helper)

- [ ] **Step 1: Add user-creation helper above `cmd_setup`**

Insert after the `# ---- Subcommands` comment, before the stubs:

```bash
ensure_user() {
  if id "${APP_USER}" &>/dev/null; then
    echo "==> User ${APP_USER} already exists."
    return 0
  fi
  echo "==> Creating system user ${APP_USER} (sudo)..."
  sudo useradd \
    --system \
    --create-home \
    --home-dir "${APP_HOME}" \
    --shell /usr/sbin/nologin \
    "${APP_USER}"
  echo "==> User created."
}
```

- [ ] **Step 2: Wire it into `cmd_setup`**

Replace `cmd_setup() { echo "TODO: setup"; }` with:

```bash
cmd_setup() {
  ensure_user
  # more steps added in later tasks
}
```

- [ ] **Step 3: Run setup and verify user exists**

```bash
./hack/deploy.sh setup
id cv_generator
```

Expected: `id cv_generator` shows `uid=NNN(cv_generator) gid=NNN(cv_generator) groups=NNN(cv_generator)` (no `wheel`).

- [ ] **Step 4: Run setup again to verify idempotence**

```bash
./hack/deploy.sh setup
```

Expected: `==> User cv_generator already exists.` (no error, no second useradd).

(No commit yet — more setup pieces coming in A3-A5.)

---

### Task A3: `setup` — install asdf system-wide + Ruby for `cv_generator`

**Files:**
- Modify: `hack/deploy.sh` (add `ensure_asdf` and `ensure_ruby`)

- [ ] **Step 1: Add `as_app` helper for running commands as cv_generator with the right env**

Insert after `ensure_user`:

```bash
as_app() {
  # Run a command as cv_generator with HOME, ASDF_DATA_DIR, PATH set so asdf shims work.
  sudo -u "${APP_USER}" \
    env \
      HOME="${APP_HOME}" \
      ASDF_DATA_DIR="${APP_HOME}/.asdf" \
      PATH="${APP_HOME}/.asdf/shims:/usr/local/bin:/usr/bin:/bin" \
      "$@"
}
```

- [ ] **Step 2: Add `ensure_asdf` helper**

Insert after `as_app`:

```bash
ensure_asdf() {
  if command -v asdf &>/dev/null && [[ "$(command -v asdf)" == "/usr/local/bin/asdf" ]]; then
    echo "==> asdf already installed at /usr/local/bin/asdf."
    return 0
  fi
  echo "==> Installing asdf ${ASDF_VERSION} to /usr/local/bin (sudo)..."
  local tmp; tmp="$(mktemp -d)"
  curl -fsSL "https://github.com/asdf-vm/asdf/releases/download/${ASDF_VERSION}/asdf-${ASDF_VERSION}-linux-amd64.tar.gz" \
    | tar -xz -C "${tmp}"
  sudo install -m 0755 "${tmp}/asdf" /usr/local/bin/asdf
  rm -rf "${tmp}"
  echo "==> asdf installed: $(asdf --version)"
}
```

- [ ] **Step 3: Add `ensure_ruby` helper**

Insert after `ensure_asdf`:

```bash
ensure_ruby() {
  echo "==> Ensuring Ruby ${RUBY_VERSION} is installed for ${APP_USER}..."
  # asdf v0.18+ uses 'plugin add', 'install', 'set'. Each is idempotent or tolerates re-runs.
  as_app asdf plugin add ruby https://github.com/asdf-vm/asdf-ruby.git || true
  if as_app asdf list ruby 2>/dev/null | grep -q "${RUBY_VERSION}"; then
    echo "==> Ruby ${RUBY_VERSION} already installed."
  else
    echo "==> Installing Ruby ${RUBY_VERSION} (this takes a few minutes)..."
    # Build deps for ruby-build:
    sudo dnf install -y -q \
      gcc make patch autoconf bison \
      openssl-devel readline-devel zlib-devel libyaml-devel libffi-devel \
      gdbm-devel ncurses-devel
    as_app asdf install ruby "${RUBY_VERSION}"
  fi
  # Pin globally (writes to /opt/cv_generator/.tool-versions)
  as_app asdf set -u ruby "${RUBY_VERSION}"
  echo "==> Ruby active: $(as_app ruby --version)"
}
```

- [ ] **Step 4: Wire into `cmd_setup`**

```bash
cmd_setup() {
  ensure_user
  ensure_asdf
  ensure_ruby
  # more in later tasks
}
```

- [ ] **Step 5: Run setup and verify**

```bash
./hack/deploy.sh setup
sudo -u cv_generator env HOME=/opt/cv_generator ASDF_DATA_DIR=/opt/cv_generator/.asdf /opt/cv_generator/.asdf/shims/ruby --version
```

Expected: `ruby 3.3.5 (...)`.

- [ ] **Step 6: Verify idempotence**

```bash
./hack/deploy.sh setup
```

Expected: `asdf already installed`, `Ruby 3.3.5 already installed`. No reinstall.

(No commit yet.)

---

### Task A4: `setup` — write systemd unit + create app dirs

**Files:**
- Modify: `hack/deploy.sh` (add `ensure_dirs`, `ensure_systemd_unit`)

- [ ] **Step 1: Add `ensure_dirs` helper**

Insert after `ensure_ruby`:

```bash
ensure_dirs() {
  echo "==> Ensuring app directories exist (sudo)..."
  sudo install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${APP_DIR}"
  sudo install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${APP_DIR}/storage"
  sudo install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${APP_DIR}/tmp"
  sudo install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${APP_DIR}/log"
  sudo install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${APP_DIR}/tmp/pids"
}
```

- [ ] **Step 2: Add `ensure_systemd_unit` helper**

Insert after `ensure_dirs`:

```bash
ensure_systemd_unit() {
  echo "==> Writing systemd unit (sudo)..."
  sudo tee "/etc/systemd/system/${APP_SERVICE}.service" > /dev/null <<UNIT
[Unit]
Description=${APP_NAME} Rails API
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
Environment=ASDF_DATA_DIR=${APP_HOME}/.asdf
Environment=PATH=${APP_HOME}/.asdf/shims:/usr/local/bin:/usr/bin:/bin
EnvironmentFile=-${APP_ENV_FILE}
ExecStart=${APP_HOME}/.asdf/shims/bundle exec puma -b tcp://${APP_BIND}:${APP_PORT} -e production
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${APP_DIR}/storage ${APP_DIR}/tmp ${APP_DIR}/log
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
  sudo systemctl daemon-reload
  sudo systemctl enable "${APP_SERVICE}.service"
  echo "==> Unit installed and enabled."
}
```

- [ ] **Step 3: Wire into `cmd_setup`**

```bash
cmd_setup() {
  ensure_user
  ensure_asdf
  ensure_ruby
  ensure_dirs
  ensure_systemd_unit
  # more in later tasks
}
```

- [ ] **Step 4: Run setup and verify**

```bash
./hack/deploy.sh setup
systemctl is-enabled cv_generator
ls -la /opt/cv_generator/api/
sudo cat /etc/systemd/system/cv_generator.service | head -15
```

Expected: `enabled`; dirs `storage tmp log` exist owned by `cv_generator`; unit file matches what we wrote.

(No commit yet.)

---

### Task A5: `setup` — firewall + SELinux

**Files:**
- Modify: `hack/deploy.sh` (add `ensure_firewall_selinux`)

- [ ] **Step 1: Add helper**

Insert after `ensure_systemd_unit`:

```bash
ensure_firewall_selinux() {
  echo "==> Ensuring SELinux tools are installed (sudo)..."
  if ! command -v semanage &>/dev/null; then
    sudo dnf install -y -q policycoreutils-python-utils
  fi

  echo "==> Opening firewall port ${APP_PORT}/tcp (sudo)..."
  sudo firewall-cmd --add-port="${APP_PORT}/tcp" --permanent
  sudo firewall-cmd --reload

  echo "==> Labelling SELinux port ${APP_PORT}/tcp as http_port_t (sudo)..."
  # 'add' fails if already labelled; 'modify' would work for existing entries.
  if sudo semanage port -l | awk '$1=="http_port_t"' | grep -qE "(^|, )${APP_PORT}(,|$)"; then
    echo "==> Port already labelled."
  else
    sudo semanage port -a -t http_port_t -p tcp "${APP_PORT}"
  fi

  echo "==> Restoring SELinux labels under ${APP_HOME} (sudo)..."
  sudo restorecon -R "${APP_HOME}" || true
}
```

- [ ] **Step 2: Wire into `cmd_setup`**

```bash
cmd_setup() {
  ensure_user
  ensure_asdf
  ensure_ruby
  ensure_dirs
  ensure_systemd_unit
  ensure_firewall_selinux
  echo "==> Setup complete. Run './hack/deploy.sh full' to deploy code."
}
```

- [ ] **Step 3: Run setup and verify**

```bash
./hack/deploy.sh setup
sudo firewall-cmd --list-ports | tr ' ' '\n' | grep '8090'
sudo semanage port -l | awk '$1=="http_port_t"' | grep -E "(^|, )8090(,|$)"
```

Expected: `8090/tcp` listed in firewall; port 8090 labelled as http_port_t.

- [ ] **Step 4: Commit Phase A1–A5**

```bash
git add hack/deploy.sh
git commit -m "feat(deploy): add deploy.sh setup subcommand (user, ruby, systemd, firewall)"
```

---

### Task A6: `full` — generate env file from `config/master.key`

**Files:**
- Modify: `hack/deploy.sh` (replace `cmd_full` stub, add helper)

- [ ] **Step 1: Add `need_master_key` and `write_env_file` helpers**

Insert above `cmd_full`:

```bash
need_master_key() {
  if [[ ! -f "${SOURCE_KEY}" ]]; then
    echo "Error: ${SOURCE_KEY} not found. Restore it from your password manager." >&2
    exit 1
  fi
}

write_env_file() {
  echo "==> Writing ${APP_ENV_FILE} (sudo)..."
  local key; key="$(cat "${SOURCE_KEY}")"
  sudo tee "${APP_ENV_FILE}" > /dev/null <<ENV
RAILS_MASTER_KEY=${key}
RAILS_LOG_TO_STDOUT=true
SOLID_QUEUE_IN_PUMA=true
ENV
  sudo chown "${APP_USER}:${APP_USER}" "${APP_ENV_FILE}"
  sudo chmod 0600 "${APP_ENV_FILE}"
}
```

- [ ] **Step 2: Replace `cmd_full` stub with first step**

```bash
cmd_full() {
  need_master_key
  write_env_file
  # more in later tasks
}
```

- [ ] **Step 3: Run and verify**

```bash
./hack/deploy.sh full
sudo stat -c '%U:%G %a %n' /opt/cv_generator/api.env
sudo wc -l /opt/cv_generator/api.env
```

Expected: `cv_generator:cv_generator 600 /opt/cv_generator/api.env`; 3 lines.

(No commit yet — building up `cmd_full`.)

---

### Task A7: `full` — rsync source + perms + restorecon

**Files:**
- Modify: `hack/deploy.sh` (add `sync_source`)

- [ ] **Step 1: Add helper**

Insert after `write_env_file`:

```bash
sync_source() {
  echo "==> Syncing source from ${ROOT} to ${APP_DIR} (sudo)..."
  sudo rsync -a --delete \
    --exclude '.git/' \
    --exclude 'tmp/' \
    --exclude 'log/' \
    --exclude '.bundle/' \
    --exclude 'vendor/bundle/' \
    --exclude 'node_modules/' \
    --exclude 'storage/' \
    --exclude '.env*' \
    --exclude 'docs/' \
    "${ROOT}/" "${APP_DIR}/"

  echo "==> Copying master.key explicitly..."
  sudo install -o "${APP_USER}" -g "${APP_USER}" -m 0600 \
    "${SOURCE_KEY}" "${APP_DIR}/config/master.key"

  echo "==> Recreating tmp/ and log/ (rsync excluded them)..."
  sudo install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${APP_DIR}/tmp"
  sudo install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${APP_DIR}/tmp/pids"
  sudo install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${APP_DIR}/log"

  echo "==> Fixing ownership..."
  sudo chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

  echo "==> Restoring SELinux labels..."
  sudo restorecon -R "${APP_DIR}" || true
}
```

- [ ] **Step 2: Wire into `cmd_full`**

```bash
cmd_full() {
  need_master_key
  write_env_file
  sync_source
  # more in later tasks
}
```

- [ ] **Step 3: Run and verify**

```bash
./hack/deploy.sh full
sudo ls -la /opt/cv_generator/api/Gemfile /opt/cv_generator/api/config/master.key
sudo stat -c '%U %a %n' /opt/cv_generator/api/config/master.key
```

Expected: both files exist, owner `cv_generator`, master.key mode `600`.

(No commit yet.)

---

### Task A8: `full` — install gems

**Files:**
- Modify: `hack/deploy.sh` (add `install_gems`)

- [ ] **Step 1: Add helper**

Insert after `sync_source`:

```bash
install_gems() {
  echo "==> Installing gems (bundle --deployment)..."
  # Bundler from Gemfile.lock's BUNDLED WITH may differ from default — bundler self-installs as needed.
  ( cd "${APP_DIR}" && as_app bundle config set --local deployment 'true' )
  ( cd "${APP_DIR}" && as_app bundle config set --local without 'development test' )
  ( cd "${APP_DIR}" && as_app bundle install --jobs 4 )
}
```

- [ ] **Step 2: Wire into `cmd_full`**

```bash
cmd_full() {
  need_master_key
  write_env_file
  sync_source
  install_gems
  # more in later tasks
}
```

- [ ] **Step 3: Run and verify**

```bash
./hack/deploy.sh full
sudo ls /opt/cv_generator/api/vendor/bundle/ruby/3.3.0/gems/ | grep -E '^rails-'
```

Expected: `rails-8.1.2/` (the gem dir exists). First run takes 1–3 minutes.

(No commit yet.)

---

### Task A9: `full` — prepare DB

**Files:**
- Modify: `hack/deploy.sh` (add `prepare_db`)

- [ ] **Step 1: Add helper**

Insert after `install_gems`:

```bash
prepare_db() {
  echo "==> Running db:prepare (RAILS_ENV=production)..."
  ( cd "${APP_DIR}" && as_app \
      RAILS_ENV=production \
      RAILS_MASTER_KEY="$(cat "${SOURCE_KEY}")" \
      bundle exec bin/rails db:prepare )
}
```

- [ ] **Step 2: Wire into `cmd_full`**

```bash
cmd_full() {
  need_master_key
  write_env_file
  sync_source
  install_gems
  prepare_db
  # more in next task
}
```

- [ ] **Step 3: Run and verify**

```bash
./hack/deploy.sh full
sudo ls /opt/cv_generator/api/storage/
```

Expected: `production.sqlite3`, `production_cache.sqlite3`, `production_queue.sqlite3`, `production_cable.sqlite3` files exist.

(No commit yet.)

---

### Task A10: `full` — restart service + health check

**Files:**
- Modify: `hack/deploy.sh` (add `restart_and_check`)

- [ ] **Step 1: Add helper**

Insert after `prepare_db`:

```bash
restart_and_check() {
  echo "==> Restarting service (sudo)..."
  sudo systemctl restart "${APP_SERVICE}"

  echo "==> Waiting for service to come up..."
  local attempt
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS -o /dev/null "http://${APP_BIND}:${APP_PORT}/up"; then
      echo "==> Service healthy at http://${APP_BIND}:${APP_PORT}/up"
      return 0
    fi
    sleep 1
  done

  echo "Error: service did not respond on /up within 10s. Recent logs:" >&2
  sudo journalctl -u "${APP_SERVICE}" -n 30 --no-pager >&2
  exit 1
}
```

- [ ] **Step 2: Wire into `cmd_full`**

```bash
cmd_full() {
  need_master_key
  write_env_file
  sync_source
  install_gems
  prepare_db
  restart_and_check
  echo "==> Deploy complete."
}
```

- [ ] **Step 3: Run and verify**

```bash
./hack/deploy.sh full
curl -fsS -o /dev/null -w "%{http_code}\n" http://192.168.1.172:8090/up
curl -fsS http://192.168.1.172:8090/api/health
systemctl is-active cv_generator
```

Expected: deploy ends with `Service healthy ... Deploy complete.`; `/up` returns `200`; `/api/health` returns `{"status":"ok"}`; `systemctl` returns `active`.

(No commit yet.)

---

### Task A11: `push` subcommand (deploy without bundle/migrate)

**Files:**
- Modify: `hack/deploy.sh` (replace `cmd_push` stub)

- [ ] **Step 1: Replace `cmd_push` stub**

```bash
cmd_push() {
  need_master_key
  write_env_file
  sync_source
  restart_and_check
  echo "==> Push complete."
}
```

- [ ] **Step 2: Run and verify it works as a faster cycle**

Make a trivial source change first (e.g. touch a controller) to confirm the rsync picks it up, then:

```bash
./hack/deploy.sh push
```

Expected: completes in seconds (no gem install, no migrate); service still healthy.

- [ ] **Step 3: Commit Phase A6–A11**

```bash
git add hack/deploy.sh
git commit -m "feat(deploy): add deploy.sh full and push subcommands"
```

---

## Phase B — Validate end-to-end

### Task B1: Confirm idempotence

- [ ] **Step 1: Re-run `setup` from scratch — should be a no-op**

```bash
./hack/deploy.sh setup
```

Expected: every helper reports "already exists" / "already installed". No errors, no duplicate work.

- [ ] **Step 2: Re-run `full` — should re-sync, no migrations to run**

```bash
./hack/deploy.sh full
```

Expected: rsync syncs (possibly nothing to copy), bundle reports already-installed, `db:prepare` no-ops, service restarts cleanly.

### Task B2: Confirm utility subcommands

- [ ] **Step 1: status**

```bash
./hack/deploy.sh status
```

Expected: `Active: active (running)`.

- [ ] **Step 2: logs (Ctrl-C after seeing app boot lines)**

```bash
timeout 3 ./hack/deploy.sh logs || true
```

Expected: recent journal lines from cv_generator service.

- [ ] **Step 3: restart**

```bash
./hack/deploy.sh restart
sleep 2
curl -fsS -o /dev/null -w "%{http_code}\n" http://192.168.1.172:8090/up
```

Expected: `Restarted.`; then `200`.

### Task B3: SELinux clean check

- [ ] **Step 1: Look for any AVC denials from this hour**

```bash
sudo ausearch -m AVC -ts recent 2>&1 | grep -i cv_generator || echo "no denials"
```

Expected: `no denials`. If denials appear, capture them and decide on policy fix before claiming success.

### Task B4: Document the final tunnel step

- [ ] **Step 1: Add a `docs/superpowers/specs/2026-05-07-cloudflared-ingress.md` note**

Create `docs/superpowers/specs/2026-05-07-cloudflared-ingress.md`:

```markdown
# Cloudflared ingress — final hookup

When the public hostname is chosen (e.g. `cv.machadovilaca.eu`):

1. Edit `/etc/cloudflared/config.yml`. **Above** the catch-all `service: http_status:404`, add:

   ```yaml
   - hostname: <chosen>.machadovilaca.eu
     service: http://192.168.1.172:8090
   ```

2. Reload: `sudo systemctl reload cloudflared`.
3. In the Cloudflare dashboard for `machadovilaca.eu`, add a CNAME for `<chosen>` pointing at the tunnel UUID
   (`c959e3f6-9e39-4106-a9a3-1beb9d5b1c16.cfargotunnel.com`), or run
   `cloudflared tunnel route dns myapp <chosen>.machadovilaca.eu`.
4. Verify: `curl -I https://<chosen>.machadovilaca.eu/up` returns `HTTP/2 200`.
5. (Stripe webhooks) In the Stripe dashboard, point the webhook URL at
   `https://<chosen>.machadovilaca.eu/api/webhooks/stripe`.
```

- [ ] **Step 2: Commit final docs**

```bash
git add docs/superpowers/specs/2026-05-07-cloudflared-ingress.md
git commit -m "docs(deploy): note cloudflared ingress hookup steps"
```

---

## Self-review notes

**Spec coverage:**
- System user (§Component decisions/System user) → A2 ✓
- Ruby for that user (§Ruby installation) → A3 ✓
- App tree, rsync, master.key copy, mkdir tmp/log, restorecon (§App tree) → A4, A7 ✓
- systemd unit (§systemd unit) → A4 ✓
- Env file with 3 vars (§Runtime environment) → A6 ✓
- Firewall + SELinux port labelling (§Firewall + SELinux) → A5 ✓
- Tunnel hookup (§Cloudflare tunnel — manual, deferred) → B4 ✓
- Deploy script subcommands (§Deploy script) → A1, A5, A11, B2 ✓
- Failure modes table → all detection paths (logs, status, journalctl, ausearch) covered in B-tasks ✓

**Bundler version:** `Gemfile.lock` pins `BUNDLED WITH 2.5.16`. Recent Bundler self-installs the right version on `bundle install`, so no explicit `gem install bundler` step needed.

**Out of scope (per spec):** backups, monitoring, rate limiting, CI/CD — not in this plan.
