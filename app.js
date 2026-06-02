const columns = {
  A: { title: 'Attack', desc: 'Top priorities for today.' },
  B: { title: 'Buy', desc: 'Things you need to buy.' },
  C: { title: 'Call', desc: 'People you need to call.' },
  D: { title: 'Due', desc: 'Backlog / tasks waiting their turn.' }
};

const DEFAULT_SETTINGS = {
  attackLimit: 5,
  dueDates: false,
  gameStyle: 'xp',
  theme: 'dark',
  customTheme: {
    base: 'dark',
    background: ''
  }
};

const starterList = {
  id: 'life',
  name: 'Life',
  A: [{ text: 'Example: Finish first ABCD app test' }],
  B: [{ text: 'Example: Notebook' }],
  C: [{ text: 'Example: Call contractor' }],
  D: [{ text: 'Example: Add reminders later' }, { text: 'Example: Test on phone for 7 days' }],
  completed: [],
  deleted: [],
  settings: { ...DEFAULT_SETTINGS }
};

let completedFilter = 'ALL';
let viewMode = localStorage.getItem('abcd-view') || 'grid';
let app = load();
let state = activeList();

const grid = document.querySelector('#grid');
const template = document.querySelector('#columnTemplate');
const gridViewBtn = document.querySelector('#gridViewBtn');
const scrollViewBtn = document.querySelector('#scrollViewBtn');
const listSelect = document.querySelector('#listSelect');

function uid() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toTask(item) {
  if (typeof item === 'string') return { id: uid(), text: item, createdAt: new Date().toISOString() };
  return { id: item.id || uid(), text: item.text || '', dueAt: item.dueAt || '', createdAt: item.createdAt || new Date().toISOString() };
}

function normalizeList(raw, fallbackName = 'Life') {
  const next = { ...starterList, ...raw };
  next.id = next.id || uid();
  next.name = next.name || fallbackName;
  ['A', 'B', 'C', 'D'].forEach(key => next[key] = (next[key] || []).map(toTask));
  next.completed = (next.completed || []).map(item => ({ ...item, id: item.id || uid(), text: item.text || String(item), atISO: item.atISO || item.at || new Date().toISOString() }));
  next.deleted = (next.deleted || []).map(item => ({ ...item, task: toTask(item.task || item), from: item.from || 'D', deletedAt: item.deletedAt || new Date().toISOString() }));
  next.settings = { ...DEFAULT_SETTINGS, ...(next.settings || {}) };
  next.settings.customTheme = { ...DEFAULT_SETTINGS.customTheme, ...(next.settings.customTheme || {}) };
  next.settings.attackLimit = Math.max(1, Number(next.settings.attackLimit) || DEFAULT_SETTINGS.attackLimit);
  return next;
}

function normalize(raw) {
  if (raw?.lists) {
    const lists = {};
    Object.entries(raw.lists).forEach(([id, list]) => lists[id] = normalizeList({ ...list, id }, list.name));
    const activeListId = lists[raw.activeListId] ? raw.activeListId : Object.keys(lists)[0];
    return { activeListId, lists };
  }
  const migrated = normalizeList(raw || starterList, raw?.name || 'Life');
  return { activeListId: migrated.id, lists: { [migrated.id]: migrated } };
}

function load() {
  try { return normalize(JSON.parse(localStorage.getItem('abcd-state')) || starterList); }
  catch { return normalize(starterList); }
}
function activeList() { return app.lists[app.activeListId]; }
function save() { app.lists[app.activeListId] = state; localStorage.setItem('abcd-state', JSON.stringify(app)); }
function attackLimit() { return Math.max(1, Number(state.settings.attackLimit) || 5); }

function promoteDueIfNeeded() {
  while (state.A.length < attackLimit() && state.D.length) state.A.push(state.D.shift());
}

function render() {
  promoteDueIfNeeded();
  save();
  applyViewMode();
  applyTheme();
  renderListSelector();
  renderProgress();
  grid.innerHTML = '';
  Object.entries(columns).forEach(([key, info]) => {
    const node = template.content.cloneNode(true);
    const section = node.querySelector('.column');
    section.dataset.key = key;
    node.querySelector('.letter').textContent = key;
    node.querySelector('h2').textContent = info.title;
    node.querySelector('p').textContent = info.desc;
    node.querySelector('.count').textContent = `${state[key].length}${key === 'A' ? `/${attackLimit()}` : ''}`;
    const form = node.querySelector('.addForm');
    const input = node.querySelector('.taskInput');
    const dueInput = node.querySelector('.dueInput');
    dueInput.classList.toggle('hidden', !state.settings.dueDates);
    const list = node.querySelector('.tasks');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const task = { id: uid(), text, dueAt: state.settings.dueDates ? dueInput.value : '', createdAt: new Date().toISOString() };
      if (key === 'A' && state.A.length >= attackLimit()) state.D.push(task);
      else state[key].push(task);
      input.value = '';
      dueInput.value = '';
      render();
    });
    if (!state[key].length) list.innerHTML = '<li class="empty">Nothing here yet.</li>';
    state[key].forEach((task, index) => list.appendChild(taskEl(key, task, index)));
    grid.appendChild(node);
  });
  renderCompleted();
  renderSettings();
}

function setViewMode(mode) {
  viewMode = mode;
  localStorage.setItem('abcd-view', mode);
  applyViewMode();
}

function applyViewMode() {
  document.body.classList.toggle('scrollView', viewMode === 'scroll');
  gridViewBtn.classList.toggle('active', viewMode === 'grid');
  scrollViewBtn.classList.toggle('active', viewMode === 'scroll');
}

function applyTheme() {
  const theme = state.settings.theme || 'dark';
  document.body.dataset.theme = theme;
  document.body.dataset.customBase = state.settings.customTheme?.base || 'dark';
  if (theme === 'custom' && state.settings.customTheme?.background) {
    document.body.style.setProperty('--custom-bg', `url("${state.settings.customTheme.background}") center / cover fixed no-repeat`);
  } else {
    document.body.style.removeProperty('--custom-bg');
  }
}

function renderListSelector() {
  listSelect.innerHTML = '';
  Object.values(app.lists).forEach(list => {
    const option = document.createElement('option');
    option.value = list.id;
    option.textContent = list.name;
    option.selected = list.id === app.activeListId;
    listSelect.appendChild(option);
  });
}

function taskEl(key, task, index) {
  const li = document.createElement('li');
  li.className = 'task';
  const textWrap = document.createElement('button');
  textWrap.type = 'button';
  textWrap.className = 'taskText';
  textWrap.onclick = () => openTaskMenu(key, index);
  textWrap.innerHTML = `<span>${escapeHtml(task.text)}</span>${task.dueAt ? `<small>Due by ${formatDue(task.dueAt)}</small>` : ''}`;
  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(button('Done', 'done', () => completeTask(key, index)));
  if (key === 'D') actions.append(button('Move to A', 'attack', () => moveDueToAttack(index)));
  actions.append(button('Delete', 'delete', () => deleteTask(key, index)));
  li.append(textWrap, actions);
  return li;
}

function button(label, cls, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  b.className = cls;
  b.addEventListener('click', e => { e.stopPropagation(); fn(); });
  return b;
}

function openTaskMenu(key, index) {
  const task = state[key][index];
  const panel = document.querySelector('#taskPanel');
  panel.querySelector('#taskPanelTitle').textContent = task.text;
  const body = panel.querySelector('#taskPanelBody');
  body.innerHTML = '';
  const edit = document.createElement('button');
  edit.textContent = 'Edit task';
  edit.onclick = () => {
    const text = prompt('Edit task', task.text);
    if (text && text.trim()) task.text = text.trim();
    if (state.settings.dueDates && confirm('Change due date/time?')) task.dueAt = prompt('Due by (YYYY-MM-DDTHH:MM) or blank', task.dueAt || '') || '';
    closePanel('taskPanel');
    render();
  };
  body.append(edit);
  body.append(menuButton('Send to top', () => moveItem(key, index, 0)));
  body.append(menuButton('Send to bottom', () => moveItem(key, index, state[key].length - 1)));
  if (index > 0) body.append(menuButton('Move up', () => moveItem(key, index, index - 1)));
  if (index < state[key].length - 1) body.append(menuButton('Move down', () => moveItem(key, index, index + 1)));
  panel.classList.remove('hidden');
}

function menuButton(label, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = () => { fn(); closePanel('taskPanel'); render(); };
  return b;
}

function moveItem(key, from, to) {
  const [task] = state[key].splice(from, 1);
  state[key].splice(to, 0, task);
}

function completeTask(key, index) {
  const [task] = state[key].splice(index, 1);
  state.completed.unshift({ key, text: task.text, dueAt: task.dueAt || '', at: new Date().toLocaleString(), atISO: new Date().toISOString() });
  render();
}

function deleteTask(key, index) {
  const [task] = state[key].splice(index, 1);
  state.deleted.unshift({ task, from: key, deletedAt: new Date().toISOString() });
  render();
}

function moveDueToAttack(index) {
  if (state.A.length < attackLimit()) {
    state.A.push(state.D.splice(index, 1)[0]);
    render();
    return;
  }
  openSwapPanel(index);
}

function openSwapPanel(dueIndex) {
  const panel = document.querySelector('#swapPanel');
  const body = panel.querySelector('#swapList');
  body.innerHTML = '';
  state.A.forEach((task, index) => {
    const b = document.createElement('button');
    b.className = 'swapChoice';
    b.innerHTML = `<strong>Swap with A${index + 1}</strong><span>${escapeHtml(task.text)}</span>`;
    b.onclick = () => {
      const [incoming] = state.D.splice(dueIndex, 1);
      const [outgoing] = state.A.splice(index, 1, incoming);
      state.D.unshift(outgoing);
      closePanel('swapPanel');
      render();
    };
    body.appendChild(b);
  });
  panel.classList.remove('hidden');
}

function renderCompleted() {
  renderCompletedFilters();
  const list = document.querySelector('#completedList');
  const items = state.completed.filter(item => completedFilter === 'ALL' || (item.key || 'A') === completedFilter);
  if (!items.length) {
    list.innerHTML = '<li class="empty">No completed tasks here yet.</li>';
    return;
  }
  list.innerHTML = items.map(item => {
    const key = item.key || 'A';
    const label = columns[key]?.title || 'Task';
    return `<li><span class="miniLetter ${key}">${key}</span><strong>${escapeHtml(item.text)}</strong><br><small>${label} • ${item.at || new Date(item.atISO).toLocaleString()}${item.dueAt ? ` • Due ${formatDue(item.dueAt)}` : ''}</small></li>`;
  }).join('');
}

function renderCompletedFilters() {
  const filters = document.querySelector('#completedFilters');
  const options = ['ALL', 'A', 'B', 'C', 'D'];
  filters.innerHTML = '';
  options.forEach(key => {
    const b = document.createElement('button');
    b.className = `filter ${key === completedFilter ? 'active' : ''} ${key}`;
    b.textContent = key === 'ALL' ? 'All' : key;
    b.title = key === 'ALL' ? 'All completed' : `${columns[key].title} completed`;
    b.onclick = () => { completedFilter = key; renderCompleted(); };
    filters.appendChild(b);
  });
}

function renderSettings() {
  const limit = document.querySelector('#attackLimit');
  const dueToggle = document.querySelector('#dueToggle');
  const style = document.querySelector('#gameStyle');
  const theme = document.querySelector('#themeScheme');
  const customSettings = document.querySelector('#customThemeSettings');
  const customBase = document.querySelector('#customThemeBase');
  const customStatus = document.querySelector('#customBgStatus');
  if (!limit) return;
  limit.value = attackLimit();
  dueToggle.checked = !!state.settings.dueDates;
  style.value = state.settings.gameStyle || 'xp';
  theme.value = state.settings.theme || 'dark';
  customSettings.classList.toggle('hidden', state.settings.theme !== 'custom');
  customBase.value = state.settings.customTheme?.base || 'dark';
  customStatus.textContent = state.settings.customTheme?.background
    ? 'Custom photo saved on this device. Upload another photo anytime to replace it.'
    : 'Choose a photo from your phone. It stays saved on this device.';
  const trash = document.querySelector('#deletedList');
  if (!state.deleted.length) {
    trash.innerHTML = '<li class="empty">No deleted tasks saved yet.</li>';
    return;
  }
  trash.innerHTML = '';
  state.deleted.forEach((item, index) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="miniLetter ${item.from}">${item.from}</span><strong>${escapeHtml(item.task.text)}</strong><br><small>Deleted ${new Date(item.deletedAt).toLocaleString()}</small>`;
    const restore = document.createElement('button');
    restore.textContent = `Restore to ${item.from}`;
    restore.onclick = () => restoreDeleted(index);
    li.appendChild(restore);
    trash.appendChild(li);
  });
}

function restoreDeleted(index) {
  const [item] = state.deleted.splice(index, 1);
  const target = item.from && state[item.from] ? item.from : 'D';
  if (target === 'A' && state.A.length >= attackLimit()) state.D.unshift(item.task);
  else state[target].push(item.task);
  render();
}

function renderProgress() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const week = state.completed.filter(item => new Date(item.atISO || item.at) >= weekStart).length;
  const month = state.completed.filter(item => new Date(item.atISO || item.at).getMonth() === now.getMonth() && new Date(item.atISO || item.at).getFullYear() === now.getFullYear()).length;
  const year = state.completed.filter(item => new Date(item.atISO || item.at).getFullYear() === now.getFullYear()).length;
  const pct = Math.min(100, (week % 20) * 5);
  const progress = document.querySelector('#progress');
  progress.classList.toggle('simple', state.settings.gameStyle === 'simple');
  progress.innerHTML = `<div class="xpTop"><strong>${state.settings.gameStyle === 'simple' ? 'Completed' : 'Life XP'}</strong><span>Week ${week} • Month ${month} • Year ${year}</span></div><div class="xpTrack"><div style="width:${pct}%"></div></div>`;
}

function createList() {
  const name = prompt('New ABCD list name', 'Business');
  if (!name || !name.trim()) return;
  const id = uid();
  app.lists[id] = normalizeList({ id, name: name.trim(), A: [], B: [], C: [], D: [], completed: [], deleted: [], settings: { ...state.settings, customTheme: { ...(state.settings.customTheme || DEFAULT_SETTINGS.customTheme) } } }, name.trim());
  app.activeListId = id;
  state = activeList();
  render();
}

function renameList() {
  const name = prompt('Rename this ABCD list', state.name);
  if (!name || !name.trim()) return;
  state.name = name.trim();
  render();
}

function deleteCurrentList() {
  if (Object.keys(app.lists).length <= 1) return alert('Keep at least one ABCD list.');
  if (!confirm(`Delete the "${state.name}" list? This removes its tasks from this device.`)) return;
  delete app.lists[app.activeListId];
  app.activeListId = Object.keys(app.lists)[0];
  state = activeList();
  render();
}

function closePanel(id) { document.querySelector(`#${id}`).classList.add('hidden'); }
function formatDue(value) { return value ? new Date(value).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : ''; }
function escapeHtml(str) { return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function exportBackup() {
  save();
  const backup = {
    app: 'ABCD List',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: app
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `abcd-list-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const imported = parsed?.data || parsed;
      const normalized = normalize(imported);
      if (!Object.keys(normalized.lists || {}).length) throw new Error('No lists found.');
      if (!confirm('Import this backup? It will replace the ABCD lists currently saved on this device.')) return;
      app = normalized;
      state = activeList();
      completedFilter = 'ALL';
      save();
      render();
      alert('Backup imported.');
    } catch (error) {
      alert(`Could not import backup: ${error.message || 'invalid file'}`);
    } finally {
      document.querySelector('#importBackupInput').value = '';
    }
  };
  reader.readAsText(file);
}

function imageFileToBackground(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Choose an image file.'));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 1400;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('That image could not be loaded.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('That image could not be read.'));
    reader.readAsDataURL(file);
  });
}

async function setCustomBackground(file) {
  const status = document.querySelector('#customBgStatus');
  try {
    status.textContent = 'Saving custom background...';
    state.settings.customTheme = state.settings.customTheme || { ...DEFAULT_SETTINGS.customTheme };
    state.settings.customTheme.background = await imageFileToBackground(file);
    state.settings.theme = 'custom';
    render();
  } catch (error) {
    if (state.settings.customTheme) state.settings.customTheme.background = '';
    status.textContent = error?.name === 'QuotaExceededError'
      ? 'That photo was too large to save locally. Try a smaller image or screenshot.'
      : (error.message || 'Could not save that photo.');
  } finally {
    document.querySelector('#customBgUpload').value = '';
  }
}

document.querySelector('#completedBtn').onclick = () => document.querySelector('#completedPanel').classList.remove('hidden');
document.querySelector('#closeCompleted').onclick = () => closePanel('completedPanel');
document.querySelector('#settingsBtn').onclick = () => document.querySelector('#settingsPanel').classList.remove('hidden');
document.querySelector('#closeSettings').onclick = () => closePanel('settingsPanel');
document.querySelector('#closeTaskPanel').onclick = () => closePanel('taskPanel');
document.querySelector('#closeSwapPanel').onclick = () => closePanel('swapPanel');
gridViewBtn.onclick = () => setViewMode('grid');
scrollViewBtn.onclick = () => setViewMode('scroll');
listSelect.onchange = e => { save(); app.activeListId = e.target.value; state = activeList(); render(); };
document.querySelector('#newListBtn').onclick = createList;
document.querySelector('#renameListBtn').onclick = renameList;
document.querySelector('#deleteListBtn').onclick = deleteCurrentList;
document.querySelector('#exportBackupBtn').onclick = exportBackup;
document.querySelector('#importBackupInput').onchange = e => importBackup(e.target.files?.[0]);
document.querySelector('#attackLimit').onchange = e => { state.settings.attackLimit = Math.max(1, Number(e.target.value) || 5); render(); };
document.querySelector('#dueToggle').onchange = e => { state.settings.dueDates = e.target.checked; render(); };
document.querySelector('#gameStyle').onchange = e => { state.settings.gameStyle = e.target.value; render(); };
document.querySelector('#themeScheme').onchange = e => { state.settings.theme = e.target.value; render(); };
document.querySelector('#customThemeBase').onchange = e => {
  state.settings.customTheme = state.settings.customTheme || { ...DEFAULT_SETTINGS.customTheme };
  state.settings.customTheme.base = e.target.value;
  state.settings.theme = 'custom';
  render();
};
document.querySelector('#customBgUpload').onchange = e => setCustomBackground(e.target.files?.[0]);
document.querySelector('#clearCustomBg').onclick = () => {
  state.settings.customTheme = { ...(state.settings.customTheme || DEFAULT_SETTINGS.customTheme), background: '' };
  render();
};
document.querySelector('#restoreDefaults').onclick = () => {
  if (confirm('Restore default settings? Your tasks stay saved.')) { state.settings = { ...DEFAULT_SETTINGS, customTheme: { ...DEFAULT_SETTINGS.customTheme } }; render(); }
};
document.querySelector('#clearCompleted').onclick = () => {
  if (confirm('Clear completed task history?')) { state.completed = []; render(); }
};

render();
