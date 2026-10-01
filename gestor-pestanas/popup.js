import {
  closeDuplicates,
  closeInactive,
  deleteSession,
  getSessions,
  getSettings,
  groupTabs,
  hostname,
  restoreSession,
  saveCurrentWindow,
  saveSettings,
  ungroupAll,
} from './tabs.js';

const $ = (sel) => document.querySelector(sel);
let statusTimer;

function showStatus(text) {
  $('#status').textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => ($('#status').textContent = ''), 4000);
}

function timeAgo(ms) {
  if (!ms) return '';
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function textBlock(title, sub) {
  return el('span', { className: 'text' }, [
    el('span', { className: 'title', textContent: title, title }),
    el('span', { className: 'sub', textContent: sub }),
  ]);
}

// ---------- Pestañas ----------

async function renderTabs() {
  const tabs = await chrome.tabs.query({});
  $('#count').textContent = plural(tabs.length, 'pestaña', 'pestañas');

  const query = $('#search').value.trim().toLowerCase();
  const visible = tabs
    .filter((t) => !query || (t.title || '').toLowerCase().includes(query) || (t.url || '').toLowerCase().includes(query))
    .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

  const list = $('#tab-list');
  list.replaceChildren();
  if (!visible.length) {
    list.append(el('li', { className: 'empty', textContent: 'No hay pestañas que coincidan.' }));
    return;
  }

  for (const tab of visible) {
    const close = el('button', { className: 'icon-btn', textContent: '✕', title: 'Cerrar pestaña' });
    close.addEventListener('click', async (e) => {
      e.stopPropagation();
      await chrome.tabs.remove(tab.id);
      renderTabs();
    });

    const favicon = el('img', { src: tab.favIconUrl || 'icons/icon16.png', alt: '' });
    favicon.addEventListener('error', () => (favicon.src = 'icons/icon16.png'), { once: true });

    const sub = [hostname(tab.url) || tab.url, tab.active ? 'activa' : timeAgo(tab.lastAccessed)].filter(Boolean).join(' · ');
    const item = el('li', { className: 'clickable', title: tab.url }, [favicon, textBlock(tab.title || tab.url, sub), close]);
    item.addEventListener('click', async () => {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      window.close();
    });
    list.append(item);
  }
}

// ---------- Sesiones ----------

async function renderSessions() {
  const sessions = await getSessions();
  const list = $('#session-list');
  list.replaceChildren();
  if (!sessions.length) {
    list.append(el('li', { className: 'empty', textContent: 'Todavía no hay sesiones guardadas.' }));
    return;
  }

  for (const s of sessions) {
    const open = el('button', { className: 'icon-btn', textContent: 'Abrir', title: 'Abrir en una ventana nueva' });
    open.addEventListener('click', () => restoreSession(s.id));

    const remove = el('button', { className: 'icon-btn', textContent: '✕', title: 'Borrar sesión' });
    remove.addEventListener('click', async () => {
      if (!confirm(`¿Borrar la sesión "${s.name}"?`)) return;
      await deleteSession(s.id);
      renderSessions();
    });

    const sub = `${plural(s.tabs.length, 'pestaña', 'pestañas')} · ${new Date(s.created).toLocaleDateString('es')}`;
    list.append(el('li', {}, [textBlock(s.name, sub), open, remove]));
  }
}

// ---------- Acciones ----------

const ACTIONS = {
  'group-topic': async () => `Listo: ${plural(await groupTabs('topic'), 'grupo creado', 'grupos creados')} por tema.`,
  'group-domain': async () => {
    const n = await groupTabs('domain');
    return n ? `Listo: ${plural(n, 'grupo creado', 'grupos creados')} por dominio.` : 'No hay dominios con 2 o más pestañas.';
  },
  ungroup: async () => `${plural(await ungroupAll(), 'pestaña desagrupada', 'pestañas desagrupadas')}.`,
  duplicates: async () => {
    const n = await closeDuplicates();
    return n ? `${plural(n, 'duplicada cerrada', 'duplicadas cerradas')}.` : 'No hay pestañas duplicadas.';
  },
  inactive: async () => {
    const days = Number($('#inactive-days').value);
    const n = await closeInactive(days);
    renderSessions();
    return n
      ? `${plural(n, 'pestaña inactiva cerrada', 'pestañas inactivas cerradas')}. Las guardé en Sesiones por si las necesitas.`
      : `No hay pestañas sin usar en más de ${plural(days, 'día', 'días')}.`;
  },
};

document.querySelectorAll('[data-action]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      showStatus(await ACTIONS[btn.dataset.action]());
    } catch (err) {
      showStatus(`Error: ${err.message}`);
    } finally {
      btn.disabled = false;
      renderTabs();
    }
  });
});

$('#search').addEventListener('input', renderTabs);

$('#save-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#session-name').value.trim();
  if (!name) return;
  const session = await saveCurrentWindow(name);
  $('#session-name').value = '';
  showStatus(session ? `Sesión "${name}" guardada con ${plural(session.tabs.length, 'pestaña', 'pestañas')}.` : 'No hay pestañas web que guardar.');
  renderSessions();
});

// ---------- Ajustes ----------

async function initSettings() {
  const settings = await getSettings();
  $('#auto-close').checked = settings.autoClose;
  $('#auto-days').value = settings.days;

  const persist = () => {
    const days = Math.min(60, Math.max(1, Number($('#auto-days').value) || 3));
    $('#auto-days').value = days;
    saveSettings({ autoClose: $('#auto-close').checked, days });
  };
  $('#auto-close').addEventListener('change', persist);
  $('#auto-days').addEventListener('change', persist);
}

renderTabs();
renderSessions();
initSettings();
