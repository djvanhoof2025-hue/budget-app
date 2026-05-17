(function() {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    const dom = {
      monthSel: document.getElementById('stats-month'), yearSel: document.getElementById('stats-year'),
      income: document.getElementById('stat-income'), expense: document.getElementById('stat-expense'),
      balance: document.getElementById('stat-balance'), overspend: document.getElementById('stat-overspend'),
      limitsList: document.getElementById('limits-list'), alertsList: document.getElementById('alerts-list')
    };
    if (!dom.monthSel) return;

    const safeParse = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) || f; } catch { return f; } };
    const fmtMoney = n => (n || 0).toLocaleString('ru') + ' ₽';
    const parseLocalDate = (dateStr) => {
      if (!dateStr) return null;
      const parts = dateStr.split('-').map(Number);
      if (parts.length !== 3) return null;
      return { year: parts[0], month: parts[1] - 1, day: parts[2] };
    };
    const now = new Date();
    MONTHS.forEach((m, i) => { const opt = document.createElement('option'); opt.value = i; opt.textContent = m; dom.monthSel.appendChild(opt); });
    dom.monthSel.value = now.getMonth();
    for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) { const opt = document.createElement('option'); opt.value = y; opt.textContent = y; dom.yearSel.appendChild(opt); }
    dom.yearSel.value = now.getFullYear();

    const getPrevMonth = (y, m) => { let pm = m - 1, py = y; if (pm < 0) { pm = 11; py--; } return { y: py, m: pm }; };
    const getRate = (y, m) => {
      const cfg = safeParse(`budget_month_cfg_${y}_${m}`, { dailyRate: null, advance: 0 });
      return Number(cfg.dailyRate) || Number(safeParse('budget_settings', { basePay: 5200 }).basePay) || 5200;
    };
    const calcEarned = (y, m) => {
      const data = safeParse(`budget_app_${y}_${m}`, {});
      const rate = getRate(y, m);
      let total = 0;
      for (const info of Object.values(data)) {
        const coef = Number(info.coef) || 0;
        if (!info.sick && !info.off && coef > 0) total += coef * rate;
      }
      return total;
    };

    const calculate = () => {
      const selMonth = parseInt(dom.monthSel.value); const selYear = parseInt(dom.yearSel.value);
      
      // Кассовый доход: Аванс текущего + Остаток прошлого
      const cfgCurr = safeParse(`budget_month_cfg_${selYear}_${selMonth}`, { dailyRate: null, advance: 0 });
      const advanceCurr = Number(cfgCurr.advance) || 0;
      
      const { y: py, m: pm } = getPrevMonth(selYear, selMonth);
      const earnedPrev = calcEarned(py, pm);
      const cfgPrev = safeParse(`budget_month_cfg_${py}_${pm}`, { dailyRate: null, advance: 0 });
      const advancePrev = Number(cfgPrev.advance) || 0;
      const remainderPrev = Math.max(0, earnedPrev - advancePrev);
      
      const salaryCash = advanceCurr + remainderPrev;

      // Прочие доходы (локальная фильтрация по дате)
      const allIncomes = safeParse('budget_incomes', []);
      const monthIncomes = allIncomes.filter(i => {
        if (i.isArchived) return false;
        const parsed = parseLocalDate(i.date);
        return parsed && parsed.year === selYear && parsed.month === selMonth;
      });
      const extraIncome = monthIncomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);
      
      const totalIncome = salaryCash + extraIncome;

      // Расходы (локальная фильтрация)
      const allExp = safeParse('budget_expenses', []);
      const monthExp = allExp.filter(e => {
        if (e.isArchived) return false;
        const parsed = parseLocalDate(e.date);
        return parsed && parsed.year === selYear && parsed.month === selMonth;
      });
      const totalExpense = monthExp.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const balance = totalIncome - totalExpense; const overspend = balance < 0 ? Math.abs(balance) : 0;

      dom.income.textContent = fmtMoney(totalIncome); dom.expense.textContent = fmtMoney(totalExpense);
      dom.balance.textContent = fmtMoney(balance); dom.balance.style.color = balance >= 0 ? 'var(--success)' : 'var(--danger)';
      dom.overspend.textContent = fmtMoney(overspend);

      const categories = safeParse('budget_categories', []); dom.limitsList.innerHTML = ''; const alerts = [];
      const activeCats = categories.filter(c => !c.isArchived);
      if (!activeCats.length) { dom.limitsList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:12px;">Нет активных категорий</p>'; }
      else {
        activeCats.forEach(cat => {
          const limit = Number(cat.monthlyLimit) || 0;
          const spent = monthExp.filter(e => e.categoryId === cat.id).reduce((s, e) => s + (Number(e.amount) || 0), 0);
          const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
          const isOver = limit > 0 && spent > limit;
          const barClass = pct < 70 ? 'safe' : pct < 100 ? 'warn' : 'danger';
          const row = document.createElement('div'); row.className = 'limit-row';
          row.innerHTML = `<div class="limit-header"><span>${cat.name}</span><span>${limit > 0 ? fmtMoney(limit) : 'Без лимита'}</span></div><div class="limit-bar-bg"><div class="limit-bar ${barClass}" style="width:${pct}%"></div></div><div class="limit-meta"><span>Потрачено: ${fmtMoney(spent)}</span><span>${limit > 0 ? (isOver ? `Перерасход: ${fmtMoney(spent - limit)}` : `Остаток: ${fmtMoney(limit - spent)}`) : ''}</span></div>`;
          dom.limitsList.appendChild(row);
          if (isOver) alerts.push({ type: 'danger', text: `Превышен лимит по категории "${cat.name}" на ${fmtMoney(spent - limit)}` });
          else if (limit > 0 && pct >= 80) alerts.push({ type: 'warn', text: `Категория "${cat.name}" близка к лимиту (${Math.round(pct)}%)` });
        });
      }
      if (overspend > 0) alerts.unshift({ type: 'danger', text: `Общий перерасход бюджета за месяц: ${fmtMoney(overspend)}` });
      if (totalIncome === 0 && totalExpense === 0) alerts.push({ type: 'info', text: `Нет данных за выбранный месяц.` });
      if (balance > 0 && totalExpense > 0) alerts.push({ type: 'info', text: `Бюджет в плюсе. Свободные средства: ${fmtMoney(balance)}` });
      dom.alertsList.innerHTML = '';
      if (!alerts.length) { dom.alertsList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:12px;">Всё в порядке</p>'; }
      else { alerts.forEach(a => { const el = document.createElement('div'); el.className = `alert-item ${a.type}`; el.textContent = a.text; dom.alertsList.appendChild(el); }); }
    };
    dom.monthSel.onchange = calculate; dom.yearSel.onchange = calculate; window.refreshStats = calculate; calculate();
  });
})();