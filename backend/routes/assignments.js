const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');

const router = express.Router();

// Middleware для проверки, что пользователь - преподаватель или администратор
const requireTeacherOrAdmin = requireRole(['teacher', 'admin']);

// Получение списка заданий
router.get('/', authenticateToken, (req, res) => {
    const { group_name, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
        SELECT a.*, u.name as created_by_name 
        FROM assignments a 
        JOIN users u ON a.created_by = u.id 
        WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM assignments WHERE 1=1';
    const params = [];

    // Студенты видят только задания своей группы
    if (req.user.role === 'student') {
        query += ' AND a.group_name = ?';
        countQuery += ' AND group_name = ?';
        params.push(req.user.group_name);
    } else if (group_name) {
        // Преподаватели и администраторы могут фильтровать по группе
        query += ' AND a.group_name = ?';
        countQuery += ' AND group_name = ?';
        params.push(group_name);
    }

    query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    db.all(query, params, (err, assignments) => {
        if (err) {
            console.error('Ошибка получения заданий:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        db.get(countQuery, params.slice(0, -2), (err, count) => {
            if (err) {
                console.error('Ошибка подсчета заданий:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            res.json({
                assignments,
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

// Получение конкретного задания
router.get('/:id', authenticateToken, (req, res) => {
    const assignmentId = req.params.id;

    db.get(
        `SELECT a.*, u.name as created_by_name 
         FROM assignments a 
         JOIN users u ON a.created_by = u.id 
         WHERE a.id = ?`,
        [assignmentId],
        (err, assignment) => {
            if (err) {
                console.error('Ошибка получения задания:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (!assignment) {
                return res.status(404).json({ error: 'Задание не найдено' });
            }

            // Проверка доступа к заданию
            if (req.user.role === 'student' && assignment.group_name !== req.user.group_name) {
                return res.status(403).json({ error: 'Доступ к этому заданию запрещен' });
            }

            res.json(assignment);
        }
    );
});

// Создание задания
router.post('/', authenticateToken, requireTeacherOrAdmin, (req, res) => {
    const { title, description, max_score, deadline, group_name } = req.body;

    // Валидация входных данных
    if (!title || !group_name) {
        return res.status(400).json({ error: 'Заполните все обязательные поля' });
    }

    const maxScore = max_score || 100;
    const deadlineDate = deadline ? new Date(deadline) : null;

    if (deadlineDate && isNaN(deadlineDate.getTime())) {
        return res.status(400).json({ error: 'Недопустимый формат даты дедлайна' });
    }

    db.run(
        'INSERT INTO assignments (title, description, max_score, deadline, group_name, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [title, description, maxScore, deadlineDate, group_name, req.user.id],
        function(err) {
            if (err) {
                console.error('Ошибка создания задания:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            res.status(201).json({
                message: 'Задание успешно создано',
                assignment: {
                    id: this.lastID,
                    title,
                    description,
                    max_score: maxScore,
                    deadline: deadlineDate,
                    group_name,
                    created_by: req.user.id,
                    created_at: new Date().toISOString()
                }
            });
        }
    );
});

// Обновление задания
router.put('/:id', authenticateToken, requireTeacherOrAdmin, (req, res) => {
    const assignmentId = req.params.id;
    const { title, description, max_score, deadline, group_name } = req.body;

    // Проверка, что преподаватель может редактировать только свои задания
    if (req.user.role === 'teacher') {
        db.get('SELECT created_by FROM assignments WHERE id = ?', [assignmentId], (err, assignment) => {
            if (err) {
                console.error('Ошибка проверки владельца задания:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (!assignment) {
                return res.status(404).json({ error: 'Задание не найдено' });
            }

            if (assignment.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Нельзя редактировать чужое задание' });
            }

            updateAssignment();
        });
    } else {
        updateAssignment();
    }

    function updateAssignment() {
        const updateFields = [];
        const values = [];

        if (title) {
            updateFields.push('title = ?');
            values.push(title);
        }

        if (description) {
            updateFields.push('description = ?');
            values.push(description);
        }

        if (max_score !== undefined) {
            updateFields.push('max_score = ?');
            values.push(max_score);
        }

        if (deadline) {
            const deadlineDate = new Date(deadline);
            if (isNaN(deadlineDate.getTime())) {
                return res.status(400).json({ error: 'Недопустимый формат даты дедлайна' });
            }
            updateFields.push('deadline = ?');
            values.push(deadlineDate);
        }

        if (group_name) {
            updateFields.push('group_name = ?');
            values.push(group_name);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'Нечего обновлять' });
        }

        values.push(assignmentId);

        db.run(
            `UPDATE assignments SET ${updateFields.join(', ')} WHERE id = ?`,
            values,
            function(err) {
                if (err) {
                    console.error('Ошибка обновления задания:', err);
                    return res.status(500).json({ error: 'Ошибка сервера' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Задание не найдено' });
                }

                res.json({ message: 'Задание успешно обновлено' });
            }
        );
    }
});

// Удаление задания
router.delete('/:id', authenticateToken, requireTeacherOrAdmin, (req, res) => {
    const assignmentId = req.params.id;

    // Проверка, что преподаватель может удалять только свои задания
    if (req.user.role === 'teacher') {
        db.get('SELECT created_by FROM assignments WHERE id = ?', [assignmentId], (err, assignment) => {
            if (err) {
                console.error('Ошибка проверки владельца задания:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (!assignment) {
                return res.status(404).json({ error: 'Задание не найдено' });
            }

            if (assignment.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Нельзя удалить чужое задание' });
            }

            deleteAssignment();
        });
    } else {
        deleteAssignment();
    }

    function deleteAssignment() {
        db.run('DELETE FROM assignments WHERE id = ?', [assignmentId], function(err) {
            if (err) {
                console.error('Ошибка удаления задания:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Задание не найдено' });
            }

            res.json({ message: 'Задание успешно удалено' });
        });
    }
});

module.exports = router;