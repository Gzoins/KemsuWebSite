const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './database/kemgu.db';

// Создаем папку для базы данных, если её нет
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Создаем папку для загрузок
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err.message);
        process.exit(1);
    }
    console.log('Подключено к SQLite базе данных');
});

// Читаем SQL схему
const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

// Выполняем миграцию
db.serialize(() => {
    db.run(schemaSQL, (err) => {
        if (err) {
            console.error('Ошибка выполнения миграции:', err.message);
            process.exit(1);
        }
        console.log('Миграция выполнена успешно');
    });

    // Проверяем, есть ли уже администратор
    db.get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'", (err, row) => {
        if (err) {
            console.error('Ошибка проверки администратора:', err.message);
            return;
        }

        if (row.count === 0) {
            // Создаем администратора по умолчанию
            const bcrypt = require('bcryptjs');
            const adminPassword = 'admin123';
            const hashedPassword = bcrypt.hashSync(adminPassword, 10);

            const adminData = {
                email: 'admin@example.com',
                password_hash: hashedPassword,
                role: 'admin',
                name: 'Администратор Системы',
                group_name: null,
                is_verified: 1
            };

            db.run(
                "INSERT INTO users (email, password_hash, role, name, group_name, is_verified) VALUES (?, ?, ?, ?, ?, ?)",
                [adminData.email, adminData.password_hash, adminData.role, adminData.name, adminData.group_name, adminData.is_verified],
                function(err) {
                    if (err) {
                        console.error('Ошибка создания администратора:', err.message);
                        return;
                    }
                    console.log(`👑 Администратор создан: ${adminData.email} / ${adminPassword}`);
                }
            );

            // Создаем тестового преподавателя
            const teacherPassword = 'teacher123';
            const hashedTeacherPassword = bcrypt.hashSync(teacherPassword, 10);

            const teacherData = {
                email: 'teacher@example.com',
                password_hash: hashedTeacherPassword,
                role: 'teacher',
                name: 'Преподаватель Иван',
                group_name: null,
                is_verified: 1
            };

            db.run(
                "INSERT INTO users (email, password_hash, role, name, group_name, is_verified) VALUES (?, ?, ?, ?, ?, ?)",
                [teacherData.email, teacherData.password_hash, teacherData.role, teacherData.name, teacherData.group_name, teacherData.is_verified],
                function(err) {
                    if (err) {
                        console.error('Ошибка создания преподавателя:', err.message);
                        return;
                    }
                    console.log(`🎓 Преподаватель создан: ${teacherData.email} / ${teacherPassword}`);
                }
            );

            // Создаем тестового студента
            const studentPassword = 'student123';
            const hashedStudentPassword = bcrypt.hashSync(studentPassword, 10);

            const studentData = {
                email: 'student@example.com',
                password_hash: hashedStudentPassword,
                role: 'student',
                name: 'Студент',
                group_name: 'ПМИ-251',
                is_verified: 1
            };

            db.run(
                "INSERT INTO users (email, password_hash, role, name, group_name, is_verified) VALUES (?, ?, ?, ?, ?, ?)",
                [studentData.email, studentData.password_hash, studentData.role, studentData.name, studentData.group_name, studentData.is_verified],
                function(err) {
                    if (err) {
                        console.error('Ошибка создания студента:', err.message);
                        return;
                    }
                    console.log(`👤 Студент создан: ${studentData.email} / ${studentPassword}`);
                }
            );
        } else {
            console.log('✅ Тестовые пользователи уже существуют в базе данных');
        }
    });
});

// Закрываем базу данных после всех операций
setTimeout(() => {
    db.close((err) => {
        if (err) {
            console.error('Ошибка закрытия базы данных:', err.message);
            process.exit(1);
        }
        console.log('База данных закрыта');
    });
}, 2000);
