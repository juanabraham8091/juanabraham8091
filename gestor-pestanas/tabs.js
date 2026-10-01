// Lógica compartida entre el popup y el service worker.

export const TOPICS = [
  { name: 'Desarrollo', color: 'blue', match: ['github.com', 'gitlab.com', 'stackoverflow.com', 'developer.mozilla.org', 'npmjs.com', 'vercel.com', 'supabase.com', 'localhost', 'codepen.io', 'replit.com', 'claude.ai', 'chatgpt.com', 'openai.com', 'anthropic.com'] },
  { name: 'Trabajo', color: 'green', match: ['docs.google.com', 'drive.google.com', 'sheets.google.com', 'mail.google.com', 'calendar.google.com', 'notion.so', 'slack.com', 'trello.com', 'asana.com', 'linear.app', 'figma.com', 'canva.com', 'n8n.io', 'make.com', 'gohighlevel.com', 'office.com', 'outlook.com', 'zoom.us', 'meet.google.com'] },
  { name: 'Redes', color: 'pink', match: ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'tiktok.com', 'reddit.com', 'threads.net', 'web.whatsapp.com', 'discord.com', 'pinterest.com'] },
  { name: 'Video y música', color: 'red', match: ['youtube.com', 'netflix.com', 'twitch.tv', 'vimeo.com', 'spotify.com', 'primevideo.com', 'disneyplus.com', 'max.com'] },
  { name: 'Compras', color: 'orange', match: ['amazon.', 'mercadolibre.', 'ebay.', 'aliexpress.com', 'temu.com', 'shein.com', 'walmart.com', 'etsy.com'] },
  { name: 'Noticias', color: 'purple', match: ['news.', 'cnn.com', 'bbc.', 'elpais.com', 'nytimes.com', 'diariolibre.com', 'listindiario.com', 'medium.com', 'substack.com', 'wikipedia.org'] },
];

const OTHER = { name: 'Otros', color: 'grey' };
const COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
const DAY = 24 * 60 * 60 * 1000;

export function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function topicFor(host) {
  return TOPICS.find((t) => t.match.some((m) => host === m || host.endsWith('.' + m) || (m.endsWith('.') && host.includes(m)))) || OTHER;
}

function colorForText(text) {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

function isWebTab(tab) {
  return /^(https?|file):/.test(tab.url || '');
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

/** Agrupa las pestañas de la ventana actual. mode: 'topic' | 'domain'. Devuelve el número de grupos creados. */
export async function groupTabs(mode) {
  // Empezar de cero para no mezclar con agrupaciones anteriores.
  await ungroupAll();
  const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
  const buckets = new Map();
  for (const tab of tabs) {
    if (tab.pinned || !isWebTab(tab)) continue;
    const host = hostname(tab.url) || 'archivos';
    const key = mode === 'topic' ? topicFor(host).name : host;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(tab.id);
  }

  let created = 0;
  for (const [title, tabIds] of buckets) {
    // Por dominio, una sola pestaña no merece su propio grupo.
    if (mode === 'domain' && tabIds.length < 2) continue;
    const groupId = await chrome.tabs.group({ tabIds });
    const color = mode === 'topic' ? (TOPICS.find((t) => t.name === title) || OTHER).color : colorForText(title);
    await chrome.tabGroups.update(groupId, { title, color });
    created++;
  }
  return created;
}

export async function ungroupAll() {
  const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
  const grouped = tabs.filter((t) => t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE).map((t) => t.id);
  if (grouped.length) await chrome.tabs.ungroup(grouped);
  return grouped.length;
}

/** Cierra pestañas con la misma URL (ignorando el #ancla) en todas las ventanas. Conserva la activa si hay una. */
export async function closeDuplicates() {
  const tabs = await chrome.tabs.query({});
  const seen = new Map();
  const toClose = [];
  for (const tab of tabs) {
    if (!tab.url || tab.pinned) continue;
    const key = normalizeUrl(tab.url);
    const kept = seen.get(key);
    if (!kept) {
      seen.set(key, tab);
    } else if (tab.active && !kept.active) {
      toClose.push(kept.id);
      seen.set(key, tab);
    } else {
      toClose.push(tab.id);
    }
  }
  if (toClose.length) await chrome.tabs.remove(toClose);
  return toClose.length;
}

/** Cierra pestañas sin usar en `days` días. Antes las guarda como sesión para poder recuperarlas. */
export async function closeInactive(days) {
  const limit = Date.now() - days * DAY;
  const tabs = await chrome.tabs.query({});
  const stale = tabs.filter((t) => !t.active && !t.pinned && !t.audible && t.lastAccessed && t.lastAccessed < limit);
  if (!stale.length) return 0;

  const label = new Date().toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
  await addSession(`Inactivas · ${label}`, stale);
  await chrome.tabs.remove(stale.map((t) => t.id));
  return stale.length;
}

// ---------- Sesiones ----------

export async function getSessions() {
  const { sessions = [] } = await chrome.storage.local.get('sessions');
  return sessions;
}

async function addSession(name, tabs) {
  const sessions = await getSessions();
  const session = {
    id: crypto.randomUUID(),
    name,
    created: Date.now(),
    tabs: tabs.filter(isWebTab).map((t) => ({ url: t.url, title: t.title || t.url })),
  };
  if (!session.tabs.length) return null;
  sessions.unshift(session);
  await chrome.storage.local.set({ sessions });
  return session;
}

export async function saveCurrentWindow(name) {
  const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
  return addSession(name, tabs);
}

export async function restoreSession(id) {
  const session = (await getSessions()).find((s) => s.id === id);
  if (session) await chrome.windows.create({ url: session.tabs.map((t) => t.url), focused: true });
}

export async function deleteSession(id) {
  const sessions = (await getSessions()).filter((s) => s.id !== id);
  await chrome.storage.local.set({ sessions });
}

// ---------- Ajustes ----------

export const DEFAULT_SETTINGS = { autoClose: false, days: 3 };

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}
