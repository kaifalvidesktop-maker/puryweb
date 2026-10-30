// PuryWeb — os/os.boot.js
// Dashboard: quota, plan/license, stats, language toggle. Re-renders live on storage changes.

import { getSettings, patchSettings, getStats, onChange } from '../shared/storage.js';
import { getStatus, activateLicense, deactivateLicense } from '../background/quota.js';
import { t, setLang, applyDom, num, minutes } from '../shared/i18n.js';
import { recycleSvg, faviconDataUrl } from '../shared/icons.js';

const $ = (id) => document.getElementById(id);

function setFavicon() {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = faviconDataUrl();
  document.head.appendChild(link);
}

function showMsg(text, ok) {
  const el = $('licenseMsg');
  el.textContent = text;
  el.className = 'msg ' + (ok ? 'ok' : 'err');
}

async function render() {
  const [settings, status, stats] = await Promise.all([getSettings(), getStatus(), getStats()]);
  setLang(settings.lang);
  applyDom();

  document.documentElement.style.setProperty('--from', settings.theme.from);
  document.documentElement.style.setProperty('--to', settings.theme.to);
  document.documentElement.style.setProperty('--radius', settings.theme.radius + 'px');

  $('langBtn').textContent = t('os.lang.switch');

  if (status.unlimited) {
    $('quotaBig').textContent = '∞';
    $('quotaBar').style.width = '100%';
    $('quotaSub').textContent = t('quota.unlimited');
  } else {
    $('quotaBig').textContent = t('quota.left', { n: status.remaining });
    $('quotaBar').style.width = Math.min(100, (status.used / status.limit) * 100) + '%';
    $('quotaSub').textContent = `${num(status.used)} / ${num(status.limit)} · ${t('quota.resets')}`;
  }

  const paid = settings.plan === 'paid';
  const badge = $('planBadge');
  badge.textContent = t(paid ? 'os.plan.paid' : 'os.plan.free');
  badge.className = 'badge' + (paid ? ' pro' : '');
  $('deactivateBtn').classList.toggle('hidden', !paid);
  $('activateBtn').classList.toggle('hidden', paid);
  $('licenseInput').classList.toggle('hidden', paid);
  $('trust').classList.toggle('hidden', !settings.trustBadge);

  $('statPurified').textContent = num(stats.purified);
  $('statSaved').textContent = minutes(stats.secondsSaved);
}

function wire() {
  $('langBtn').addEventListener('click', async () => {
    const s = await getSettings();
    await patchSettings({ lang: s.lang === 'bn' ? 'en' : 'bn' });
  });

  $('activateBtn').addEventListener('click', async () => {
    const r = await activateLicense($('licenseInput').value);
    if (r.ok) {
      $('licenseInput').value = '';
      await render();
      showMsg(t('os.license.ok'), true);
    } else {
      showMsg(t('os.license.invalid'), false);
    }
  });

  $('licenseInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('activateBtn').click();
  });

  $('deactivateBtn').addEventListener('click', async () => {
    await deactivateLicense();
    await render();
    showMsg(t('os.license.off'), true);
  });
}

let pending = 0;
function scheduleRender() {
  clearTimeout(pending);
  pending = setTimeout(() => render().catch(console.error), 60);
}

async function boot() {
  setFavicon();
  $('logo').innerHTML = recycleSvg({ size: 40 });
  wire();
  await render();
  onChange(scheduleRender);
}

boot().catch((e) => {
  console.error('[PuryWeb OS] boot failed', e);
  document.body.insertAdjacentHTML('beforeend', '<p style="padding:24px;color:#F87171">PuryWeb OS failed to start. Reload the extension.</p>');
});
