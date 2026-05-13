(function() {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    let state = { year: new Date().getFullYear(), month: new Date().getMonth(), view: 'quarter', editing: null };
    let tempIncomes = [];

    const dom = {
      root: document.getElementById('calendar-root'), title: document.getElementById('period-title'),
      globalTotal: document.getElementById('global-total'), switcher: document.getElementById('view-switcher'),
      prev: document.getElementById('nav-prev'), next: document.getElementById('nav-next'),
      btnMonthCfg: document.getElementById('btn-month-cfg'),
      cfgModal: document.getElementById('month-cfg-modal-overlay'), cfgTitle: document.getElementById('month-cfg-title'),
      cfgRate: document.getElementById('cfg-daily-rate'), cfgAdvance: document.getElementById('cfg-advance'),
      cfgSave: document.getElementById('cfg-btn-save'), cfgCancel: document.getElementById('cfg-btn-cancel'),
      modal: document.getElementById('modal-overlay'), mTitle: document.getElementById('modal-title'),
      mCoef: document.getElementById('input-coef'), mComment: document.getElementById('input-comment'),
      mSick: document.getElementById('chk-sick'), mOff: document.getElementById('chk-off'), mEvent: document.getElementById('chk-event'),
      eventFields: document.getElementById('event-fields'), mLocation: document.getElementById('input-location'),
      mDjPrice: document.getElementById('input-dj-price'), incomesList: document.getElementById('extra-incomes-list'),
      btnAddIncome: document.getElementById('btn-add-income'), mSave: document.getElementById('btn-save'), mCancel: document.getElementById('btn-cancel')
    };
    if (!dom.root) return;

    const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const safeParse = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) || f; } catch { return f; } };
    const getGlobalSettings = () => safeParse('budget_settings', { basePay: 5200 });
    const getMonthCfgKey = (y, m) => `budget_month_cfg_${y}_${m}`;
    const getMonthCfg = (y, m) => safeParse(getMonthCfgKey(y, m), { dailyRate: null, advance: 0 });
    const saveMonthCfg = (y, m, data) => localStorage.setItem(getMonthCfgKey(y, m), JSON.stringify(data));
    const getStorageKey = (y, m) => `budget_app_${y}_${m}`;
    const loadMonth = (y, m) => safeParse(getStorageKey(y, m), {});
    const saveMonth = (y, m, data) => localStorage.setItem(getStorageKey(y, m), JSON.stringify(data));

    // 🔧 СТРОГАЯ НОРМАЛИЗАЦИЯ ДАТ (только строки, без new Date)
    const normalizeDate = (val) => val ? String(val).trim().substring(0, 10) : '';

    ['month','quarter','half','year'].forEach((v, i) => {
      const btn = document.createElement('button');
      btn.className = `view-btn ${i === 1 ? 'active' : ''}`;
      btn.textContent = ['1М','Квартал','Полгода','Год'][i];
      btn.dataset.view = v;
      btn.onclick = () => { dom.switcher.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); state.view = v; render(); };
      dom.switcher.appendChild(btn);
    });

    const getIncomesForDate = (dateStr) => {
      try {
        const raw = localStorage.getItem('budget_incomes');
        const all = raw ? JSON.parse(raw) : [];
        return all.filter(i => {
          const type = String(i.type || '').trim().toLowerCase();
          const isArchived = Boolean(Number(i.isArchived) || 0);
          const itemDate = normalizeDate(i.date);
          return itemDate === dateStr && !isArchived;
        });
      } catch (e) { return []; }
    };

    const calcDayTotal = (info, dateStr, y, m) => {
      const cfg = getMonthCfg(y, m);
      const dailyRate = Number(cfg.dailyRate) || Number(getGlobalSettings().basePay) || 5200;
      const coef = Number(info.coef) || 0;
      const isWorkDay = !info.sick && !info.off && coef > 0;
      const baseIncome = isWorkDay ? coef * dailyRate : 0;
      const dayIncomes = getIncomesForDate(dateStr);
      const extraIncome = dayIncomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);
      return baseIncome + extraIncome;
    };

    const getDayMarkers = (y, m, d) => {
      const dateStr = normalizeDate(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      const expenses = safeParse('budget_expenses', []);
      const expTotal = expenses.filter(e => normalizeDate(e.date) === dateStr && !e.isArchived && e.type !== 'debt_payment').reduce((s,e) => s + (Number(e.amount)||0), 0);
      return expTotal > 0 ? [{ type: 'exp', amount: expTotal }] : [];
    };

    const render = () => {
      dom.root.innerHTML = '';
      dom.root.className = `calendar-container view-${state.view}`;
      let startM = state.month, startY = state.year, count = 1;
      if (state.view === 'quarter') { count = 3; startM = Math.floor(state.month / 3) * 3; }
      if (state.view === 'half') { count = 6; startM = state.month < 6 ? 0 : 6; }
      if (state.view === 'year') { count = 12; startM = 0; startY = state.year; }
      
      const titles = { month: `${MONTHS[state.month]} ${state.year}`, quarter: `${Math.floor(startM/3)+1}-й квартал ${startY}`, half: `${startM < 6 ? 'I' : 'II'} полугодие ${startY}`, year: `${startY} год` };
      dom.title.textContent = titles[state.view];
      
      let viewTotal = 0;
      const fragment = document.createDocumentFragment();
      
      for (let i = 0; i < count; i++) {
        let curM = startM + i, curY = startY;
        if (curM > 11) { curY += Math.floor(curM / 12); curM %= 12; }
        const data = loadMonth(curY, curM);
        let monthTotal = 0;
        
        const card = document.createElement('div'); card.className = 'month-card';
        card.innerHTML = `<div class="month-title">${MONTHS[curM]} ${curY}</div>`;
        const grid = document.createElement('div'); grid.className = 'month-grid';
        ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(d => { const h = document.createElement('div'); h.className = 'day-header'; h.textContent = d; grid.appendChild(h); });
        
        const firstDay = new Date(curY, curM, 1).getDay();
        const daysInMonth = new Date(curY, curM + 1, 0).getDate();
        const offset = firstDay === 0 ? 6 : firstDay - 1;
        for (let k = 0; k < offset; k++) { const e = document.createElement('div'); e.className = 'day-cell empty'; grid.appendChild(e); }
        
        for (let d = 1; d <= daysInMonth; d++) {
          const key = String(d);
          const info = data[key] || { coef: 0, comment: '', sick: false, off: false, event: false, eventLocation: '' };
          const dateStr = normalizeDate(`${curY}-${String(curM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
          const dayIncome = calcDayTotal(info, dateStr, curY, curM);
          monthTotal += dayIncome;
          
          const cell = document.createElement('div'); cell.className = 'day-cell';
          if (info.sick) cell.classList.add('status-sick');
          if (info.off) cell.classList.add('status-off');
          if (info.event) cell.classList.add('status-event');
          if (!info.sick && !info.off && info.coef > 0 && info.coef < 1) cell.classList.add('coef-low');
          
          let tooltipParts = [];
          if (info.comment) tooltipParts.push(info.comment);
          if (info.eventLocation) tooltipParts.push(info.eventLocation);
          if (tooltipParts.length) cell.title = tooltipParts.join(' | ');
          
          cell.innerHTML = `<div class="day-num">${d}</div><div class="warn-badge">!</div><div class="day-coef">${info.coef || '—'}</div>`;
          
          const markers = getDayMarkers(curY, curM, d);
          if (markers.length > 0) {
            const totalExp = markers.reduce((s, m) => s + m.amount, 0);
            const markerEl = document.createElement('div');
            markerEl.className = 'expense-marker';
            markerEl.textContent = `-${totalExp.toLocaleString('ru')}`;
            cell.appendChild(markerEl);
          }
          cell.onclick = () => openModal(curY, curM, d, info);
          grid.appendChild(cell);
        }
        viewTotal += monthTotal;
        card.appendChild(grid);
        card.insertAdjacentHTML('beforeend', `<div class="month-total">Итого за месяц: <strong>${monthTotal.toLocaleString('ru')} ₽</strong></div>`);
        fragment.appendChild(card);
      }
      dom.root.appendChild(fragment);
      const labels = { month: 'за месяц', quarter: 'за квартал', half: 'за полугодие', year: 'за год' };
      dom.globalTotal.innerHTML = `Итого ${labels[state.view]}: <strong>${viewTotal.toLocaleString('ru')} ₽</strong>`;
    };

    const openMonthCfg = () => {
      const cfg = getMonthCfg(state.year, state.month);
      dom.cfgTitle.textContent = `Настройки: ${MONTHS[state.month]} ${state.year}`;
      dom.cfgRate.value = cfg.dailyRate || '';
      dom.cfgAdvance.value = cfg.advance || '';
      dom.cfgModal.classList.add('visible');
      setTimeout(() => dom.cfgRate.focus(), 100);
    };
    dom.btnMonthCfg.onclick = openMonthCfg;
    dom.cfgSave.onclick = () => {
      const cfg = { dailyRate: parseFloat(dom.cfgRate.value) || null, advance: parseFloat(dom.cfgAdvance.value) || 0 };
      saveMonthCfg(state.year, state.month, cfg);
      dom.cfgModal.classList.remove('visible');
      render();
      if (window.refreshIncomes) window.refreshIncomes();
      if (window.refreshStats) window.refreshStats();
    };
    dom.cfgCancel.onclick = () => dom.cfgModal.classList.remove('visible');
    dom.cfgModal.onclick = e => { if (e.target === dom.cfgModal) dom.cfgModal.classList.remove('visible'); };

    const renderIncomes = () => {
      dom.incomesList.innerHTML = '';
      tempIncomes.forEach((item, idx) => {
        const row = document.createElement('div'); row.className = 'income-row-modal';
        row.innerHTML = `<input type="text" placeholder="Описание" value="${item.desc || ''}" data-idx="${idx}" class="inc-desc"><input type="number" placeholder="₽" value="${item.amount || ''}" data-idx="${idx}" class="inc-amount" step="10" min="0"><button class="btn-remove" data-idx="${idx}">×</button>`;
        dom.incomesList.appendChild(row);
      });
      dom.incomesList.querySelectorAll('.inc-desc').forEach(i => i.oninput = e => tempIncomes[e.target.dataset.idx].desc = e.target.value);
      dom.incomesList.querySelectorAll('.inc-amount').forEach(i => i.oninput = e => tempIncomes[e.target.dataset.idx].amount = e.target.value);
      dom.incomesList.querySelectorAll('.btn-remove').forEach(b => b.onclick = e => { tempIncomes.splice(e.target.dataset.idx, 1); renderIncomes(); });
    };

    const openModal = (y, m, d, info) => {
      state.editing = { y, m, d };
      const dateStr = normalizeDate(`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
      dom.mTitle.textContent = `${d} ${MONTHS[m]} ${y}`;
      dom.mCoef.value = info.coef || ''; dom.mComment.value = info.comment || '';
      dom.mSick.checked = !!info.sick; dom.mOff.checked = !!info.off; dom.mEvent.checked = !!info.event;
      dom.mLocation.value = info.eventLocation || ''; dom.mDjPrice.value = '';
      
      const dayIncomes = getIncomesForDate(dateStr);
      console.log(`[CAL DEBUG] Ищем доходы на ${dateStr}. Найдено: ${dayIncomes.length}`, dayIncomes.map(i=>i.type));
      
      tempIncomes = dayIncomes.filter(i => i.type === 'extra').map(i => ({ id: i.id, desc: i.description, amount: i.amount }));
      renderIncomes();
      
      const djIncome = dayIncomes.find(i => i.type === 'dj');
      if (djIncome) {
        dom.mEvent.checked = true;
        dom.mDjPrice.value = djIncome.amount;
        dom.mLocation.value = djIncome.location || info.eventLocation || '';
      } else {
        dom.mEvent.checked = false;
        dom.mLocation.value = info.eventLocation || '';
      }
      
      dom.eventFields.classList.toggle('hidden', !dom.mEvent.checked);
      dom.modal.classList.add('visible'); setTimeout(() => dom.mCoef.focus(), 100);
    };
    dom.mEvent.onchange = () => dom.eventFields.classList.toggle('hidden', !dom.mEvent.checked);
    dom.btnAddIncome.onclick = () => { tempIncomes.push({ desc: '', amount: 0 }); renderIncomes(); };
    const closeModal = () => { dom.modal.classList.remove('visible'); state.editing = null; };
    
    const saveDay = () => {
      if (!state.editing) return;
      const { y, m, d } = state.editing;
      const dateStr = normalizeDate(`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
      const data = loadMonth(y, m);
      data[String(d)] = {
        coef: parseFloat(String(dom.mCoef.value).replace(',', '.')) || 0,
        comment: dom.mComment.value.trim(), sick: dom.mSick.checked, off: dom.mOff.checked, event: dom.mEvent.checked,
        eventLocation: dom.mLocation.value.trim()
      };
      saveMonth(y, m, data);

      const allIncomes = safeParse('budget_incomes', []);
      const filtered = allIncomes.filter(i => normalizeDate(i.date) !== dateStr);
      if (dom.mEvent.checked && dom.mDjPrice.value) {
        filtered.push({ id: genId(), date: dateStr, type: 'dj', categoryId: null, amount: parseFloat(dom.mDjPrice.value)||0, description: 'DJ сет', location: dom.mLocation.value.trim(), isArchived: false });
      }
      tempIncomes.forEach(inc => {
        if ((inc.desc && inc.desc.trim()) || parseFloat(inc.amount) > 0) {
          filtered.push({ id: inc.id || genId(), date: dateStr, type: 'extra', categoryId: null, amount: parseFloat(inc.amount)||0, description: inc.desc.trim() || 'Доп. доход', location: null, isArchived: false });
        }
      });
      localStorage.setItem('budget_incomes', JSON.stringify(filtered));

      closeModal(); render();
      if (window.refreshIncomes) window.refreshIncomes();
      if (window.refreshStats) window.refreshStats();
    };
    dom.mSave.onclick = saveDay; dom.mCancel.onclick = closeModal;
    dom.modal.onclick = e => { if (e.target === dom.modal) closeModal(); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && dom.modal.classList.contains('visible')) closeModal(); });
    dom.prev.onclick = () => { const shift = state.view === 'year' ? -12 : state.view === 'half' ? -6 : state.view === 'quarter' ? -3 : -1; state.month += shift; while (state.month < 0) { state.year--; state.month += 12; } render(); };
    dom.next.onclick = () => { const shift = state.view === 'year' ? 12 : state.view === 'half' ? 6 : state.view === 'quarter' ? 3 : 1; state.month += shift; while (state.month >= 12) { state.year++; state.month -= 12; } render(); };
    document.querySelectorAll('.nav-item').forEach(item => {
      item.onclick = e => {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const target = document.getElementById(`${item.dataset.tab}-tab`);
        if (target) target.classList.add('active');
        document.getElementById('page-subtitle').textContent = item.querySelector('.nav-label').textContent;
        if (item.dataset.tab === 'home') render();
        if (item.dataset.tab === 'incomes' && window.refreshIncomes) window.refreshIncomes();
        if (item.dataset.tab === 'stats' && window.refreshStats) window.refreshStats();
      };
    });
    window.refreshCalendar = render;
    render();
  });
})();