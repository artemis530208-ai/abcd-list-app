const columns = {
  A: { title: 'Attack', desc: 'Top 5 priorities for today.' },
  B: { title: 'Buy', desc: 'Things you need to buy.' },
  C: { title: 'Call', desc: 'People you need to call.' },
  D: { title: 'Do', desc: 'Backlog / tasks waiting their turn.' }
};

let completedFilter = 'ALL';
let viewMode = localStorage.getItem('abcd-view') || 'grid';

const starter = {
  A: ['Example: Finish first ABCD app test'],
  B: ['Example: Notebook'],
  C: ['Example: Call contractor'],
  D: ['Example: Add reminders later', 'Example: Test on phone for 7 days'],
  completed: []
};

let state = load();
const grid = document.querySelector('#grid');
const template = document.querySelector('#columnTemplate');
const gridViewBtn = document.querySelector('#gridViewBtn');
const scrollViewBtn = document.querySelector('#scrollViewBtn');

function load() {
  try { return JSON.parse(localStorage.getItem('abcd-state')) || starter; }
  catch { return starter; }
}
function save() { localStorage.setItem('abcd-state', JSON.stringify(state)); }

function promoteDueIfNeeded() {
  while (state.A.length < 5 && state.D.length) state.A.push(state.D.shift());
}

function render() {
  promoteDueIfNeeded();
  save();
  applyViewMode();
  grid.innerHTML = '';
  Object.entries(columns).forEach(([key, info]) => {
    const node = template.content.cloneNode(true);
    const section = node.querySelector('.column');
    section.dataset.key = key;
    node.querySelector('.letter').textContent = key;
    node.querySelector('h2').textContent = info.title;
    node.querySelector('p').textContent = info.desc;
    node.querySelector('.count').textContent = `${state[key].length}${key === 'A' ? '/5' : ''}`;
    const form = node.querySelector('.addForm');
    const input = node.querySelector('input');
    const list = node.querySelector('.tasks');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      if (key === 'A' && state.A.length >= 5) state.D.push(text);
      else state[key].push(text);
      input.value = '';
      render();
    });
    if (!state[key].length) list.innerHTML = '<li class="empty">Nothing here yet.</li>';
    state[key].forEach((text, index) => list.appendChild(taskEl(key, text, index)));
    grid.appendChild(node);
  });
  renderCompleted();
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

function taskEl(key, text, index) {
  const li = document.createElement('li');
  li.className = 'task';
  const span = document.createElement('span');
  span.textContent = text;
  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(button('Done', 'done', () => completeTask(key, index)));
  if (key === 'D') actions.append(button('Move to A', 'attack', () => moveDoToAttack(index)));
  actions.append(button('Delete', 'delete', () => { state[key].splice(index, 1); render(); }));
  li.append(span, actions);
  return li;
}

function button(label, cls, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  b.className = cls;
  b.addEventListener('click', fn);
  return b;
}

function completeTask(key, index) {
  const [text] = state[key].splice(index, 1);
  state.completed.unshift({ key, text, at: new Date().toLocaleString() });
  render();
}

function moveDoToAttack(index) {
  const [text] = state.D.splice(index, 1);
  if (state.A.length < 5) state.A.push(text);
  else state.A[4] = text;
  render();
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
    return `<li><span class="miniLetter ${key}">${key}</span><strong>${escapeHtml(item.text)}</strong><br><small>${label} • ${item.at}</small></li>`;
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
function escapeHtml(str) { return str.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

document.querySelector('#completedBtn').onclick = () => document.querySelector('#completedPanel').classList.remove('hidden');
document.querySelector('#closeCompleted').onclick = () => document.querySelector('#completedPanel').classList.add('hidden');
gridViewBtn.onclick = () => setViewMode('grid');
scrollViewBtn.onclick = () => setViewMode('scroll');
document.querySelector('#clearCompleted').onclick = () => {
  if (confirm('Clear completed task history?')) { state.completed = []; render(); }
};

render();
