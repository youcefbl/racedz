# zidrun.com unreachable from Algeria (Cloudflare edge + IPv6) — runbook

## Summary

`zidrun.com` intermittently fails to load for Algerian users (in the app **and** in the
browser), while the site is actually up. It typically comes back after a **router restart**,
then breaks again later. Mobile data often works when WiFi doesn't.

**Root cause:** the domain resolves to **Cloudflare's proxied edge IPs** (notably the
`188.114.96.0/22` range) and to **IPv6 (`AAAA`) addresses**. Many Algerian ISPs / home routers
(e.g. Huawei **HG8145X6**) can't reliably route to that Cloudflare range, and routers with
**broken IPv6** try the `AAAA` first and stall. The origin server itself is fine.

**Permanent fix:** take Cloudflare out of the path — serve both `zidrun.com` and `www` as
plain **DNS-only (grey-cloud) `A` records to the origin** (`91.99.227.228`). See below.

---

## Symptoms

- App shows a blank / "Webpage not available" / `ERR_QUIC_PROTOCOL_ERROR` / "Aw, Snap!" screen.
- Browser can't reach `https://zidrun.com` on WiFi, but **mobile data works**.
- Restarting the **WiFi router** fixes it temporarily (clears the local DNS/IPv6 cache).
- Sometimes `www` works but the apex doesn't, or vice-versa.

## Diagnosis (how to confirm)

```bash
# What is the domain resolving to right now?
dig +short zidrun.com A        # BAD if Cloudflare (104.21.x / 172.67.x / 188.114.x); GOOD if 91.99.227.228
dig +short zidrun.com AAAA     # BAD if any IPv6 is returned; GOOD if empty

# Is the origin actually up (bypassing Cloudflare)?
curl -s -o /dev/null -w "%{http_code}\n" --resolve zidrun.com:443:91.99.227.228 https://zidrun.com/   # expect 200
```

- If `A` returns Cloudflare IPs and/or `AAAA` returns anything → the request is going through
  Cloudflare's edge (the unreliable path from Algeria).
- If `--resolve` to the origin returns `200`, the server is healthy and the problem is purely
  the Cloudflare/IPv6 network path.

Confirm the IPv6 angle on the affected phone: open `https://test-ipv6.com` — if the IPv6 tests
time out, the WiFi router's IPv6 is broken.

## Why it keeps coming back (the trap)

The apex was set as **`CNAME zidrun.com → www`** while **`www` stayed proxied (orange cloud)**.
CNAME-flattening then makes the apex resolve to `www`'s **Cloudflare** IPs (`188.114.x`) + IPv6.
So the apex is still on the flaky path even though it "looks" changed. A router restart only
clears the local cache; the bad records are served again minutes later. Grey-clouding **only one**
of the two records is not enough.

---

## Permanent fix

In **Cloudflare → DNS → Records**, make it **exactly** these two, both **DNS only (grey cloud)**:

| Type | Name         | Content          | Proxy status      |
|------|--------------|------------------|-------------------|
| A    | `zidrun.com` | `91.99.227.228`  | **DNS only (grey)** |
| A    | `www`        | `91.99.227.228`  | **DNS only (grey)** |

- If the apex is currently a `CNAME → www`, **change it back to a plain `A` record**.
- **Grey-cloud `www` as well** — this is the step that's usually missed.
- **Do not re-enable the orange cloud.**

Result: both hosts resolve only to `91.99.227.228` over **IPv4, with no `AAAA`** — eliminating
both the `188.114.x` routing problem and the broken-IPv6-router problem. No more router restarts.

### TLS note
Ensure **Caddy** on the origin is configured for **both** `zidrun.com` and `www.zidrun.com` so
each gets a valid Let's Encrypt cert (the box already serves a valid cert for `zidrun.com`).

### Verify after changing
```bash
dig +short zidrun.com A        # → 91.99.227.228 (only)
dig +short zidrun.com AAAA     # → (empty)
dig +short www.zidrun.com A    # → 91.99.227.228 (only)
curl -s -o /dev/null -w "%{http_code}\n" https://zidrun.com/       # → 200
curl -s -o /dev/null -w "%{http_code}\n" https://www.zidrun.com/   # → 200
```
Give DNS a few minutes to propagate; on the phone, toggle WiFi off/on (or restart it once) to
drop any cached IPv6/old IPs.

---

## Trade-offs & alternatives

- **Trade-off of grey-cloud:** you lose Cloudflare's CDN/caching and DDoS shielding, and your
  origin IP (`91.99.227.228`) becomes public. For an Algeria-focused app where "it loads
  reliably" is the priority, this is the right call.
- **Keep Cloudflare AND be reliable in Algeria:** not achievable on the free plan (you can't pick
  Cloudflare's anycast IPs, and IPv6 can't be disabled on free). Would require a paid Cloudflare
  tier (e.g. Argo Smart Routing) or a different CDN/edge with better Algeria routing — a separate
  project.
- **App-only bypass (if you want Cloudflare on the website):** add `app.zidrun.com` →
  `91.99.227.228` **DNS only**, serve it in Caddy, and point the Capacitor `serverUrl` (and the
  App Links / deep-link hosts) at `app.zidrun.com`. Keeps Cloudflare on the public site, direct
  path for the app.

## Related client-side mitigations (already shipped)

- **HTTP/3 disabled** at Cloudflare earlier to stop `ERR_QUIC_PROTOCOL_ERROR` (only relevant while
  proxied; moot once grey-clouded).
- **Native crash recovery** in the app (`RecoveryWebViewClient`) shows a reload page instead of
  the app closing when the WebView renderer is killed.
