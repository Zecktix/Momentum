const root = document.getElementById('app');
const state = { user: null, tab: 'task', tasks: [], habits: [], mode: 'login', resetToken: null };

const iso = (d) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD in the user's local time
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const today = () => daysAgo(0);
const niceDate = (s) => new Date(`${s}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
state.cal = new Date(new Date().getFullYear(), new Date().getMonth(), 1); // month shown in the calendar
state.sel = today(); // day selected in the calendar

// Builds DOM with textContent only, so user-supplied text can never inject markup
function h(tag, props = {}, kids = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  el.append(...[].concat(kids));
  return el;
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || 'Something went wrong. Try again.');
    err.status = res.status;
    if (err.status === 401 && state.user && !url.startsWith('/api/auth/')) {
      state.user = null;
      state.mode = 'login';
      renderAuth('Your session ended. Sign in again.', 'bad');
    }
    throw err;
  }
  return data;
}

const logo = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<rect width="100" height="100" rx="22" fill="#2f5bff"/><path d="M24 68V32l26 26 26-26v36" fill="none" stroke="#ffd23f" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>';
  return h('div', { class: 'wordmark' }, [svg, 'Momentum']);
};

/* ---------- Signed-out screens ---------- */
function field(label, name, type, autocomplete, hint) {
  return h('label', {}, [
    label, hint ? h('span', { class: 'hint', text: hint }) : '',
    h('input', { name, type, autocomplete, required: '', maxlength: type === 'email' ? 254 : 72 }),
  ]);
}

function renderAuth(notice = '', kind = 'ok') {
  const mode = state.mode;
  const copy = {
    login: ['Welcome back', 'Pick up where your streaks left off.', 'Sign in'],
    register: ['Start your streak', 'Free account. One list for tasks, one for habits.', 'Create account'],
    forgot: ['Forgot your password?', "Enter your email and we'll send a reset link.", 'Send reset link'],
    reset: ['Choose a new password', 'Use at least 8 characters.', 'Save password'],
  }[mode];

  const msg = h('p', { class: `form-msg ${notice ? kind : ''}`, role: 'alert', text: notice });
  const btn = h('button', { class: 'btn', type: 'submit', text: copy[2] });
  const fields = [];
  if (mode !== 'reset') fields.push(field('Email', 'email', 'email', mode === 'login' ? 'username' : 'email'));
  if (mode !== 'forgot') {
    fields.push(field(mode === 'reset' ? 'New password' : 'Password', 'password', 'password',
      mode === 'login' ? 'current-password' : 'new-password', mode === 'login' ? '' : '8 to 72 characters'));
  }
  const form = h('form', { novalidate: '' }, [...fields, msg, btn]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    msg.className = 'form-msg';
    msg.textContent = '';
    btn.disabled = true;
    try {
      if (mode === 'login' || mode === 'register') {
        const { user } = await api('POST', `/api/auth/${mode}`, { email: data.email, password: data.password });
        state.user = user;
        await loadData();
        renderApp();
      } else if (mode === 'forgot') {
        const r = await api('POST', '/api/auth/forgot', { email: data.email });
        msg.className = 'form-msg ok';
        msg.textContent = r.message;
      } else {
        const r = await api('POST', '/api/auth/reset', { token: state.resetToken, password: data.password });
        state.mode = 'login';
        renderAuth(r.message, 'ok');
      }
    } catch (err) {
      msg.className = 'form-msg bad';
      msg.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  const go = (m, text) => h('button', { class: 'link', type: 'button', text, onclick: () => { state.mode = m; renderAuth(); } });
  const links = {
    login: [go('register', 'Create an account'), go('forgot', 'Forgot password?')],
    register: [go('login', 'I already have an account')],
    forgot: [go('login', 'Back to sign in')],
    reset: [go('login', 'Back to sign in')],
  }[mode];

  root.replaceChildren(h('main', { class: 'auth' }, [
    logo(),
    h('div', {}, [h('h1', { text: copy[0] }), h('p', { class: 'lede', text: copy[1] })]),
    h('div', { class: 'panel' }, [form]),
    h('div', { class: 'switch' }, links),
  ]));
  root.querySelector('input')?.focus();
}

/* ---------- Signed-in app ---------- */
async function loadData() {
  const [t, hb] = await Promise.all([api('GET', '/api/tasks'), api('GET', '/api/habits')]);
  state.tasks = t.tasks;
  state.habits = hb.habits;
}

function streak(days) {
  const set = new Set(days);
  let n = 0;
  let i = set.has(today()) ? 0 : 1; // a streak stays alive until the end of the day
  while (set.has(daysAgo(i))) { n++; i++; }
  return n;
}

function renderApp() {
  root.replaceChildren(h('main', {}, [
    h('header', { class: 'bar' }, [
      logo(),
      h('div', { class: 'who' }, [state.user.email, h('button', { class: 'link', text: 'Sign out', onclick: signOut })]),
    ]),
    h('section', { class: 'summary', 'aria-live': 'polite' }, [
      h('p', { id: 'sum' }), h('p', { class: 'sub', id: 'sub' }), h('div', { class: 'meter' }, [h('i', { id: 'fill' })]),
    ]),
    h('div', { class: 'tabs', role: 'tablist' }, ['task', 'habit', 'calendar'].map((t) =>
      h('button', {
        role: 'tab', 'data-tab': t, 'aria-selected': String(state.tab === t), text: { task: 'Tasks', habit: 'Habits', calendar: 'Calendar' }[t],
        onclick: () => { state.tab = t; renderApp(); },
      }))),
    state.tab === 'calendar' ? '' : addForm(),
    h('div', { id: 'list' }),
  ]));
  renderList();
}

function addForm() {
  const isTask = state.tab === 'task';
  const title = h('input', { name: 'title', maxlength: 80, required: '', 'aria-label': isTask ? 'Task title' : 'Habit name', placeholder: isTask ? 'What needs doing?' : 'A habit to repeat, like "Read 20 minutes"' });
  const btn = h('button', { class: 'btn', type: 'submit', text: isTask ? 'Add task' : 'Add habit' });
  const pri = h('select', { name: 'priority', 'aria-label': 'Priority' }, [
    h('option', { value: 'low', text: 'Low priority' }), h('option', { value: 'med', text: 'Medium priority', selected: '' }), h('option', { value: 'high', text: 'High priority' }),
  ]);
  const due = h('input', { name: 'due', type: 'date', 'aria-label': 'Due date' });
  const form = h('form', { class: `add ${state.tab}`, novalidate: '' }, [
    h('div', { class: 'main' }, [title, isTask ? '' : btn]),
    isTask ? h('div', { class: 'row' }, [pri, due, btn]) : '',
  ]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = title.value.trim().replace(/\s+/g, ' ');
    if (!text) return toast('Enter a title first.');
    if (text.length > 80) return toast('Keep the title to 80 characters or fewer.');
    btn.disabled = true;
    try {
      if (isTask) {
        const { task } = await api('POST', '/api/tasks', { title: text, priority: pri.value, due: due.value || null });
        state.tasks.push(task);
      } else {
        const { habit } = await api('POST', '/api/habits', { title: text });
        state.habits.push(habit);
      }
      form.reset();
      renderList();
      title.focus();
    } catch (err) { toast(err.message); } finally { btn.disabled = false; }
  });
  return form;
}

function renderList() {
  const isTask = state.tab === 'task';
  const td = today();
  const doneCount = state.tasks.filter((t) => t.done).length + state.habits.filter((x) => x.days.includes(td)).length;
  const total = state.tasks.length + state.habits.length;
  document.getElementById('sum').textContent = total ? `${doneCount} of ${total} done today` : 'Nothing on your list yet';
  document.getElementById('sub').textContent = total ? 'Completed tasks and today\u2019s habit check-ins.' : 'Add a task or a habit to get started.';
  document.getElementById('fill').style.width = total ? `${Math.round((doneCount / total) * 100)}%` : '0%';

  const list = document.getElementById('list');
  if (state.tab === 'calendar') return renderCalendar(list);
  const items = isTask
    ? [...state.tasks].sort((a, b) => a.done - b.done || a.createdAt - b.createdAt)
    : state.habits;
  if (!items.length) {
    list.replaceChildren(h('div', { class: 'empty', text: isTask ? 'No tasks yet. Add the first thing you want to finish.' : 'No habits yet. Start with something small you can do every day.' }));
    return;
  }
  list.replaceChildren(...items.map(isTask ? taskItem : habitItem));
}

/* ---------- Calendar ---------- */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function renderCalendar(list) {
  const y = state.cal.getFullYear();
  const m = state.cal.getMonth();
  const todayKey = today();
  const byDay = {};
  for (const t of state.tasks) if (t.due) (byDay[t.due] ||= []).push(t);

  const goTo = (date) => { state.cal = new Date(date.getFullYear(), date.getMonth(), 1); renderList(); };
  const head = h('div', { class: 'cal-head' }, [
    h('h2', { text: state.cal.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) }),
    h('div', { class: 'cal-nav' }, [
      h('button', { class: 'nav', type: 'button', 'aria-label': 'Previous month', text: '\u2039', onclick: () => goTo(new Date(y, m - 1, 1)) }),
      h('button', { class: 'nav wide', type: 'button', text: 'Today', onclick: () => { state.sel = todayKey; goTo(new Date()); } }),
      h('button', { class: 'nav', type: 'button', 'aria-label': 'Next month', text: '\u203a', onclick: () => goTo(new Date(y, m + 1, 1)) }),
    ]),
  ]);

  const cells = WEEKDAYS.map((d) => h('div', { class: 'cal-dow', text: d }));
  for (let i = 0; i < new Date(y, m, 1).getDay(); i++) cells.push(h('div', { class: 'cal-pad' }));
  for (let d = 1, last = new Date(y, m + 1, 0).getDate(); d <= last; d++) {
    const key = iso(new Date(y, m, d));
    const tasks = byDay[key] || [];
    const open = tasks.filter((t) => !t.done).length;
    const summary = tasks.length ? `${open} open of ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}` : 'no tasks';
    cells.push(h('button', {
      class: `cal-day${key === todayKey ? ' is-today' : ''}${key === state.sel ? ' is-sel' : ''}`,
      type: 'button', 'aria-pressed': String(key === state.sel), 'aria-label': `${niceDate(key)}, ${summary}`,
      onclick: () => { state.sel = key; renderList(); list.querySelector('.is-sel')?.focus(); },
    }, [
      h('span', { class: 'n', text: String(d) }),
      tasks.length ? h('span', { class: 'dots' }, tasks.slice(0, 3).map((t) => h('i', { class: t.done ? 'dot done' : `dot p-${t.priority}` }))) : '',
      tasks.length > 3 ? h('span', { class: 'more', text: `+${tasks.length - 3}` }) : '',
    ]));
  }

  const dayTasks = [...(byDay[state.sel] || [])].sort((a, b) => a.done - b.done || a.createdAt - b.createdAt);
  const panel = h('section', { class: 'day-panel', 'aria-live': 'polite' }, [
    h('h3', { text: new Date(`${state.sel}T12:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) }),
    dayForm(state.sel),
    dayTasks.length
      ? h('div', {}, dayTasks.map(taskItem))
      : h('div', { class: 'empty', text: 'Nothing scheduled. Add a task for this day above.' }),
  ]);

  list.replaceChildren(head, h('div', { class: 'cal-grid' }, cells), panel);
}

function dayForm(day) {
  const title = h('input', { name: 'title', maxlength: 80, required: '', 'aria-label': 'New task title', placeholder: 'Add a task for this day' });
  const pri = h('select', { name: 'priority', 'aria-label': 'Priority' }, [
    h('option', { value: 'low', text: 'Low' }), h('option', { value: 'med', text: 'Medium', selected: '' }), h('option', { value: 'high', text: 'High' }),
  ]);
  const btn = h('button', { class: 'btn', type: 'submit', text: 'Add task' });
  const form = h('form', { class: 'day-form', novalidate: '' }, [title, pri, btn]);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = title.value.trim().replace(/\s+/g, ' ');
    if (!text) return toast('Enter a title first.');
    if (text.length > 80) return toast('Keep the title to 80 characters or fewer.');
    btn.disabled = true;
    try {
      const { task } = await api('POST', '/api/tasks', { title: text, priority: pri.value, due: day });
      state.tasks.push(task);
      renderList();
      document.querySelector('.day-form input')?.focus();
    } catch (err) { toast(err.message); } finally { btn.disabled = false; }
  });
  return form;
}

function taskItem(t) {
  const late = t.due && !t.done && t.due < today();
  const meta = h('div', { class: 'meta' }, [
    h('span', { class: `pri-${t.priority}`, text: { low: 'Low', med: 'Medium', high: 'High' }[t.priority] }),
    t.due ? h('span', { class: late ? 'late' : '', text: late ? `Overdue since ${niceDate(t.due)}` : `Due ${niceDate(t.due)}` }) : '',
  ]);
  return h('div', { class: `item ${t.done ? 'is-done' : ''}` }, [
    h('button', {
      class: 'check', 'aria-pressed': String(t.done), 'aria-label': `Mark "${t.title}" ${t.done ? 'not done' : 'done'}`, text: t.done ? '\u2713' : '',
      onclick: async () => {
        try { Object.assign(t, (await api('PATCH', `/api/tasks/${t.id}`, { done: !t.done })).task); renderList(); } catch (err) { toast(err.message); }
      },
    }),
    h('div', { class: 'body' }, [h('div', { class: 'name', text: t.title }), meta]),
    removeBtn(t.title, async () => { await api('DELETE', `/api/tasks/${t.id}`); state.tasks = state.tasks.filter((x) => x.id !== t.id); }),
  ]);
}

function habitItem(hb) {
  const week = h('div', { class: 'week' }, [6, 5, 4, 3, 2, 1, 0].map((n) => {
    const day = daysAgo(n);
    const on = hb.days.includes(day);
    const label = new Date(`${day}T12:00`).toLocaleDateString(undefined, { weekday: 'narrow' });
    return h('button', {
      class: `day ${n === 0 ? 'today' : ''}`, 'aria-pressed': String(on), 'aria-label': `${hb.title}, ${niceDate(day)}${n === 0 ? ' (today)' : ''}`,
      onclick: async () => {
        try {
          await api(on ? 'DELETE' : 'PUT', `/api/habits/${hb.id}/checkins/${day}`);
          hb.days = on ? hb.days.filter((d) => d !== day) : [...hb.days, day].sort();
          renderList();
        } catch (err) { toast(err.message); }
      },
    }, [h('span', { class: 'sq' }), label]);
  }));
  const s = streak(hb.days);
  return h('div', { class: 'item' }, [
    h('div', { class: 'body' }, [h('div', { class: 'name', text: hb.title }), week]),
    h('span', { class: `streak ${s ? '' : 'none'}`, text: s ? `${s}-day streak` : 'No streak yet' }),
    removeBtn(hb.title, async () => { await api('DELETE', `/api/habits/${hb.id}`); state.habits = state.habits.filter((x) => x.id !== hb.id); }),
  ]);
}

function removeBtn(name, action) {
  return h('button', {
    class: 'x', 'aria-label': `Delete "${name}"`, text: '\u00d7',
    onclick: async () => {
      if (!confirm(`Delete "${name}"?`)) return;
      try { await action(); renderList(); } catch (err) { toast(err.message); }
    },
  });
}

async function signOut() {
  try { await api('POST', '/api/auth/logout', {}); } catch { /* already signed out */ }
  Object.assign(state, { user: null, tasks: [], habits: [], mode: 'login' });
  renderAuth('You are signed out.', 'ok');
}

/* ---------- Boot ---------- */
(async function boot() {
  const token = new URLSearchParams(location.search).get('reset');
  if (token) {
    state.mode = 'reset';
    state.resetToken = token;
    history.replaceState(null, '', '/'); // keep the token out of the address bar and history
    return renderAuth();
  }
  try {
    state.user = (await api('GET', '/api/auth/me')).user;
    await loadData();
    renderApp();
  } catch {
    renderAuth();
  }
})();
