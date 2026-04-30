const form = document.getElementById('meeting-form');
const transcriptEl = document.getElementById('transcript');
const analyzeBtn = document.getElementById('analyzeBtn');
const metadataCard = document.getElementById('metadataCard');
const metadataContent = document.getElementById('metadataContent');
const resultSection = document.getElementById('results');
const emptyState = document.getElementById('emptyState');
const dashboard = document.getElementById('dashboard');
const summaryCards = document.getElementById('summaryCards');
const summaryText = document.getElementById('summaryText');
const riskBadge = document.getElementById('riskBadge');
const riskList = document.getElementById('riskList');
const taskFilters = document.getElementById('taskFilters');
const taskList = document.getElementById('taskList');
const followupEmail = document.getElementById('followupEmail');
const copySummaryBtn = document.getElementById('copySummaryBtn');
const copyEmailBtn = document.getElementById('copyEmailBtn');
const copyTasksBtn = document.getElementById('copyTasksBtn');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const uploadStatus = document.getElementById('uploadStatus');

let state = { tasks: [], filter: 'הכל', lastAnalysis: null };

const ownerLabels = ['אני', 'לקוח', 'תמיכה', 'פיתוח'];
const filters = ['הכל', 'שלי', 'לקוח', 'תמיכה/פיתוח', 'פתוחות בלבד'];

function extractMetadata(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const topChunk = lines.slice(0, 20).join(' | ');
  const companyMatch = topChunk.match(/(?:חברה|לקוח|Client|Company)[:\-]?\s*([^|,\n]+)/i);
  const dateMatch = text.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/);
  const timeMatch = text.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
  const durationMatch = text.match(/(?:משך|duration)[:\-]?\s*(\d+\s*(?:דקות|שעות|minutes|hours))/i);
  const topicMatch = topChunk.match(/(?:נושא|כותרת|Title|Topic)[:\-]?\s*([^|\n]+)/i);

  const nameRegex = /(?:^|\s)([א-ת]{2,}\s[א-ת]{2,})(?=\s|$)/g;
  const participants = new Set();
  for (const line of lines.slice(0, 40)) {
    const hits = [...line.matchAll(nameRegex)];
    hits.forEach((hit) => {
      const name = hit[1].trim();
      if (name.length >= 4 && participants.size < 8) participants.add(name);
    });
  }

  return {
    company: companyMatch?.[1]?.trim() || document.getElementById('clientName').value.trim() || 'לא זוהה',
    date: dateMatch?.[1] || document.getElementById('meetingDate').value || 'לא זוהה',
    time: timeMatch?.[0] || 'לא זוהה',
    participants: participants.size ? [...participants] : ['לא זוהו'],
    topic: topicMatch?.[1]?.trim() || 'פגישת עבודה שוטפת',
    duration: durationMatch?.[1] || 'לא צוין'
  };
}

function extractTasks(text) {
  const candidateLines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 8);
  const taskLines = candidateLines.filter((line) => /(צריך|נדרש|לבצע|משימה|todo|action|להכין|לעדכן)/i.test(line)).slice(0, 12);
  const source = taskLines.length ? taskLines : [
    'צריך להכין סיכום סטטוס שבועי ללקוח.',
    'נדרש לתאם בדיקות המשך עם צוות הפיתוח.',
    'הלקוח יעביר מסמכי דרישות מעודכנים.',
    'יש לבצע בדיקת ביצועים בסביבת התמיכה.'
  ];

  return source.map((line, index) => {
    const lower = line.toLowerCase();
    const owner = lower.includes('לקוח') ? 'לקוח' : lower.includes('תמיכה') ? 'תמיכה' : lower.includes('פיתוח') ? 'פיתוח' : 'אני';
    const priority = lower.includes('דחוף') || lower.includes('מידי') ? 'גבוהה' : lower.includes('בהמשך') ? 'נמוכה' : 'בינונית';
    return { id: `task-${index}`, title: line.replace(/^[•\-\d.)\s]+/, ''), owner, priority, done: false };
  });
}

function analyzeRisk(tasks, text) {
  const riskyHints = (text.match(/(עיכוב|סיכון|דחייה|תקלה|חסם|escalation)/gi) || []).length;
  const highCount = tasks.filter((task) => task.priority === 'גבוהה').length;
  const score = riskyHints + highCount;
  if (score >= 4) return 'גבוה';
  if (score >= 2) return 'בינוני';
  return 'נמוך';
}

function renderMetadata(metadata) {
  const fields = [
    ['חברה/לקוח', metadata.company],
    ['תאריך', metadata.date],
    ['שעה', metadata.time],
    ['משך', metadata.duration],
    ['נושא', metadata.topic],
    ['משתתפים', metadata.participants.join(', ')],
  ];

  metadataContent.innerHTML = fields
    .map(([label, value]) => `<div class="metadata-item"><span>${label}</span><strong>${value}</strong></div>`)
    .join('');
  metadataCard.classList.remove('hidden');
}

function getFilteredTasks() {
  const { tasks, filter } = state;
  if (filter === 'הכל') return tasks;
  if (filter === 'שלי') return tasks.filter((task) => task.owner === 'אני');
  if (filter === 'לקוח') return tasks.filter((task) => task.owner === 'לקוח');
  if (filter === 'תמיכה/פיתוח') return tasks.filter((task) => ['תמיכה', 'פיתוח'].includes(task.owner));
  if (filter === 'פתוחות בלבד') return tasks.filter((task) => !task.done);
  return tasks;
}

function renderTaskFilters() {
  taskFilters.innerHTML = filters.map((filter) => `<button type="button" data-filter="${filter}" class="filter-btn ${state.filter === filter ? 'active' : ''}">${filter}</button>`).join('');
}

function renderTasks() {
  const filtered = getFilteredTasks();
  taskList.innerHTML = filtered.map((task) => `
    <li class="task-item ${task.done ? 'done' : ''}">
      <input type="checkbox" data-id="${task.id}" ${task.done ? 'checked' : ''} />
      <span>${task.title}</span>
      <span class="tag">${task.owner}</span>
      <span class="tag">${task.priority}</span>
    </li>
  `).join('');
}

function renderSummary(analysis) {
  const openTasks = analysis.tasks.filter((task) => !task.done).length;
  const summaries = [
    ['מספר משימות', analysis.tasks.length],
    ['משימות פתוחות', openTasks],
    ['סיכונים', analysis.riskLevel],
    ['משתתפים', analysis.metadata.participants.length],
  ];

  summaryCards.innerHTML = summaries.map(([title, value]) => `<article class="summary-card"><span>${title}</span><strong>${value}</strong></article>`).join('');
}

function renderAnalysis(analysis) {
  summaryText.textContent = analysis.summary;
  riskList.innerHTML = analysis.risks.map((risk) => `<li>• ${risk}</li>`).join('');
  followupEmail.textContent = analysis.email;
  riskBadge.textContent = analysis.riskLevel;
  riskBadge.className = `risk-badge ${analysis.riskLevel === 'גבוה' ? 'high' : analysis.riskLevel === 'בינוני' ? 'medium' : ''}`;

  renderSummary(analysis);
  renderTaskFilters();
  renderTasks();
  emptyState.classList.add('hidden');
  dashboard.classList.remove('hidden');
}

function createAnalysis(metadata, transcript) {
  const tasks = extractTasks(transcript);
  const riskLevel = analyzeRisk(tasks, transcript);
  const risks = [
    'פערי ציפיות מול הלקוח עלולים לעכב החלטות.',
    'תלות בצוותים נוספים עלולה לדחות מסירה.',
    'ללא מעקב שבועי קיים סיכון לירידת שקיפות.'
  ];

  return {
    metadata,
    tasks,
    riskLevel,
    risks,
    summary: `בפגישה בנושא "${metadata.topic}" עם ${metadata.company}, הוגדרו ${tasks.length} משימות אופרטיביות ונקבעו בעלי אחריות להמשך.`,
    email: `שלום ${metadata.company},\n\nתודה על הפגישה. ריכזנו את עיקרי הסיכום והמשימות להמשך.\nנשמח לאישור ותיאום נקודת מעקב נוספת.\n\nבברכה,`
  };
}

async function copyText(text) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
}

function handleFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.txt')) {
    uploadStatus.textContent = 'ניתן להעלות כרגע רק קבצי TXT.';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    transcriptEl.value = String(reader.result || '').trim();
    uploadStatus.textContent = `נטען: ${file.name}`;
    const metadata = extractMetadata(transcriptEl.value);
    renderMetadata(metadata);
  };
  reader.readAsText(file, 'utf-8');
}

fileInput.addEventListener('change', (event) => handleFile(event.target.files[0]));
['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.add('active');
}));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.remove('active');
}));
dropZone.addEventListener('drop', (event) => handleFile(event.dataTransfer.files[0]));
dropZone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') fileInput.click();
});
dropZone.addEventListener('click', () => fileInput.click());

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const transcript = transcriptEl.value.trim();
  if (!transcript) return;

  const metadata = extractMetadata(transcript);
  renderMetadata(metadata);

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'מנתח...';

  setTimeout(() => {
    const analysis = createAnalysis(metadata, transcript);
    state.tasks = analysis.tasks;
    state.filter = 'הכל';
    state.lastAnalysis = analysis;
    renderAnalysis(analysis);
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'נתח פגישה';
  }, 900);
});

taskFilters.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-filter]');
  if (!button) return;
  state.filter = button.dataset.filter;
  renderTaskFilters();
  renderTasks();
});

taskList.addEventListener('change', (event) => {
  const checkbox = event.target.closest('input[type="checkbox"]');
  if (!checkbox) return;
  const task = state.tasks.find((item) => item.id === checkbox.dataset.id);
  if (!task) return;
  task.done = checkbox.checked;
  if (state.lastAnalysis) renderSummary({ ...state.lastAnalysis, tasks: state.tasks });
  renderTasks();
});

copySummaryBtn.addEventListener('click', () => copyText(summaryText.textContent));
copyEmailBtn.addEventListener('click', () => copyText(followupEmail.textContent));
copyTasksBtn.addEventListener('click', () => {
  const text = state.tasks.map((task) => `- [${task.done ? 'x' : ' '}] ${task.title} | ${task.owner} | ${task.priority}`).join('\n');
  copyText(text);
});

resultSection.classList.remove('hidden');
