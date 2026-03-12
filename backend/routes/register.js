const express = require('express');
const bcrypt = require('bcryptjs');
const { 
    generateToken, 
    hashPassword, 
    getUserByEmail, 
    createUser 
} = require('../middleware/auth');
const emailService = require('../services/email');
const nanoid = require('nanoid');
const db = require('../database/db');

const router = express.Router();

// Регистрация пользователя
router.post('/register', async (req, res) => {
    console.log('[REGISTER] POST /register - Received request');
    console.log('[REGISTER] Request body:', req.body);
    
    try {
        const { email, password, role, name, group_name } = req.body;
        console.log('[REGISTER] Destructured data:', { email, role, name, hasPassword: !!password });

        // Валидация входных данных
        if (!email || !password || !role || !name) {
            console.log('[REGISTER] Validation failed - missing fields');
            return res.status(400).json({ error: 'Заполните все обязательные поля' });
        }

        if (!['admin', 'teacher', 'student'].includes(role)) {
            console.log('[REGISTER] Validation failed - invalid role:', role);
            return res.status(400).json({ error: 'Недопустимая роль' });
        }

        if (role === 'student' && !group_name) {
            console.log('[REGISTER] Validation failed - student without group');
            return res.status(400).json({ error: 'Для студента необходимо указать группу' });
        }
        
        console.log('[REGISTER] Validation passed');

        // Проверка, существует ли пользователь
        console.log('[REGISTER] Checking if user exists...');
        const existingUser = await getUserByEmail(email);
        console.log('[REGISTER] User exists check:', !!existingUser);
        
        if (existingUser) {
            console.log('[REGISTER] User already exists:', email);
            return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
        }

        // Хеширование пароля
        console.log('[REGISTER] Hashing password...');
        const passwordHash = await hashPassword(password);
        console.log('[REGISTER] Password hashed successfully');

        // Создание пользователя
        console.log('[REGISTER] Creating user...');
        const newUser = await createUser({
            email,
            password_hash: passwordHash,
            role,
            name,
            group_name: role === 'student' ? group_name : null
        });
        console.log('[REGISTER] User created with ID:', newUser.id);

        // Создаем цифровой код подтверждения (6 цифр)
        console.log('[REGISTER] Creating email verification code...');
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут

        await db.createEmailVerification(newUser.id, verificationCode, expiresAt);
        console.log('[REGISTER] Verification code created');

        // Отправка email с кодом подтверждения
        try {
            console.log('[REGISTER] Sending verification email with code...');
            await emailService.sendVerificationCodeEmail(newUser, verificationCode);
            console.log('[REGISTER] Verification email sent');
        } catch (emailError) {
            console.error('[REGISTER] Failed to send verification email:', emailError);
            // Не возвращаем ошибку, так как пользователь уже создан
        }

        // Генерация токена
        console.log('[REGISTER] Generating token...');
        const token = generateToken(newUser);
        console.log('[REGISTER] Token generated');

        console.log('[REGISTER] Sending success response');
        res.status(201).json({
            message: 'Пользователь успешно зарегистрирован. Проверьте email для подтверждения.',
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                role: newUser.role,
                name: newUser.name,
                group_name: newUser.group_name,
                is_verified: false
            }
        });
        console.log('[REGISTER] Response sent');

    } catch (error) {
        console.error('[REGISTER] Error during registration:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Подтверждение email кодом
router.post('/verify-email', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ error: 'Введите email и код подтверждения' });
        }

        // Поиск пользователя по email
        const user = await getUserByEmail(email);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        if (user.is_verified) {
            return res.status(400).json({ error: 'Email уже подтвержден' });
        }

        // Поиск кода подтверждения
        const verification = await db.getEmailVerificationByToken(code);
        if (!verification) {
            return res.status(400).json({ error: 'Неверный код подтверждения' });
        }

        // Проверка что код принадлежит пользователю
        if (verification.user_id !== user.id) {
            return res.status(400).json({ error: 'Код не соответствует пользователю' });
        }

        // Проверка срока действия кода
        if (new Date() > new Date(verification.expires_at)) {
            return res.status(400).json({ error: 'Срок действия кода истек' });
        }

        // Подтверждение email
        await db.verifyUserEmail(user.id);

        // Удаление использованного кода
        await db.deleteEmailVerification(verification.id);

        // Отправка приветственного письма
        try {
            await emailService.sendWelcomeEmail(user);
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
        }

        // Генерация нового токена с is_verified: true
        const token = generateToken(user);

        res.json({
            message: 'Email успешно подтвержден',
            token,
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
        res.status(500).json({ error: 'Ошибка сервера' });
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
        }

        res.json({ message: 'Ссылка для подтверждения отправлена на email' });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;
