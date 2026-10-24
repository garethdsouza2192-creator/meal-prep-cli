# Meal Prep CLI

## Local development

Set the runtime mode explicitly before starting the app:

```bash
export APP_ENV=LOCAL
npm install
npm run dev -- --host 0.0.0.0
```

Valid values are `LOCAL`, `DEV`, and `PROD`.

- `LOCAL` uses email/password sign-in.
- `DEV` is for shared non-production environments.
- `PROD` uses the production magic-link flow.

## Run with PM2 and Tailscale

This keeps the app running in the background and exposes it through Tailscale on the local tailnet.

Use the launcher script:

```bash
./run-meal-prep.sh
```

Or run the commands manually:

```bash
npm install
pm2 start "npm run dev:tailscale" --name meal-prep --update-env
tailscale serve reset
tailscale serve 3001
```

Then open:

```text
APP_URL
```

If you want to restart the app later:

```bash
pm2 restart meal-prep
```
