# Momentum

Tasks, habits and a calendar, with user accounts. No dependencies to install.

## Run it

1. Install [Node.js](https://nodejs.org) 18.11 or newer (LTS is fine).
2. Open a terminal in this folder and run:

```
npm start
```

3. Open http://localhost:3000

Other commands:

| Command | What it does |
| --- | --- |
| `npm start` | Run the app |
| `npm run dev` | Run and auto-restart when files change |
| `npm test` | Run the API tests |

## Settings (optional environment variables)

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3000` | Windows: `set PORT=3001 && npm start` |
| `HOST` | `127.0.0.1` | Use `0.0.0.0` to allow other devices or to deploy |
| `BASE_URL` | request host | Used in password-reset links |

## Where things are

- `server.js` – the web server and API
- `public/` – the front end (`index.html`, `app.js`, `styles.css`)
- `data/db.json` – created on first run; holds all accounts and data. Back it up, don't commit it.

## Password reset

There's no email service built in. When someone uses "Forgot password?", the reset link is printed in the terminal running the server. To send real emails, add your mail provider's call where `server.js` logs the link.
