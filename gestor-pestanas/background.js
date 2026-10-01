import { closeDuplicates, closeInactive, getSettings, groupTabs } from './tabs.js';

const ALARM = 'auto-cleanup';

async function updateBadge() {
  const tabs = await chrome.tabs.query({});
  await chrome.action.setBadgeText({ text: String(tabs.length) });
  await chrome.action.setBadgeBackgroundColor({ color: tabs.length > 30 ? '#d93025' : '#5f6368' });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM, { periodInMinutes: 60 });
  updateBadge();
});

chrome.runtime.onStartup.addListener(updateBadge);
chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  const { autoClose, days } = await getSettings();
  if (autoClose) await closeInactive(days);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'group-by-topic') await groupTabs('topic');
  if (command === 'close-duplicates') await closeDuplicates();
});
