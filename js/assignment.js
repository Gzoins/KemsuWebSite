// assignment.js
document.addEventListener('DOMContentLoaded', async () => {
  const session = window.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const submissionsList = document.getElementById('submissionsList');
  
  if (submissionsList) {
    try {
      const db = await window.fetchDB();
      
      if (session.role === 'teacher') {
        const submissions = db.submissions || [];
        const assignments = db.assignments || [];
        const students = db.students || [];
        
        if (submissions.length === 0) {
          submissionsList.innerHTML = '<p class="small">Нет отправленных работ</p>';
        } else {
          submissionsList.innerHTML = '<div class="table-container"><table><thead><tr><th>Студент</th><th>Группа</th><th>Название работы</th><th>Файлы</th><th>Коммент</th><th>Статус</th><th>Баллы</th><th>Действия</th></tr></thead><tbody>' +
            submissions.map(s => {
              const assignment = assignments.find(a => a.id === s.assignmentId);
              const student = students.find(st => st.login === s.studentLogin);
              const studentName = student ? student.name : s.studentLogin;
              const studentGroup = student ? student.group : '???';
              
              return `
                <tr>
                  <td class="student-submission-cell">
                    <div style="font-weight:600">${window.escapeHtml(studentName)}</div>
                    <div class="small">${window.escapeHtml(s.studentLogin)}</div>
                  </td>
                  <td><span class="status-badge status-submitted">${studentGroup}</span></td>
                  <td><b>${window.escapeHtml(s.workTitle || 'Без названия')}</b></td>
                  <td>
                    ${s.uploadedFiles ? s.uploadedFiles.map(f => 
                      `<a href="${window.API_BASE}${s.url}" target="_blank" class="btn-ghost" style="font-size:0.8rem;margin:2px;display:inline-block">${window.escapeHtml(f)}</a>`
                    ).join('') : '-'}
                  </td>
                  <td style="max-width:200px; font-size:0.85rem; opacity:0.8">${s.comment ? window.escapeHtml(s.comment) : '-'}</td>
                  <td><span class="status-badge status-${s.status}">${s.status}</span></td>
                  <td><b>${s.points !== null ? s.points : '-'}</b></td>
                  <td><button class="btn" style="padding:6px 12px; font-size:0.8rem" onclick="openGradeModal('${s.id}', ${s.points || 0}, '${s.comment || ''}')">Оценить</button></td>
                </tr>
              `;
            }).join('') +
            '</tbody></table></div>';
        }
      } else if (session.role === 'student') {
        const student = session;
        const submissions = (db.submissions || []).filter(s => s.studentLogin === student.login);
        const assignments = db.assignments || [];
        
        if (submissions.length === 0) {
          submissionsList.innerHTML = '<p class="small">Вы ещё не отправили ни одной работы</p>';
        } else {
          submissionsList.innerHTML = '<div class="table-container"><table><thead><tr><th>Название работы</th><th>Задание</th><th>Дата</th><th>Статус</th><th>Баллы</th><th>Комментарий преподавателя</th></tr></thead><tbody>' +
            submissions.map(s => {
              const assignment = assignments.find(a => a.id === s.assignmentId);
              return `
                <tr>
                  <td><b>${window.escapeHtml(s.workTitle || 'Без названия')}</b></td>
                  <td>${assignment ? window.escapeHtml(assignment.title) : 'Удалено'}</td>
                  <td class="small">${new Date(s.date).toLocaleDateString()}</td>
                  <td><span class="status-badge status-${s.status}">${s.status}</span></td>
                  <td><b>${s.points !== null ? s.points : '-'}</b></td>
                  <td>${s.comment ? window.escapeHtml(s.comment) : '<span style="opacity:0.5">Нет</span>'}</td>
                </tr>
              `;
            }).join('') +
            '</tbody></table></div>';
        }
      }
    } catch (error) {
      console.error('Failed to load submissions:', error);
      submissionsList.innerHTML = '<p class="error-message">Ошибка загрузки работ</p>';
    }
  }

  const gradeModal = document.getElementById('gradeModal');
  const gradeForm = document.getElementById('gradeForm');
  
  if (gradeForm) {
    gradeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submissionId = document.getElementById('gradeSubmissionId').value;
      const points = parseInt(document.getElementById('gradePoints').value);
      const comment = document.getElementById('gradeComment').value;
      const status = document.getElementById('gradeStatus').value;
      
      try {
        const db = await window.fetchDB();
        const idx = (db.submissions || []).findIndex(s => s.id === submissionId);
        if (idx >= 0) {
          db.submissions[idx] = {
            ...db.submissions[idx],
            points,
            comment,
            status
          };
          await window.saveDBUnified(db);
          
          if (window.showToast) window.showToast('Оценка выставлена!', 'success');
          gradeModal.classList.remove('open');
          setTimeout(() => location.reload(), 500);
        }
      } catch (error) {
        console.error('Failed to grade:', error);
        alert('Ошибка оценки');
      }
    });
  }
});

window.openGradeModal = (id, currentPoints, currentComment) => {
  const modal = document.getElementById('gradeModal');
  const idInput = document.getElementById('gradeSubmissionId');
  const pointsInput = document.getElementById('gradePoints');
  const commentInput = document.getElementById('gradeComment');
  
  if (modal && idInput) {
    idInput.value = id;
    if (pointsInput) pointsInput.value = currentPoints || 0;
    if (commentInput) commentInput.value = currentComment || '';
    modal.classList.add('open');
  }
};