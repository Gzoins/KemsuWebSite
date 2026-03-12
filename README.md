# КемГУ — Портал обучения

## 📁 Структура проекта

```
KemsuWebSite/
├── backend/                    # Бэкенд часть (Node.js + Express)
│   ├── server.js              # Главный файл сервера
│   ├── database/              # База данных SQLite и миграции
│   │   ├── db.js             # Подключение к БД
│   │   ├── schema.sql        # Схема базы данных
│   │   ├── migrate.js        # Миграции
│   │   └── kemgu.db          # SQLite база данных
│   ├── routes/                # API маршруты
│   │   ├── admin.js          # Админ-панель
│   │   ├── auth.js           # Аутентификация
│   │   ├── assignments.js    # Задания
│   │   ├── lectures.js       # Лекции
│   │   └── submissions.js    # Проверка работ
│   ├── middleware/            # Промежуточное ПО
│   │   └── auth.js           # JWT аутентификация
│   ├── services/              # Сервисы
│   │   └── email.js          # Email рассылки
│   ├── .env                   # Переменные окружения
│   └── package.json           # Зависимости бэкенда
│
├── frontend/                   # Фронтенд часть
│   ├── public/                # HTML страницы
│   │   ├── index.html        # Главная страница (вход)
│   │   ├── admin.html        # Админ-панель
│   │   ├── teacher.html      # Преподаватель
│   │   ├── student.html      # Студент
│   │   ├── register.html     # Регистрация
│   │   ├── profile.html      # Профиль
│   │   ├── lecture.html      # Лекции
│   │   ├── assignment.html   # Задания
│   │   └── resources.html    # Материалы
│   └── assets/                # Статические ресурсы
│       ├── css/
│       │   └── style.css     # Основные стили
│       ├── js/
│       │   ├── api.js        # API клиент
│       │   ├── auth.js       # Аутентификация
│       │   ├── ui.js         # UI компоненты
│       │   ├── loader.js     # Загрузчик
│       │   ├── main.js       # Основная логика
│       │   ├── admin.js      # Админ-панель
│       │   ├── teacher.js    # Преподаватель
│       │   ├── student.js    # Студент
│       │   ├── lecture.js    # Лекции
│       │   └── assignment.js # Задания
│       └── images/           # Изображения
│
├── uploads/                    # Загруженные файлы
├── docs/                       # Документация
├── tests/                      # Тесты
├── package.json               # Корневой package.json
└── README.md                   # Этот файл
```

## 🚀 Быстрый старт

### Установка зависимостей

```bash
# Установить все зависимости
npm run install:all

# Или по отдельности
npm install
cd backend && npm install
```

### Запуск проекта

```bash
# Режим разработки (с nodemon)
npm run dev

# Обычный запуск
npm start
```

Сервер запустится на порту `http://localhost:4001`

## 📝 Описание API

Все API endpoints доступны по адресу `http://localhost:4001/api`

### Основные маршруты:
- `/api/auth` - аутентификация и регистрация
- `/api/admin` - админ-панель
- `/api/lectures` - лекции
- `/api/assignments` - задания
- `/api/submissions` - проверка работ

## 🔧 Конфигурация

Переменные окружения находятся в файле `backend/.env`:

```env
NODE_ENV=development
PORT=4001
DB_PATH=./database/kemgu.db
JWT_SECRET=kemgu-super-secret-jwt-key-2024
JWT_EXPIRES_IN=24h
UPLOAD_DIR=../uploads
```

## 👥 Роли пользователей

- **admin** - полный доступ ко всем функциям системы
- **teacher** - создание лекций, заданий, проверка работ
- **student** - просмотр лекций, выполнение заданий

## 📦 Технологический стек

### Backend:
- Node.js + Express
- SQLite3
- JWT Authentication
- Nodemailer (email рассылки)

### Frontend:
- Vanilla JavaScript
- CSS3
- HTML5

## 📄 Лицензия

MIT
