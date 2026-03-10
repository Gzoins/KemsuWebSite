const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');

const router = express.Router();

// Middleware для проверки, что пользователь - преподаватель или администратор
const requireTeacherOrAdmin = requireRole(['teacher', 'admin']);

// Получение списка лекций
router.get('/', authenticateToken, (req, res) => {
    const { group_name, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
        SELECT l.*, u.name as created_by_name 
        FROM lectures l 
        JOIN users u ON l.created_by = u.id 
        WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM lectures WHERE 1=1';
    const params = [];

    // Студенты видят только лекции своей группы
    if (req.user.role === 'student') {
        query += ' AND l.group_name = ?';
        countQuery += ' AND group_name = ?';
        params.push(req.user.group_name);
    } else if (group_name) {
        // Преподаватели и администраторы могут фильтровать по группе
        query += ' AND l.group_name = ?';
        countQuery += ' AND group_name = ?';
        params.push(group_name);
    }

    query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    db.all(query, params, (err, lectures) => {
        if (err) {
            console.error('Ошибка получения лекций:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        db.get(countQuery, params.slice(0, -2), (err, count) => {
            if (err) {
                console.error('Ошибка подсчета лекций:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            res.json({
                lectures,
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

// Получение конкретной лекции
router.get('/:id', authenticateToken, (req, res) => {
    const lectureId = req.params.id;

    db.get(
        `SELECT l.*, u.name as created_by_name 
         FROM lectures l 
         JOIN users u ON l.created_by = u.id 
         WHERE l.id = ?`,
        [lectureId],
        (err, lecture) => {
            if (err) {
                console.error('Ошибка получения лекции:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (!lecture) {
                return res.status(404).json({ error: 'Лекция не найдена' });
            }

            // Проверка доступа к лекции
            if (req.user.role === 'student' && lecture.group_name !== req.user.group_name) {
                return res.status(403).json({ error: 'Доступ к этой лекции запрещен' });
            }

            res.json(lecture);
        }
    );
});

// Создание лекции
router.post('/', authenticateToken, requireTeacherOrAdmin, (req, res) => {
    const { title, description, video_url, materials, group_name } = req.body;

    // Валидация входных данных
    if (!title || !video_url || !group_name) {
        return res.status(400).json({ error: 'Заполните все обязательные поля' });
    }

    // Проверка формата URL видео
    if (!isValidVideoUrl(video_url)) {
        return res.status(400).json({ error: 'Недопустимый формат URL видео' });
    }

    const materialsJson = materials ? JSON.stringify(materials) : null;

    db.run(
        'INSERT INTO lectures (title, description, video_url, materials, group_name, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [title, description, video_url, materialsJson, group_name, req.user.id],
        function(err) {
            if (err) {
                console.error('Ошибка создания лекции:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            res.status(201).json({
                message: 'Лекция успешно создана',
                lecture: {
                    id: this.lastID,
                    title,
                    description,
                    video_url,
                    materials,
                    group_name,
                    created_by: req.user.id,
                    created_at: new Date().toISOString()
                }
            });
        }
    );
});

// Обновление лекции
router.put('/:id', authenticateToken, requireTeacherOrAdmin, (req, res) => {
    const lectureId = req.params.id;
    const { title, description, video_url, materials, group_name } = req.body;

    // Проверка, что преподаватель может редактировать только свои лекции
    if (req.user.role === 'teacher') {
        db.get('SELECT created_by FROM lectures WHERE id = ?', [lectureId], (err, lecture) => {
            if (err) {
                console.error('Ошибка проверки владельца лекции:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (!lecture) {
                return res.status(404).json({ error: 'Лекция не найдена' });
            }

            if (lecture.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Нельзя редактировать чужую лекцию' });
            }

            updateLecture();
        });
    } else {
        updateLecture();
    }

    function updateLecture() {
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

        if (video_url) {
            if (!isValidVideoUrl(video_url)) {
                return res.status(400).json({ error: 'Недопустимый формат URL видео' });
            }
            updateFields.push('video_url = ?');
            values.push(video_url);
        }

        if (materials !== undefined) {
            const materialsJson = materials ? JSON.stringify(materials) : null;
            updateFields.push('materials = ?');
            values.push(materialsJson);
        }

        if (group_name) {
            updateFields.push('group_name = ?');
            values.push(group_name);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'Нечего обновлять' });
        }

        values.push(lectureId);

        db.run(
            `UPDATE lectures SET ${updateFields.join(', ')} WHERE id = ?`,
            values,
            function(err) {
                if (err) {
                    console.error('Ошибка обновления лекции:', err);
                    return res.status(500).json({ error: 'Ошибка сервера' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Лекция не найдена' });
                }

                res.json({ message: 'Лекция успешно обновлена' });
            }
        );
    }
});

// Удаление лекции
router.delete('/:id', authenticateToken, requireTeacherOrAdmin, (req, res) => {
    const lectureId = req.params.id;

    // Проверка, что преподаватель может удалять только свои лекции
    if (req.user.role === 'teacher') {
        db.get('SELECT created_by FROM lectures WHERE id = ?', [lectureId], (err, lecture) => {
            if (err) {
                console.error('Ошибка проверки владельца лекции:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (!lecture) {
                return res.status(404).json({ error: 'Лекция не найдена' });
            }

            if (lecture.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Нельзя удалить чужую лекцию' });
            }

            deleteLecture();
        });
    } else {
        deleteLecture();
    }

    function deleteLecture() {
        db.run('DELETE FROM lectures WHERE id = ?', [lectureId], function(err) {
            if (err) {
                console.error('Ошибка удаления лекции:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Лекция не найдена' });
            }

            res.json({ message: 'Лекция успешно удалена' });
        });
    }
});

// Валидация URL видео
function isValidVideoUrl(url) {
    try {
        const videoUrl = new URL(url);
        // Разрешаем YouTube, Vimeo и прямые ссылки на видео
        const allowedHosts = ['www.youtube.com', 'youtube.com', 'www.vimeo.com', 'vimeo.com'];
        const allowedExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
        
        if (allowedHosts.includes(videoUrl.hostname)) {
            return true;
        }
        
        // Проверка прямых ссылок на видеофайлы
        const pathname = videoUrl.pathname.toLowerCase();
        return allowedExtensions.some(ext => pathname.endsWith(ext));
    } catch (e) {
        return false;
    }
}

module.exports = router;