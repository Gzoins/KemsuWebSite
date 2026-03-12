// auth.js - Обновленный обработчик входа с поддержкой API
console.log('[AUTH] Script loaded');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[AUTH] DOMContentLoaded');
  console.log('[AUTH] window.kemguAPI:', window.kemguAPI);
  
  if (typeof commonInit === 'function') commonInit();

  const form = document.getElementById('loginForm');
  const err = document.getElementById('err');
  const loginInput = document.getElementById('login');
  const passInput = document.getElementById('password');
  const testStudent = document.getElementById('testStudent');
  const testTeacher = document.getElementById('testTeacher');

  function showError(m) {
    if (!err) {
      alert(m);
      return;
    }
    err.style.display = 'block';
    err.textContent = m;
    setTimeout(() => { err.style.display = 'none'; }, 4000);
  }

  // Функция для входа через API
  async function loginWithAPI(credentials) {
    console.log('[AUTH] loginWithAPI called');
    console.log('[AUTH] window.kemguAPI:', window.kemguAPI);
    console.log('[AUTH] window.kemguAPI.auth:', window.kemguAPI?.auth);
    
    try {
      if (!window.kemguAPI) {
        throw new Error('kemguAPI не инициализирован');
      }
      if (!window.kemguAPI.auth) {
        throw new Error('kemguAPI.auth не определен');
      }
      
      const result = await window.kemguAPI.auth.login(credentials);
      console.log('[AUTH] Login result:', result);
      
      if (result.token) {
        window.kemguAPI.setAuthToken(result.token);
        
        // Определяем, на какую страницу перенаправить
        const userRole = result.user.role;
        let redirectPage = 'index.html';
        
        if (userRole === 'teacher') redirectPage = 'teacher.html';
        else if (userRole === 'student') redirectPage = 'student.html';
        else if (userRole === 'admin') redirectPage = 'admin.html'; // если будет админка
        
        window.location.href = redirectPage;
      } else {
        showError('Ошибка авторизации');
      }
    } catch (error) {
      console.error('API Login error:', error);
      showError(error.message || 'Ошибка входа. Проверьте логин и пароль.');
    }
  }

  // Функция для входа через локальную базу (для тестовых пользователей)
  async function loginWithLocalDB(credentials) {
    try {
      let db;
      if (typeof fetchDB === 'function') {
        db = await fetchDB();
      } else if (typeof loadDBLocal === 'function') {
        db = loadDBLocal();
      } else {
        showError('Внутренняя ошибка: нет функции для получения БД');
        return;
      }

      if (!db) { showError('База данных не доступна'); return; }

      const { login, password } = credentials;

      // Проверка преподавателя
      if (db.teacher && login === db.teacher.login && password === db.teacher.password) {
        const user = { ...db.teacher, role: 'teacher' };
        if (typeof setSession === 'function') setSession(user);
        else sessionStorage.setItem('kemgu_session', JSON.stringify(user));
        window.location.href = 'teacher.html';
        return;
      }

      // Проверка студентов
      const stud = (db.students || []).find(s => s.login === login && s.password === password);
      if (stud) {
        const user = { ...stud, role: 'student' };
        if (typeof setSession === 'function') setSession(user);
        else sessionStorage.setItem('kemgu_session', JSON.stringify(user));
        window.location.href = 'student.html';
        return;
      }

      showError('Неверный логин или пароль');
    } catch (errObj) {
      console.error('Ошибка входа:', errObj);
      showError('Ошибка при попытке входа: ' + (errObj && errObj.message ? errObj.message : String(errObj)));
    }
  }

  // Обработчик формы
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = (loginInput.value || '').trim();
    const pass = (passInput.value || '').trim();

    if (!login || !pass) { showError('Введите логин и пароль'); return; }

    // Проверяем, есть ли API
    if (window.kemguAPI && window.kemguAPI.auth) {
      // Используем API для реальной аутентификации
      await loginWithAPI({ email: login, password: pass });
    } else {
      // Используем локальную базу для тестовых пользователей
      await loginWithLocalDB({ login, password });
    }
  });
});
