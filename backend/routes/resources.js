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
        // Генерируем уникальное имя файла с корректным UTF-8
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        
        // Сохраняем оригинальное имя в UTF-8
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf-8');
        const safeName = originalName.replace(/[^\w\sа-яА-ЯёЁ.-]/g, '_').substring(0, 50); // Ограничиваем длину
        
        cb(null, 'resource-' + uniqueSuffix + '_' + safeName + ext);
    }
});

// Фильтр для проверки типа файла
const fileFilter = (req, file, cb) => {
    // Разрешенные MIME типы
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
        'image/jpeg',
        'image/png',
        'image/gif'
    ];
    
    // Разрешенные расширения
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.ppt', '.pptx', '.xls', '.xlsx', '.csv', '.jpg', '.jpeg', '.png', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Недопустимый тип файла. Разрешены: PDF, DOC, DOCX, TXT, PPT, PPTX, XLS, XLSX, CSV, JPG, PNG, GIF'), false);
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
router.get('/', authenticateToken, async (req, res) => {
    const { group_name, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    try {
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

        const resources = await db.all(query, params);
        
        const countParams = params.slice(0, -2);
        const count = await db.get(countQuery, countParams);

        res.json({
            resources,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count.total,
                pages: Math.ceil(count.total / limit)
            }
        });
    } catch (error) {
        console.error('Ошибка получения материалов:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
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

// Скачивание учебного материала
router.get('/:id/download', authenticateToken, async (req, res) => {
    try {
        const resourceId = req.params.id;

        const resource = await db.get(
            `SELECT * FROM resources WHERE id = ?`,
            [resourceId]
        );

        if (!resource) {
            return res.status(404).json({ error: 'Материал не найден' });
        }

        // Проверка доступа
        if (req.user.role === 'student' && resource.group_name !== req.user.group_name) {
            return res.status(403).json({ error: 'Доступ к этому материалу запрещен' });
        }

        // Путь к файлу
        const filePath = path.join(__dirname, '..', '..', 'uploads', 'resources', path.basename(resource.file_path));
        
        console.log('[RESOURCES DOWNLOAD] File path:', filePath);
        console.log('[RESOURCES DOWNLOAD] File exists:', fs.existsSync(filePath));

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Файл не найден на сервере' });
        }

        // Отправляем файл с правильными заголовками
        res.download(filePath, resource.file_name);
    } catch (error) {
        console.error('[RESOURCES DOWNLOAD] Error:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Удаление учебного материала
router.delete('/:id', authenticateToken, requireTeacherOrAdmin, async (req, res) => {
    try {
        const resourceId = req.params.id;

        // Получаем материал
        const resource = await db.get(
            `SELECT * FROM resources WHERE id = ?`,
            [resourceId]
        );

        if (!resource) {
            return res.status(404).json({ error: 'Материал не найден' });
        }

        // Удаляем файл из файловой системы
        const filePath = path.join(__dirname, '..', '..', 'uploads', 'resources', path.basename(resource.file_path));
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('[RESOURCES DELETE] File deleted:', filePath);
        }

        // Удаляем запись из БД
        await db.run('DELETE FROM resources WHERE id = ?', [resourceId]);
        
        console.log('[RESOURCES DELETE] Resource deleted from DB:', resourceId);

        res.json({ message: 'Материал успешно удален' });
    } catch (error) {
        console.error('[RESOURCES DELETE] Error:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

// Создание учебного материала (с загрузкой файла)
router.post('/', authenticateToken, requireTeacherOrAdmin, upload.single('file'), async (req, res) => {
    try {
        console.log('[RESOURCES CREATE] Request body:', req.body);
        console.log('[RESOURCES CREATE] File:', req.file);
        
        const { title, description, group_name } = req.body;

        // Валидация входных данных
        if (!title || !group_name) {
            return res.status(400).json({ error: 'Заполните название и группу' });
        }

        // Проверка наличия файла
        if (!req.file) {
            return res.status(400).json({ error: 'Загрузите файл' });
        }

        // Формируем путь к файлу для сохранения в БД
        const filePath = '/uploads/resources/' + req.file.filename;
        
        // Декодируем имя файла из UTF-8 (multer сохраняет в latin1)
        let fileName = req.file.originalname;
        try {
            fileName = Buffer.from(fileName, 'latin1').toString('utf-8');
        } catch (e) {
            console.error('[RESOURCES CREATE] Error decoding filename:', e);
        }
        
        const fileExt = path.extname(fileName).toLowerCase().substring(1); // убираем точку
        const fileType = fileExt || 'other';

        console.log('[RESOURCES CREATE] Saving to DB:', { title, description, group_name, filePath, fileName, fileType });
        
        // Создаем материал в БД
        const result = await db.run(
            `INSERT INTO resources (title, description, file_path, file_name, file_type, group_name, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [title, description || null, filePath, fileName, fileType, group_name, req.user.id]
        );
        
        console.log('[RESOURCES CREATE] Created with ID:', result.lastID);

        res.status(201).json({
            message: 'Материал успешно загружен',
            resource: {
                id: result.lastID,
                title,
                description,
                file_path: filePath,
                file_name: fileName,
                file_type: fileType,
                group_name,
                created_by: req.user.id,
                created_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('[RESOURCES CREATE] Error:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
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
