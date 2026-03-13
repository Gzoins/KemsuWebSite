// teacher.js - Полная версия с загрузкой из API
console.log('[TEACHER.JS] Script loaded');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[TEACHER] DOMContentLoaded');
  
  // Ждем пока kemguAPI будет доступен
  console.log('[TEACHER] Waiting for kemguAPI...');
  let attempts = 0;
  while (!window.kemguAPI || !window.kemguAPI.assignments) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
    if (attempts > 50) {
      console.error('[TEACHER] kemguAPI not available after waiting');
      const assignmentsList = document.getElementById('assignmentsList');
      if (assignmentsList) {
        assignmentsList.innerHTML = '<p class="error-message">Ошибка: API не доступен. Проверьте подключение к серверу.</p>';
      }
      return;
    }
  }
  console.log('[TEACHER] kemguAPI is available!');
  
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
  
  // Отображаем имя учителя
  const teacherNameEl = document.getElementById('teacherName');
  if (teacherNameEl) {
    teacherNameEl.textContent = teacher.name || 'Преподаватель';
  }
  
  // Отображаем статистику
  const teacherStatsEl = document.getElementById('teacherStats');
  if (teacherStatsEl) {
    teacherStatsEl.innerHTML = `
      <div><b>Имя:</b> ${escapeHtml(teacher.name || '')}</div>
      <div><b>Email:</b> ${escapeHtml(teacher.email || '')}</div>
    `;
  }
  
  // Аватар для профиля
  const profileAvatarMini = document.getElementById('profileAvatarMini');
  if (profileAvatarMini && teacher.photo) {
    profileAvatarMini.innerHTML = `<img src="${teacher.photo}" alt="Фото">`;
  } else if (profileAvatarMini && teacher.name) {
    const initials = teacher.name.charAt(0).toUpperCase();
    profileAvatarMini.textContent = initials;
  }

  // Загрузка заданий
  const assignmentsList = document.getElementById('assignmentsList');
  if (assignmentsList) {
    console.log('[TEACHER] Assignments list element found, loading...');
    await loadAssignments(assignmentsList);
  } else {
    console.warn('[TEACHER] Assignments list element NOT found');
  }

  // Настройка модальных окон и обработчиков
  setupModalHandlers();
  
  console.log('[TEACHER] Module initialized for:', teacher.name);
});

// Функция загрузки заданий
async function loadAssignments(container) {
  try {
    console.log('[TEACHER] loadAssignments called, loader exists:', !!window.kemguLoader);
    if (window.kemguLoader) window.kemguLoader.showElement(container);
    
    const session = window.getSession();
    console.log('[TEACHER] Loading assignments for user:', session?.id);
    console.log('[TEACHER] Session object:', session);
    
    // Проверяем наличие API и сессии
    if (!window.kemguAPI || !window.kemguAPI.assignments) {
      console.error('[TEACHER] kemguAPI.assignments not available');
      throw new Error('API не доступен');
    }
    
    if (!session || !session.id) {
      console.error('[TEACHER] No session or session.id missing');
      throw new Error('Пользователь не авторизован');
    }
    
    console.log('[TEACHER] Calling API with created_by:', session.id);
    
    // Делаем запрос к API с логированием
    let result;
    try {
      result = await window.kemguAPI.assignments.getAssignments({ created_by: session.id });
      console.log('[TEACHER] API call completed');
    } catch (apiError) {
      console.error('[TEACHER] API call failed:', apiError);
      throw new Error('Не удалось загрузить задания: ' + apiError.message);
    }
    
    console.log('[TEACHER] API result:', result);
    console.log('[TEACHER] Assignments from result:', result?.assignments);
    
    const assignments = result?.assignments || [];
    console.log('[TEACHER] Number of assignments:', assignments.length);
    
    if (assignments.length === 0) {
      console.log('[TEACHER] No assignments found, showing empty message');
      container.innerHTML = '<p class="small" style="padding: 20px; text-align: center;">Нет созданных заданий. Нажмите кнопку "+ Создать задание" чтобы добавить первое задание.</p>';
    } else {
      console.log('[TEACHER] Rendering', assignments.length, 'assignments');
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
    console.error('[TEACHER] Failed to load assignments:', error);
    console.error('[TEACHER] Error details:', error.message, error.stack);
    container.innerHTML = '<p class="error-message">Ошибка загрузки заданий: ' + escapeHtml(error.message) + '</p>';
  } finally {
    console.log('[TEACHER] Hiding loader, container:', container);
    if (window.kemguLoader) {
      window.kemguLoader.hideElement(container);
      console.log('[TEACHER] Loader hidden successfully');
    } else {
      console.warn('[TEACHER] kemguLoader not available');
    }
    // Дополнительная страховка - убираем любой spinner внутри контейнера
    const spinners = container.querySelectorAll('.element-loader');
    spinners.forEach(s => s.remove());
    console.log('[TEACHER] Spinners removed:', spinners.length);
  }
}

// Настройка модальных окон
function setupModalHandlers() {
  const createBtn = document.getElementById('createAssignmentBtn');
  const createModal = document.getElementById('createAssignmentModal');
  const createForm = document.getElementById('createAssignmentForm');
  const closeButtons = document.querySelectorAll('.modal-close');
  
  // Открытие модального окна создания
  if (createBtn && createModal) {
    createBtn.addEventListener('click', () => {
      createModal.classList.add('open');
    });
  }
  
  // Закрытие модальных окон
  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) {
        modal.classList.remove('open');
      }
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
        console.log('[TEACHER] Creating assignment:', newAssignment);
        const result = await window.kemguAPI.assignments.createAssignment(newAssignment);
        console.log('[TEACHER] Assignment created:', result);
        
        createModal.classList.remove('open');
        createForm.reset();
        
        if (window.showToast) window.showToast('Задание создано!', 'success');
        
        // Перезагрузка списка заданий
        console.log('[TEACHER] Reloading assignments list...');
        await loadAssignments(document.getElementById('assignmentsList'));
        console.log('[TEACHER] Assignments reloaded successfully');
      } catch (error) {
        console.error('[TEACHER] Failed to create assignment:', error);
        console.error('[TEACHER] Error details:', error.message, error.stack);
        if (window.showToast) {
          window.showToast('Ошибка создания задания: ' + error.message, 'error');
        } else {
          alert('Ошибка создания задания: ' + error.message);
        }
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        console.log('[TEACHER] Form reset completed');
      }
    });
  }
  
  // Отправка формы редактирования задания
  const editForm = document.getElementById('editAssignmentForm');
  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const assignmentId = document.getElementById('editAssignmentId').value;
      const updatedAssignment = {
        group_name: document.getElementById('editAssignmentGroup').value,
        title: document.getElementById('editAssignmentTitle').value.trim(),
        description: document.getElementById('editAssignmentDescription').value.trim(),
        deadline: document.getElementById('editAssignmentDeadline').value,
        max_score: parseInt(document.getElementById('editAssignmentMaxPoints').value)
      };
      
      const submitBtn = editForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Сохранение...';
      submitBtn.disabled = true;
      
      try {
        console.log('[TEACHER] Updating assignment:', assignmentId, updatedAssignment);
        const result = await window.kemguAPI.assignments.updateAssignment(assignmentId, updatedAssignment);
        console.log('[TEACHER] Assignment updated:', result);
        
        const editModal = document.getElementById('editAssignmentModal');
        if (editModal) {
          editModal.classList.remove('open');
        }
        editForm.reset();
        
        if (window.showToast) window.showToast('Задание обновлено!', 'success');
        
        // Перезагрузка списка заданий
        console.log('[TEACHER] Reloading assignments list...');
        await loadAssignments(document.getElementById('assignmentsList'));
        console.log('[TEACHER] Assignments reloaded successfully');
      } catch (error) {
        console.error('[TEACHER] Failed to update assignment:', error);
        console.error('[TEACHER] Error details:', error.message, error.stack);
        if (window.showToast) {
          window.showToast('Ошибка обновления задания: ' + error.message, 'error');
        } else {
          alert('Ошибка обновления задания: ' + error.message);
        }
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        console.log('[TEACHER] Edit form reset completed');
      }
    });
  }
}

// Глобальные функции
window.editAssignment = async (id) => {
  console.log('[TEACHER] Edit assignment clicked for ID:', id);
  
  try {
    // Получаем данные задания
    const assignment = await window.kemguAPI.assignments.getAssignmentById(id);
    console.log('[TEACHER] Assignment data:', assignment);
    
    // Заполняем форму редактирования
    document.getElementById('editAssignmentId').value = assignment.id;
    document.getElementById('editAssignmentGroup').value = assignment.group_name;
    document.getElementById('editAssignmentSubject').value = assignment.title; // Используем title как subject
    document.getElementById('editAssignmentTitle').value = assignment.title;
    document.getElementById('editAssignmentDescription').value = assignment.description || '';
    
    // Обрабатываем deadline - может быть строкой, Date или null
    let deadlineValue = '';
    if (assignment.deadline) {
      if (typeof assignment.deadline === 'string') {
        deadlineValue = assignment.deadline.split('T')[0];
      } else if (assignment.deadline instanceof Date) {
        deadlineValue = assignment.deadline.toISOString().split('T')[0];
      }
    }
    document.getElementById('editAssignmentDeadline').value = deadlineValue;
    
    document.getElementById('editAssignmentMaxPoints').value = assignment.max_score || 100;
    
    // Открываем модальное окно
    const editModal = document.getElementById('editAssignmentModal');
    if (editModal) {
      editModal.classList.add('open');
    }
  } catch (error) {
    console.error('[TEACHER] Error loading assignment:', error);
    alert('Ошибка загрузки данных задания: ' + error.message);
  }
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
