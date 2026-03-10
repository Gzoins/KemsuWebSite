const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Загрузка переменных окружения
require('dotenv').config();

const PORT = process.env.PORT || 4001;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Создаем папку для загрузок, если её нет
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Статическая раздача файлов из папки uploads
app.use('/uploads', express.static(UPLOAD_DIR));

// Подключение маршрутов
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const lectureRoutes = require('./routes/lectures');
const assignmentRoutes = require('./routes/assignments');
const submissionRoutes = require('./routes/submissions');

// API маршруты
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/lectures', lectureRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/submissions', submissionRoutes);

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
    console.log(`📁 Папка загрузок: ${UPLOAD_DIR}`);
});

module.exports = app;