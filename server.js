'use strict';
/*
 * Momentum server. Uses only Node built-ins, so there is nothing to `npm install`.
 * Data is stored in data/db.json.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);
const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8',
};
const SESSION_MS = 30 * 24 * 3600 * 1000;
const RESET_MS = 3600 * 1000;
const PRIORITIES = ['low', 'med', 'high'];

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) &&
  new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
const cleanTitle = (t) => (typeof t === 'string' ? t.trim().replace(/\s+/g, ' ') : '');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}
async function checkPassword(pw, stored) {
  const [salt, key] = stored.split(':');
  const test = await scrypt(pw, Buffer.from(salt, 'hex'), 64);
  return crypto.timingSafeEqual(test, Buffer.from(key, 'hex'));
}

function createApp({ dataFile = path.join(__dirname, 'data', 'db.json'), log = console.log, authLimit = 30, baseUrl } = {}) {
  const empty = () => ({ users: [], tasks: [], habits: [], sessions: [], resets: [] });
  let db = empty();
  try { db = { ...empty(), ...JSON.parse(fs.readFileSync(dataFile, 'utf8')) }; } catch { /* first run */ }
  const pruneNow = () => {
    const now = Date.now();
    db.sessions = db.sessions.filter((s) => s.expires > now);
    db.resets = db.resets.filter((r) => r.expires > now);
  };
  pruneNow();

  function save() {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    const tmp = `${dataFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, dataFile);
  }

  const attempts = new Map(); // ip -> { n, reset }
  function limit(req) {
    const ip = req.socket.remoteAddress || 'x';
    const now = Date.now();
    let a = attempts.get(ip);
    if (!a || a.reset < now) { a = { n: 0, reset: now + 15 * 60 * 1000 }; attempts.set(ip, a); }
    if (++a.n > authLimit) throw new HttpError(429, 'Too many attempts. Wait a few minutes and try again.');
  }

  function send(res, status, data, headers = {}) {
    if (data === undefined || data === null) { res.writeHead(status, headers); return res.end(); }
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
    res.end(JSON.stringify(data));
  }

  function readJson(req) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > 10 * 1024) { reject(new HttpError(413, 'Request too large.')); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (!chunks.length) return resolve({});
        try {
          const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          resolve(v && typeof v === 'object' ? v : {});
        } catch { reject(new HttpError(400, 'Invalid request.')); }
      });
      req.on('error', reject);
    });
  }

  const cookie = (req, name) => {
    for (const part of (req.headers.cookie || '').split(';')) {
      const [k, ...v] = part.trim().split('=');
      if (k === name) return decodeURIComponent(v.join('='));
    }
    return null;
  };
  const sessionCookie = (req, value, maxAge) => {
    const secure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
    return `sid=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
  };
  function currentUser(req) {
    const sid = cookie(req, 'sid');
    if (!sid) return null;
    const s = db.sessions.find((x) => x.hash === sha(sid) && x.expires > Date.now());
    return s ? db.users.find((u) => u.id === s.userId) || null : null;
  }
  const requireUser = (req) => {
    const u = currentUser(req);
    if (!u) throw new HttpError(401, 'Please sign in.');
    return u;
  };
  function startSession(req, res, user, status, body) {
    const token = crypto.randomBytes(32).toString('hex');
    db.sessions.push({ hash: sha(token), userId: user.id, expires: Date.now() + SESSION_MS });
    save();
    send(res, status, body, { 'Set-Cookie': sessionCookie(req, token, SESSION_MS / 1000) });
  }

  function validCredentials(body, needEmail = true) {
    const email = String(body.email || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (needEmail && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new HttpError(400, 'Enter a valid email address.');
    return { email, password };
  }
  const checkNewPassword = (pw) => {
    if (pw.length < 8 || pw.length > 72) throw new HttpError(400, 'Use a password of 8 to 72 characters.');
  };

  const taskOut = (t) => ({ id: t.id, title: t.title, priority: t.priority, due: t.due, done: t.done, createdAt: t.createdAt });
  const habitOut = (h) => ({ id: h.id, title: h.title, days: h.days });

  async function route(req, res, url) {
    const { pathname } = url;
    const m = req.method;
    let r;

    /* ---- auth ---- */
    if (pathname === '/api/auth/register' && m === 'POST') {
      limit(req);
      const body = await readJson(req);
      const { email, password } = validCredentials(body);
      checkNewPassword(password);
      if (db.users.some((u) => u.email === email)) throw new HttpError(409, 'An account with that email already exists.');
      const user = { id: crypto.randomUUID(), email, password: await hashPassword(password), createdAt: Date.now() };
      db.users.push(user);
      return startSession(req, res, user, 201, { user: { email } });
    }
    if (pathname === '/api/auth/login' && m === 'POST') {
      limit(req);
      const { email, password } = validCredentials(await readJson(req), false);
      const user = db.users.find((u) => u.email === email);
      const ok = user ? await checkPassword(password, user.password) : (await scrypt(password, 'x', 64), false);
      if (!ok) throw new HttpError(401, 'Email or password is incorrect.');
      return startSession(req, res, user, 200, { user: { email: user.email } });
    }
    if (pathname === '/api/auth/logout' && m === 'POST') {
      const sid = cookie(req, 'sid');
      if (sid) { db.sessions = db.sessions.filter((s) => s.hash !== sha(sid)); save(); }
      return send(res, 204, null, { 'Set-Cookie': sessionCookie(req, '', 0) });
    }
    if (pathname === '/api/auth/me' && m === 'GET') {
      return send(res, 200, { user: { email: requireUser(req).email } });
    }
    if (pathname === '/api/auth/forgot' && m === 'POST') {
      limit(req);
      const { email } = validCredentials(await readJson(req));
      const user = db.users.find((u) => u.email === email);
      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        db.resets = db.resets.filter((x) => x.userId !== user.id);
        db.resets.push({ hash: sha(token), userId: user.id, expires: Date.now() + RESET_MS });
        save();
        // No email service is built in. The link is printed to the server console.
        log(`\n[Momentum] Password reset link for ${email} (valid 1 hour):\n  ${baseUrl || `http://${req.headers.host}`}/?reset=${token}\n`);
      }
      return send(res, 200, { message: 'If that email has an account, a reset link has been sent.' });
    }
    if (pathname === '/api/auth/reset' && m === 'POST') {
      limit(req);
      const body = await readJson(req);
      const password = typeof body.password === 'string' ? body.password : '';
      checkNewPassword(password);
      const rec = typeof body.token === 'string' && db.resets.find((x) => x.hash === sha(body.token) && x.expires > Date.now());
      if (!rec) throw new HttpError(400, 'This reset link is invalid or has expired.');
      const user = db.users.find((u) => u.id === rec.userId);
      user.password = await hashPassword(password);
      db.resets = db.resets.filter((x) => x !== rec);
      db.sessions = db.sessions.filter((s) => s.userId !== user.id);
      save();
      return send(res, 200, { message: 'Password updated. Sign in with your new password.' });
    }

    /* ---- tasks ---- */
    if (pathname === '/api/tasks') {
      const user = requireUser(req);
      if (m === 'GET') return send(res, 200, { tasks: db.tasks.filter((t) => t.userId === user.id).map(taskOut) });
      if (m === 'POST') {
        const b = await readJson(req);
        const title = cleanTitle(b.title);
        if (!title || title.length > 80) throw new HttpError(400, 'Title must be 1 to 80 characters.');
        const priority = b.priority === undefined ? 'med' : b.priority;
        if (!PRIORITIES.includes(priority)) throw new HttpError(400, 'Invalid priority.');
        const due = b.due ?? null;
        if (due !== null && !isDate(due)) throw new HttpError(400, 'Invalid due date.');
        if (db.tasks.filter((t) => t.userId === user.id).length >= 500) throw new HttpError(400, 'Task limit reached.');
        const task = { id: crypto.randomUUID(), userId: user.id, title, priority, due, done: false, createdAt: Date.now() };
        db.tasks.push(task); save();
        return send(res, 201, { task: taskOut(task) });
      }
    }
    if ((r = pathname.match(/^\/api\/tasks\/([\w-]+)$/))) {
      const user = requireUser(req);
      const task = db.tasks.find((t) => t.id === r[1] && t.userId === user.id);
      if (!task) throw new HttpError(404, 'Task not found.');
      if (m === 'PATCH') {
        const b = await readJson(req);
        if ('done' in b) { if (typeof b.done !== 'boolean') throw new HttpError(400, 'Invalid value.'); task.done = b.done; }
        if ('title' in b) {
          const t = cleanTitle(b.title);
          if (!t || t.length > 80) throw new HttpError(400, 'Title must be 1 to 80 characters.');
          task.title = t;
        }
        if ('priority' in b) { if (!PRIORITIES.includes(b.priority)) throw new HttpError(400, 'Invalid priority.'); task.priority = b.priority; }
        if ('due' in b) { if (b.due !== null && !isDate(b.due)) throw new HttpError(400, 'Invalid due date.'); task.due = b.due; }
        save();
        return send(res, 200, { task: taskOut(task) });
      }
      if (m === 'DELETE') { db.tasks = db.tasks.filter((t) => t !== task); save(); return send(res, 204); }
    }

    /* ---- habits ---- */
    if (pathname === '/api/habits') {
      const user = requireUser(req);
      if (m === 'GET') return send(res, 200, { habits: db.habits.filter((x) => x.userId === user.id).map(habitOut) });
      if (m === 'POST') {
        const title = cleanTitle((await readJson(req)).title);
        if (!title || title.length > 80) throw new HttpError(400, 'Title must be 1 to 80 characters.');
        if (db.habits.filter((x) => x.userId === user.id).length >= 100) throw new HttpError(400, 'Habit limit reached.');
        const habit = { id: crypto.randomUUID(), userId: user.id, title, days: [], createdAt: Date.now() };
        db.habits.push(habit); save();
        return send(res, 201, { habit: habitOut(habit) });
      }
    }
    if ((r = pathname.match(/^\/api\/habits\/([\w-]+)(?:\/checkins\/([^/]+))?$/))) {
      const user = requireUser(req);
      const habit = db.habits.find((x) => x.id === r[1] && x.userId === user.id);
      if (!habit) throw new HttpError(404, 'Habit not found.');
      if (!r[2] && m === 'DELETE') { db.habits = db.habits.filter((x) => x !== habit); save(); return send(res, 204); }
      if (r[2] && (m === 'PUT' || m === 'DELETE')) {
        if (!isDate(r[2])) throw new HttpError(400, 'Invalid date.');
        if (m === 'PUT' && !habit.days.includes(r[2])) habit.days = [...habit.days, r[2]].sort();
        if (m === 'DELETE') habit.days = habit.days.filter((d) => d !== r[2]);
        save();
        return send(res, 204);
      }
    }

    throw new HttpError(pathname.startsWith('/api/') ? 404 : 405, pathname.startsWith('/api/') ? 'Not found.' : 'Method not allowed.');
  }

  function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed.');
    let rel;
    try { rel = decodeURIComponent(pathname); } catch { throw new HttpError(400, 'Bad request.'); }
    const file = path.resolve(PUBLIC, `.${rel === '/' ? '/index.html' : rel}`);
    if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) throw new HttpError(404, 'Not found.');
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return send(res, 404, { error: 'Not found.' });
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.origin) {
        let same = false;
        try { same = new URL(req.headers.origin).host === req.headers.host; } catch { /* bad origin */ }
        if (!same) throw new HttpError(403, 'Cross-site request blocked.');
      }
      if (url.pathname.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store');
        await route(req, res, url);
      } else {
        serveStatic(req, res, url.pathname);
      }
    } catch (err) {
      if (!(err instanceof HttpError)) console.error(err);
      if (!res.headersSent) send(res, err.status || 500, { error: err.status ? err.message : 'Something went wrong. Try again.' });
    }
  });

  const cleanup = setInterval(() => { pruneNow(); }, 3600 * 1000);
  cleanup.unref();
  return server;
}

module.exports = { createApp };

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '127.0.0.1';
  createApp({ baseUrl: process.env.BASE_URL }).listen(port, host, () => {
    console.log(`Momentum is running at http://localhost:${port}`);
  }).on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `Port ${port} is busy. Try: set PORT=3001 (Windows) or PORT=3001 npm start` : e);
    process.exit(1);
  });
}
