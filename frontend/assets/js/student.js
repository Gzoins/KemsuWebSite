// student.js
document.addEventListener('DOMContentLoaded', async () => {
  const session = window.getSession();
  
  if (!session || session.role !== 'student') {
    window.location.href = 'index.html';
    return;
  }

  const student = session; 
  
  console.log('[STUDENT] Session data:', student);
  console.log('[STUDENT] Group name from session:', student.group_name);
  console.log('[STUDENT] Group name buffer:', student.group_name ? new TextEncoder().encode(student.group_name) : 'null');
  
  // Safely set text content for elements that might not exist on all pages
  const safeSetText = (id, text) => {
    const el = document.getElementById(id);
    if (el) {
      // Используем textContent для правильной установки текста
      console.log(`[STUDENT] Setting ${id} to:`, text);
      el.textContent = text;
    }
  };
  
  safeSetText('studentName', student.name);
  safeSetText('userGroup', student.group_name || student.group);
  safeSetText('profileFullName', student.name);
  safeSetText('profileName', student.name);
  safeSetText('profileEmail', student.email || '');
  safeSetText('profileGroup', student.group_name || student.group);
  safeSetText('profileStudentId', `№ ${String(student.id).padStart(6, '0')}`);
  
  const avatarEl = document.getElementById('profileAvatar');
  if (avatarEl) {
    avatarEl.textContent = student.name.split(' ')[0][0];
  }
  
  const studentInfoEl = document.getElementById('studentInfo');
  if (studentInfoEl) {
    studentInfoEl.innerHTML = `
      <div><b>Имя:</b> ${student.name}</div>
      <div><b>Группа:</b> ${student.group_name || student.group}</div>
      <div><b>Email:</b> ${student.email}</div>
    `;
  }
  
  const profileAvatarMini = document.getElementById('profileAvatarMini');
  if (profileAvatarMini) {
    if (student.photo) {
      profileAvatarMini.innerHTML = `<img src="${student.photo}" alt="Фото">`;
    } else {
      const initials = student.name.charAt(0).toUpperCase();
      profileAvatarMini.textContent = initials;
    }
  }

  const assignmentsList = document.getElementById('assignmentsList');
  if (assignmentsList) {
    try {
      window.kemguLoader.showElement(assignmentsList);
      
      // Fetch assignments from API for student's group
      const assignmentsData = await window.kemguAPI.assignments.getAssignments({
        group_name: student.group_name || student.group
      });
      
      const assignments = assignmentsData.assignments || [];
      console.log('[STUDENT] Loaded assignments:', assignments.length);
      
      // Fetch submissions for this student
      const submissionsData = await window.kemguAPI.submissions.getSubmissions({
        student_id: student.id
      });
      const submissions = submissionsData.submissions || [];
      console.log('[STUDENT] Loaded submissions:', submissions.length);
      
      if (assignments.length === 0) {
        assignmentsList.innerHTML = '<p class="small">Нет доступных заданий</p>';
      } else {
        assignmentsList.innerHTML = assignments.map(a => {
          const existingSub = submissions.find(s => s.assignment_id === a.id);
          const statusBadge = existingSub 
            ? `<span class="status-badge status-${existingSub.status}">${existingSub.status === 'submitted' ? 'Отправлено' : existingSub.status === 'graded' ? 'Оценено' : 'На проверке'}</span>` 
            : '';
          
          const deadlineDate = a.deadline ? new Date(a.deadline) : null;
          const formattedDeadline = deadlineDate 
            ? deadlineDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'Не указан';
          
          return `
          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:start;">
              <h3>${window.escapeHtml(a.title)}</h3>
              ${statusBadge}
            </div>
            <p class="small">${window.escapeHtml(a.description || 'Без описания')}</p>
            <p class="small">Дедлайн: ${formattedDeadline}</p>
            <p class="small">Макс. балл: ${a.max_score || 100}</p>
            ${existingSub 
              ? `<button class="btn-ghost" disabled>Работа отправлена</button>` 
              : `<button class="btn" onclick="openSubmitModal('${a.id}')">Отправить работу</button>`
            }
          </div>
        `}).join('');
      }
    } catch (error) {
      console.error('Failed to load assignments:', error);
      assignmentsList.innerHTML = '<p class="error-message">Ошибка загрузки заданий: ' + error.message + '</p>';
    }
  }
  
  const logoutButton = document.getElementById('logoutBtn');
  const logoutLink = document.querySelector('.btn-logout');
  const handleLogout = () => {
    window.clearSession();
    window.location.href = 'index.html';
  };
  
  if (logoutButton) logoutButton.addEventListener('click', handleLogout);
  if (logoutLink) logoutLink.addEventListener('click', handleLogout);
  
  console.log('Student module initialized for:', student.name);
});

let tempFiles = [];

window.updateFilesDisplay = function() {
  const input = document.getElementById('submitFiles');
  const preview = document.getElementById('filesPreview');
  tempFiles = Array.from(input.files);
  
  if (tempFiles.length === 0) {
    preview.innerHTML = '';
    return;
  }
  
  preview.innerHTML = tempFiles.map((file, index) => `
    <div class="submission-file-item">
      <span class="file-icon">📄</span>
      <span class="file-name">${window.escapeHtml(file.name)} (${formatFileSize(file.size)})</span>
      <button type="button" class="remove-file-btn" onclick="removeFile(${index})">×</button>
    </div>
  `).join('');
};

window.removeFile = function(index) {
  tempFiles.splice(index, 1);
  updateFilesDisplay();
};

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

window.openSubmitModal = (assignmentId) => {
  const modal = document.getElementById('submitModal');
  const assignmentIdInput = document.getElementById('submitAssignmentId');
  if (modal && assignmentIdInput) {
    assignmentIdInput.value = assignmentId;
    tempFiles = [];
    updateFilesDisplay();
    modal.classList.add('open');
  }
};

const submitForm = document.getElementById('submitForm');
if (submitForm) {
  submitForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const assignmentId = document.getElementById('submitAssignmentId').value;
    const titleInput = document.getElementById('workTitle');
    const commentInput = document.getElementById('submitComment');
    const student = window.getSession(); // сессия — сам студент
    
    if (!tempFiles || tempFiles.length === 0) {
      alert('Пожалуйста, выберите хотя бы один файл');
      return;
    }

    if (!titleInput.value.trim()) {
      alert('Введите название работы');
      return;
    }

    const submitBtn = submitForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Загрузка...';
    submitBtn.disabled = true;

    try {
      let uploadedFiles = [];
      
      for (const file of tempFiles) {
        const submission = await window.uploadSubmissionFile({
          assignmentId,
          studentLogin: student.email,
          fileInput: { files: [file] }
        });
        
        uploadedFiles.push(submission);
      }

      const db = await window.fetchDB();
      const primarySub = uploadedFiles[0];
      
      let idx = (db.submissions || []).findIndex(s => s.id === primarySub.id);
      if (idx >= 0) {
        db.submissions[idx].workTitle = titleInput.value.trim();
        db.submissions[idx].comment = commentInput.value.trim();
        db.submissions[idx].uploadedFiles = uploadedFiles.map(s => s.fileName);
        await window.saveDBUnified(db);
      } else {
        const newSub = {
          ...primarySub,
          workTitle: titleInput.value.trim(),
          comment: commentInput.value.trim(),
          uploadedFiles: uploadedFiles.map(s => s.fileName)
        };
        db.submissions = db.submissions || [];
        db.submissions.push(newSub);
        await window.saveDBUnified(db);
      }

      if (window.showToast) window.showToast('Работа успешно отправлена!', 'success');
      
      document.getElementById('submitModal').classList.remove('open');
      submitForm.reset();
      tempFiles = [];
      updateFilesDisplay();
      setTimeout(() => location.reload(), 1000);
      
    } catch (error) {
      console.error('Submit error:', error);
      alert('Ошибка при отправке: ' + error.message);
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}