# SSL Certificate (Let's Encrypt) for www.epicwoven.com

## Prerequisites

- **DNS**: `www.epicwoven.com` must point to your server’s public IP (A record).
- **Port 80**: Open in the server firewall / security group (Let’s Encrypt uses HTTP for the challenge).
- **Nginx**: Serving the site on port 80 with the certbot webroot at `/.well-known/acme-challenge/` (see `web/nginx.conf`).

---

## 1. Generate certificate (first time or new domain)

### Option A: Using the project script (Docker)

From the **project root** (where `docker-compose` and `setup-ssl.sh` live):

```bash
# Create certbot dirs
mkdir -p certbot/conf certbot/www

# Start only the frontend so nginx can serve the challenge
docker-compose up -d frontend
sleep 5

# Obtain certificate (replace email with your address)
docker run --rm \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d www.epicwoven.com
```

**Important:** Nginx must map `/.well-known/acme-challenge/` to `/var/www/certbot`. If you run nginx in Docker, mount the host `certbot/www` into the container at `/var/www/certbot` and use that in the `location /.well-known/acme-challenge/` block.

### Option B: Certbot installed on the server (no Docker)

```bash
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d www.epicwoven.com
```

Certificates will be under `/etc/letsencrypt/live/www.epicwoven.com/`. Point nginx’s `ssl_certificate` and `ssl_certificate_key` to those paths (or copy them where your nginx config expects).

---

## 2. Renew certificate

Let’s Encrypt certificates are valid for 90 days. Renew before they expire.

### With Docker

```bash
docker run --rm \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot renew
```

### On the server (certbot installed)

```bash
sudo certbot renew
```

After renewal, reload nginx so it uses the new certs:

```bash
sudo nginx -t && sudo nginx -s reload
# or, if nginx runs in Docker:
docker-compose exec frontend nginx -s reload
```

---

## 3. Auto-renewal (cron)

Add a cron job to renew and reload nginx (example for system certbot):

```bash
# Run every day at 3 AM; reload nginx only if renewal succeeded
0 3 * * * certbot renew --quiet --deploy-hook "nginx -s reload"
```

Adjust the path to `certbot` and `nginx` if needed (e.g. use full paths or run via Docker).

---

## 4. Troubleshooting

| Issue | Check |
|-------|--------|
| "Connection refused" or challenge fails | Port 80 open? Nginx running? `location /.well-known/acme-challenge/` and webroot path correct? |
| "DNS problem" or "No valid IP" | DNS for `www.epicwoven.com` points to this server and has propagated. |
| Rate limit | Let’s Encrypt has weekly limits; use `--staging` for testing to avoid hitting them. |

**Staging (test) certificate (no rate-limit impact):**

```bash
docker run --rm \
  -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  --staging \
  --email your-email@example.com \
  --agree-tos --no-eff-email \
  -d www.epicwoven.com
```

Remove `--staging` when you’re ready to get a real certificate.
