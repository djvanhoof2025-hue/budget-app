const express = require('express');
const path = require('path');
const { initDB } = require('./db');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.post('/api/db-test', async (req, res) => {
  try { await initDB(req.body); res.json({ success: true, message: 'Подключение успешно' }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sync', async (req, res) => {
  try {
    const { config, data } = req.body;
    if (!config?.host || !config?.name) return res.status(400).json({ error: 'Нет конфигурации БД' });
    const pool = await initDB(config);
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
      // 1. Настройки
      await conn.execute('UPDATE settings SET base_pay=? WHERE id=1', [data.settings?.basePay || 5200]);

      // 2. Категории доходов
      for (const cat of data.incomeCategories || []) {
        await conn.execute('INSERT INTO income_categories (id, name, is_archived) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), is_archived=VALUES(is_archived)', [cat.id, cat.name, cat.isArchived ? 1 : 0]);
      }
      
      // 3. Доходы
      for (const inc of data.incomes || []) {
        await conn.execute('INSERT INTO incomes (id, date, type, category_id, amount, description, location, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE date=VALUES(date), type=VALUES(type), category_id=VALUES(category_id), amount=VALUES(amount), description=VALUES(description), location=VALUES(location), is_archived=VALUES(is_archived)', [inc.id, inc.date, inc.type, inc.categoryId || null, inc.amount, inc.description || '', inc.location || null, inc.isArchived ? 1 : 0]);
      }

      // 4. Категории и подкатегории расходов
      // Собираем валидные ID подкатегорий для безопасной проверки ниже
      const validSubcatIds = new Set();
      for (const cat of data.categories || []) {
        await conn.execute('INSERT INTO expense_categories (id, name, monthly_limit, is_archived) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), monthly_limit=VALUES(monthly_limit), is_archived=VALUES(is_archived)', [cat.id, cat.name, cat.monthlyLimit || 0, cat.isArchived ? 1 : 0]);
        for (const sub of cat.subcategories || []) {
          validSubcatIds.add(sub.id);
          await conn.execute('INSERT INTO expense_subcategories (id, category_id, name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)', [sub.id, cat.id, sub.name]);
        }
      }

      // 5. Расходы (с защитой от Foreign Key ошибок)
      for (const exp of data.expenses || []) {
        // Если подкатегория отсутствует в пакете, ставим NULL (безопасно для FK)
        const safeSubId = (exp.subcategoryId && validSubcatIds.has(exp.subcategoryId)) ? exp.subcategoryId : null;
        
        await conn.execute('INSERT INTO expenses (id, name, category_id, subcategory_id, amount, date, is_recurring, type, is_auto, debt_id, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), category_id=VALUES(category_id), subcategory_id=VALUES(subcategory_id), amount=VALUES(amount), date=VALUES(date), is_recurring=VALUES(is_recurring), type=VALUES(type), is_auto=VALUES(is_auto), debt_id=VALUES(debt_id), is_archived=VALUES(is_archived)', 
        [exp.id, exp.name, exp.categoryId || null, safeSubId, exp.amount, exp.date, exp.recurring ? 1 : 0, exp.type || 'expense', exp.isAuto ? 1 : 0, exp.debtId || null, exp.isArchived ? 1 : 0]);
      }

      // 6. Долги
      for (const debt of data.debts || []) {
        await conn.execute('INSERT INTO debts (id, name, total_amount, remaining_amount, monthly_payment, start_date, category_id, subcategory_id, is_archived) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), total_amount=VALUES(total_amount), remaining_amount=VALUES(remaining_amount), monthly_payment=VALUES(monthly_payment), start_date=VALUES(start_date), category_id=VALUES(category_id), subcategory_id=VALUES(subcategory_id), is_archived=VALUES(is_archived)', 
        [debt.id, debt.name, debt.total, debt.remaining, debt.monthlyPayment || 0, debt.startDate || null, debt.categoryId || null, debt.subcategoryId || null, debt.isArchived ? 1 : 0]);
        for (const p of debt.payments || []) {
          await conn.execute('INSERT IGNORE INTO debt_payments (debt_id, date, amount, is_auto) VALUES (?, ?, ?, ?)', [debt.id, p.date, p.amount, p.isAuto ? 1 : 0]);
        }
      }

      // 7. Календарь
      for (const [key, days] of Object.entries(data.calendar || {})) {
        const match = key.match(/budget_app_(\d+)_(\d+)/);
        if (!match) continue;
        const year = parseInt(match[1]); const monthJS = parseInt(match[2]); const dbMonth = monthJS + 1;
        for (const [dayStr, info] of Object.entries(days)) {
          const day = parseInt(dayStr);
          await conn.execute(`INSERT INTO calendar_entries (year, month, day, coef, comment, is_sick, is_off, is_event, event_location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE coef=VALUES(coef), comment=VALUES(comment), is_sick=VALUES(is_sick), is_off=VALUES(is_off), is_event=VALUES(is_event), event_location=VALUES(event_location)`, [year, dbMonth, day, info.coef || 0, info.comment || '', info.sick ? 1 : 0, info.off ? 1 : 0, info.event ? 1 : 0, info.eventLocation || null]);
        }
      }
      await conn.commit();
      res.json({ success: true, message: 'Синхронизация завершена' });
    } catch (err) { await conn.rollback(); throw err; } finally { conn.release(); }
  } catch (err) { console.error('Sync error:', err); res.status(500).json({ error: err.message }); }
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Сервер запущен: http://127.0.0.1:${PORT}`);
  console.log(`💡 Остановка: Ctrl + C`);
});
process.on('SIGINT', () => { console.log('\n🛑 Остановка сервера...'); server.close(() => process.exit(0)); });