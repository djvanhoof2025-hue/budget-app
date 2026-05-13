(function() {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    let categories = [], incomes = [];
    let catState = { mode: 'add', id: null }, incomeState = { mode: 'add', id: null };
    let showArchive = { cat: false, income: false };

    const getLocalDateStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const dom = {
      catList: document.getElementById('inc-categories-list'), historyList: document.getElementById('incomes-history'),
      btnAddCat: document.getElementById('btn-add-inc-cat'), btnOpenIncome: document.getElementById('btn-open-income-modal'),
      toggleCatArch: document.getElementById('toggle-inc-cat-archive'), toggleIncArch: document.getElementById('toggle-inc-archive'),
      monthSel: document.getElementById('inc-month'), yearSel: document.getElementById('inc-year'),
      catModal: document.getElementById('inc-cat-modal-overlay'), catTitle: document.getElementById('inc-cat-modal-title'), catName: document.getElementById('inc-cat-name'), catSave: document.getElementById('inc-cat-btn-save'), catCancel: document.getElementById('inc-cat-btn-cancel'),
      incomeModal: document.getElementById('income-modal-overlay'), incomeTitle: document.getElementById('income-modal-title'), incomeType: document.getElementById('income-type'), incomeDesc: document.getElementById('income-desc'), incomeCat: document.getElementById('income-category'), incomeAmount: document.getElementById('income-amount'), incomeDate: document.getElementById('income-date'), incomeLoc: document.getElementById('income-location'), incomeDjFields: document.getElementById('income-dj-fields'), incomeSave: document.getElementById('income-btn-save'), incomeCancel: document.getElementById('income-btn-cancel')
    };
    if (!dom.catList) return;

    const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const safeParse = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) || f; } catch { return f; } };
    const saveAll = () => {
      localStorage.setItem('budget_income_categories', JSON.stringify(categories));
      localStorage.setItem('budget_incomes', JSON.stringify(incomes));
      if (window.refreshCalendar) window.refreshCalendar();
      if (window.refreshStats) window.refreshStats();
    };
    const fmtDate = d => d ? new Date(d).toLocaleDateString('ru') : '—';
    const fmtMoney = n => (n || 0).toLocaleString('ru') + ' ₽';
    const openModal = el => el.classList.add('visible');
    const closeModal = el => el.classList.remove('visible');

    const now = new Date();
    MONTHS.forEach((m, i) => { const opt = document.createElement('option'); opt.value = i; opt.textContent = m; dom.monthSel.appendChild(opt); });
    dom.monthSel.value = now.getMonth();
    for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) { const opt = document.createElement('option'); opt.value = y; opt.textContent = y; dom.yearSel.appendChild(opt); }
    dom.yearSel.value = now.getFullYear();

    const loadData = () => { categories = safeParse('budget_income_categories', []); incomes = safeParse('budget_incomes', []); };
    const populateCats = () => {
      dom.incomeCat.innerHTML = '<option value="">— Без категории —</option>';
      categories.filter(c => !c.isArchived).forEach(c => { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; dom.incomeCat.appendChild(opt); });
    };

    const renderCategories = () => {
      dom.catList.innerHTML = '';
      const list = categories.filter(c => showArchive.cat ? true : !c.isArchived);
      if (!list.length) { dom.catList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:12px;">Нет категорий</p>'; return; }
      list.forEach(cat => {
        const card = document.createElement('div'); card.className = 'category-card inc-cat-card';
        if (cat.isArchived) card.style.opacity = '0.6';
        const archBtn = cat.isArchived ? `<button class="btn-icon unarch-cat" data-id="${cat.id}">↺</button>` : `<button class="btn-icon arch-cat" data-id="${cat.id}">↓</button>`;
        card.innerHTML = `<div class="cat-header"><span class="cat-name">${cat.name}</span><div class="cat-actions">${archBtn}<button class="btn-icon edit-cat" data-id="${cat.id}">✎</button><button class="btn-icon del-cat" data-id="${cat.id}">×</button></div></div>`;
        dom.catList.appendChild(card);
      });
      dom.catList.querySelectorAll('.edit-cat').forEach(b => b.onclick = () => openCatModal('edit', b.dataset.id));
      dom.catList.querySelectorAll('.del-cat').forEach(b => b.onclick = () => deleteCat(b.dataset.id));
      dom.catList.querySelectorAll('.arch-cat').forEach(b => b.onclick = () => toggleArchiveCat(b.dataset.id, true));
      dom.catList.querySelectorAll('.unarch-cat').forEach(b => b.onclick = () => toggleArchiveCat(b.dataset.id, false));
    };

    const toggleArchiveCat = (id, state) => { const c = categories.find(x=>x.id===id); if(c){c.isArchived=state; saveAll(); renderCategories();} };
    const openCatModal = (mode, id = null) => {
      catState = { mode, id };
      dom.catTitle.textContent = mode === 'add' ? 'Новая категория' : 'Редактировать категорию';
      dom.catName.value = mode === 'edit' ? categories.find(c => c.id === id).name : '';
      openModal(dom.catModal); setTimeout(() => dom.catName.focus(), 100);
    };
    dom.catSave.onclick = () => {
      const name = dom.catName.value.trim(); if (!name) return;
      if (catState.mode === 'add') categories.push({ id: genId(), name, isArchived: false });
      else { const c = categories.find(x=>x.id===catState.id); if(c) c.name = name; }
      saveAll(); renderCategories(); closeModal(dom.catModal);
    };
    dom.catCancel.onclick = () => closeModal(dom.catModal);
    dom.catModal.onclick = e => { if (e.target === dom.catModal) closeModal(dom.catModal); };
    dom.btnAddCat.onclick = () => openCatModal('add');
    const deleteCat = id => { categories = categories.filter(c => c.id !== id); saveAll(); renderCategories(); renderHistory(); };

    const renderHistory = () => {
      loadData(); dom.historyList.innerHTML = '';
      const selM = parseInt(dom.monthSel.value); const selY = parseInt(dom.yearSel.value);
      const otherIncomes = incomes.filter(i => {
        if (!showArchive.income && i.isArchived) return false;
        const d = new Date(i.date); return d.getFullYear() === selY && d.getMonth() === selM;
      });
      const otherTotal = otherIncomes.reduce((s,i) => s + i.amount, 0);
      const summary = document.createElement('div');
      summary.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;margin-bottom:14px;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:0.85rem;';
      summary.innerHTML = `<span style="color:var(--success);font-weight:600;">Прочие доходы: ${fmtMoney(otherTotal)}</span>`;
      dom.historyList.appendChild(summary);

      if (!otherIncomes.length) { dom.historyList.innerHTML += '<p style="color:var(--text-muted);text-align:center;padding:12px;">Нет доходов за выбранный месяц</p>'; return; }
      otherIncomes.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(inc => {
        const el = document.createElement('div'); el.className = 'income-row';
        if (inc.isArchived) el.style.opacity = '0.6';
        const cat = categories.find(c => c.id === inc.categoryId);
        const catName = cat ? cat.name : 'Без категории';
        const typeLabel = inc.type === 'dj' ? 'DJ' : 'Доп.';
        const badgeStyle = inc.type === 'dj' ? 'background:#fef3c7;color:#b45309;border-color:#fde68a;' : 'background:#dcfce7;color:var(--success);border-color:#bbf7d0;';
        const archBadge = inc.isArchived ? '<span class="badge badge-archived">АРХИВ</span>' : '';
        const actions = inc.isArchived ? `<button class="btn-icon unarch-inc" data-id="${inc.id}">↺</button>` : `<button class="btn-icon edit-inc" data-id="${inc.id}">✎</button><button class="btn-icon del-inc" data-id="${inc.id}">×</button>`;
        el.innerHTML = `<div class="income-info"><div class="income-name">${inc.description || typeLabel}</div><div class="income-meta"><span>${fmtDate(inc.date)}</span><span>${catName}</span><span class="badge" style="${badgeStyle}">${typeLabel}</span>${archBadge}</div></div><div style="display:flex;align-items:center;gap:8px;"><div class="income-amount">+${fmtMoney(inc.amount)}</div>${actions}</div>`;
        dom.historyList.appendChild(el);
      });
      dom.historyList.querySelectorAll('.edit-inc').forEach(b => b.onclick = () => openIncomeModal('edit', b.dataset.id));
      dom.historyList.querySelectorAll('.del-inc').forEach(b => b.onclick = () => deleteIncome(b.dataset.id));
      dom.historyList.querySelectorAll('.unarch-inc').forEach(b => b.onclick = () => toggleArchiveIncome(b.dataset.id, false));
    };

    const toggleArchiveIncome = (id, state) => { const i = incomes.find(x=>x.id===id); if(i){i.isArchived=state; saveAll(); renderHistory();} };
    const deleteIncome = id => { incomes = incomes.filter(i => i.id !== id); saveAll(); renderHistory(); };

    const openIncomeModal = (mode, id = null) => {
      incomeState = { mode, id };
      dom.incomeTitle.textContent = mode === 'add' ? 'Добавить доход' : 'Редактировать доход';
      populateCats();
      if (mode === 'edit') {
        const i = incomes.find(x => x.id === id);
        dom.incomeType.value = i.type === 'dj' ? 'dj' : 'extra';
        dom.incomeDesc.value = i.description || ''; dom.incomeCat.value = i.categoryId || '';
        dom.incomeAmount.value = i.amount; dom.incomeDate.value = i.date; dom.incomeLoc.value = i.location || '';
      } else {
        dom.incomeType.value = 'extra'; dom.incomeDesc.value = ''; dom.incomeCat.value = '';
        dom.incomeAmount.value = ''; dom.incomeDate.value = getLocalDateStr(); dom.incomeLoc.value = '';
      }
      dom.incomeDjFields.classList.toggle('hidden', dom.incomeType.value !== 'dj');
      openModal(dom.incomeModal);
    };
    dom.incomeType.onchange = () => dom.incomeDjFields.classList.toggle('hidden', dom.incomeType.value !== 'dj');
    dom.incomeSave.onclick = () => {
      const type = dom.incomeType.value; const desc = dom.incomeDesc.value.trim();
      const amount = parseFloat(dom.incomeAmount.value) || 0; const date = dom.incomeDate.value;
      if (!date || amount <= 0) return;
      const catId = dom.incomeCat.value || null; const loc = type === 'dj' ? dom.incomeLoc.value.trim() : null;
      if (incomeState.mode === 'add') {
        incomes.push({ id: genId(), date, type, categoryId: catId, amount, description: desc || (type==='dj'?'DJ сет':'Доп. доход'), location: loc, isArchived: false });
      } else {
        const i = incomes.find(x => x.id === incomeState.id);
        if (i) { i.date = date; i.type = type; i.categoryId = catId; i.amount = amount; i.description = desc || i.description; i.location = loc; }
      }
      saveAll(); renderHistory(); closeModal(dom.incomeModal);
    };
    dom.incomeCancel.onclick = () => closeModal(dom.incomeModal);
    dom.incomeModal.onclick = e => { if (e.target === dom.incomeModal) closeModal(dom.incomeModal); };
    dom.btnOpenIncome.onclick = () => openIncomeModal('add');
    dom.toggleCatArch.onclick = () => { showArchive.cat = !showArchive.cat; dom.toggleCatArch.textContent = showArchive.cat ? 'Скрыть архив' : 'Показать архив'; renderCategories(); };
    dom.toggleIncArch.onclick = () => { showArchive.income = !showArchive.income; dom.toggleIncArch.textContent = showArchive.income ? 'Скрыть архив' : 'Показать архив'; renderHistory(); };
    dom.monthSel.onchange = renderHistory; dom.yearSel.onchange = renderHistory;
    window.refreshIncomes = renderHistory;
    renderCategories(); renderHistory();
  });
})();