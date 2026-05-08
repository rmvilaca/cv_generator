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
APP_BIND="${APP_BIND:-0.0.0.0}"
APP_PORT="${APP_PORT:-8090}"
RUBY_VERSION="3.3.5"
ASDF_VERSION="v0.16.7"

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
  APP_BIND    Bind interface  [0.0.0.0]
  APP_PORT    Listen port     [8090]
EOF
  exit 1
}

# ---- Subcommands (stubs filled in later tasks) ------------------------------

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

as_app() {
  # Run a command as cv_generator. Defaults to APP_HOME as cwd; pass `--at DIR` first to override.
  # The chdir is essential: the parent shell's cwd may live under /home/<dev>/ which cv_generator
  # cannot traverse (0700), and tools like ruby-build try to popd back to it.
  local chdir="${APP_HOME}"
  if [[ "${1:-}" == "--at" ]]; then
    chdir="$2"
    shift 2
  fi
  sudo -u "${APP_USER}" \
    env -C "${chdir}" \
      HOME="${APP_HOME}" \
      ASDF_DATA_DIR="${APP_HOME}/.asdf" \
      PATH="${APP_HOME}/.asdf/shims:/usr/local/bin:/usr/bin:/bin" \
      "$@"
}

ensure_asdf() {
  # Check the file directly: developer shells often have ~/bin/asdf earlier on PATH,
  # so `command -v asdf` would mask the system install we actually care about.
  if [[ -x /usr/local/bin/asdf ]]; then
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

ensure_ruby() {
  echo "==> Ensuring Ruby ${RUBY_VERSION} is installed for ${APP_USER}..."
  as_app asdf plugin add ruby https://github.com/asdf-vm/asdf-ruby.git || true

  # Idempotency check: only consider the version "installed" if its ruby binary actually exists.
  # asdf list shows partial/failed installs, so trust the binary on disk.
  local ruby_bin="${APP_HOME}/.asdf/installs/ruby/${RUBY_VERSION}/bin/ruby"
  if sudo test -x "${ruby_bin}"; then
    echo "==> Ruby ${RUBY_VERSION} already installed."
  else
    echo "==> Installing Ruby ${RUBY_VERSION} build deps (sudo)..."
    sudo dnf install -y -q \
      gcc make patch autoconf bison \
      openssl-devel readline-devel zlib-devel libyaml-devel libffi-devel \
      gdbm-devel ncurses-devel
    # Wipe any partial install from a prior failure
    sudo rm -rf "${APP_HOME}/.asdf/installs/ruby/${RUBY_VERSION}" \
                "${APP_HOME}/.asdf/downloads/ruby/${RUBY_VERSION}"
    echo "==> Building Ruby ${RUBY_VERSION} (this takes a few minutes)..."
    as_app asdf install ruby "${RUBY_VERSION}"
  fi
  as_app asdf set -u ruby "${RUBY_VERSION}"
  echo "==> Ruby active: $(as_app ruby --version)"
}

ensure_dirs() {
  echo "==> Ensuring app directories exist (sudo)..."
  sudo install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${APP_DIR}"
  sudo install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${APP_DIR}/storage"
  sudo install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${APP_DIR}/tmp"
  sudo install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${APP_DIR}/log"
  sudo install -d -o "${APP_USER}" -g "${APP_USER}" -m 0755 "${APP_DIR}/tmp/pids"
}

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

ensure_firewall_selinux() {
  echo "==> Ensuring SELinux tools are installed (sudo)..."
  if ! command -v semanage &>/dev/null; then
    sudo dnf install -y -q policycoreutils-python-utils
  fi

  echo "==> Opening firewall port ${APP_PORT}/tcp (sudo)..."
  sudo firewall-cmd --add-port="${APP_PORT}/tcp" --permanent
  sudo firewall-cmd --reload

  echo "==> Labelling SELinux port ${APP_PORT}/tcp as http_port_t (sudo)..."
  # 'semanage port -a' on an already-labelled port exits non-zero and would kill
  # the script under set -e. Use grep -w so numeric word boundaries (space, comma,
  # newline) match regardless of whether the port is first or later in the list.
  if sudo semanage port -l | awk '$1=="http_port_t"' | grep -qw "${APP_PORT}"; then
    echo "==> Port already labelled."
  else
    sudo semanage port -a -t http_port_t -p tcp "${APP_PORT}"
  fi

  echo "==> Restoring SELinux labels under ${APP_HOME} (sudo)..."
  sudo restorecon -R "${APP_HOME}" || true
}

cmd_setup() {
  ensure_user
  ensure_asdf
  ensure_ruby
  ensure_dirs
  ensure_systemd_unit
  ensure_firewall_selinux
  echo "==> Setup complete. Run './hack/deploy.sh full' to deploy code."
}

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

install_gems() {
  echo "==> Installing gems (bundle --deployment)..."
  # Use as_app --at so bundle runs with cwd=APP_DIR; env -C in as_app overrides
  # any plain `cd && sudo` so we cannot just shell-cd before invoking it.
  ensure_bundle_config deployment 'true'
  # Bundle normalises space-separated groups to colon-separated on disk; pass
  # the colon form so the read-back comparison matches and we don't reset on
  # every run (which prints a noisy "You are replacing..." warning).
  ensure_bundle_config without 'development:test'
  as_app --at "${APP_DIR}" bundle install --jobs 4
}

ensure_bundle_config() {
  # Set a bundler local config key only if its current value differs from the
  # desired one. Avoids the redundant set + warning on idempotent re-runs.
  local key="$1" want="$2" current
  current="$(as_app --at "${APP_DIR}" bundle config get "${key}" 2>/dev/null \
    | grep -oE '"[^"]*"' | head -1 | tr -d '"' || true)"
  if [[ "${current}" != "${want}" ]]; then
    as_app --at "${APP_DIR}" bundle config set --local "${key}" "${want}"
  fi
}

prepare_db() {
  echo "==> Running db:prepare (RAILS_ENV=production)..."
  as_app --at "${APP_DIR}" \
    RAILS_ENV=production \
    RAILS_MASTER_KEY="$(cat "${SOURCE_KEY}")" \
    bundle exec bin/rails db:prepare
}

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

cmd_full() {
  need_master_key
  write_env_file
  sync_source
  install_gems
  prepare_db
  restart_and_check
  echo "==> Deploy complete."
}

cmd_push() {
  need_master_key
  write_env_file
  sync_source
  restart_and_check
  echo "==> Push complete."
}

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
