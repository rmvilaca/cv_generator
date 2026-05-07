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
