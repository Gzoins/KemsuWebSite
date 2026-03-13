const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');

const router = express.Router();

// Middleware для проверки, что пользователь - преподаватель или администратор
const requireTeacherOrAdmin = requireRole(['teacher', 'admin']);

// Получение списка заданий
router.get('/', authenticateToken, async (req, res) => {
    console.log('[ASSIGNMENTS] Request user:', req.user);
    
    try {
        // Проверяем что пользователь существует
        const user = await db.get('SELECT id FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            console.error('[ASSIGNMENTS] User not found:', req.user.id);
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        
        console.log('[ASSIGNMENTS] User exists, proceeding...');
        
        const { group_name, created_by, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT a.*, u.name as created_by_name 
            FROM assignments a 
            JOIN users u ON a.created_by = u.id 
            WHERE 1=1
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM assignments WHERE 1=1';
        const params = [];

        // Фильтрация по создателю задания (если преподаватель смотрит свои задания)
        if (created_by) {
            query += ' AND a.created_by = ?';
            countQuery += ' AND created_by = ?';
            params.push(created_by);
        }

        // Студенты видят только задания своей группы
        if (req.user.role === 'student') {
            query += ' AND a.group_name = ?';
            countQuery += ' AND group_name = ?';
            params.push(req.user.group_name);
        } else if (group_name && !created_by) {
            // Преподаватели и администраторы могут фильтровать по группе (если не фильтр по created_by)
            query += ' AND a.group_name = ?';
            countQuery += ' AND group_name = ?';
            params.push(group_name);
        }

        query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        console.log('[ASSIGNMENTS] Query:', query);
        console.log('[ASSIGNMENTS] Params:', params);

        // Проверяем что база данных доступна
        console.log('[ASSIGNMENTS] About to execute query...');
        
        // Выполняем основной запрос
        const assignments = await db.all(query, params);
        console.log('[ASSIGNMENTS] Found assignments:', assignments ? assignments.length : 'NULL');
        console.log('[ASSIGNMENTS] Assignments:', JSON.stringify(assignments, null, 2));
        
        // Выполняем запрос подсчета
        const countParams = params.slice(0, -2);
        console.log('[ASSIGNMENTS] Count params:', countParams);
        const count = await db.get(countQuery, countParams);
        
        console.log('[ASSIGNMENTS] Total count:', count.total);
        console.log('[ASSIGNMENTS] Sending response...');

        res.json({
            assignments: assignments || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count.total,
                pages: Math.ceil(count.total / limit)
            }
        });
        
        console.log('[ASSIGNMENTS] Response sent successfully');
    } catch (error) {
        console.error('[ASSIGNMENTS] Error:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Получение конкретного задания
router.get('/:id', authenticateToken, async (req, res) => {
    const assignmentId = req.params.id;

    try {
        const assignment = await db.get(
            `SELECT a.*, u.name as created_by_name 
             FROM assignments a 
             JOIN users u ON a.created_by = u.id 
             WHERE a.id = ?`,
            [assignmentId]
        );
        
        if (!assignment) {
            return res.status(404).json({ error: 'Задание не найдено' });
        }

        // Проверка доступа к заданию
        if (req.user.role === 'student' && assignment.group_name !== req.user.group_name) {
            return res.status(403).json({ error: 'Доступ к этому заданию запрещён' });
        }

        res.json(assignment);
    } catch (error) {
        console.error('Ошибка получения задания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание задания
router.post('/', authenticateToken, requireTeacherOrAdmin, async (req, res) => {
    console.log('[ASSIGNMENTS CREATE] Request received from user:', req.user);
    const { title, description, max_score, deadline, group_name } = req.body;
    
    console.log('[ASSIGNMENTS CREATE] Request body:', JSON.stringify(req.body, null, 2));

    try {
        // Валидация входных данных
        if (!title || !group_name) {
            console.log('[ASSIGNMENTS CREATE] Validation failed - missing required fields');
            return res.status(400).json({ error: 'Заполните все обязательные поля' });
        }

        const maxScore = max_score || 100;
        const deadlineDate = deadline ? new Date(deadline) : null;

        if (deadlineDate && isNaN(deadlineDate.getTime())) {
            console.log('[ASSIGNMENTS CREATE] Invalid deadline date');
            return res.status(400).json({ error: 'Недопустимый формат даты дедлайна' });
        }

        console.log('[ASSIGNMENTS CREATE] Inserting into database...');
        
        const result = await db.run(
            'INSERT INTO assignments (title, description, max_score, deadline, group_name, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [title, description, maxScore, deadlineDate, group_name, req.user.id]
        );
        
        console.log('[ASSIGNMENTS CREATE] Assignment created with ID:', result.lastID);

        res.status(201).json({
            message: 'Задание успешно создано',
            assignment: {
                id: result.lastID,
                title,
                description,
                max_score: maxScore,
                deadline: deadlineDate,
                group_name,
                created_by: req.user.id,
                created_at: new Date().toISOString()
            }
        });
        console.log('[ASSIGNMENTS CREATE] Response sent');
    } catch (error) {
        console.error('[ASSIGNMENTS CREATE] Database error:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Обновление задания
router.put('/:id', authenticateToken, requireTeacherOrAdmin, async (req, res) => {
    const assignmentId = req.params.id;
    const { title, description, max_score, deadline, group_name } = req.body;

    try {
        // Проверка, что преподаватель может редактировать только свои задания
        if (req.user.role === 'teacher') {
            const assignment = await db.get('SELECT created_by FROM assignments WHERE id = ?', [assignmentId]);
            
            if (!assignment) {
                return res.status(404).json({ error: 'Задание не найдено' });
            }

            if (assignment.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Нельзя редактировать чужое задание' });
            }
        }

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

        const result = await db.run(
            `UPDATE assignments SET ${updateFields.join(', ')} WHERE id = ?`,
            values
        );
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Задание не найдено' });
        }

        res.json({ message: 'Задание успешно обновлено' });
    } catch (error) {
        console.error('Ошибка обновления задания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удаление задания
router.delete('/:id', authenticateToken, requireTeacherOrAdmin, async (req, res) => {
    const assignmentId = req.params.id;

    try {
        // Проверка, что преподаватель может удалять только свои задания
        if (req.user.role === 'teacher') {
            const assignment = await db.get('SELECT created_by FROM assignments WHERE id = ?', [assignmentId]);
            
            if (!assignment) {
                return res.status(404).json({ error: 'Задание не найдено' });
            }

            if (assignment.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Нельзя удалить чужое задание' });
            }
        }

        const result = await db.run('DELETE FROM assignments WHERE id = ?', [assignmentId]);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Задание не найдено' });
        }

        res.json({ message: 'Задание успешно удалено' });
    } catch (error) {
        console.error('Ошибка удаления задания:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;