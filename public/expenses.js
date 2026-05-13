(function() {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    let categories=[], subcategories=[], expenses=[], debts=[];
    let catState={mode:'add',id:null}, subcatState={mode:'add',id:null,parentId:null}, debtState={mode:'add',id:null}, paymentState={mode:'pay',debtId:null}, expState={mode:'add',id:null};
    let showArchive={cat:false,debt:false,exp:false};

    const getLocalDateStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const dom={
      catList:document.getElementById('categories-list'),debtList:document.getElementById('debts-list'),historyList:document.getElementById('expenses-history'),
      btnAddCat:document.getElementById('btn-add-category'),btnAddDebt:document.getElementById('btn-add-debt'),btnOpenExp:document.getElementById('btn-open-expense-modal'),
      toggleCatArch:document.getElementById('toggle-cat-archive'),toggleDebtArch:document.getElementById('toggle-debt-archive'),toggleExpArch:document.getElementById('toggle-exp-archive'),
      catModal:document.getElementById('cat-modal-overlay'),catTitle:document.getElementById('cat-modal-title'),catName:document.getElementById('cat-name'),catLimit:document.getElementById('cat-limit'),catSave:document.getElementById('cat-btn-save'),catCancel:document.getElementById('cat-btn-cancel'),
      subcatModal:document.getElementById('subcat-modal-overlay'),subcatTitle:document.getElementById('subcat-modal-title'),subcatName:document.getElementById('subcat-name'),subcatSave:document.getElementById('subcat-btn-save'),subcatCancel:document.getElementById('subcat-btn-cancel'),
      debtModal:document.getElementById('debt-modal-overlay'),debtTitle:document.getElementById('debt-modal-title'),debtName:document.getElementById('debt-name'),debtTotal:document.getElementById('debt-total'),debtMonthly:document.getElementById('debt-monthly'),debtStartDate:document.getElementById('debt-start-date'),debtCat:document.getElementById('debt-category'),debtSub:document.getElementById('debt-subcategory'),debtSave:document.getElementById('debt-btn-save'),debtCancel:document.getElementById('debt-btn-cancel'),
      paymentModal:document.getElementById('payment-modal-overlay'),paymentTitle:document.getElementById('payment-modal-title'),paymentInfo:document.getElementById('payment-info'),paymentAmount:document.getElementById('payment-amount'),paymentDate:document.getElementById('payment-date'),paymentSave:document.getElementById('payment-btn-save'),paymentCancel:document.getElementById('payment-btn-cancel'),
      expModal:document.getElementById('expense-modal-overlay'),expTitle:document.getElementById('exp-modal-title'),expName:document.getElementById('exp-name'),expCat:document.getElementById('exp-category'),expSub:document.getElementById('exp-subcategory'),expAmount:document.getElementById('exp-amount'),expDate:document.getElementById('exp-date'),expRecurring:document.getElementById('exp-recurring'),expSave:document.getElementById('exp-btn-save'),expCancel:document.getElementById('exp-btn-cancel')
    };
    if(!dom.catList) return;

    const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const safeParse = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) || f; } catch { return f; } };
    const saveAll = () => {
      localStorage.setItem('budget_categories', JSON.stringify(categories));
      localStorage.setItem('budget_subcategories', JSON.stringify(subcategories));
      localStorage.setItem('budget_expenses', JSON.stringify(expenses));
      localStorage.setItem('budget_debts', JSON.stringify(debts));
      if(window.refreshCalendar) window.refreshCalendar();
      if(window.refreshStats) window.refreshStats();
    };
    const fmtDate = d => d ? new Date(d).toLocaleDateString('ru') : '—';
    const fmtMoney = n => (n || 0).toLocaleString('ru') + ' ₽';
    const openModal = el => el.classList.add('visible');
    const closeModal = el => el.classList.remove('visible');

    const loadData = () => {
      categories = safeParse('budget_categories', []);
      subcategories = safeParse('budget_subcategories', []);
      expenses = safeParse('budget_expenses', []);
      debts = safeParse('budget_debts', []);
    };

    const populateCats = (sel, subSel=null) => {
      sel.innerHTML = '<option value="">— Выберите —</option>';
      categories.filter(c => !c.isArchived).forEach(c => {
        const o = document.createElement('option'); o.value = c.id; o.textContent = c.name; sel.appendChild(o);
      });
      if(subSel) {
        sel.onchange = () => {
          subSel.innerHTML = '<option value="">— Не выбрана —</option>';
          const cat = categories.find(c => c.id === sel.value);
          if(cat) subcategories.filter(s => s.categoryId === cat.id).forEach(s => {
            const o = document.createElement('option'); o.value = s.id; o.textContent = s.name; subSel.appendChild(o);
          });
        };
      }
    };

    const renderCategories = () => {
      dom.catList.innerHTML = '';
      const list = categories.filter(c => showArchive.cat ? true : !c.isArchived);
      if(!list.length) { dom.catList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:12px;">Нет категорий</p>'; return; }
      list.forEach(cat => {
        const card = document.createElement('div'); card.className = 'category-card';
        if(cat.isArchived) card.style.opacity = '0.6';
        const archBtn = cat.isArchived ? `<button class="btn-icon unarch-cat" data-id="${cat.id}">↺</button>` : `<button class="btn-icon arch-cat" data-id="${cat.id}">↓</button>`;
        card.innerHTML = `<div class="cat-header"><span class="cat-name">${cat.name}</span><div class="cat-actions">${archBtn}<button class="btn-icon edit-cat" data-id="${cat.id}">✎</button><button class="btn-icon del-cat" data-id="${cat.id}">×</button></div></div><div class="cat-limit-info">Лимит: ${fmtMoney(cat.monthlyLimit||0)}</div><button class="btn btn-secondary btn-sm btn-add-sub" data-parent="${cat.id}">+ Подкатегория</button>`;
        dom.catList.appendChild(card);
      });
      dom.catList.querySelectorAll('.edit-cat').forEach(b => b.onclick = () => openCatModal('edit', b.dataset.id));
      dom.catList.querySelectorAll('.del-cat').forEach(b => b.onclick = () => deleteCat(b.dataset.id));
      dom.catList.querySelectorAll('.arch-cat').forEach(b => b.onclick = () => toggleArchiveCat(b.dataset.id, true));
      dom.catList.querySelectorAll('.unarch-cat').forEach(b => b.onclick = () => toggleArchiveCat(b.dataset.id, false));
      dom.catList.querySelectorAll('.btn-add-sub').forEach(b => b.onclick = () => openSubcatModal('add', b.dataset.parent));
    };

    const toggleArchiveCat = (id, state) => { const c = categories.find(x=>x.id===id); if(c){c.isArchived=state; saveAll(); renderCategories();} };
    const openCatModal = (mode, id=null) => {
      catState = {mode, id};
      dom.catTitle.textContent = mode==='add' ? 'Новая категория' : 'Редактировать категорию';
      dom.catName.value = mode==='edit' ? categories.find(c=>c.id===id).name : '';
      dom.catLimit.value = mode==='edit' ? (categories.find(c=>c.id===id).monthlyLimit||'') : '';
      openModal(dom.catModal); setTimeout(()=>dom.catName.focus(), 100);
    };
    dom.catSave.onclick = () => {
      const name = dom.catName.value.trim(); const limit = parseFloat(dom.catLimit.value)||0;
      if(!name) return;
      if(catState.mode==='add') categories.push({id:genId(), name, monthlyLimit:limit, isArchived:false});
      else { const c = categories.find(x=>x.id===catState.id); if(c){c.name=name; c.monthlyLimit=limit;} }
      saveAll(); renderCategories(); closeModal(dom.catModal);
    };
    dom.catCancel.onclick = () => closeModal(dom.catModal); dom.catModal.onclick = e => { if(e.target===dom.catModal) closeModal(dom.catModal); };
    dom.btnAddCat.onclick = () => openCatModal('add');
    const deleteCat = id => { categories = categories.filter(c=>c.id!==id); saveAll(); renderCategories(); renderHistory(); };

    const openSubcatModal = (mode, parentId, subId=null) => {
      subcatState = {mode, parentId, id:subId};
      dom.subcatTitle.textContent = mode==='add' ? 'Новая подкатегория' : 'Редактировать подкатегорию';
      dom.subcatName.value = mode==='edit' ? subcategories.find(s=>s.id===subId).name : '';
      openModal(dom.subcatModal); setTimeout(()=>dom.subcatName.focus(), 100);
    };
    dom.subcatSave.onclick = () => {
      const name = dom.subcatName.value.trim(); if(!name) return;
      if(subcatState.mode==='add') subcategories.push({id:genId(), categoryId:subcatState.parentId, name});
      else { const s = subcategories.find(x=>x.id===subcatState.id); if(s) s.name=name; }
      saveAll(); renderCategories(); closeModal(dom.subcatModal);
    };
    dom.subcatCancel.onclick = () => closeModal(dom.subcatModal); dom.subcatModal.onclick = e => { if(e.target===dom.subcatModal) closeModal(dom.subcatModal); };

    const renderDebts = () => {
      dom.debtList.innerHTML = '';
      const list = debts.filter(d => showArchive.debt ? true : !d.isArchived);
      if(!list.length) { dom.debtList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:12px;">Нет долгов</p>'; return; }
      list.forEach(debt => {
        const card = document.createElement('div'); card.className = 'debt-card';
        if(debt.isArchived) card.style.opacity = '0.7';
        const archBtn = debt.isArchived ? `<button class="btn-icon unarch-debt" data-id="${debt.id}">↺</button>` : `<button class="btn-icon arch-debt" data-id="${debt.id}">↓</button>`;
        card.innerHTML = `<div class="debt-header"><span class="debt-name">${debt.name}</span><div style="display:flex;gap:4px;">${archBtn}<button class="btn-icon edit-debt" data-id="${debt.id}">✎</button><button class="btn-icon del-debt" data-id="${debt.id}">×</button></div></div><div class="debt-amounts"><span>Всего: ${fmtMoney(debt.total)}</span><span style="color:var(--danger);font-weight:600;">Остаток: ${fmtMoney(debt.remaining)}</span></div><div class="debt-actions"><button class="btn-pay" data-id="${debt.id}" ${debt.remaining<=0?'disabled':''}>Внести платёж</button></div>`;
        dom.debtList.appendChild(card);
      });
      dom.debtList.querySelectorAll('.edit-debt').forEach(b => b.onclick = () => openDebtModal('edit', b.dataset.id));
      dom.debtList.querySelectorAll('.del-debt').forEach(b => b.onclick = () => deleteDebt(b.dataset.id));
      dom.debtList.querySelectorAll('.arch-debt').forEach(b => b.onclick = () => toggleArchiveDebt(b.dataset.id, true));
      dom.debtList.querySelectorAll('.unarch-debt').forEach(b => b.onclick = () => toggleArchiveDebt(b.dataset.id, false));
      dom.debtList.querySelectorAll('.btn-pay').forEach(b => b.onclick = () => openPaymentModal('pay', b.dataset.id));
    };

    const toggleArchiveDebt = (id, state) => { const d = debts.find(x=>x.id===id); if(d){d.isArchived=state; saveAll(); renderDebts();} };
    const openDebtModal = (mode, id=null) => {
      debtState = {mode, id};
      dom.debtTitle.textContent = mode==='add' ? 'Новый долг' : 'Редактировать долг';
      populateCats(dom.debtCat, dom.debtSub);
      if(mode==='edit') {
        const d = debts.find(x=>x.id===id);
        dom.debtName.value = d.name; dom.debtTotal.value = d.total; dom.debtMonthly.value = d.monthlyPayment||'';
        dom.debtStartDate.value = d.startDate||''; dom.debtCat.value = d.categoryId||'';
        dom.debtCat.dispatchEvent(new Event('change')); setTimeout(()=>{dom.debtSub.value = d.subcategoryId||'';}, 50);
      } else {
        dom.debtName.value=''; dom.debtTotal.value=''; dom.debtMonthly.value='';
        dom.debtStartDate.value = getLocalDateStr(); dom.debtCat.value=''; dom.debtSub.value='';
      }
      openModal(dom.debtModal);
    };
    dom.debtSave.onclick = () => {
      const name = dom.debtName.value.trim(); const total = parseFloat(dom.debtTotal.value)||0;
      const monthly = parseFloat(dom.debtMonthly.value)||0; const startDate = dom.debtStartDate.value;
      if(!name || total<=0) return;
      const catId = dom.debtCat.value||null; const subId = dom.debtSub.value||null;
      if(debtState.mode==='add') debts.push({id:genId(), name, total, remaining:total, monthlyPayment:monthly, startDate, categoryId:catId, subcategoryId:subId, isArchived:false, payments:[]});
      else {
        const d = debts.find(x=>x.id===debtState.id);
        if(d) { const paid = d.total - d.remaining; d.name=name; d.total=total; d.remaining=Math.max(0, total-paid); d.monthlyPayment=monthly; d.startDate=startDate; d.categoryId=catId; d.subcategoryId=subId; }
      }
      saveAll(); renderDebts(); renderHistory(); closeModal(dom.debtModal);
    };
    dom.debtCancel.onclick = () => closeModal(dom.debtModal); dom.debtModal.onclick = e => { if(e.target===dom.debtModal) closeModal(dom.debtModal); };
    dom.btnAddDebt.onclick = () => openDebtModal('add');
    const deleteDebt = id => { debts = debts.filter(d=>d.id!==id); saveAll(); renderDebts(); renderHistory(); };

    const openPaymentModal = (mode, debtId) => {
      paymentState = {mode, debtId};
      const debt = debts.find(d=>d.id===debtId); if(!debt) return;
      dom.paymentTitle.textContent = `Платёж: ${debt.name}`;
      dom.paymentInfo.textContent = `Остаток: ${fmtMoney(debt.remaining)}`;
      dom.paymentAmount.value = debt.remaining; dom.paymentAmount.max = debt.remaining;
      dom.paymentDate.value = getLocalDateStr();
      dom.paymentSave.textContent = 'Внести платёж'; dom.paymentSave.className = 'btn btn-primary';
      openModal(dom.paymentModal);
    };
    dom.paymentSave.onclick = () => {
      const debt = debts.find(d=>d.id===paymentState.debtId); if(!debt) return;
      const amount = parseFloat(dom.paymentAmount.value)||0; const date = dom.paymentDate.value;
      if(amount<=0 || amount>debt.remaining) return; if(!date) return;
      debt.remaining -= amount;
      if(!debt.payments) debt.payments=[];
      debt.payments.push({date, amount, isAuto:false});
      expenses.push({id:genId(), name:`Платёж: ${debt.name}`, categoryId:debt.categoryId, subcategoryId:debt.subcategoryId, amount, date, recurring:false, type:'debt_payment', isAuto:false, isArchived:false});
      saveAll(); renderDebts(); renderHistory(); closeModal(dom.paymentModal);
    };
    dom.paymentCancel.onclick = () => closeModal(dom.paymentModal); dom.paymentModal.onclick = e => { if(e.target===dom.paymentModal) closeModal(dom.paymentModal); };

    const renderHistory = () => {
      dom.historyList.innerHTML = '';
      const list = expenses.filter(e => showArchive.exp ? true : !e.isArchived).sort((a,b) => new Date(b.date) - new Date(a.date));
      if(!list.length) { dom.historyList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:12px;">История пуста</p>'; return; }
      list.slice(0, 60).forEach(exp => {
        const el = document.createElement('div'); el.className = 'expense-row';
        if(exp.isArchived) el.style.opacity = '0.6';
        const cat = categories.find(c=>c.id===exp.categoryId);
        const catName = cat ? cat.name : 'Без категории';
        const archBadge = exp.isArchived ? '<span class="badge badge-archived">АРХИВ</span>' : '';
        const actions = exp.isArchived ? `<button class="btn-icon unarch-exp" data-id="${exp.id}">↺</button>` : `<button class="btn-icon arch-exp" data-id="${exp.id}">↓</button><button class="btn-icon edit-exp" data-id="${exp.id}">✎</button><button class="btn-icon del-exp" data-id="${exp.id}">×</button>`;
        el.innerHTML = `<div class="exp-info"><div class="exp-name">${exp.name}</div><div class="exp-meta"><span>${fmtDate(exp.date)}</span><span>${catName}</span>${archBadge}</div></div><div style="display:flex;align-items:center;gap:8px;"><div class="exp-amount">-${fmtMoney(exp.amount)}</div>${actions}</div>`;
        dom.historyList.appendChild(el);
      });
      dom.historyList.querySelectorAll('.edit-exp').forEach(b => b.onclick = () => openExpModal('edit', b.dataset.id));
      dom.historyList.querySelectorAll('.del-exp').forEach(b => b.onclick = () => deleteExp(b.dataset.id));
      dom.historyList.querySelectorAll('.arch-exp').forEach(b => b.onclick = () => toggleArchiveExp(b.dataset.id, true));
      dom.historyList.querySelectorAll('.unarch-exp').forEach(b => b.onclick = () => toggleArchiveExp(b.dataset.id, false));
    };

    const toggleArchiveExp = (id, state) => { const e = expenses.find(x=>x.id===id); if(e){e.isArchived=state; saveAll(); renderHistory();} };
    const deleteExp = id => { expenses = expenses.filter(e=>e.id!==id); saveAll(); renderHistory(); };
    const openExpModal = (mode, id=null) => {
      expState = {mode, id};
      dom.expTitle.textContent = mode==='add' ? 'Добавить расход' : 'Редактировать расход';
      populateCats(dom.expCat, dom.expSub);
      if(mode==='edit') {
        const e = expenses.find(x=>x.id===id);
        dom.expName.value = e.name; dom.expAmount.value = e.amount; dom.expDate.value = e.date;
        dom.expRecurring.checked = !!e.recurring; dom.expCat.value = e.categoryId||'';
        dom.expCat.dispatchEvent(new Event('change')); setTimeout(()=>{dom.expSub.value = e.subcategoryId||'';}, 50);
      } else {
        dom.expName.value=''; dom.expAmount.value=''; dom.expDate.value = getLocalDateStr();
        dom.expRecurring.checked=false; dom.expCat.value=''; dom.expSub.value='';
      }
      openModal(dom.expModal);
    };
    dom.expSave.onclick = () => {
      const name = dom.expName.value.trim(); const amount = parseFloat(dom.expAmount.value)||0; const date = dom.expDate.value;
      if(!name || amount<=0 || !date) return;
      if(expState.mode==='add') expenses.push({id:genId(), name, categoryId:dom.expCat.value||null, subcategoryId:dom.expSub.value||null, amount, date, recurring:dom.expRecurring.checked, type:'expense', isAuto:false, isArchived:false});
      else { const e = expenses.find(x=>x.id===expState.id); if(e){e.name=name; e.amount=amount; e.date=date; e.recurring=dom.expRecurring.checked; e.categoryId=dom.expCat.value||null; e.subcategoryId=dom.expSub.value||null;} }
      saveAll(); renderHistory(); closeModal(dom.expModal);
    };
    dom.expCancel.onclick = () => closeModal(dom.expModal); dom.expModal.onclick = e => { if(e.target===dom.expModal) closeModal(dom.expModal); };
    dom.btnOpenExp.onclick = () => openExpModal('add');
    dom.toggleCatArch.onclick = () => { showArchive.cat=!showArchive.cat; dom.toggleCatArch.textContent=showArchive.cat?'Скрыть архив':'Показать архив'; renderCategories(); };
    dom.toggleDebtArch.onclick = () => { showArchive.debt=!showArchive.debt; dom.toggleDebtArch.textContent=showArchive.debt?'Скрыть архив':'Показать архив'; renderDebts(); };
    dom.toggleExpArch.onclick = () => { showArchive.exp=!showArchive.exp; dom.toggleExpArch.textContent=showArchive.exp?'Скрыть архив':'Показать архив'; renderHistory(); };
    loadData(); renderCategories(); renderDebts(); renderHistory();
  });
})();