(function() {
  'use strict';
  document.addEventListener('DOMContentLoaded', async () => {
    const dom = {
      basePay: document.getElementById('base-pay'), saveSettings: document.getElementById('btn-save-settings'),
      host: document.getElementById('db-host'), name: document.getElementById('db-name'),
      user: document.getElementById('db-user'), pass: document.getElementById('db-pass'),
      saveCfg: document.getElementById('btn-save-db'), testBtn: document.getElementById('btn-test-db'),
      syncBtn: document.getElementById('btn-sync-db'), status: document.getElementById('db-status')
    };
    if (!dom.saveCfg) return;

    const showStatus = (msg, type) => {
      dom.status.textContent = msg; dom.status.className = `db-status ${type}`; dom.status.style.display = 'block';
      if (type === 'success') setTimeout(() => { dom.status.style.display = 'none'; }, 4000);
    };
    const getConfig = () => ({ host: dom.host.value.trim(), name: dom.name.value.trim(), user: dom.user.value.trim(), pass: dom.pass.value });
    const safeParse = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) || f; } catch { return f; } };

    const loadSettings = () => {
      dom.basePay.value = safeParse('budget_settings', { basePay: 5200 }).basePay || 5200;
      const db = safeParse('db_config', {});
      dom.host.value = db.host || ''; dom.name.value = db.name || ''; dom.user.value = db.user || ''; dom.pass.value = db.pass || '';
    };

    dom.saveSettings.onclick = () => {
      const base = parseFloat(dom.basePay.value) || 5200;
      localStorage.setItem('budget_settings', JSON.stringify({ basePay: base }));
      showStatus('Настройки сохранены', 'success');
      if (window.refreshCalendar) window.refreshCalendar();
      if (window.refreshIncomes) window.refreshIncomes();
      if (window.refreshStats) window.refreshStats();
    };

    dom.saveCfg.onclick = () => {
      const cfg = getConfig();
      if (!cfg.host || !cfg.name) return showStatus('Укажите хост и имя БД', 'error');
      localStorage.setItem('db_config', JSON.stringify(cfg));
      showStatus('Конфигурация сохранена', 'success');
    };

    dom.testBtn.onclick = async () => {
      const cfg = getConfig();
      if (!cfg.host || !cfg.name) return showStatus('Заполните хост и имя БД', 'error');
      dom.testBtn.disabled = true; dom.testBtn.textContent = 'Проверка...';
      try {
        const res = await fetch('/api/db-test', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(cfg) });
        const data = await res.json();
        if (data.success) showStatus(data.message, 'success');
        else showStatus(`Ошибка: ${data.error}`, 'error');
      } catch (err) { showStatus(`Ошибка сети: ${err.message}`, 'error'); }
      finally { dom.testBtn.disabled = false; dom.testBtn.textContent = 'Проверить'; }
    };

    const collectData = () => {
      const data = {
        settings: safeParse('budget_settings', { basePay: 5200 }),
        incomeCategories: safeParse('budget_income_categories', []),
        incomes: safeParse('budget_incomes', []),
        categories: safeParse('budget_categories', []),
        expenses: safeParse('budget_expenses', []),
        debts: safeParse('budget_debts', []),
        calendar: {}
      };
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith('budget_app_')) {
          try { data.calendar[k] = JSON.parse(localStorage.getItem(k)); } catch {}
        }
      }
      return data;
    };

    dom.syncBtn.onclick = async () => {
      const cfg = getConfig();
      if (!cfg.host || !cfg.name) return showStatus('Заполните конфигурацию БД', 'error');
      if (!confirm('Все локальные данные будут отправлены в удалённую БД. Продолжить?')) return;
      dom.syncBtn.disabled = true; dom.syncBtn.textContent = 'Синхронизация...';
      try {
        const payload = { config: cfg, data: collectData() };
        const res = await fetch('/api/sync', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) showStatus(data.message, 'success');
        else showStatus(`Ошибка: ${data.error}`, 'error');
      } catch (err) { showStatus(`Ошибка сети: ${err.message}`, 'error'); }
      finally { dom.syncBtn.disabled = false; dom.syncBtn.textContent = 'Синхронизировать'; }
    };

    loadSettings();
  });
})();