// router.js - Система маршрутизации для КемГУ Портала
// Обеспечивает правильный порядок открытия страниц и проверку доступа

(function() {
  'use strict';

  // Конфигурация маршрутов
  const ROUTES = {
    // Публичные страницы (доступны без авторизации)
    'index.html': { 
      authRequired: false, 
      role: null,
      redirectIfAuth: true // Если авторизован - перенаправлять на соответствующую страницу
    },
    'register.html': { 
      authRequired: false, 
      role: null,
      redirectIfAuth: true
    },
    'verify.html': { 
      authRequired: false, 
      role: null,
      redirectIfAuth: true
    },
    
    // Страницы для студентов
    'student.html': { 
      authRequired: true, 
      role: 'student' 
    },
    
    // Страницы для преподавателей
    'teacher.html': { 
      authRequired: true, 
      role: 'teacher' 
    },
    
    // Общие страницы для авторизованных пользователей
    'lecture.html': { 
      authRequired: true, 
      role: null // Доступно всем авторизованным
    },
    'assignment.html': { 
      authRequired: true, 
      role: null 
    },
    'resources.html': { 
      authRequired: true, 
      role: null 
    },
    'profile.html': { 
      authRequired: true, 
      role: null 
    },
    
    // Админ панель
    'admin.html': { 
      authRequired: true, 
      role: 'admin' 
    }
  };

  // Карта перенаправлений после авторизации
  const ROLE_REDIRECTS = {
    'student': 'student.html',
    'teacher': 'teacher.html',
    'admin': 'admin.html'
  };

  /**
   * Получение текущей сессии
   */
  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem('kemgu_session'));
    } catch (e) {
      return null;
    }
  }

  /**
   * Проверка токена аутентификации
   */
  function getToken() {
    return localStorage.getItem('kemgu_token');
  }

  /**
   * Декодирование JWT токена (без проверки подписи)
   */
  function decodeToken(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      
      // Правильное декодирование UTF-8
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );
      
      const decoded = JSON.parse(jsonPayload);
      console.log('[ROUTER] Decoded token payload:', decoded);
      return decoded;
    } catch (e) {
      console.error('[ROUTER] Token decode error:', e);
      return null;
    }
  }

  /**
   * Получение текущего пользователя
   */
  function getCurrentUser() {
    const session = getSession();
    if (session) return session;

    const token = getToken();
    if (token) {
      const payload = decodeToken(token);
      if (payload) {
        return {
          login: payload.login || payload.email,
          name: payload.name,
          role: payload.role,
          group: payload.group_name || payload.group
        };
      }
    }
    return null;
  }

  /**
   * Проверка авторизации
   */
  function isAuthenticated() {
    return !!(getSession() || getToken());
  }

  /**
   * Получение текущей страницы
   */
  function getCurrentPage() {
    const path = window.location.pathname;
    const parts = path.split('/');
    return parts[parts.length - 1] || 'index.html';
  }

  /**
   * Перенаправление на страницу
   */
  function redirectTo(page) {
    console.log(`[ROUTER] Redirecting to: ${page}`);
    window.location.href = page;
  }

  /**
   * Показ ошибки доступа
   */
  function showAccessError(message) {
    console.error(`[ROUTER] Access Error: ${message}`);
    
    // Создаем контейнер для ошибки если его нет
    let container = document.querySelector('.router-error-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'router-error-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 400px;
        z-index: 10000;
      `;
      document.body.appendChild(container);
    }

    const errorBox = document.createElement('div');
    errorBox.style.cssText = `
      background: #dc3545;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideInRight 0.3s ease-out;
    `;
    errorBox.innerHTML = `
      <strong>⛔ Ошибка доступа</strong><br>
      <small>${escapeHtml(message)}</small>
    `;

    container.innerHTML = '';
    container.appendChild(errorBox);

    setTimeout(() => {
      errorBox.style.opacity = '0';
      errorBox.style.transition = 'opacity 0.3s';
      setTimeout(() => container.remove(), 300);
    }, 5000);
  }

  /**
   * Экранирование HTML
   */
  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Основная функция проверки маршрута
   */
  function checkRoute() {
    const currentPage = getCurrentPage();
    const routeConfig = ROUTES[currentPage];

    console.log(`[ROUTER] Checking route: ${currentPage}`, routeConfig);

    // Если маршрут не найден в конфигурации - разрешаем доступ по умолчанию
    if (!routeConfig) {
      console.warn(`[ROUTER] Route ${currentPage} not configured, allowing access`);
      return true;
    }

    const user = getCurrentUser();
    const isAuthed = isAuthenticated();

    console.log(`[ROUTER] User:`, user, 'IsAuthed:', isAuthed);

    // Проверка: требуется ли авторизация
    if (routeConfig.authRequired && !isAuthed) {
      console.log(`[ROUTER] Auth required for ${currentPage}, redirecting to login`);
      showAccessError('Для доступа к этой странице необходимо войти в систему');
      setTimeout(() => redirectTo('index.html'), 1500);
      return false;
    }

    // Проверка: если страница только для авторизованных, но пользователь уже вошел
    if (routeConfig.redirectIfAuth && isAuthed && user) {
      console.log(`[ROUTER] User already authenticated, redirecting to role page`);
      const targetPage = ROLE_REDIRECTS[user.role] || 'student.html';
      // НЕ перенаправляем если уже на нужной странице
      if (targetPage !== currentPage) {
        setTimeout(() => redirectTo(targetPage), 500);
        return false;
      }
    }

    // Проверка роли если указана
    if (routeConfig.role && user && user.role !== routeConfig.role) {
      console.log(`[ROUTER] Wrong role. Expected: ${routeConfig.role}, Got: ${user.role}`);
      showAccessError(`У вас нет прав для доступа к этой странице. Требуется роль: ${getRoleName(routeConfig.role)}`);
      
      // Перенаправляем на соответствующую страницу по роли ТОЛЬКО если это не та же самая страница
      const targetPage = ROLE_REDIRECTS[user.role] || 'index.html';
      if (targetPage !== currentPage) {
        setTimeout(() => {
          redirectTo(targetPage);
        }, 2000);
      }
      return false;
    }

    console.log(`[ROUTER] Access granted to ${currentPage}`);
    return true;
  }

  /**
   * Получение названия роли на русском
   */
  function getRoleName(role) {
    const names = {
      'student': 'Студент',
      'teacher': 'Преподаватель',
      'admin': 'Администратор'
    };
    return names[role] || role;
  }

  /**
   * Инициализация роутера
   */
  function initRouter() {
    console.log('[ROUTER] Initializing...');

    // Проверяем маршрут при загрузке
    const accessGranted = checkRoute();

    if (accessGranted) {
      // Добавляем информацию о пользователе в глобальную область
      window.currentUser = getCurrentUser();
      window.isAuthenticated = isAuthenticated;
      
      console.log('[ROUTER] Initialization complete');
    }

    // Отслеживаем навигацию вперед/назад
    window.addEventListener('popstate', () => {
      console.log('[ROUTER] Popstate detected');
      checkRoute();
    });
  }

  /**
   * Принудительная проверка авторизации (для использования в страницах)
   */
  function requireAuth(redirectToPage = 'index.html') {
    if (!isAuthenticated()) {
      showAccessError('Требуется авторизация');
      setTimeout(() => redirectTo(redirectToPage), 1500);
      return false;
    }
    return true;
  }

  /**
   * Проверка конкретной роли
   */
  function requireRole(requiredRole, redirectToPage = 'index.html') {
    const user = getCurrentUser();
    
    if (!isAuthenticated()) {
      showAccessError('Требуется авторизация');
      setTimeout(() => redirectTo(redirectToPage), 1500);
      return false;
    }
    
    if (user.role !== requiredRole) {
      showAccessError(`Требуется роль: ${getRoleName(requiredRole)}`);
      setTimeout(() => {
        const targetPage = ROLE_REDIRECTS[user.role] || redirectToPage;
        redirectTo(targetPage);
      }, 2000);
      return false;
    }
    
    return true;
  }

  /**
   * Перенаправление на главную страницу по роли пользователя
   */
  function redirectToRoleHome() {
    const user = getCurrentUser();
    if (!user) {
      redirectTo('index.html');
      return;
    }
    
    const targetPage = ROLE_REDIRECTS[user.role];
    if (targetPage) {
      redirectTo(targetPage);
    } else {
      redirectTo('index.html');
    }
  }

  // Экспортируем публичные функции
  window.KemguRouter = {
    init: initRouter,
    checkRoute: checkRoute,
    requireAuth: requireAuth,
    requireRole: requireRole,
    redirectToRoleHome: redirectToRoleHome,
    getCurrentUser: getCurrentUser,
    isAuthenticated: isAuthenticated,
    ROUTES: ROUTES
  };

  // Автоматическая инициализация после загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRouter);
  } else {
    initRouter();
  }

  console.log('[ROUTER] KemguRouter loaded');
})();
