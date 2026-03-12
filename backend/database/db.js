const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Путь к базе данных относительно корня проекта
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'kemgu.db');

// Создаем папку для базы данных, если её нет
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Создаем соединение с базой данных
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err.message);
        process.exit(1);
    }
    console.log('Подключено к SQLite базе данных');
    
    // Проверяем существование таблицы users ПЕРЕД serialize()
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
        if (err) {
            console.error('Ошибка проверки таблиц:', err.message);
            return;
        }
        
        if (!row) {
            console.log('⚠️  Таблица users не найдена. Автоматическая инициализация...');
            initializeDatabase();
        } else {
            console.log('✅ База данных инициализирована корректно');
        }
    });
});

// Функция автоматической инициализации базы данных
function initializeDatabase() {
    const fs = require('fs');
    const schemaPath = path.join(__dirname, 'schema.sql');
    
    if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        db.exec(schema, (err) => {
            if (err) {
                console.error('❌ Ошибка создания таблиц:', err.message);
            } else {
                console.log('✅ Таблицы успешно созданы');
                createDefaultUsers();
            }
        });
    } else {
        console.error('❌ Файл schema.sql не найден');
    }
}

// Создание пользователей по умолчанию
function createDefaultUsers() {
    const bcrypt = require('bcryptjs');
    
    const defaultUsers = [
        {
            email: 'admin@example.com',
            password: 'admin123',
            role: 'admin',
            name: 'Администратор',
            group_name: null
        },
        {
            email: 'student@example.com',
            password: 'student123',
            role: 'student',
            name: 'Студент Тестовый',
            group_name: 'ПМИ-251'
        },
        {
            email: 'teacher@example.com',
            password: 'teacher123',
            role: 'teacher',
            name: 'Преподаватель Тестовый',
            group_name: null
        }
    ];
    
    let created = 0;
    
    defaultUsers.forEach(async (user) => {
        try {
            const passwordHash = await bcrypt.hash(user.password, 10);
            
            db.run(
                `INSERT OR IGNORE INTO users (email, password_hash, role, name, group_name, is_verified) 
                 VALUES (?, ?, ?, ?, ?, 1)`,
                [user.email, passwordHash, user.role, user.name, user.group_name],
                function(err) {
                    if (err) {
                        console.error(`❌ Ошибка создания пользователя ${user.email}:`, err.message);
                    } else {
                        if (this.changes > 0) {
                            console.log(`✅ Пользователь создан: ${user.email}`);
                        }
                        created++;
                        if (created === defaultUsers.length) {
                            console.log('✅ Все пользователи по умолчанию созданы');
                        }
                    }
                }
            );
        } catch (error) {
            console.error(`❌ Ошибка хеширования пароля для ${user.email}:`, error.message);
        }
    });
}

// Настройка базы данных (без serialize чтобы не блокировать запросы)
db.run("PRAGMA foreign_keys = ON", (err) => {
    if (err) console.error('Error enabling foreign keys:', err);
});
db.run("PRAGMA journal_mode = WAL", (err) => {
    if (err) console.error('Error setting WAL mode:', err);
});
db.run("PRAGMA cache_size = 10000", (err) => {
    if (err) console.error('Error setting cache size:', err);
});

// Промисифицированные методы для удобства
const dbPromise = {
  db: db, // Сохраняем ссылку на оригинальную БД
  
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  },

  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  },

  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  },

  close: () => {
    return new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
};

// Дополнительные функции для работы с пользователями
dbPromise.getUserByEmail = async function(email) {
  const sql = 'SELECT * FROM users WHERE email = ?';
  return await this.get(sql, [email]);
};

dbPromise.getUserById = async function(id) {
  const sql = 'SELECT * FROM users WHERE id = ?';
  return await this.get(sql, [id]);
};

dbPromise.createUser = async function(userData) {
  const sql = `
    INSERT INTO users (email, password_hash, role, name, group_name, is_verified)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const result = await this.run(sql, [
    userData.email,
    userData.password_hash,
    userData.role,
    userData.name,
    userData.group_name || null,
    userData.is_verified || 0
  ]);
  return result.lastID;
};

dbPromise.updateUser = async function(id, userData) {
  const fields = [];
  const values = [];
  
  if (userData.name) {
    fields.push('name = ?');
    values.push(userData.name);
  }
  
  if (userData.email) {
    fields.push('email = ?');
    values.push(userData.email);
  }
  
  if (userData.group_name !== undefined) {
    fields.push('group_name = ?');
    values.push(userData.group_name);
  }
  
  if (fields.length === 0) {
    throw new Error('Нет данных для обновления');
  }
  
  values.push(id);
  
  const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  await this.run(sql, values);
  
  return await this.getUserById(id);
};

dbPromise.updateUserPassword = async function(id, passwordHash) {
  const sql = 'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  await this.run(sql, [passwordHash, id]);
};

// Функции для email подтверждения
dbPromise.createEmailVerification = async function(userId, token, expiresAt) {
  const sql = 'INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)';
  await this.run(sql, [userId, token, expiresAt]);
};

dbPromise.getEmailVerificationByToken = async function(token) {
  const sql = 'SELECT * FROM email_verifications WHERE token = ?';
  return await this.get(sql, [token]);
};

dbPromise.verifyUserEmail = async function(userId) {
  const sql = 'UPDATE users SET is_verified = 1, email_verified_at = CURRENT_TIMESTAMP WHERE id = ?';
  await this.run(sql, [userId]);
};

dbPromise.deleteEmailVerification = async function(id) {
  const sql = 'DELETE FROM email_verifications WHERE id = ?';
  await this.run(sql, [id]);
};

dbPromise.getRecentEmailVerification = async function(userId) {
  const sql = `
    SELECT * FROM email_verifications 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `;
  return await this.get(sql, [userId]);
};

// Функции для учебных материалов
dbPromise.createResource = async function(resourceData) {
  const sql = `
    INSERT INTO resources (title, description, file_path, file_name, file_type, group_name, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const result = await this.run(sql, [
    resourceData.title,
    resourceData.description || null,
    resourceData.file_path,
    resourceData.file_name,
    resourceData.file_type,
    resourceData.group_name,
    resourceData.created_by
  ]);
  return result.lastID;
};

dbPromise.getResourcesByGroup = async function(groupName) {
  const sql = 'SELECT * FROM resources WHERE group_name = ? ORDER BY created_at DESC';
  return await this.all(sql, [groupName]);
};

dbPromise.getResourceById = async function(id) {
  const sql = 'SELECT * FROM resources WHERE id = ?';
  return await this.get(sql, [id]);
};

dbPromise.deleteResource = async function(id) {
  const sql = 'DELETE FROM resources WHERE id = ?';
  await this.run(sql, [id]);
};

module.exports = dbPromise;