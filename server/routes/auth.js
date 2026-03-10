const express = require('express');
const bcrypt = require('bcryptjs');
const { 
    authenticateToken, 
    requireRole, 
    generateToken, 
    hashPassword, 
    comparePassword, 
    getUserByEmail, 
    getUserById, 
    createUser 
} = require('../middleware/auth');
const emailService = require('../services/email');
const nanoid = require('nanoid');

const router = express.Router();
const db = require('../database/db');

// Регистрация пользователя
router.post('/register', async (req, res) => {
    try {
        const { email, password, role, name, group_name } = req.body;

        // Валидация входных данных
        if (!email || !password || !role || !name) {
            return res.status(400).json({ error: 'Заполните все обязательные поля' });
        }

        if (!['admin', 'teacher', 'student'].includes(role)) {
            return res.status(400).json({ error: 'Недопустимая роль' });
        }

        if (role === 'student' && !group_name) {
            return res.status(400).json({ error: 'Для студента необходимо указать группу' });
        }

        // Проверка, существует ли пользователь
        const existingUser = await getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }

        // Хеширование пароля
        const passwordHash = await hashPassword(password);

        // Создание пользователя
        const newUser = await createUser({
            email,
            password_hash: passwordHash,
            role,
            name,
            group_name: role === 'student' ? group_name : null
        });

        // Генерация токена
        const token = generateToken(newUser);

        res.status(201).json({
            message: 'Пользователь успешно зарегистрирован',
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                role: newUser.role,
                name: newUser.name,
                group_name: newUser.group_name
            }
        });

    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Авторизация пользователя
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Введите email и пароль' });
        }

        // Получение пользователя
        const user = await getUserByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        // Проверка пароля
        const isPasswordValid = await comparePassword(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        // Генерация токена
        const token = generateToken(user);

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

    } catch (error) {
        console.error('Ошибка авторизации:', error);
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
        console.error('Ошибка получения профиля:', error);
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

        db.run(
            `UPDATE users SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            values,
            function(err) {
                if (err) {
                    console.error('Ошибка обновления профиля:', err);
                    return res.status(500).json({ error: 'Ошибка сервера' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Пользователь не найден' });
                }

                res.json({ message: 'Профиль успешно обновлен' });
            }
        );

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
        const newPasswordHash = await hashPassword(newPassword);

        // Обновление пароля
        db.run(
            'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newPasswordHash, userId],
            function(err) {
                if (err) {
                    console.error('Ошибка смены пароля:', err);
                    return res.status(500).json({ error: 'Ошибка сервера' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Пользователь не найден' });
                }

                res.json({ message: 'Пароль успешно изменен' });
            }
        );

    } catch (error) {
        console.error('Ошибка смены пароля:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Подтверждение email
router.get('/verify-email', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({ error: 'Требуется токен подтверждения' });
        }

        // Поиск токена в базе данных
        const verification = await db.getEmailVerificationByToken(token);
        if (!verification) {
            return res.status(400).json({ error: 'Неверный или просроченный токен' });
        }

        // Проверка срока действия токена
        if (new Date() > new Date(verification.expires_at)) {
            return res.status(400).json({ error: 'Токен подтверждения истек' });
        }

        // Подтверждение email
        await db.verifyUserEmail(verification.user_id);

        // Удаление использованного токена
        await db.deleteEmailVerification(verification.id);

        // Получаем обновленного пользователя
        const user = await getUserById(verification.user_id);

        // Отправка приветственного письма
        try {
            await emailService.sendWelcomeEmail(user);
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
            // Не возвращаем ошибку, так как email уже подтвержден
        }

        res.json({
            message: 'Email успешно подтвержден',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                group_name: user.group_name,
                is_verified: true
            }
        });
    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({ error: 'Ошибка сервера при подтверждении email' });
    }
});

// Повторная отправка email подтверждения
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Требуется email' });
        }

        const user = await getUserByEmail(email);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        if (user.is_verified) {
            return res.status(400).json({ error: 'Email уже подтвержден' });
        }

        // Проверяем, не было ли недавно отправлено подтверждение (защита от спама)
        const recentVerification = await db.getRecentEmailVerification(user.id);
        if (recentVerification) {
            const timeDiff = Date.now() - new Date(recentVerification.created_at).getTime();
            const minutesDiff = timeDiff / (1000 * 60);
            
            if (minutesDiff < 5) {
                return res.status(429).json({ 
                    error: 'Слишком много запросов',
                    message: 'Повторную ссылку можно запросить не чаще чем раз в 5 минут'
                });
            }
        }

        // Создаем новый токен подтверждения
        const verificationToken = nanoid.nanoid(32);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа

        await db.createEmailVerification(user.id, verificationToken, expiresAt);

        // Отправка email подтверждения
        try {
            await emailService.sendVerificationEmail(user, verificationToken);
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            // Не возвращаем ошибку, так как пользователь уже создан
        }

        res.json({ message: 'Ссылка для подтверждения отправлена на email' });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;
