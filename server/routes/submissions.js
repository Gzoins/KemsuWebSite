const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');

const router = express.Router();

// Настройка multer для загрузки файлов
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|zip|rar|txt|jpg|jpeg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Недопустимый тип файла. Разрешены: PDF, DOC, DOCX, ZIP, RAR, TXT, изображения'));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Получение списка сабмитов
router.get('/', authenticateToken, (req, res) => {
    const { assignment_id, student_id, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
        SELECT s.*, a.title as assignment_title, u.name as student_name, u.group_name as student_group
        FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        JOIN users u ON s.student_id = u.id
        WHERE 1=1
    `;
    let countQuery = `
        SELECT COUNT(*) as total
        FROM submissions s
        JOIN assignments a ON s.assignment_id = a.id
        JOIN users u ON s.student_id = u.id
        WHERE 1=1
    `;
    const params = [];

    // Преподаватель видит только свои задания
    if (req.user.role === 'teacher') {
        query += ' AND a.created_by = ?';
        countQuery += ' AND a.created_by = ?';
        params.push(req.user.id);
    }

    // Студент видит только свои сабмиты
    if (req.user.role === 'student') {
        query += ' AND s.student_id = ?';
        countQuery += ' AND s.student_id = ?';
        params.push(req.user.id);
    }

    // Фильтрация по заданию
    if (assignment_id) {
        query += ' AND s.assignment_id = ?';
        countQuery += ' AND s.assignment_id = ?';
        params.push(assignment_id);
    }

    // Фильтрация по студенту (только для преподавателя и администратора)
    if (student_id && (req.user.role === 'teacher' || req.user.role === 'admin')) {
        query += ' AND s.student_id = ?';
        countQuery += ' AND s.student_id = ?';
        params.push(student_id);
    }

    query += ' ORDER BY s.submitted_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    db.all(query, params, (err, submissions) => {
        if (err) {
            console.error('Ошибка получения сабмитов:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        db.get(countQuery, params.slice(0, -2), (err, count) => {
            if (err) {
                console.error('Ошибка подсчета сабмитов:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            res.json({
                submissions,
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

// Получение конкретного сабмита
router.get('/:id', authenticateToken, (req, res) => {
    const submissionId = req.params.id;

    db.get(
        `SELECT s.*, a.title as assignment_title, a.group_name as assignment_group, 
                u.name as student_name, u.group_name as student_group
         FROM submissions s
         JOIN assignments a ON s.assignment_id = a.id
         JOIN users u ON s.student_id = u.id
         WHERE s.id = ?`,
        [submissionId],
        (err, submission) => {
            if (err) {
                console.error('Ошибка получения сабмита:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (!submission) {
                return res.status(404).json({ error: 'Сабмит не найден' });
            }

            // Проверка доступа к сабмиту
            if (req.user.role === 'student' && submission.student_id !== req.user.id) {
                return res.status(403).json({ error: 'Доступ к этому сабмиту запрещен' });
            }

            // Преподаватель может видеть только сабмиты своих заданий
            if (req.user.role === 'teacher' && submission.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Доступ к этому сабмиту запрещен' });
            }

            res.json(submission);
        }
    );
});

// Создание сабмита (загрузка работы студентом)
router.post('/', authenticateToken, requireRole(['student']), upload.single('file'), (req, res) => {
    const { assignment_id, work_title, comment } = req.body;
    const file = req.file;

    // Валидация входных данных
    if (!assignment_id || !work_title) {
        return res.status(400).json({ error: 'Заполните все обязательные поля' });
    }

    // Проверка, что задание существует и доступно студенту
    db.get(
        'SELECT id, group_name FROM assignments WHERE id = ?',
        [assignment_id],
        (err, assignment) => {
            if (err) {
                console.error('Ошибка проверки задания:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (!assignment) {
                return res.status(404).json({ error: 'Задание не найдено' });
            }

            // Проверка, что студент из нужной группы
            if (assignment.group_name !== req.user.group_name) {
                return res.status(403).json({ error: 'Вы не можете сдать работу на это задание' });
            }

            // Проверка, не сдавал ли студент уже эту работу
            db.get(
                'SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?',
                [assignment_id, req.user.id],
                (err, existingSubmission) => {
                    if (err) {
                        console.error('Ошибка проверки существующего сабмита:', err);
                        return res.status(500).json({ error: 'Ошибка сервера' });
                    }

                    if (existingSubmission) {
                        return res.status(400).json({ error: 'Вы уже сдали работу на это задание' });
                    }

                    // Создание сабмита
                    const filePath = file ? file.path : null;
                    const fileName = file ? file.filename : null;

                    db.run(
                        'INSERT INTO submissions (assignment_id, student_id, file_path, file_name, work_title, comment, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [assignment_id, req.user.id, filePath, fileName, work_title, comment || null, 'submitted'],
                        function(err) {
                            if (err) {
                                console.error('Ошибка создания сабмита:', err);
                                return res.status(500).json({ error: 'Ошибка сервера' });
                            }

                            res.status(201).json({
                                message: 'Работа успешно отправлена',
                                submission: {
                                    id: this.lastID,
                                    assignment_id,
                                    student_id: req.user.id,
                                    file_path: filePath,
                                    file_name: fileName,
                                    work_title,
                                    comment: comment || null,
                                    status: 'submitted',
                                    submitted_at: new Date().toISOString()
                                }
                            });
                        }
                    );
                }
            );
        }
    );
});

// Обновление сабмита (оценка преподавателем)
router.put('/:id', authenticateToken, requireRole(['teacher', 'admin']), (req, res) => {
    const submissionId = req.params.id;
    const { points, comment, status } = req.body;

    // Валидация входных данных
    if (points !== undefined && (points < 0 || points > 100)) {
        return res.status(400).json({ error: 'Баллы должны быть от 0 до 100' });
    }

    if (status && !['submitted', 'graded', 'revision'].includes(status)) {
        return res.status(400).json({ error: 'Недопустимый статус' });
    }

    // Проверка, что сабмит существует
    db.get(
        `SELECT s.*, a.created_by as assignment_creator
         FROM submissions s
         JOIN assignments a ON s.assignment_id = a.id
         WHERE s.id = ?`,
        [submissionId],
        (err, submission) => {
            if (err) {
                console.error('Ошибка проверки сабмита:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (!submission) {
                return res.status(404).json({ error: 'Сабмит не найден' });
            }

            // Проверка прав на оценку
            if (req.user.role === 'teacher' && submission.assignment_creator !== req.user.id) {
                return res.status(403).json({ error: 'Вы можете оценивать только свои задания' });
            }

            // Обновление сабмита
            const updateFields = [];
            const values = [];

            if (points !== undefined) {
                updateFields.push('points = ?');
                values.push(points);
            }

            if (comment !== undefined) {
                updateFields.push('comment = ?');
                values.push(comment);
            }

            if (status) {
                updateFields.push('status = ?');
                values.push(status);
            }

            if (updateFields.length === 0) {
                return res.status(400).json({ error: 'Нечего обновлять' });
            }

            // Добавляем дату оценки, если статус изменен на graded
            if (status === 'graded') {
                updateFields.push('graded_at = CURRENT_TIMESTAMP');
            }

            values.push(submissionId);

            db.run(
                `UPDATE submissions SET ${updateFields.join(', ')} WHERE id = ?`,
                values,
                function(err) {
                    if (err) {
                        console.error('Ошибка обновления сабмита:', err);
                        return res.status(500).json({ error: 'Ошибка сервера' });
                    }

                    if (this.changes === 0) {
                        return res.status(404).json({ error: 'Сабмит не найден' });
                    }

                    res.json({ message: 'Сабмит успешно обновлен' });
                }
            );
        }
    );
});

// Удаление сабмита
router.delete('/:id', authenticateToken, requireRole(['teacher', 'admin']), (req, res) => {
    const submissionId = req.params.id;

    // Проверка, что сабмит существует
    db.get(
        `SELECT s.*, a.created_by as assignment_creator
         FROM submissions s
         JOIN assignments a ON s.assignment_id = a.id
         WHERE s.id = ?`,
        [submissionId],
        (err, submission) => {
            if (err) {
                console.error('Ошибка проверки сабмита:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (!submission) {
                return res.status(404).json({ error: 'Сабмит не найден' });
            }

            // Проверка прав на удаление
            if (req.user.role === 'teacher' && submission.assignment_creator !== req.user.id) {
                return res.status(403).json({ error: 'Вы можете удалять только сабмиты своих заданий' });
            }

            // Удаление файла, если он есть
            if (submission.file_path && fs.existsSync(submission.file_path)) {
                fs.unlinkSync(submission.file_path);
            }

            // Удаление сабмита
            db.run('DELETE FROM submissions WHERE id = ?', [submissionId], function(err) {
                if (err) {
                    console.error('Ошибка удаления сабмита:', err);
                    return res.status(500).json({ error: 'Ошибка сервера' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Сабмит не найден' });
                }

                res.json({ message: 'Сабмит успешно удален' });
            });
        }
    );
});

module.exports = router;