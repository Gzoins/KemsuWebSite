// teacher.js - Полная версия с загрузкой из API
document.addEventListener('DOMContentLoaded', async () => {
  const session = window.getSession();
  
  console.log('[TEACHER] Session check:', session);
  
  // Проверка авторизации
  if (!session) {
    console.log('[TEACHER] No session, redirecting to login');
    window.location.href = 'index.html';
    return;
  }
  
  // Проверка роли
  if (session.role !== 'teacher') {
    console.log('[TEACHER] Wrong role:', session.role, 'redirecting to login');
    window.location.href = 'index.html';
    return;
  }

  const teacher = session;
  
  document.getElementById('teacherName').textContent = teacher.name;
  document.getElementById('teacherStats').innerHTML = `
    <div><b>Имя:</b> ${teacher.name}</div>
    <div><b>Email:</b> ${teacher.email}</div>
  `;
  
  // Аватар для профиля
  const profileAvatarMini = document.getElementById('profileAvatarMini');
  if (profileAvatarMini) {
    if (teacher.photo) {
      profileAvatarMini.innerHTML = `<img src="${teacher.photo}" alt="Фото">`;
    } else {
      const initials = teacher.name.charAt(0).toUpperCase();
      profileAvatarMini.textContent = initials;
    }
  }

  // Загрузка заданий из API
  const assignmentsList = document.getElementById('assignmentsList');
  if (assignmentsList) {
    await loadAssignments(assignmentsList);
  }

  // Настройка модальных окон и обработчиков
  setupModalHandlers();
  
  console.log('Teacher module initialized for:', teacher.name);
});

// Функция загрузки заданий
async function loadAssignments(container) {
  try {
    window.kemguLoader.showElement(container);
    
    const session = window.getSession();
    const result = await window.kemguAPI.assignments.getAssignments({ created_by: session.id });
    
    const assignments = result.assignments || [];
    
    if (assignments.length === 0) {
      container.innerHTML = '<p class="small">Нет созданных заданий</p>';
    } else {
      container.innerHTML = assignments.map(a => `
        <div class="card">
          <h3>${escapeHtml(a.title)}</h3>
          <p class="small">${escapeHtml(a.group_name)} - ${escapeHtml(a.description || 'Без описания')}</p>
          <p class="small">Дедлайн: ${formatDate(a.deadline)}</p>
          <p class="small">Макс. балл: ${a.max_score || 100}</p>
          <div class="form-actions">
            <button class="btn-ghost" onclick="window.editAssignment('${a.id}')">Редактировать</button>
            <button class="btn-ghost btn-danger" onclick="window.deleteAssignment('${a.id}')">Удалить</button>
          </div>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Failed to load assignments:', error);
    container.innerHTML = '<p class="error-message">Ошибка загрузки заданий</p>';
  } finally {
    if (window.kemguLoader) window.kemguLoader.hideElement(container);
  }
}

// Настройка модальных окон
function setupModalHandlers() {
  const createBtn = document.getElementById('createAssignmentBtn');
  const createModal = document.getElementById('createAssignmentModal');
  const createForm = document.getElementById('createAssignmentForm');
  const closeButtons = document.querySelectorAll('.modal-close');
  
  // Открытие модального окна
  if (createBtn && createModal) {
    createBtn.addEventListener('click', () => {
      createModal.classList.add('open');
    });
  }
  
  // Закрытие модального окна
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      createModal.classList.remove('open');
    });
  });
  
  // Отправка формы создания задания
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newAssignment = {
        group_name: document.getElementById('assignmentGroup').value,
        title: document.getElementById('assignmentTitle').value.trim(),
        description: document.getElementById('assignmentDescription').value.trim(),
        deadline: document.getElementById('assignmentDeadline').value,
        max_score: parseInt(document.getElementById('assignmentMaxPoints').value)
      };
      
      const submitBtn = createForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Создание...';
      submitBtn.disabled = true;
      
      try {
        await window.kemguAPI.assignments.createAssignment(newAssignment);
        
        createModal.classList.remove('open');
        createForm.reset();
        
        if (window.showToast) window.showToast('Задание создано!', 'success');
        
        // Перезагрузка списка заданий
        await loadAssignments(document.getElementById('assignmentsList'));
      } catch (error) {
        console.error('Failed to create assignment:', error);
        alert('Ошибка создания задания: ' + error.message);
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }
}

// Глобальные функции
window.editAssignment = async (id) => {
  alert('Редактирование задания: ' + id + '\nФункция в разработке');
};

window.deleteAssignment = async (id) => {
  if (!confirm('Вы уверены, что хотите удалить это задание?')) return;
  
  try {
    await window.kemguAPI.assignments.deleteAssignment(id);
    
    if (window.showToast) window.showToast('Задание удалено', 'success');
    
    // Перезагрузка списка
    await loadAssignments(document.getElementById('assignmentsList'));
  } catch (error) {
    console.error('Failed to delete assignment:', error);
    alert('Ошибка удаления задания: ' + error.message);
  }
};

// Вспомогательные функции
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDate(dateString) {
  if (!dateString) return 'Не указан';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}
