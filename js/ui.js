// ui.js
function showToast(message, type = 'success') {
  const container = document.querySelector('.toast-container') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : '⚠️'}</span><span>${message}</span>`;
  
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

function createToastContainer() {
  const div = document.createElement('div');
  div.className = 'toast-container';
  document.body.appendChild(div);
  return div;
}

function initThemePicker() {
  const anchor = document.getElementById('themeToggle');
  if (!anchor) return;
  
  const existing = document.querySelector('.kg-theme-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.className = 'kg-theme-menu';

  const themes = [
    { id: 'light', name: 'Светлая' },
    { id: 'dark', name: 'Тёмная' },
    { id: 'blue', name: 'Голубая' },
    { id: 'soft', name: 'Мятная' },
  ];

  const currentTheme = localStorage.getItem('kemgu_theme') || 'light';

  themes.forEach((t, i) => {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    
    const swatch = document.createElement('div');
    swatch.className = `theme-swatch ${t.id === 'light' ? 'swatch-light' : t.id === 'dark' ? 'swatch-dark' : t.id === 'blue' ? 'swatch-blue' : 'swatch-soft'}`;
    if (t.id === currentTheme) swatch.classList.add('active');
    
    const tooltip = document.createElement('div');
    tooltip.className = 'theme-tooltip';
    tooltip.textContent = t.name;
    
    swatch.addEventListener('click', () => {
      window.setTheme(t.id);
      document.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      hideMenu();
    });
    
    wrapper.appendChild(swatch);
    wrapper.appendChild(tooltip);
    menu.appendChild(wrapper);
  });

  document.body.appendChild(menu);

  function position() {
    const r = anchor.getBoundingClientRect();
    menu.style.left = `${Math.max(0, r.right - 200)}px`;
    menu.style.top = `${r.bottom + 10}px`;
  }
  
  function showMenu() {
    position(); 
    menu.classList.add('open');
  }
  
  function hideMenu() {
    menu.classList.remove('open');
  }

  anchor.addEventListener('click', (e) => { 
    e.stopPropagation(); 
    if (menu.classList.contains('open')) hideMenu(); 
    else showMenu(); 
  });
  
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== anchor) hideMenu();
  });
  
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, { passive: true });
}

function initProfileMenu() {
  const trigger = document.getElementById('profileTrigger');
  const menu = document.querySelector('.kg-profile-menu');
  
  if (!trigger || !menu) return;

  function closeMenu() {
    menu.classList.remove('open');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.classList.contains('open')) {
      closeMenu();
    } else {
      menu.classList.add('open');
    }
  });

  document.addEventListener('click', () => closeMenu());
  window.addEventListener('resize', closeMenu);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
}

function initModals() {
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  });
  
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay').classList.remove('open');
    });
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });
}

function initUI() {
  initThemePicker();
  initModals();
  initProfileMenu();
}

window.initThemePicker = initThemePicker;
window.openModal = openModal;
window.closeModal = closeModal;
window.initModals = initModals;
window.initProfileMenu = initProfileMenu;
window.initUI = initUI;

document.addEventListener('DOMContentLoaded', initUI);