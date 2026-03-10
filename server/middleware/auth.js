const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'kemgu-super-secret-jwt-key-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Middleware для проверки JWT токена
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        req.user = user;
        next();
    });
};

// Middleware для проверки роли
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Требуется авторизация' });
        }

        const userRole = req.user.role;
        if (!roles.includes(userRole)) {
            return res.status(403).json({ error: 'Недостаточно прав доступа' });
        }

        next();
    };
};

// Функция для генерации JWT токена
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email, 
            role: user.role,
            name: user.name,
            group_name: user.group_name
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

// Функция для хеширования пароля
const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

// Функция для проверки пароля
const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

// Функция для получения пользователя по email
const getUserByEmail = (email) => {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT id, email, password_hash, role, name, group_name, created_at FROM users WHERE email = ?",
            [email],
            (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            }
        );
    });
};

// Функция для получения пользователя по ID
const getUserById = (id) => {
    return new Promise((resolve, reject) => {
        db.get(
            "SELECT id, email, role, name, group_name, created_at FROM users WHERE id = ?",
            [id],
            (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            }
        );
    });
};

// Функция для создания пользователя
const createUser = (userData) => {
    return new Promise((resolve, reject) => {
        const { email, password_hash, role, name, group_name } = userData;
        
        db.run(
            "INSERT INTO users (email, password_hash, role, name, group_name) VALUES (?, ?, ?, ?, ?)",
            [email, password_hash, role, name, group_name],
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, email, role, name, group_name });
                }
            }
        );
    });
};

module.exports = {
    authenticateToken,
    requireRole,
    generateToken,
    hashPassword,
    comparePassword,
    getUserByEmail,
    getUserById,
    createUser
};