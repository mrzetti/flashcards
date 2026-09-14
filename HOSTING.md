# Hosting Flashcards on a fresh VPS

This is a static site: nginx serves HTML, JavaScript, the catalog, original SWFs,
and a self-hosted Ruffle runtime. No application server or database is required.

## First installation (Debian / Ubuntu)

Point your hostname's A record (and AAAA, if used) at the VPS. Allow inbound TCP
80 and 443. Run the following as root, replacing the example hostname:

```sh
apt-get update
apt-get install -y git nginx rsync python3 certbot python3-certbot-nginx
git clone https://github.com/mrzetti/flashcards.git /opt/flashcards
cd /opt/flashcards
sh deploy.sh
HOST=flashcards.example.org
sed "s/FLASHCARDS_HOST/$HOST/g" deploy/nginx.conf > /etc/nginx/sites-available/flashcards
ln -s /etc/nginx/sites-available/flashcards /etc/nginx/sites-enabled/flashcards
nginx -t
systemctl reload nginx
certbot --nginx -d "$HOST" --redirect
curl --fail "https://$HOST/catalog.json"
```

Certbot installs renewal scheduling. Check it with `systemctl list-timers` and
verify renewal using `certbot renew --dry-run`. Keep the nginx MIME types include
provided by the distribution; the site template explicitly serves `.wasm` as
`application/wasm`, including on older distributions without that MIME mapping.

## Updates

```sh
cd /opt/flashcards
git pull --ff-only
sh deploy.sh
```

`deploy.sh` copies public files into `/var/www/flashcards`; an optional first
argument selects another destination. It synchronizes the asset and original
directories, removing obsolete deployed assets. It does not overwrite nginx or
certificate configuration. Serve the public deployment directory, not the Git
checkout. Keep a previous checkout/commit available for rollback; check out that
commit and run the same deployment command.

The shipped nginx template sends `Cache-Control: no-cache` for every response:
filenames are not content-hashed, so browsers must revalidate with ETag /
If-Modified-Since after a deploy instead of reusing a stale launcher or catalog
(mobile browsers are the usual victims). `qa/check_deployment.py` asserts the
header on every checked URL.

The template also enables cross-origin isolation with
`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`. This is required for the embedded
Asche browser game to keep SharedArrayBuffer. Keep the self-hosted site free of
cross-origin resources without compatible CORP headers; the Asche deployment
sends `Cross-Origin-Resource-Policy: same-site` so its sibling subdomain may be
framed. `qa/check_deployment.py` also checks the game URL's isolation headers.

The script validates catalog paths and SWF integrity before copying. Updates are
in-place; use a maintenance window if replacing a large collection. All card
assets must be under `assets/` or `originals/`, the two synchronized trees.

## Portability and embedding

Runtime and catalog assets use relative URLs. No API keys or external CDN are
needed. Use a dedicated hostname for the simplest deployment. If serving below a
path prefix, retain the relative directory layout and test direct card links,
player iframe URLs, and any SWF-relative companion requests.

Embed the launcher using a regular iframe with `allow="autoplay; fullscreen"`
and `allowfullscreen`. Browser/user policies may require a further tap for audio
or disallow fullscreen in an embedded context. Fullscreen should always be
tested in the actual wiki integration.

## Operational checks

After updating, open the HTTPS site, launch a card, interact with it, change the
volume, minimize/restore, restart, enter/exit fullscreen, close, and reopen.
Check browser console/network output for failed assets. Test a narrow viewport
and keyboard-required content using its touch controls. Consult `VERIFICATION.md`
for the tested coverage and known content limitations.

The original deployment uses `/var/www/flashcards` and the nginx site name
`flashcards.rammwiki.mrzetti.com`. Its certificate was issued by Let's Encrypt;
fresh installations should obtain their own certificate as above.
