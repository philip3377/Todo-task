const API_BASE = '/api';
const TICKET_CHARS = 4;
const HEALTH_POLL_MS = 15000;
const CONFIRM_DELETE_MS = 2500;

const els = {
  banner: document.getElementById('api-banner'),
  bannerText: document.getElementById('api-banner-text'),
  retry: document.getElementById('api-retry'),
  dismiss: document.getElementById('api-dismiss'),
  status: document.getElementById('api-status'),
  statusLabel: document.getElementById('api-status-label'),
  boardMeta: document.getElementById('board-meta'),
  form: document.getElementById('new-task-form'),
  title: document.getElementById('new-title'),
  description: document.getElementById('new-description'),
  formError: document.getElementById('form-error'),
  filters: document.getElementById('filters'),
  list: document.getElementById('task-list'),
  empty: document.getElementById('empty-state'),
};

const state = {
  tasks: [],
  filter: 'all',
  editingId: null,
  health: null,
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'done', label: 'Done' },
];

function toApiError(message, options = {}) {
  const error = new Error(message);
  error.status = options.status;
  error.unavailable = Boolean(options.unavailable);
  return error;
}

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw toApiError('Cannot reach the TaskFlow API. Is the server running?', { unavailable: true });
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body && body.error && body.error.message) {
        message = body.error.message;
      }
    } catch {
      // keep the generic status message
    }
    throw toApiError(message, { status: response.status });
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function ticketNumber(task) {
  return `#${task.id.slice(0, TICKET_CHARS).toUpperCase()}`;
}

function formatIssued(iso) {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return `${day} · ${time}`;
}

function formatUptime(seconds) {
  const total = Math.floor(seconds);
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function visibleTasks() {
  if (state.filter === 'active') {
    return state.tasks.filter((task) => !task.completed);
  }
  if (state.filter === 'done') {
    return state.tasks.filter((task) => task.completed);
  }
  return state.tasks;
}

function renderStatus() {
  if (!state.health) {
    els.status.dataset.state = 'unknown';
    els.statusLabel.textContent = 'CHECKING…';
    return;
  }
  els.status.dataset.state = 'live';
  els.statusLabel.textContent = 'API LIVE';
}

function renderMeta() {
  const active = state.tasks.filter((task) => !task.completed).length;
  const done = state.tasks.length - active;
  const uptime = state.health ? ` · uptime ${formatUptime(state.health.uptime)}` : '';
  els.boardMeta.textContent =
    `${state.tasks.length} on the board · ${active} open · ${done} done${uptime}`;
}

function renderFilters() {
  els.filters.replaceChildren();
  const counts = {
    all: state.tasks.length,
    active: state.tasks.filter((task) => !task.completed).length,
    done: state.tasks.filter((task) => task.completed).length,
  };

  for (const filter of FILTERS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-btn';
    button.setAttribute('aria-pressed', String(state.filter === filter.id));
    button.dataset.filter = filter.id;
    button.append(`${filter.label} `);

    const count = document.createElement('span');
    count.className = 'filter-count';
    count.textContent = String(counts[filter.id]);
    button.append(count);
    els.filters.append(button);
  }
}

function renderEmptyState() {
  const none = visibleTasks().length === 0;
  els.empty.hidden = !none;
  if (!none) return;

  if (state.tasks.length === 0) {
    els.empty.textContent = 'The board is clear. Issue your first work order above.';
  } else if (state.filter === 'done') {
    els.empty.textContent = 'Nothing stamped done yet.';
  } else {
    els.empty.textContent = 'No open work orders. Everything is done.';
  }
}

function buildStaticCard(task) {
  const item = document.createElement('li');
  item.className = 'tag-card' + (task.completed ? ' is-done' : '');
  item.dataset.id = task.id;

  const head = document.createElement('div');
  head.className = 'tag-head';

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'task-check';
  check.checked = task.completed;
  check.dataset.action = 'toggle';
  const label = task.completed ? `Reopen ${ticketNumber(task)}` : `Mark ${ticketNumber(task)} done`;
  check.setAttribute('aria-label', label);

  const number = document.createElement('span');
  number.className = 'ticket-no';
  number.textContent = ticketNumber(task);

  const title = document.createElement('h3');
  title.className = 'task-title';
  title.textContent = task.title;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'task-delete';
  remove.dataset.action = 'delete';
  remove.setAttribute('aria-label', `Delete ${ticketNumber(task)}`);
  remove.textContent = '✕ DEL';

  head.append(check, number, title, remove);
  item.append(head);

  if (task.description) {
    const description = document.createElement('p');
    description.className = 'task-description';
    description.textContent = task.description;
    item.append(description);
  }

  const foot = document.createElement('div');
  foot.className = 'tag-foot';

  const issued = document.createElement('span');
  issued.className = 'issued-at';
  issued.textContent = `issued ${formatIssued(task.createdAt)}`;

  const actions = document.createElement('span');
  actions.className = 'tag-actions';

  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'btn btn-mini btn-quiet';
  edit.dataset.action = 'edit';
  edit.textContent = 'Edit';

  actions.append(edit);
  foot.append(issued, actions);
  item.append(foot);

  if (task.completed) {
    const stamp = document.createElement('span');
    stamp.className = 'stamp';
    stamp.textContent = 'Done';
    item.append(stamp);
  }

  return item;
}

function buildEditCard(task) {
  const item = document.createElement('li');
  item.className = 'tag-card';
  item.dataset.id = task.id;

  const head = document.createElement('div');
  head.className = 'tag-head';

  const number = document.createElement('span');
  number.className = 'ticket-no';
  number.textContent = ticketNumber(task);

  const heading = document.createElement('h3');
  heading.className = 'task-title';
  heading.textContent = 'Editing order';

  head.append(number, heading);
  item.append(head);

  const fields = document.createElement('div');
  fields.className = 'edit-fields';

  const titleInput = document.createElement('input');
  titleInput.className = 'field-input';
  titleInput.type = 'text';
  titleInput.maxLength = 200;
  titleInput.value = task.title;
  titleInput.setAttribute('aria-label', `Title for ${ticketNumber(task)}`);
  titleInput.dataset.edit = 'title';

  const notesInput = document.createElement('input');
  notesInput.className = 'field-input';
  notesInput.type = 'text';
  notesInput.maxLength = 2000;
  notesInput.value = task.description;
  notesInput.setAttribute('aria-label', `Notes for ${ticketNumber(task)}`);
  notesInput.dataset.edit = 'description';

  const error = document.createElement('p');
  error.className = 'card-error';
  error.hidden = true;
  error.dataset.edit = 'error';

  fields.append(titleInput, notesInput, error);
  item.append(fields);

  const foot = document.createElement('div');
  foot.className = 'tag-foot';

  const issued = document.createElement('span');
  issued.className = 'issued-at';
  issued.textContent = `issued ${formatIssued(task.createdAt)}`;

  const actions = document.createElement('span');
  actions.className = 'tag-actions';

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'btn btn-mini btn-primary';
  save.dataset.action = 'save-edit';
  save.textContent = 'Save';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn btn-mini';
  cancel.dataset.action = 'cancel-edit';
  cancel.textContent = 'Cancel';

  actions.append(save, cancel);
  foot.append(issued, actions);
  item.append(foot);

  return item;
}

function render() {
  renderFilters();
  renderStatus();
  renderMeta();

  const tasks = visibleTasks();
  els.list.replaceChildren(...tasks.map((task) => (
    task.id === state.editingId ? buildEditCard(task) : buildStaticCard(task)
  )));
  renderEmptyState();
}

function showBanner(message, { retryable }) {
  els.bannerText.textContent = message;
  els.retry.hidden = !retryable;
  els.banner.hidden = false;
}

function hideBanner() {
  els.banner.hidden = true;
}

function showFormError(message) {
  els.formError.textContent = message;
  els.formError.hidden = false;
}

function hideFormError() {
  els.formError.hidden = true;
}

async function loadHealth() {
  try {
    state.health = await api('/health');
    hideBanner();
  } catch (error) {
    state.health = null;
    if (error.unavailable) {
      showBanner(error.message, { retryable: true });
    }
  }
  renderStatus();
  renderMeta();
}

async function loadTasks() {
  try {
    state.tasks = await api('/tasks');
    hideBanner();
  } catch (error) {
    if (error.unavailable) {
      showBanner(error.message, { retryable: true });
    }
    return;
  }
  render();
}

async function refreshAll() {
  await Promise.all([loadHealth(), loadTasks()]);
}

async function handleCreate(event) {
  event.preventDefault();
  hideFormError();

  const title = els.title.value.trim();
  if (!title) {
    showFormError('A work order needs a title.');
    els.title.focus();
    return;
  }

  try {
    await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: els.description.value.trim(),
      }),
    });
  } catch (error) {
    if (error.unavailable) {
      showBanner(error.message, { retryable: true });
    } else {
      showFormError(error.message);
    }
    return;
  }

  els.form.reset();
  els.title.focus();
  await loadTasks();
}

async function handleToggle(taskId, completed) {
  try {
    await api(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ completed }),
    });
  } catch (error) {
    if (error.unavailable) {
      showBanner(error.message, { retryable: true });
    }
  }
  await loadTasks();
}

async function handleSaveEdit(taskId, item) {
  const titleInput = item.querySelector('[data-edit="title"]');
  const notesInput = item.querySelector('[data-edit="description"]');
  const errorEl = item.querySelector('[data-edit="error"]');
  errorEl.hidden = true;

  const title = titleInput.value.trim();
  if (!title) {
    errorEl.textContent = 'A work order needs a title.';
    errorEl.hidden = false;
    titleInput.focus();
    return;
  }

  try {
    await api(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({
        title,
        description: notesInput.value.trim(),
      }),
    });
    state.editingId = null;
  } catch (editError) {
    if (editError.unavailable) {
      showBanner(editError.message, { retryable: true });
    } else {
      errorEl.textContent = editError.message;
      errorEl.hidden = false;
      return;
    }
  }
  await loadTasks();
}

function armDelete(button, taskId) {
  if (button.dataset.armed === 'true') {
    button.dataset.armed = '';
    return taskId;
  }

  button.dataset.armed = 'true';
  const original = button.textContent;
  button.textContent = 'SURE?';
  window.setTimeout(() => {
    button.dataset.armed = '';
    button.textContent = original;
  }, CONFIRM_DELETE_MS);
  return null;
}

async function handleListClick(event) {
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;

  const item = actionEl.closest('[data-id]');
  const taskId = item.dataset.id;

  switch (actionEl.dataset.action) {
    case 'delete': {
      const confirmed = armDelete(actionEl, taskId);
      if (!confirmed) return;
      try {
        await api(`/tasks/${taskId}`, { method: 'DELETE' });
      } catch (error) {
        if (error.unavailable) {
          showBanner(error.message, { retryable: true });
        }
      }
      if (state.editingId === taskId) state.editingId = null;
      await loadTasks();
      break;
    }
    case 'toggle':
      await handleToggle(taskId, actionEl.checked);
      break;
    case 'edit':
      state.editingId = taskId;
      render();
      break;
    case 'cancel-edit':
      state.editingId = null;
      render();
      break;
    case 'save-edit':
      await handleSaveEdit(taskId, item);
      break;
    default:
      break;
  }
}

els.form.addEventListener('submit', handleCreate);
els.list.addEventListener('click', handleListClick);
els.list.addEventListener('change', (event) => {
  if (event.target.dataset.action === 'toggle') {
    handleListClick(event);
  }
});
els.filters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  state.filter = button.dataset.filter;
  render();
});
els.retry.addEventListener('click', refreshAll);
els.dismiss.addEventListener('click', hideBanner);

refreshAll();
window.setInterval(loadHealth, HEALTH_POLL_MS);
