const STORAGE_KEY = 'pocket-jam-sketches-v1';
const WORKING_KEY = 'pocket-jam-working-sketch-v1';

const form = document.querySelector('#sketch-form');
const titleInput = document.querySelector('#sketch-title');
const textInput = document.querySelector('#sketch-text');
const mediaInput = document.querySelector('#sketch-media');
const list = document.querySelector('#sketch-list');
const count = document.querySelector('#sketch-count');
const status = document.querySelector('#sketch-status');
const error = document.querySelector('#sketch-error');
let activeId = null;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

function readDrafts() {
  const value = readJson(STORAGE_KEY, []);
  return Array.isArray(value) ? value : [];
}

function currentValues() {
  return { id: activeId, title: titleInput.value.trim(), text: textInput.value.trim(), media: mediaInput.value.trim() };
}

function saveWorkingCopy() {
  try {
    localStorage.setItem(WORKING_KEY, JSON.stringify(currentValues()));
    status.textContent = 'Изменения сохранены в этом браузере';
  } catch {
    status.textContent = 'Не удалось сохранить изменения в браузере';
  }
}

function validateMedia(value) {
  const urls = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const item of urls) {
    try {
      const url = new URL(item);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid');
    } catch { return null; }
  }
  return urls;
}

function renderDrafts() {
  const drafts = readDrafts().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  count.textContent = String(drafts.length).padStart(2, '0');
  list.replaceChildren();
  if (!drafts.length) {
    const empty = document.createElement('p');
    empty.className = 'sketch-drafts__empty';
    empty.textContent = 'Пока пусто. Первый набросок появится здесь после сохранения.';
    list.append(empty);
    return;
  }
  for (const draft of drafts) {
    const card = document.createElement('article');
    card.className = 'sketch-draft';
    const number = document.createElement('span');
    number.className = 'sketch-draft__meta';
    number.textContent = new Date(draft.updatedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
    const heading = document.createElement('h3');
    heading.textContent = draft.title || 'Без названия';
    const preview = document.createElement('p');
    preview.textContent = draft.text || 'Текст пока не добавлен';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = 'Открыть ↗';
    edit.addEventListener('click', () => {
      activeId = draft.id;
      titleInput.value = draft.title;
      textInput.value = draft.text;
      mediaInput.value = draft.media.join('\n');
      error.hidden = true;
      status.textContent = 'Редактирование наброска';
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      titleInput.focus();
    });
    card.append(number, heading, preview, edit);
    list.append(card);
  }
}

form.addEventListener('input', () => {
  error.hidden = true;
  saveWorkingCopy();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const values = currentValues();
  const media = validateMedia(values.media);
  if (!media) {
    error.textContent = 'Проверьте ссылки на медиа: нужен адрес с http:// или https://, по одному в строке.';
    error.hidden = false;
    mediaInput.focus();
    return;
  }
  if (!values.title && !values.text && !media.length) {
    error.textContent = 'Добавьте название, текст или ссылку на медиа.';
    error.hidden = false;
    titleInput.focus();
    return;
  }
  const drafts = readDrafts();
  const now = new Date().toISOString();
  const id = activeId || crypto.randomUUID();
  const next = { id, title: values.title, text: values.text, media, updatedAt: now };
  const index = drafts.findIndex((draft) => draft.id === id);
  if (index === -1) drafts.push(next);
  else drafts[index] = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    localStorage.removeItem(WORKING_KEY);
    activeId = id;
    status.textContent = 'Набросок сохранён';
    renderDrafts();
  } catch {
    error.textContent = 'Браузер не дал сохранить набросок. Проверьте свободное место и настройки хранения.';
    error.hidden = false;
  }
});

document.querySelector('#sketch-new').addEventListener('click', () => {
  activeId = null;
  form.reset();
  error.hidden = true;
  status.textContent = 'Новый набросок';
  try { localStorage.removeItem(WORKING_KEY); } catch {}
  titleInput.focus();
});

const working = readJson(WORKING_KEY, null);
if (working && typeof working === 'object') {
  activeId = working.id || null;
  titleInput.value = working.title || '';
  textInput.value = working.text || '';
  mediaInput.value = working.media || '';
  status.textContent = 'Восстановлен незавершённый набросок';
}
renderDrafts();
