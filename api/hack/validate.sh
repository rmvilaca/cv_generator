#!/usr/bin/env bash
# Phase B1+B2+B3 sanity sweep for the cv_generator deploy.
# Run from anywhere as: ./hack/validate.sh
#
# B1: idempotence — re-run setup and full, expect 'already' messages and no real work.
# B2: utility subcommands — status, restart (+health), logs (3-second tail).
# B3: SELinux — sweep for cv_generator-related AVC denials in the last hour.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

echo "==> Refreshing sudo timestamp once up front..."
if ! sudo -v; then
  echo "ERROR: could not acquire sudo credentials. Run this script from an" >&2
  echo "interactive terminal (so the password prompt has a TTY)." >&2
  exit 2
fi

hr() { printf "==================================================================\n"; }

hr; echo "B1: idempotence sweep"; hr
echo
echo "--- B1.1: re-run setup (expect 'already' lines, no curl/dnf/install) ---"
./hack/deploy.sh setup
echo
echo "--- B1.2: re-run full (rsync should be a near no-op; bundle/db should report no work) ---"
./hack/deploy.sh full

echo
hr; echo "B2: utility subcommands"; hr
echo
echo "--- B2.1: status (expect Active: active (running)) ---"
./hack/deploy.sh status

echo
echo "--- B2.2: restart, then /up health-check ---"
./hack/deploy.sh restart
sleep 4
curl -fsS -o /dev/null -w "/up after restart: HTTP %{http_code}\n" http://127.0.0.1:8090/up || echo "    /up curl failed"

echo
echo "--- B2.3: logs (3-second tail; SIGTERM via timeout is expected) ---"
timeout 3 ./hack/deploy.sh logs || true

echo
hr; echo "B3: SELinux AVC sweep (cv_generator-related denials)"; hr
echo
# ausearch exit codes: 0 = matches, 1 = no matches, anything else = real failure.
# Capture output and exit code separately so a sudo/ausearch failure can't
# masquerade as a clean "no denials" via a silent-pipe-into-grep.
avc_out="$(sudo ausearch -m AVC -ts recent 2>&1)"
avc_rc=$?
# sudo and ausearch both return 1 in their respective "nothing wrong" cases
# (sudo: auth fail; ausearch: no matches). Distinguish by sniffing for sudo's
# diagnostic prefix in the output before trusting rc==1 as "no denials".
if printf '%s' "${avc_out}" | grep -qE '^sudo:'; then
  echo "ERROR: sudo could not run ausearch:"
  printf '%s\n' "${avc_out}"
elif [[ ${avc_rc} -ne 0 && ${avc_rc} -ne 1 ]]; then
  echo "ERROR: ausearch failed (exit ${avc_rc}):"
  printf '%s\n' "${avc_out}"
elif printf '%s\n' "${avc_out}" | grep -i cv_generator; then
  : # grep already printed matching lines
else
  echo "no cv_generator AVC denials"
fi

echo
hr; echo "Done."; hr
