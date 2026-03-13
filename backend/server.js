const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Загрузка переменных окружения
dotenv.config();

const PORT = process.env.PORT || 4001;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Создаем папку для загрузок, если её нет
const uploadPath = path.join(__dirname, '..', UPLOAD_DIR);
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb', parameterLimit: 50000 }));

// Устанавливаем кодировку UTF-8 для всех JSON ответов
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});

// Статическая раздача файлов из папки frontend/public (главная страница)
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public'), {
    setHeaders: (res, path) => {
        // Устанавливаем UTF-8 для HTML файлов
        if (path.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
    }
}));

// Обработчик ошибок для некорректных URL (должен быть перед статикой)
app.use((err, req, res, next) => {
    if (err instanceof URIError) {
        console.warn('[SERVER] Malformed URI:', req.path);
        return res.status(400).send('Bad Request');
    }
    next(err);
});

// Статическая раздача ассетов с правильной обработкой MIME типов
app.use('/assets', express.static(path.join(__dirname, '..', 'frontend', 'assets'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.svg')) {
            res.setHeader('Content-Type', 'image/svg+xml');
        } else if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
        } else if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
    },
    fallthrough: true
}));

// Статическая раздача файлов из папки uploads с правильными заголовками
app.use('/uploads', express.static(uploadPath, {
    setHeaders: (res, path) => {
        // Устанавливаем правильный Content-Type для разных типов файлов
        if (path.endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment');
        } else if (path.endsWith('.doc')) {
            res.setHeader('Content-Type', 'application/msword; charset=utf-8');
        } else if (path.endsWith('.docx')) {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document; charset=utf-8');
        } else if (path.endsWith('.xls')) {
            res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
        } else if (path.endsWith('.xlsx')) {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=utf-8');
        } else if (path.endsWith('.ppt')) {
            res.setHeader('Content-Type', 'application/vnd.ms-powerpoint; charset=utf-8');
        } else if (path.endsWith('.pptx')) {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation; charset=utf-8');
        } else if (path.endsWith('.txt')) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        } else if (path.endsWith('.csv')) {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(path.substring(path.lastIndexOf('.')).toLowerCase())) {
            res.setHeader('Content-Type', `image/${path.substring(path.lastIndexOf('.') + 1)}`);
        }
    }
}));

// Подключение маршрутов
const registerRoutes = require('./routes/register');
const loginRoutes = require('./routes/login');
const adminRoutes = require('./routes/admin');
const lectureRoutes = require('./routes/lectures');
const assignmentRoutes = require('./routes/assignments');
const submissionRoutes = require('./routes/submissions');
const resourceRoutes = require('./routes/resources');

// API маршруты
app.use('/api/auth/register', registerRoutes);
app.use('/api/auth/login', loginRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/lectures', lectureRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/resources', resourceRoutes);

// Главная страница API
app.get('/api', (req, res) => {
    res.json({
        message: 'KemGU API v2.0',
        version: '2.0.0',
        endpoints: {
            auth: '/api/auth',
            admin: '/api/admin',
            lectures: '/api/lectures',
            assignments: '/api/assignments',
            submissions: '/api/submissions'
        },
        documentation: 'https://github.com/kemgu/kemgu-api-docs'
    });
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Что-то пошло не так!' });
});

// Обработка 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Маршрут не найден' });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 KemGU Server запущен на порту ${PORT}`);
    console.log(`📚 API доступен по адресу: http://localhost:${PORT}/api`);
    console.log(`🌐 Главная страница: http://localhost:${PORT}`);
    console.log(`📁 Папка загрузок: ${UPLOAD_DIR}`);
});

module.exports = app;