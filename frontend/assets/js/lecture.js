// lecture.js

document.addEventListener('DOMContentLoaded', async () => {
  const session = window.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  const lecturesList = document.getElementById('lecturesList');
  
  if (lecturesList) {
    try {
      const db = await window.fetchDB();
      let lectures = db.lectures || [];
      
      if (session.role === 'student') {
        const student = session;
        lectures = lectures.filter(l => l.group === student.group);
      }
      
      if (lectures.length === 0) {
        lecturesList.innerHTML = '<p class="small">Нет доступных лекций</p>';
      } else {
        lecturesList.innerHTML = lectures.map(l => `
          <div class="card">
            <h3>${escapeHtml(l.title)}</h3>
            <p class="small">${escapeHtml(l.subject)} - ${escapeHtml(l.group)}</p>
            ${l.video ? `<iframe width="100%" height="200" src="${l.video}" frameborder="0" allowfullscreen></iframe>` : ''}
            ${l.questions ? `<div class="small"><b>Вопросы:</b> ${l.questions.join(', ')}</div>` : ''}
          </div>
        `).join('');
      }
    } catch (error) {
      console.error('Failed to load lectures:', error);
      lecturesList.innerHTML = '<p class="error-message">Ошибка загрузки лекций</p>';
    }
  }
});