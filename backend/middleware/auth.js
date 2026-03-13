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
    console.log('[AUTH] generateToken called with user:', JSON.stringify(user, null, 2));
    
    if (!user || !user.id) {
        console.error('[AUTH] Invalid user object:', user);
        throw new Error('Invalid user object for token generation');
    }
    
    const payload = { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name,
        group_name: user.group_name
    };
    
    console.log('[AUTH] Token payload:', JSON.stringify(payload, null, 2));
    
    const token = jwt.sign(
        payload,
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
    
    console.log('[AUTH] Generated token:', token);
    console.log('[AUTH] Token length:', token.length);
    
    return token;
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
const getUserByEmail = async (email) => {
    console.log('[DB] getUserByEmail called with:', email);
    try {
        const sql = 'SELECT id, email, password_hash, role, name, group_name, created_at FROM users WHERE email = ? LIMIT 1';
        const row = await db.get(sql, [email]);
        console.log('[DB] User found:', !!row);
        return row;
    } catch (error) {
        console.error('[DB] Error in getUserByEmail:', error.message);
        throw error;
    }
};

// Функция для получения пользователя по ID
const getUserById = async (id) => {
    try {
        const sql = 'SELECT id, email, role, name, group_name, created_at FROM users WHERE id = ?';
        return await db.get(sql, [id]);
    } catch (error) {
        console.error('[DB] Error in getUserById:', error.message);
        throw error;
    }
};

// Функция для создания пользователя
const createUser = async (userData) => {
    try {
        const { email, password_hash, role, name, group_name } = userData;
        
        const sql = 'INSERT INTO users (email, password_hash, role, name, group_name) VALUES (?, ?, ?, ?, ?)';
        const result = await db.run(sql, [email, password_hash, role, name, group_name]);
        
        return { id: result.lastID, email, role, name, group_name };
    } catch (error) {
        console.error('[DB] Error in createUser:', error.message);
        throw error;
    }
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