# Cloudflared ingress — final hookup

The deploy script binds Puma on the host's `0.0.0.0:8090` and leaves the public
exposure to the existing `cloudflared` tunnel (`myapp`, UUID
`c959e3f6-9e39-4106-a9a3-1beb9d5b1c16`). This doc captures the steps to add a
public hostname for `cv_generator` once one is chosen.

## Step-by-step

When the public hostname is chosen (e.g. `cv.machadovilaca.eu`):

1. Edit `/etc/cloudflared/config.yml`. **Above** the catch-all
   `service: http_status:404`, add a new ingress entry:

   ```yaml
   - hostname: <chosen>.machadovilaca.eu
     service: http://127.0.0.1:8090
   ```

   The order of `ingress:` matters — first match wins, and the catch-all must
   stay last. See "Choosing the upstream URL" below if you want to match the
   sibling `degen-gambler` style instead.

2. Reload cloudflared so it picks up the new ingress rule:

   ```bash
   sudo systemctl reload cloudflared
   ```

3. Point DNS at the tunnel. In the Cloudflare dashboard for `machadovilaca.eu`,
   add a CNAME for `<chosen>` → `c959e3f6-9e39-4106-a9a3-1beb9d5b1c16.cfargotunnel.com`,
   or run:

   ```bash
   cloudflared tunnel route dns myapp <chosen>.machadovilaca.eu
   ```

4. Verify end-to-end reachability:

   ```bash
   curl -I https://<chosen>.machadovilaca.eu/up           # expect HTTP/2 200
   curl https://<chosen>.machadovilaca.eu/api/health      # expect {"status":"ok"}
   ```

5. (Stripe webhooks) In the Stripe dashboard, point the webhook URL at
   `https://<chosen>.machadovilaca.eu/api/webhooks/stripe`. The path comes from
   `config/routes.rb` — `namespace :api { namespace :webhooks { post "stripe" } }`.

## Choosing the upstream URL

Puma binds `0.0.0.0:8090`, so any of the host's interfaces will accept the
tunnel connection. Two reasonable choices:

| Upstream | When it works | Trade-off |
|---|---|---|
| `http://127.0.0.1:8090` | Always (loopback is always up). | Doesn't match the existing degen-gambler entry, which uses the LAN IP. |
| `http://192.168.1.172:8090` | Only when ethernet is plugged in and `m920q-tiny-1` has its static `.172` lease. Breaks on wifi-only or different networks. | Matches the degen-gambler style for consistency. |

**Recommendation: `127.0.0.1:8090`.** Both `cloudflared` and `cv_generator`
run on the same host, so loopback is the most direct path; it survives any
LAN/IP change (we already hit the failure mode when the host moved from
ethernet to wifi during initial bring-up). If/when degen-gambler is rewired,
its entry can move to loopback for the same reason.

## Reference: current `/etc/cloudflared/config.yml` shape

```yaml
tunnel: myapp
credentials-file: /home/<user>/.cloudflared/c959e3f6-9e39-4106-a9a3-1beb9d5b1c16.json
origincert: /etc/cloudflared/cert.pem

ingress:
  - hostname: degengambler.machadovilaca.eu
    service: http://192.168.1.172:8080

  # ↓ insert cv_generator entry here, above the catch-all
  - hostname: <chosen>.machadovilaca.eu
    service: http://127.0.0.1:8090

  - service: http_status:404
```

## Failure modes & quick checks

- **DNS not resolving** — check `dig <chosen>.machadovilaca.eu CNAME` returns the
  `cfargotunnel.com` target.
- **502 / 521 from Cloudflare** — origin (Puma) is down or unreachable from
  loopback. Verify `curl -fsS http://127.0.0.1:8090/up` succeeds on the host
  itself; if not, the deploy script's `restart_and_check` would have already
  flagged it.
- **Tunnel not picking up new ingress** — `sudo systemctl reload cloudflared`
  was skipped, or the YAML has a syntax error (`cloudflared validate`
  diagnoses).
- **Stripe webhook signing failures** — the webhook secret in Stripe must
  match `Rails.application.credentials.dig(:stripe, :webhook_secret)`. The
  webhook URL itself just needs to reach the Rails app on this hostname.
