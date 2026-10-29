# Momentum

A tasks, habits and calendar tracker with real user accounts. Add tasks with due dates, check off habits to build streaks, and click a day on the calendar to plan ahead. Everyone only sees their own data.

![Node](https://img.shields.io/badge/node-%3E%3D20.12-339933)
![License](https://img.shields.io/badge/license-MIT-blue)

## Why I built it

I wanted one small place for tasks, daily habits and a calendar. It's also a practice project: the app is simple on purpose so the real work is in the hard parts, like storing passwords, sessions, password reset, rate limiting and testing them.

## Features

- Sign up, sign in and sign out, with private data per account
- Password reset by emailed link (single use, expires in 30 minutes, signs you out everywhere)
- Tasks with priorities and due dates, overdue ones turn red
- Habits with a 7-day grid and streaks
- Month calendar: click a day to see and add that day's tasks
- Dark mode and a phone-friendly layout

## Built with

JavaScript, Node.js, Express, SQLite (better-sqlite3), bcryptjs, jsonwebtoken, zod, helmet, express-rate-limit, nodemailer (optional, for SMTP). Plain HTML/CSS/JS on the front end with no build step. No outside APIs needed.

## Getting started

You need Node.js 20.12 or newer and Git.

```bash
git clone https://github.com/Zecktix/momentum.git
cd momentum
npm install
npm run dev
```

Open http://localhost:3000. Use `npm start` to run without auto-restart.

With no email set up, password reset links are printed in the terminal.

## Configuration

Everything has a default, so settings are optional. To change them, copy `.env.example` to `.env` (`cp` on Mac/Linux, `copy` on Windows).

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `NODE_ENV` | `development` | Set to `production` when deployed |
| `JWT_SECRET` | dev value | Signs sessions. Required in production, 32+ characters |
| `BASE_URL` | `http://localhost:3000` | Used to build reset links |
| `DB_PATH` | `./data/momentum.db` | Where the SQLite file lives |
| `SMTP_URL` | empty | Send real reset emails. If empty, links print to the console |

No API keys are needed.

## Using it

Create an account, then use the **Tasks**, **Habits** and **Calendar** tabs. It also has a JSON API under `/api`, for example:

```bash
curl -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"correct horse battery"}' \
  http://localhost:3000/api/auth/register

curl -b cookies.txt -H "Content-Type: application/json" \
  -d '{"title":"Book dentist","priority":"high","due":"2026-11-03"}' \
  http://localhost:3000/api/tasks
```

The second call returns `{"task":{"id":1,"title":"Book dentist","priority":"high","due":"2026-11-03","done":false,...}}`. The routes are `/api/auth`, `/api/tasks` and `/api/habits`; see `src/routes/` for details.

## Project structure

```
src/server.js     back end entry point
src/app.js        Express setup: headers, rate limits, routes
src/routes/       auth, tasks, habits
src/middleware/   session check, validation, errors
src/db.js         SQLite tables
public/           front end (index.html is the entry point)
test/             integration tests
```

## Deploying

I use Fly.io with a small volume for the SQLite file. Check their pricing first.

```bash
fly launch --no-deploy --copy-config
fly volumes create momentum_data --size 1
fly secrets set JWT_SECRET=<random-32+-chars> BASE_URL=https://<your-app>.fly.dev
fly deploy
```

## Roadmap and limitations

- [ ] Edit tasks in the UI (the API already supports it)
- [ ] Show habits on the calendar
- [ ] Email verification and optional two-factor login
- [ ] Switch to PostgreSQL so it can run on more than one server

Right now it only runs on one server, rate limits are per IP, and the front end has no automated tests. Nothing is in progress at the moment.

## Testing

```bash
npm test
```

23 tests using Node's built-in test runner and supertest, covering accounts, password reset, rate limiting, validation and data isolation. Line coverage of `src/` is about 97%. GitHub Actions runs them on every push.

## Contributing

Contributions are welcome. Open an [issue](https://github.com/Zecktix/momentum/issues/new/choose) for a bug or feature request, or fork the repo, make a branch, add tests, run `npm test` and open a pull request. Please report security problems privately by email instead of in a public issue.

## License and contact

MIT, see [LICENSE](LICENSE).

Riley Maynard · [@Zecktix](https://github.com/Zecktix) · ril3ymaynard@gmail.com · [LinkedIn](https://www.linkedin.com/in/riley-maynard-190636272/)

Thanks to the maintainers of the open-source packages used here and to the OWASP cheat sheets, which guided the auth design.
