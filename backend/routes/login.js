const express = require('express');
const bcrypt = require('bcryptjs');
const { 
    authenticateToken, 
    generateToken, 
    comparePassword, 
    getUserByEmail, 
    getUserById 
} = require('../middleware/auth');
const db = require('../database/db');

const router = express.Router();

// Авторизация пользователя
router.post('/login', async (req, res) => {
    console.log('[LOGIN] POST /login - Received request');
    
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            console.log('[LOGIN] Validation failed - missing credentials');
            return res.status(400).json({ error: 'Введите email и пароль' });
        }

        // Получение пользователя
        console.log('[LOGIN] Looking up user by email:', email);
        const user = await getUserByEmail(email);
        
        if (!user) {
            console.log('[LOGIN] User not found:', email);
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        console.log('[LOGIN] User found, verifying password...');
        
        // Проверка пароля
        const isPasswordValid = await comparePassword(password, user.password_hash);
        
        if (!isPasswordValid) {
            console.log('[LOGIN] Invalid password');
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        console.log('[LOGIN] Password verified successfully');

        // Генерация токена
        const token = generateToken(user);
        console.log('[LOGIN] Token generated');

        res.json({
            message: 'Авторизация успешна',
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                group_name: user.group_name
            }
        });
        console.log('[LOGIN] Login successful');

    } catch (error) {
        console.error('[LOGIN] Error during authorization:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение информации о текущем пользователе
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await getUserById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json({
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            group_name: user.group_name,
            created_at: user.created_at
        });

    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновление профиля пользователя
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { name, group_name } = req.body;
        const userId = req.user.id;

        // Проверка, что пользователь не пытается изменить свою роль
        if (req.body.role) {
            return res.status(403).json({ error: 'Нельзя изменить роль' });
        }

        // Обновление профиля
        const updateFields = [];
        const values = [];

        if (name) {
            updateFields.push('name = ?');
            values.push(name);
        }

        if (req.user.role === 'student' && group_name) {
            updateFields.push('group_name = ?');
            values.push(group_name);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'Нечего обновлять' });
        }

        values.push(userId);

        try {
            const result = await db.run(
                `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                values
            );

            if (result.changes === 0) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }

            res.json({ message: 'Профиль успешно обновлен' });
        } catch (err) {
            console.error('Ошибка обновления профиля:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

    } catch (error) {
        console.error('Ошибка обновления профиля:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Смена пароля
router.put('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Введите текущий и новый пароль' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Новый пароль должен быть не менее 6 символов' });
        }

        // Получение пользователя
        const user = await getUserById(userId);
        
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Проверка текущего пароля
        const isCurrentPasswordValid = await comparePassword(currentPassword, user.password_hash);
        
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ error: 'Текущий пароль введен неверно' });
        }

        // Хеширование нового пароля
        const bcrypt = require('bcryptjs');
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Обновление пароля
        try {
            const result = await db.run(
                'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newPasswordHash, userId]
            );

            if (result.changes === 0) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }

            res.json({ message: 'Пароль успешно изменен' });
        } catch (err) {
            console.error('Ошибка смены пароля:', err);
            return res.status(500).json({ error: 'Ошибка сервера' });
        }

    } catch (error) {
        console.error('Ошибка смены пароля:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;
