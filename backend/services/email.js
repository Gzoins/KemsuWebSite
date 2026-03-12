const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    try {
      // Проверяем, установлены ли переменные окружения для email
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('Email credentials not configured, email service disabled');
        this.transporter = null;
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
      
      // Проверяем соединение с транспортером
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('Email transporter verification failed:', error);
          this.transporter = null;
        } else {
          console.log('Email transporter ready');
        }
      });
    } catch (error) {
      console.error('Email transporter initialization failed:', error);
      this.transporter = null;
    }
  }

  async sendVerificationCodeEmail(user, code) {
    if (!this.transporter) {
      console.warn('Email service not configured, skipping verification email');
      return;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: 'Код подтверждения регистрации - КемГУ',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">КемГУ</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Образовательный портал</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; margin-top: 20px;">
            <h2 style="color: #333; margin-top: 0;">Добро пожаловать, ${user.name}!</h2>
            
            <p style="color: #666; line-height: 1.6;">Для завершения регистрации введите этот код подтверждения:</p>
            
            <div style="text-align: center; margin: 30px 0; padding: 20px; background: white; border-radius: 8px; border: 2px dashed #667eea;">
              <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea;">${code}</div>
              <p style="margin-top: 10px; color: #999; font-size: 14px;">Код действителен в течение 10 минут</p>
            </div>
            
            <p style="color: #666; font-size: 14px;">Введите этот код в поле подтверждения на сайте.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
              <p style="color: #999; font-size: 12px; margin: 0;">Это письмо отправлено автоматически. Пожалуйста, не отвечайте на него.</p>
              <p style="color: #999; font-size: 12px; margin: 5px 0 0 0;">Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.</p>
            </div>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Verification code email sent to ${user.email}`);
    } catch (error) {
      console.error('Error sending verification code email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  async sendWelcomeEmail(user) {
    if (!this.transporter) {
      console.warn('Email service not configured, skipping welcome email');
      return;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: 'Добро пожаловать в КемГУ!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 12px; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">✅ Аккаунт подтвержден!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Добро пожаловать в образовательный портал КемГУ</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; margin-top: 20px;">
            <h2 style="color: #333; margin-top: 0;">Здравствуйте, ${user.name}!</h2>
            
            <p style="color: #666; line-height: 1.6;">Поздравляем! Ваш email успешно подтвержден, и вы можете начать пользоваться всеми возможностями нашего образовательного портала.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">Ваши данные:</h3>
              <p style="color: #666;"><strong>Email:</strong> ${user.email}</p>
              <p style="color: #666;"><strong>Роль:</strong> ${this.getRoleLabel(user.role)}</p>
              ${user.group_name ? `<p style="color: #666;"><strong>Группа:</strong> ${user.group_name}</p>` : ''}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:4001'}" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Начать обучение</a>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
              <p style="color: #999; font-size: 12px; margin: 0;">Если у вас возникнут вопросы, свяжитесь с нами через форму обратной связи на сайте.</p>
            </div>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Welcome email sent to ${user.email}`);
    } catch (error) {
      console.error('Error sending welcome email:', error);
    }
  }

  getRoleLabel(role) {
    switch (role) {
      case 'admin': return 'Администратор';
      case 'teacher': return 'Преподаватель';
      case 'student': return 'Студент';
      default: return role;
    }
  }
}

module.exports = new EmailService();