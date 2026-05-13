const mysql = require('mysql2/promise');
let pool = null;

const TARGET_SCHEMA_VERSION = 2;

async function initDB(config) {
  if (pool) await pool.end();
  pool = mysql.createPool({
    host: config.host, user: config.user, password: config.pass, database: config.name,
    waitForConnections: true, connectionLimit: 5, connectTimeout: 10000, decimalNumbers: true, charset: 'utf8mb4'
  });
  
  const conn = await pool.getConnection(); 
  conn.release();
  
  await createSchema();
  await runMigrations();
  
  return pool;
}

async function createSchema() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS settings (id INT PRIMARY KEY DEFAULT 1, base_pay DECIMAL(10,2) DEFAULT 5200) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
    `INSERT IGNORE INTO settings (id, base_pay) VALUES (1, 5200);`,
    `CREATE TABLE IF NOT EXISTS calendar_entries (id INT AUTO_INCREMENT PRIMARY KEY, year INT NOT NULL, month INT NOT NULL, day INT NOT NULL, coef DECIMAL(5,2) DEFAULT 0, comment TEXT, is_sick TINYINT(1) DEFAULT 0, is_off TINYINT(1) DEFAULT 0, is_event TINYINT(1) DEFAULT 0, event_location VARCHAR(255), UNIQUE KEY unique_day (year, month, day)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
    `CREATE TABLE IF NOT EXISTS income_categories (id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, is_archived TINYINT(1) DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
    `CREATE TABLE IF NOT EXISTS incomes (id VARCHAR(36) PRIMARY KEY, date DATE NOT NULL, type ENUM('dj','extra') DEFAULT 'extra', category_id VARCHAR(36), amount DECIMAL(10,2) NOT NULL, description VARCHAR(255), location VARCHAR(255), is_archived TINYINT(1) DEFAULT 0, FOREIGN KEY (category_id) REFERENCES income_categories(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
    
    // ИСПРАВЛЕНО: таблица expense_categories
    `CREATE TABLE IF NOT EXISTS expense_categories (id VARCHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, monthly_limit DECIMAL(10,2) DEFAULT 0, is_archived TINYINT(1) DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
    `CREATE TABLE IF NOT EXISTS expense_subcategories (id VARCHAR(36) PRIMARY KEY, category_id VARCHAR(36) NOT NULL, name VARCHAR(100) NOT NULL, FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
    
    // ИСПРАВЛЕНО: ссылки в expenses ведут на expense_categories
    `CREATE TABLE IF NOT EXISTS expenses (id VARCHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, category_id VARCHAR(36), subcategory_id VARCHAR(36), amount DECIMAL(10,2) NOT NULL, date DATE NOT NULL, is_recurring TINYINT(1) DEFAULT 0, type ENUM('expense','debt_payment') DEFAULT 'expense', is_auto TINYINT(1) DEFAULT 0, debt_id VARCHAR(36), is_archived TINYINT(1) DEFAULT 0, FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL, FOREIGN KEY (subcategory_id) REFERENCES expense_subcategories(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
    
    // ИСПРАВЛЕНО: ссылки в debts ведут на expense_categories
    `CREATE TABLE IF NOT EXISTS debts (id VARCHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, total_amount DECIMAL(10,2) NOT NULL, remaining_amount DECIMAL(10,2) NOT NULL, monthly_payment DECIMAL(10,2) DEFAULT 0, start_date DATE, category_id VARCHAR(36), subcategory_id VARCHAR(36), is_archived TINYINT(1) DEFAULT 0, FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL, FOREIGN KEY (subcategory_id) REFERENCES expense_subcategories(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
    
    `CREATE TABLE IF NOT EXISTS debt_payments (id INT AUTO_INCREMENT PRIMARY KEY, debt_id VARCHAR(36) NOT NULL, date DATE NOT NULL, amount DECIMAL(10,2) NOT NULL, is_auto TINYINT(1) DEFAULT 0, FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  ];
  for (const sql of tables) await pool.execute(sql);
}

async function runMigrations() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS schema_versions (
      version INT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const [rows] = await pool.execute('SELECT MAX(version) as v FROM schema_versions');
  const currentVersion = rows[0].v || 0;

  if (currentVersion >= TARGET_SCHEMA_VERSION) return;

  console.log(`🔄 Обновление схемы БД: с ${currentVersion} до ${TARGET_SCHEMA_VERSION}...`);

  const migrations = [
    {
      version: 1,
      up: async () => { console.log('✅ Миграция v1: Базовая схема уже создана'); }
    },
    {
      version: 2,
      up: async () => {
        const safeAddColumn = async (table, column, definition) => {
          try {
            await pool.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
            console.log(`   + Добавлено: ${table}.${column}`);
          } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') throw e;
          }
        };
        await safeAddColumn('expenses', 'is_auto', 'TINYINT(1) DEFAULT 0');
        await safeAddColumn('expenses', 'debt_id', 'VARCHAR(36)');
        await safeAddColumn('expenses', 'is_archived', 'TINYINT(1) DEFAULT 0');
        await safeAddColumn('debts', 'monthly_payment', 'DECIMAL(10,2) DEFAULT 0');
        await safeAddColumn('debts', 'start_date', 'DATE');
        await safeAddColumn('debts', 'is_archived', 'TINYINT(1) DEFAULT 0');
        await safeAddColumn('debt_payments', 'is_auto', 'TINYINT(1) DEFAULT 0');
      }
    }
  ];

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await migration.up();
        await conn.execute('INSERT INTO schema_versions (version) VALUES (?)', [migration.version]);
        await conn.commit();
        console.log(`✅ Применена миграция версии ${migration.version}`);
      } catch (err) {
        await conn.rollback();
        console.error(`❌ Ошибка миграции v${migration.version}:`, err.message);
        throw err;
      } finally { conn.release(); }
    }
  }
  console.log('🎉 Схема БД актуальна.');
}

module.exports = { 
  initDB, 
  query: async (sql, params) => { 
    if (!pool) throw new Error('БД не инициализирована'); 
    const [rows] = await pool.execute(sql, params); 
    return rows; 
  } 
};