// teacher.js
document.addEventListener('DOMContentLoaded', async () => {
  const session = window.getSession();
  
  if (!session || session.role !== 'teacher') {
    window.location.href = 'index.html';
    return;
  }

  const teacher = session; // сессия передать в будующем в моно скриптт
  
  document.getElementById('teacherName').textContent = teacher.name;
  document.getElementById('teacherStats').innerHTML = `
    <div><b>Имя:</b> ${teacher.name}</div>
    <div><b>Логин:</b> ${teacher.login}</div>
  `;
  
 //аватар для профиля препода
  const profileAvatarMini = document.getElementById('profileAvatarMini');
  if (profileAvatarMini) {
    if (teacher.photo) {
      profileAvatarMini.innerHTML = `<img src="${teacher.photo}" alt="Фото">`;
    } else {
      const initials = teacher.name.charAt(0).toUpperCase();
      profileAvatarMini.textContent = initials;
    }
  }

  const assignmentsList = document.getElementById('assignmentsList');
  if (assignmentsList) {
    try {
      const db = await window.fetchDB();
      const assignments = db.assignments || [];
      
      if (assignments.length === 0) {
        assignmentsList.innerHTML = '<p class="small">Нет созданных заданий</p>';
      } else {
        assignmentsList.innerHTML = assignments.map(a => `
          <div class="card">
            <h3>${window.escapeHtml(a.title)}</h3>
            <p class="small">${window.escapeHtml(a.group)} - ${window.escapeHtml(a.subject)}</p>
            <p class="small">Дедлайн: ${a.deadline}</p>
            <p class="small">Макс. балл: ${a.maxScore || a.maxPoints || 100}</p>
            <div class="form-actions">
              <button class="btn-ghost" onclick="editAssignment('${a.id}')">Редактировать</button>
              <button class="btn-ghost btn-danger" onclick="deleteAssignment('${a.id}')">Удалить</button>
            </div>
          </div>
        `).join('');
      }
    } catch (error) {
      console.error('Failed to load assignments:', error);
      assignmentsList.innerHTML = '<p class="error-message">Ошибка загрузки заданий</p>';
    }
  }

  const createBtn = document.getElementById('createAssignmentBtn');
  const createModal = document.getElementById('createAssignmentModal');
  const createForm = document.getElementById('createAssignmentForm');
  
  if (createBtn && createModal) {
    createBtn.addEventListener('click', () => {
      createModal.classList.add('open');
    });
  }
  
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newAssignment = {
        group: document.getElementById('assignmentGroup').value,
        subject: document.getElementById('assignmentSubject').value,
        title: document.getElementById('assignmentTitle').value,
        description: document.getElementById('assignmentDescription').value,
        deadline: document.getElementById('assignmentDeadline').value,
        maxScore: parseInt(document.getElementById('assignmentMaxPoints').value)
      };
      
      try {
        const db = await window.fetchDB();
        newAssignment.id = window.uid('ass');
        db.assignments = db.assignments || [];
        db.assignments.push(newAssignment);
        await window.saveDBUnified(db);
        
        createModal.classList.remove('open');
        createForm.reset();
        if (window.showToast) window.showToast('Задание создано!', 'success');
        setTimeout(() => location.reload(), 500);
      } catch (error) {
        console.error('Failed to create assignment:', error);
        alert('Ошибка создания задания');
      }
    });
  }
  
  const logoutButton = document.getElementById('logoutBtn');
  const logoutLink = document.querySelector('.btn-logout');
  const handleLogout = () => {
    window.clearSession();
    window.location.href = 'index.html';
  };
  
  if (logoutButton) logoutButton.addEventListener('click', handleLogout);
  if (logoutLink) logoutLink.addEventListener('click', handleLogout);
  
  console.log('Teacher module initialized for:', teacher.name);
});

window.editAssignment = (id) => {
  alert('Редактирование задания: ' + id);
};

window.deleteAssignment = async (id) => {
  if (!confirm('Вы уверены, что хотите удалить это задание?')) return;
  
  try {
    const db = await window.fetchDB();
    db.assignments = (db.assignments || []).filter(a => a.id !== id);
    await window.saveDBUnified(db);
    if (window.showToast) window.showToast('Задание удалено', 'success');
    setTimeout(() => location.reload(), 500);
  } catch (error) {
    console.error('Failed to delete assignment:', error);
    alert('Ошибка удаления задания');
  }
};