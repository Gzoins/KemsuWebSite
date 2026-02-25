// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const { nanoid } = require('nanoid');

const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch (e) { return null; }
}
function saveDB(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8'); }

if (!loadDB()) {
  const groups = ['ПМИ-251','ПИ-251','КБ-251'];
  const students = [];
  for (let g=0; g<3; g++){
    for (let i=1;i<=20;i++){
      const idx = g*20 + i;
      students.push({ id:`stu_${idx}`, login:`user${idx}`, password:`user${idx}`, name:`Студент ${idx}`, group: groups[g] });
    }
  }
  const teacher = { id: 'tch_1', login: 'teacher', password: 'teacher', name: 'Преподаватель' };
  const assignments = [
    { id: `ass_${nanoid(6)}`, group: 'ПМИ-251', subject: 'Web Dev', title: 'Лабораторная 1', description: 'Сверстать макет', maxScore: 100, deadline: '2024-12-31' }
  ];
  const db = { groups, students, teacher, assignments, submissions: [], lectures: [], resources: [] };
  saveDB(db);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (req,file,cb) => cb(null, UPLOAD_DIR),
  filename: (req,file,cb) => cb(null, `${Date.now()}_${nanoid(6)}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

app.get('/api/db', (req,res) => res.json(loadDB()));

app.post('/api/import', (req,res) => {
  const obj = req.body;
  if (!obj || !Array.isArray(obj.students)) return res.status(400).json({ error:'invalid' });
  saveDB(obj);
  res.json({ ok:true });
});

app.post('/api/submissions', upload.single('file'), (req,res) => {
  const db = loadDB();
  const { assignmentId, studentLogin } = req.body;
  if (!assignmentId || !studentLogin) return res.status(400).json({ error: 'missing data' });
  
  const sub = {
    id: `sub_${nanoid(6)}`,
    assignmentId, studentLogin,
    fileName: req.file ? req.file.filename : null,
    url: req.file ? `/uploads/${req.file.filename}` : null,
    date: new Date().toISOString(),
    status: 'submitted', points: null, comment: null
  };
  
  db.submissions = db.submissions || [];
  const idx = db.submissions.findIndex(s => s.assignmentId === assignmentId && s.studentLogin === studentLogin);
  if (idx >= 0) db.submissions[idx] = { ...db.submissions[idx], ...sub };
  else db.submissions.push(sub);
  
  saveDB(db);
  res.json(sub);
});

app.put('/api/submissions/:id', (req,res) => {
  const db = loadDB();
  const idx = (db.submissions || []).findIndex(x => x.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error:'not found' });
  db.submissions[idx] = { ...db.submissions[idx], ...req.body };
  saveDB(db);
  res.json(db.submissions[idx]);
});

// ===== NEW PROFILE ENDPOINT =====
app.post('/api/profile', (req,res) => {
  const db = loadDB();
  const { login, name, photo } = req.body;
  
  let userData = null;
  
  // Check if it's a student
  const studentIdx = db.students.findIndex(s => s.login === login);
  if (studentIdx >= 0) {
    if (name) db.students[studentIdx].name = name;
    // Photo upload could be saved here
    saveDB(db);
    res.json({ ok:true });
    return;
  }
  
  // Check if it's teacher
  const teacherIdx = db.teacher.login === login ? 0 : -1;
  if (teacherIdx >= 0) {
    if (name) db.teacher.name = name;
    saveDB(db);
    res.json({ ok:true });
    return;
  }
  
  res.status(404).json({ error: 'User not found' });
});

app.listen(PORT, () => console.log(`KemGU Server running on port ${PORT}`));