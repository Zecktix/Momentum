# Momentum

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A simple app for **tasks**, **daily habits** and a **calendar**, with user accounts.
It runs on your own computer, needs no database, and has **nothing to install** besides Node.js.

- **Tasks:** priority levels, due dates and overdue highlighting
- **Habits:** a 7-day check-in strip with running streaks
- **Calendar:** a month view of your tasks, with quick-add for any day
- **Accounts:** sign up, sign in, sign out and password reset
- Light and dark mode that follows your system setting

---

## Getting started

This guide assumes no programming experience. It takes about five minutes.

### Step 1: Install Node.js (one time only)

Momentum runs on Node.js. Check whether you already have it:

1. Open a terminal (see [Step 4](#step-4-open-a-terminal-in-the-project-folder) if you're not sure how).
2. Type `node --version` and press Enter.

If you see a version number of **18.11 or higher** (for example `v22.12.0`), skip to Step 2.
If you see an older number or an error like "command not found" or "not recognized":

1. Go to **https://nodejs.org**.
2. Download the **LTS** version and run the installer, accepting the defaults.
3. **Close and reopen your terminal**, then run `node --version` again to confirm.

### Step 2: Download the project

1. On this GitHub page, click the green **Code** button near the top right.
2. Click **Download ZIP**.
3. Your browser saves a file named something like `momentum-main.zip`, usually in your **Downloads** folder.

> Comfortable with Git? Run `git clone <this-repository-url>` instead and skip to Step 4.

### Step 3: Unzip it

**Windows**
1. Open your Downloads folder and right-click `momentum-main.zip`.
2. Choose **Extract All...**, then click **Extract**.

**macOS**
1. Open your Downloads folder and double-click `momentum-main.zip`.
2. A `momentum-main` folder appears next to it.

**Linux**
1. Right-click the zip and choose **Extract Here**, or run `unzip momentum-main.zip` in a terminal.

Move the extracted folder somewhere easy to find, such as your Documents folder.

> **Check:** open the extracted folder. You should see `server.js`, `package.json` and a folder named `public`.
> If you only see one more folder inside, open that one. The right folder is the one that contains `package.json`.

### Step 4: Open a terminal in the project folder

**Windows**
1. Open the project folder in File Explorer (the one containing `package.json`).
2. Click the address bar at the top, type `cmd`, and press Enter.

**macOS**
1. Right-click the project folder in Finder.
2. Choose **New Terminal at Folder**. If you don't see it, open **System Settings > Keyboard > Keyboard Shortcuts > Services** and turn on "New Terminal at Folder".
3. Alternatively, open the Terminal app, type `cd ` (with a space), drag the project folder into the window, and press Enter.

**Linux**
1. Right-click an empty spot in the folder and choose **Open in Terminal**.

### Step 5: Start the app

In the terminal, type:

```
npm start
```

and press Enter. You should see:

```
Momentum is running at http://localhost:3000
```

**Leave this terminal window open.** The app runs only while it's open.

### Step 6: Open it in your browser

Go to **http://localhost:3000**. You'll see the sign-in screen.

---

## Using Momentum

### Create your account

1. Click **Create an account**.
2. Enter your email and a password of 8 to 72 characters.
3. Click **Create account**. You're signed in right away.

Your data is saved on your computer, so you can close the browser and come back later. Just sign in again.

### Tasks

1. Open the **Tasks** tab.
2. Type what needs doing, choose a **priority** (low, medium or high), and optionally pick a **due date**.
3. Click **Add task**.
4. Click the **circle** next to a task to mark it done. Click it again to undo.
5. Click **×** to delete a task. You'll be asked to confirm.

Tasks past their due date are flagged as overdue.

### Habits

1. Open the **Habits** tab.
2. Type a habit, such as "Read 20 minutes", and click **Add habit**.
3. Each habit shows the last 7 days, with today outlined on the right.
4. Click a day's square to check it in. Click it again to undo.
5. Check in on consecutive days to build a **streak**, shown at the top right of the habit.
   A streak stays alive until the end of the day, so you won't lose it before you've had a chance to check in.

### Calendar

1. Open the **Calendar** tab to see the month, with a dot on each day that has tasks.
   Dot colors show priority: red is high, amber is medium and green is low. A hollow dot means done.
2. Click a day to see its tasks and add new ones for that date.
3. Use the **‹** and **›** buttons to change months, and **Today** to jump back.

### Progress bar

The bar at the top shows how much you've finished: completed tasks plus today's habit check-ins.

### Sign out

Click **Sign out** at the top right.

### Forgot your password?

There's no email service built in, so reset links appear in the terminal instead:

1. On the sign-in screen, click **Forgot password?** and enter your email.
2. Look at the terminal window where the app is running. A link like `http://localhost:3000/?reset=...` is printed there.
3. Copy that link into your browser and choose a new password. The link works for one hour.

---

## Stopping and restarting

- **To stop:** click the terminal window and press `Ctrl + C`.
- **To start again:** open a terminal in the project folder and run `npm start`.

Your accounts and data are kept between restarts.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `node` or `npm` is "not recognized" / "command not found" | Install Node.js (Step 1), then **close and reopen** the terminal. |
| `npm start` says it can't find `package.json` | The terminal is in the wrong folder. Go back to Step 4 and open it in the folder that contains `package.json`. |
| `Port 3000 is busy` | Another program is using the port. Run on a different one: see [Settings](#settings). Then visit `http://localhost:3001` (or whichever port you chose). |
| The page shows `{"error":"Not found."}` | The `public` folder is missing or its files were moved. `index.html`, `app.js` and `styles.css` must be inside `public`, next to `server.js`. |
| The page won't load at all | Check that the terminal still shows the app running, and that you typed `http://localhost:3000` exactly. |
| "Too many attempts" when signing in | Wait about 15 minutes. This limit protects against password guessing. |
| Forgot your password and can't find the reset link | Look in the terminal window running the app, not in your email. |

---

## Settings

All optional. They're set as environment variables before starting.

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `3000` | Port the app listens on |
| `HOST` | `127.0.0.1` | Use `0.0.0.0` to allow other devices on your network, or when deploying |
| `BASE_URL` | the request's host | Base address used in password-reset links |

Examples of running on port 3001:

```
# Windows (Command Prompt)
set PORT=3001 && npm start

# Windows (PowerShell)
$env:PORT=3001; npm start

# macOS / Linux
PORT=3001 npm start
```

---

## Your data

- Everything is stored in `data/db.json`, created the first time you run the app.
- **Back this file up** if your data matters to you. To move to another computer, copy it over.
- Don't commit it to Git. It contains account details. The included `.gitignore` already excludes it.
- Passwords are stored as salted scrypt hashes, never as plain text.

## Project layout

```
momentum/
├── server.js        Web server, API and authentication
├── package.json
├── public/          Front end (served to the browser)
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── test/            Automated tests
└── data/            Created on first run (your database)
```

## For developers

```
npm run dev     # restart automatically when files change
npm test        # run the API tests
```

| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/auth/register`, `/login`, `/logout` | Account and session |
| POST | `/api/auth/forgot`, `/reset` | Password reset |
| GET | `/api/auth/me` | Current user |
| GET, POST | `/api/tasks` | List or create tasks |
| PATCH, DELETE | `/api/tasks/:id` | Update or delete a task |
| GET, POST | `/api/habits` | List or create habits |
| DELETE | `/api/habits/:id` | Delete a habit |
| PUT, DELETE | `/api/habits/:id/checkins/:YYYY-MM-DD` | Add or remove a check-in |

To send real reset emails, add your mail provider's call where `server.js` logs the reset link.

**Putting it on the internet?** This app is designed for personal use on a trusted machine.
If you deploy it publicly, serve it over HTTPS (for example, behind a reverse proxy) and consider
replacing the JSON file with a real database.

## License

MIT. See [LICENSE](LICENSE).
