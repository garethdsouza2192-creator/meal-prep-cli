# Meal Prep CLI

## Local development

```bash
npm install
npm run dev -- --host 0.0.0.0
```

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
