// main.js

const DB_KEY = 'kemgu_db';
const SESSION_KEY = 'kemgu_session';
const THEME_KEY = 'kemgu_theme';

const USE_SERVER = true;
const KEMGU_API_BASE = 'http://localhost:4001';

function uid(prefix = 'id') { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }
function todayYMD() { return new Date().toISOString().slice(0, 10); }
function isPast(dateYMD) { if (!dateYMD) return false; return new Date(dateYMD + 'T23:59:59') < new Date(); }
function safeJSONParse(s, fallback = null) { try { return JSON.parse(s); } catch (e) { return fallback; } }
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

function loadDBLocal() { try { return JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { return null; } }
function saveDBLocal(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

async function apiFetch(path, opts = {}) {
  if (!USE_SERVER) throw new Error('Server disabled');
  const url = KEMGU_API_BASE + path;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? await res.json() : res;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// иницциализация бдшки
async function fetchDB() {
  if (USE_SERVER) {
    try {
      const db = await apiFetch('/api/db');
      if (db) return db;
    } catch (e) { console.warn('Server unreachable, using local DB'); }
  }
  let db = loadDBLocal();
  if (!db) { initDataLocal(); db = loadDBLocal(); }
  return db;
}

async function saveDBUnified(db) {
  if (USE_SERVER) {
    try {
      await apiFetch('/api/import', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(db) });
      return true;
    } catch (e) {
      console.warn('Server save failed, saving locally');
      saveDBLocal(db);
      return false;
    }
  } else {
    saveDBLocal(db); return true;
  }
}

async function uploadSubmissionFile({ assignmentId, studentLogin, fileInput }) {
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) throw new Error('No file');
  if (USE_SERVER) {
    const fd = new FormData();
    fd.append('assignmentId', assignmentId);
    fd.append('studentLogin', studentLogin);
    fd.append('file', fileInput.files[0]);
    return await apiFetch('/api/submissions', { method: 'POST', body: fd });
  } else {
    const db = loadDBLocal() || {};
    db.submissions = db.submissions || [];
    const file = fileInput.files[0];
    const obj = { 
      id: uid('sub'), assignmentId, studentLogin, 
      fileName: file.name, url: null, 
      date: new Date().toISOString(), 
      status: 'submitted', points: null, comment: null 
    };
    const idx = db.submissions.findIndex(s => s.assignmentId === assignmentId && s.studentLogin === studentLogin);
    if (idx >= 0) db.submissions[idx] = { ...db.submissions[idx], ...obj };
    else db.submissions.push(obj);
    saveDBLocal(db);
    return obj;
  }
}

function setSession(user) { 
  try { 
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); 
  } catch (e) {} 
}

function getSession() { 
  try { 
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)); 
  } catch (e) { return null; } 
}

function clearSession() { 
  try { 
    sessionStorage.removeItem(SESSION_KEY); 
  } catch (e) {} 
}

window.handleLogout = function() {
  clearSession();
  if (window.showToast) {
    window.showToast('Вы успешно вышли из системы', 'info');
  }
  window.location.href = 'index.html';
};

function initTheme() {
  const t = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', t);
}

function setTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem(THEME_KEY, name);
}

function initDataLocal() {
  if (loadDBLocal()) return;
  
  const groups = ['ПМИ-251', 'ПИ-251', 'КБ-251'];
  const students = [];
  for (let g = 0; g < groups.length; g++) {
    for (let i = 1; i <= 20; i++) {
      const idx = g * 20 + i;
      students.push({ 
        id: uid('stu'), login: `user${idx}`, password: `user${idx}`, 
        name: `Студент ${idx}`, group: groups[g] 
      });
    }
  }
  
  const teacher = { id: uid('tch'), login: 'teacher', password: 'teacher', name: 'Преподаватель' };
  
  const assignments = [
    { 
      id: uid('ass'), group: 'ПМИ-251', subject: 'Программирование', 
      title: 'Домашка 1: Основы JS', description: 'Реализовать функции.', 
      maxScore: 100, weight: 0.2, difficulty: 'medium', 
      deadline: todayYMD(), allowRetry: true, maxAttempts: 3 
    }
  ];
  
  // Добавим тестовые лекции
  // а еще не хочу писать свой плеер
  const lectures = [
    {
      id: uid('lec'),
      title: 'Введение в JavaScript',
      description: 'Основы языка программирования JavaScript',
      videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      materials: ['Презентация', 'Конспект'],
      group: 'ПМИ-251'
    },
    {
      id: uid('lec'),
      title: 'React для начинающих',
      description: 'Основы React и компонентный подход',
      videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      materials: ['Исходный код', 'Документация'],
      group: 'ПМИ-251'
    }
  ];
  
  const db = { 
    groups, 
    students, 
    teacher, 
    assignments, 
    submissions: [], 
    lectures: lectures, 
    resources: [] 
  };
  
  saveDBLocal(db);
  console.log('Demo data initialized');
}

function showToast(message, type = 'info', duration = 3000) {
  // контейнер выхода при ошибках
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';
  
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// статус аунтификации слушаем с индекса и передаем на экран 
function requireAuth(redirectTo = 'index.html') {
  const session = getSession();
  if (!session) {
    window.location.href = redirectTo;
    return false;
  }
  return session;
}
// вот так и все, я устал, я спать 

function initApp() {
  try {
    initTheme();
    
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
      const session = getSession();
      if (session) {
        const role = session.role === 'teacher' ? 'teacher' : 'student';
        window.location.href = `${role}.html`;
      }
    }
    
    console.log('KemGU Portal v2.0 Initialized');
  } catch (e) { console.error('initApp error', e); }
}

window.fetchDB = fetchDB;
window.saveDBUnified = saveDBUnified;
window.uploadSubmissionFile = uploadSubmissionFile;
window.setSession = setSession;
window.getSession = getSession;
window.clearSession = clearSession;
window.initApp = initApp;
window.initTheme = initTheme;
window.setTheme = setTheme;
window.initDataLocal = initDataLocal;
window.uid = uid;
window.escapeHtml = escapeHtml;
window.API_BASE = KEMGU_API_BASE;
window.showToast = showToast;
window.requireAuth = requireAuth;

// кнопки выхода входа в аккаунт
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtns = document.querySelectorAll('.btn-logout, #logoutBtn, [data-action="logout"]');
  logoutBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.handleLogout();
    });
  });
  
  initApp();
});
// если бы море было пивом, я бы тоже спать пошел