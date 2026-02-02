# Nauth Demo - Docker Deployment

## Deploy to demo.nauth.dev

```bash
cd examples
./start.sh
```

Done. Auto-generates secrets (only if .env doesn't exist), starts everything.

## What You Get

- **Frontend:** https://demo.nauth.dev
- **API:** https://demo.nauth.dev/api
- Single domain setup (no subdomains needed)
- Automatic HTTPS via Caddy
- Console email/SMS (logs to terminal)
- PostgreSQL + Redis included

## DNS Required

Point ONE domain to your server:
```
A    demo.nauth.dev    -> YOUR_SERVER_IP
```

## Your .env is Safe

Use a **single** `.env` in `examples/` (next to `docker-compose.yml`).  
Docker Compose loads it automatically when you run from `examples/`.

`./start.sh` will NOT overwrite existing `.env` file.  
Only generates secrets if `.env` doesn't exist.

- Backend and frontend **build args** (e.g. `RECAPTCHA_ENTERPRISE_SITE_KEY`, `API_BASE_URL`) come from this `.env`.
- Set `RECAPTCHA_ENTERPRISE_SITE_KEY` in `examples/.env` when reCAPTCHA is enabled, then rebuild the frontend: `docker compose build --no-cache frontend && docker compose up -d`.
- Do not use a separate `.env` in `sample-angular/`; use `examples/.env` only.

## Add OAuth (Optional)

Your `.env` already has Google OAuth configured! ✓

To add more:
```bash
# Edit examples/.env
APPLE_SERVICE_ID=...
FACEBOOK_CLIENT_ID=...
```

Then: `docker-compose up -d --build`

## Management

```bash
docker-compose logs -f        # View logs
docker-compose restart        # Restart
docker-compose down           # Stop
```

## Email/SMS Testing

Emails and SMS codes print to backend logs:
```bash
docker-compose logs -f backend | grep "Email\|SMS"
```

That's it.
