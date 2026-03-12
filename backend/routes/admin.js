const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');

const router = express.Router();

// Middleware для проверки, что пользователь - администратор
const requireAdmin = requireRole(['admin']);

// Получение списка всех пользователей
router.get('/users', authenticateToken, requireAdmin, (req, res) => {
    const { page = 1, limit = 10, role, group_name } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT id, email, role, name, group_name, created_at FROM users WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
    const params = [];

    if (role) {
        query += ' AND role = ?';
        countQuery += ' AND role = ?';
        params.push(role);
    }

    if (group_name) {
        query += ' AND group_name = ?';
        countQuery += ' AND group_name = ?';
        params.push(group_name);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    db.all(query, params, (err, users) => {
        if (err) {
            console.error('Ошибка получения пользователей:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        db.get(countQuery, params.slice(0, -2), (err, count) => {
            if (err) {
                console.error('Ошибка подсчета пользователей:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            res.json({
                users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count.total,
                    pages: Math.ceil(count.total / limit)
                }
            });
        });
    });
});

// Получение информации о конкретном пользователе
router.get('/users/:id', authenticateToken, requireAdmin, (req, res) => {
    const userId = req.params.id;

    db.get(
        'SELECT id, email, role, name, group_name, created_at, updated_at FROM users WHERE id = ?',
        [userId],
        (err, user) => {
            if (err) {
                console.error('Ошибка получения пользователя:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (!user) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }

            res.json(user);
        }
    );
});

// Создание нового пользователя
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { email, password, role, name, group_name } = req.body;

        // Валидация входных данных
        if (!email || !password || !role || !name) {
            return res.status(400).json({ error: 'Заполните все обязательные поля' });
        }

        if (!['teacher', 'student'].includes(role)) {
            return res.status(400).json({ error: 'Недопустимая роль для создания' });
        }

        if (role === 'student' && !group_name) {
            return res.status(400).json({ error: 'Для студента необходимо указать группу' });
        }

        // Проверка, существует ли пользователь
        db.get('SELECT id FROM users WHERE email = ?', [email], async (err, existingUser) => {
            if (err) {
                console.error('Ошибка проверки существования пользователя:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (existingUser) {
                return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
            }

            // Хеширование пароля
            const bcrypt = require('bcryptjs');
            const passwordHash = await bcrypt.hash(password, 10);

            // Создание пользователя
            db.run(
                'INSERT INTO users (email, password_hash, role, name, group_name) VALUES (?, ?, ?, ?, ?)',
                [email, passwordHash, role, name, role === 'student' ? group_name : null],
                function(err) {
                    if (err) {
                        console.error('Ошибка создания пользователя:', err);
                        return res.status(500).json({ error: 'Ошибка сервера' });
                    }

                    res.status(201).json({
                        message: 'Пользователь успешно создан',
                        user: {
                            id: this.lastID,
                            email,
                            role,
                            name,
                            group_name: role === 'student' ? group_name : null
                        }
                    });
                }
            );
        });

    } catch (error) {
        console.error('Ошибка создания пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление пользователя
router.put('/users/:id', authenticateToken, requireAdmin, (req, res) => {
    const userId = req.params.id;
    const { role, name, group_name } = req.body;

    // Проверка, что нельзя изменить роль на admin
    if (role === 'admin') {
        return res.status(403).json({ error: 'Нельзя создать администратора через API' });
    }

    const updateFields = [];
    const values = [];

    if (role && ['teacher', 'student'].includes(role)) {
        updateFields.push('role = ?');
        values.push(role);
    }

    if (name) {
        updateFields.push('name = ?');
        values.push(name);
    }

    if (group_name !== undefined) {
        updateFields.push('group_name = ?');
        values.push(group_name);
    }

    if (updateFields.length === 0) {
        return res.status(400).json({ error: 'Нечего обновлять' });
    }

    values.push(userId);

    db.run(
        `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        function(err) {
            if (err) {
                console.error('Ошибка обновления пользователя:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }

            res.json({ message: 'Пользователь успешно обновлен' });
        }
    );
});

// Удаление пользователя
router.delete('/users/:id', authenticateToken, requireAdmin, (req, res) => {
    const userId = req.params.id;

    // Проверка, что нельзя удалить самого себя
    if (userId == req.user.id) {
        return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }

    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
        if (err) {
            console.error('Ошибка удаления пользователя:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json({ message: 'Пользователь успешно удален' });
    });
});

// Получение статистики
router.get('/stats', authenticateToken, requireAdmin, (req, res) => {
    const stats = {};

    // Статистика по ролям
    db.all('SELECT role, COUNT(*) as count FROM users GROUP BY role', (err, roleStats) => {
        if (err) {
            console.error('Ошибка получения статистики по ролям:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        stats.byRole = roleStats;

        // Статистика по группам
        db.all('SELECT group_name, COUNT(*) as count FROM users WHERE role = "student" GROUP BY group_name', (err, groupStats) => {
            if (err) {
                console.error('Ошибка получения статистики по группам:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            stats.byGroup = groupStats;

            // Общее количество пользователей
            db.get('SELECT COUNT(*) as total FROM users', (err, total) => {
                if (err) {
                    console.error('Ошибка получения общего количества пользователей:', err);
                    return res.status(500).json({ error: 'Ошибка сервера' });
                }

                stats.total = total.total;
                res.json(stats);
            });
        });
    });
});

module.exports = router;