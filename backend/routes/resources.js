const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const db = require('../database/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Middleware для проверки, что пользователь - преподаватель или администратор
const requireTeacherOrAdmin = requireRole(['teacher', 'admin']);

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        
        // Создаем папку для ресурсов если её нет
        const resourcesDir = path.join(uploadDir, 'resources');
        if (!fs.existsSync(resourcesDir)) {
            fs.mkdirSync(resourcesDir, { recursive: true });
        }
        
        cb(null, resourcesDir);
    },
    filename: (req, file, cb) => {
        // Генерируем уникальное имя файла
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'resource-' + uniqueSuffix + ext);
    }
});

// Фильтр для проверки типа файла (только PDF)
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Разрешены только PDF файлы'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB лимит
    }
});

// Получение списка учебных материалов
router.get('/', authenticateToken, (req, res) => {
    const { group_name, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
        SELECT r.*, u.name as created_by_name 
        FROM resources r 
        JOIN users u ON r.created_by = u.id 
        WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM resources WHERE 1=1';
    const params = [];

    // Студенты видят только материалы своей группы
    if (req.user.role === 'student') {
        query += ' AND r.group_name = ?';
        countQuery += ' AND group_name = ?';
        params.push(req.user.group_name);
    } else if (group_name) {
        // Преподаватели и администраторы могут фильтровать по группе
        query += ' AND r.group_name = ?';
        countQuery += ' AND group_name = ?';
        params.push(group_name);
    }

    query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    db.all(query, params, (err, resources) => {
        if (err) {
            console.error('Ошибка получения материалов:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        db.get(countQuery, params.slice(0, -2), (err, count) => {
            if (err) {
                console.error('Ошибка подсчета материалов:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            res.json({
                resources,
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

// Получение конкретного материала
router.get('/:id', authenticateToken, (req, res) => {
    const resourceId = req.params.id;

    db.get(
        `SELECT r.*, u.name as created_by_name 
         FROM resources r 
         JOIN users u ON r.created_by = u.id 
         WHERE r.id = ?`,
        [resourceId],
        (err, resource) => {
            if (err) {
                console.error('Ошибка получения материала:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            if (!resource) {
                return res.status(404).json({ error: 'Материал не найден' });
            }

            // Проверка доступа к материалу
            if (req.user.role === 'student' && resource.group_name !== req.user.group_name) {
                return res.status(403).json({ error: 'Доступ к этому материалу запрещен' });
            }

            res.json(resource);
        }
    );
});

// Создание учебного материала (с загрузкой файла)
router.post('/', authenticateToken, requireTeacherOrAdmin, upload.single('file'), (req, res) => {
    try {
        const { title, description, group_name } = req.body;

        // Валидация входных данных
        if (!title || !group_name) {
            return res.status(400).json({ error: 'Заполните название и группу' });
        }

        // Проверка наличия файла
        if (!req.file) {
            return res.status(400).json({ error: 'Загрузите PDF файл' });
        }

        // Формируем путь к файлу для сохранения в БД
        const filePath = '/uploads/resources/' + req.file.filename;
        const fileName = req.file.originalname;
        const fileType = 'pdf';

        // Создаем материал в БД
        db.run(
            `INSERT INTO resources (title, description, file_path, file_name, file_type, group_name, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [title, description || null, filePath, fileName, fileType, group_name, req.user.id],
            function(err) {
                if (err) {
                    console.error('Ошибка создания материала:', err);
                    return res.status(500).json({ error: 'Ошибка сервера' });
                }

                res.status(201).json({
                    message: 'Материал успешно создан',
                    resource: {
                        id: this.lastID,
                        title,
                        description,
                        file_path: filePath,
                        file_name: fileName,
                        group_name,
                        created_by: req.user.id
                    }
                });
            }
        );
    } catch (error) {
        console.error('Ошибка загрузки материала:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление материала
router.put('/:id', authenticateToken, requireTeacherOrAdmin, (req, res) => {
    const resourceId = req.params.id;
    const { title, description } = req.body;

    // Проверка существования материала
    db.get('SELECT * FROM resources WHERE id = ?', [resourceId], (err, resource) => {
        if (err) {
            console.error('Ошибка проверки материала:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        if (!resource) {
            return res.status(404).json({ error: 'Материал не найден' });
        }

        // Обновление материала
        const updateFields = [];
        const values = [];

        if (title) {
            updateFields.push('title = ?');
            values.push(title);
        }

        if (description !== undefined) {
            updateFields.push('description = ?');
            values.push(description);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'Нечего обновлять' });
        }

        values.push(resourceId);

        db.run(
            `UPDATE resources SET ${updateFields.join(', ')} WHERE id = ?`,
            values,
            function(err) {
                if (err) {
                    console.error('Ошибка обновления материала:', err);
                    return res.status(500).json({ error: 'Ошибка сервера' });
                }

                res.json({ message: 'Материал успешно обновлен' });
            }
        );
    });
});

// Удаление материала
router.delete('/:id', authenticateToken, requireTeacherOrAdmin, (req, res) => {
    const resourceId = req.params.id;

    // Проверка существования материала
    db.get('SELECT * FROM resources WHERE id = ?', [resourceId], (err, resource) => {
        if (err) {
            console.error('Ошибка проверки материала:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

        if (!resource) {
            return res.status(404).json({ error: 'Материал не найден' });
        }

        // Удаляем файл с диска
        const filePath = path.join(__dirname, '..', resource.file_path);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Удаляем запись из БД
        db.run('DELETE FROM resources WHERE id = ?', [resourceId], function(err) {
            if (err) {
                console.error('Ошибка удаления материала:', err);
                return res.status(500).json({ error: 'Ошибка сервера' });
            }

            res.json({ message: 'Материал успешно удален' });
        });
    });
});

module.exports = router;
