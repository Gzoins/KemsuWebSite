// student.js
document.addEventListener('DOMContentLoaded', async () => {
  const session = window.getSession();
  
  if (!session || session.role !== 'student') {
    window.location.href = 'index.html';
    return;
  }

  const student = session; 
  
  document.getElementById('studentName').textContent = student.name;
  document.getElementById('userGroup').textContent = student.group;
  document.getElementById('profileFullName').textContent = student.name;
  document.getElementById('profileName').textContent = student.name;
  document.getElementById('profileLogin').textContent = student.login;
  document.getElementById('profileGroup').textContent = student.group;
  document.getElementById('profileStudentId').textContent = `№ ${String(student.id).padStart(6, '0')}`;
  document.getElementById('profileAvatar').textContent = student.name.split(' ')[0][0];
  
  const profileAvatarMini = document.getElementById('profileAvatarMini');
  if (profileAvatarMini) {
    if (student.photo) {
      profileAvatarMini.innerHTML = `<img src="${student.photo}" alt="Фото">`;
    } else {
      const initials = student.name.charAt(0).toUpperCase();
      profileAvatarMini.textContent = initials;
    }
  }
  
  document.getElementById('studentInfo').innerHTML = `
    <div><b>Имя:</b> ${student.name}</div>
    <div><b>Группа:</b> ${student.group}</div>
    <div><b>Логин:</b> ${student.login}</div>
  `;

  const assignmentsList = document.getElementById('assignmentsList');
  if (assignmentsList) {
    try {
      window.kemguLoader.showElement(assignmentsList);
      const db = await window.fetchDB();
      const assignments = (db.assignments || []).filter(a => a.group === student.group);
      const submissions = db.submissions || [];
      
      if (assignments.length === 0) {
        assignmentsList.innerHTML = '<p class="small">Нет доступных заданий</p>';
      } else {
        assignmentsList.innerHTML = assignments.map(a => {
          const existingSub = submissions.find(s => s.assignmentId === a.id && s.studentLogin === student.login);
          const statusBadge = existingSub 
            ? `<span class="status-badge status-${existingSub.status}">${existingSub.status === 'submitted' ? 'Отправлено' : existingSub.status}</span>` 
            : '';
          
          return `
          <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:start;">
              <h3>${window.escapeHtml(a.title)}</h3>
              ${statusBadge}
            </div>
            <p class="small">${window.escapeHtml(a.subject)}</p>
            <p class="small">Дедлайн: ${a.deadline}</p>
            <p class="small">Макс. балл: ${a.maxScore || a.maxPoints || 100}</p>
            ${existingSub 
              ? `<button class="btn-ghost" disabled>Работа отправлена</button>` 
              : `<button class="btn" onclick="openSubmitModal('${a.id}')">Отправить работу</button>`
            }
          </div>
        `}).join('');
      }
    } catch (error) {
      console.error('Failed to load assignments:', error);
      assignmentsList.innerHTML = '<p class="error-message">Ошибка загрузки заданий</p>';
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
          studentLogin: student.login,
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