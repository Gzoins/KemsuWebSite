// auth.js — обновлённый обработчик входа, совместим с fetchDB() и fallback'ами
document.addEventListener('DOMContentLoaded', async () => {

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

  // обработчик формы
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = (loginInput.value || '').trim();
    const pass = (passInput.value || '').trim();

    if (!login || !pass) { showError('Введите логин и пароль'); return; }

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

      if (db.teacher && login === db.teacher.login && pass === db.teacher.password) {
        const user = { ...db.teacher, role: 'teacher' };
        if (typeof setSession === 'function') setSession(user);
        else sessionStorage.setItem('kemgu_session', JSON.stringify(user));
        // редирект
        if (typeof goTo === 'function') goTo('teacher.html'); else window.location.href = 'teacher.html';
        return;
      }

      const stud = (db.students || []).find(s => s.login === login && s.password === pass);
      if (stud) {
        const user = { ...stud, role: 'student' };
        if (typeof setSession === 'function') setSession(user);
        else sessionStorage.setItem('kemgu_session', JSON.stringify(user));
        if (typeof goTo === 'function') goTo('student.html'); else window.location.href = 'student.html';
        return;
      }

      showError('Неверный логин или пароль');
    } catch (errObj) {
      console.error('Ошибка входа:', errObj);
      showError('Ошибка при попытке входа: ' + (errObj && errObj.message ? errObj.message : String(errObj)));
    }
  });

  if (testStudent) testStudent.addEventListener('click', ()=>{ loginInput.value = 'user1'; passInput.value = 'user1'; });
  if (testTeacher) testTeacher.addEventListener('click', ()=>{ loginInput.value = 'teacher'; passInput.value = 'teacher'; });
});