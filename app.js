const API_BASE_URL = 'https://YOUR-RENDER-URL';

const form = document.getElementById('meeting-form');
const transcriptEl = document.getElementById('transcript');
const analyzeBtn = document.getElementById('analyzeBtn');
const metadataCard = document.getElementById('metadataCard');
const metadataContent = document.getElementById('metadataContent');
const emptyState = document.getElementById('emptyState');
const dashboard = document.getElementById('dashboard');
const summaryCards = document.getElementById('summaryCards');
const summaryText = document.getElementById('summaryText');
const riskBadge = document.getElementById('riskBadge');
const confidenceBadge = document.getElementById('confidenceBadge');
const analysisNote = document.getElementById('analysisNote');
const riskList = document.getElementById('riskList');
const taskList = document.getElementById('taskList');
const sectionsList = document.getElementById('sectionsList');
const followupEmail = document.getElementById('followupEmail');
const copySummaryBtn = document.getElementById('copySummaryBtn');
const copyEmailBtn = document.getElementById('copyEmailBtn');
const copyTasksBtn = document.getElementById('copyTasksBtn');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const uploadStatus = document.getElementById('uploadStatus');

let lastAnalysis = null;

function renderMetadata(data) {
  const rows = Object.entries(data).map(([k, v]) => `<div class="metadata-item"><span>${k}</span><strong>${v}</strong></div>`).join('');
  metadataContent.innerHTML = rows;
  metadataCard.classList.remove('hidden');
}

function renderAnalysis(data) {
  lastAnalysis = data;
  summaryText.textContent = data.executiveSummary || '';
  riskList.innerHTML = (data.risks || []).map((r) => `<li>• ${r}</li>`).join('') || '<li>• לא זוהו סיכונים מהותיים</li>';
  followupEmail.textContent = data.followUpEmail || '';
  const riskLevel = (data.risks || []).length > 2 ? 'גבוה' : (data.risks || []).length ? 'בינוני' : 'נמוך';
  riskBadge.textContent = riskLevel;
  confidenceBadge.textContent = `רמת ביטחון: ${data.tasks?.length ? 'בינונית-גבוהה' : 'בינונית'}`;
  analysisNote.textContent = 'הניתוח הופק באמצעות OpenAI דרך שרת מאובטח.';

  summaryCards.innerHTML = `
    <article class="summary-card"><span>משימות</span><strong>${data.tasks?.length || 0}</strong></article>
    <article class="summary-card"><span>שאלות לקוח</span><strong>${data.clientQuestions?.length || 0}</strong></article>
    <article class="summary-card"><span>תקלות</span><strong>${data.issuesAndBugs?.length || 0}</strong></article>
    <article class="summary-card"><span>החלטות</span><strong>${data.decisionsMade?.length || 0}</strong></article>`;

  taskList.innerHTML = (data.tasks || []).map((t, i) => `<li class="task-item"><input type="checkbox" data-id="${i}" /><span><strong>${t.title}</strong><br/>${t.description}</span><span class="tag">${t.owner}</span><span class="tag">${t.priority}</span></li>`).join('');

  const sections = [
    ['מטרת הפגישה', [data.meetingGoal]],
    ['צרכי לקוח', data.clientNeeds || []],
    ['נושאים שנדונו', data.topicsCovered || []],
    ['שאלות לקוח', data.clientQuestions || []],
    ['תקלות ובאגים', data.issuesAndBugs || []],
    ['החלטות', data.decisionsMade || []],
    ['משימות המשך', data.followUpTasks || []],
    ['משוב למיישם - עבד טוב', data.implementerFeedback?.whatWentWell || []],
    ['משוב למיישם - לשיפור', data.implementerFeedback?.whatCouldImprove || []],
    ['המלצה לפגישה הבאה', [data.implementerFeedback?.nextMeetingRecommendation || '']],
    ['אג׳נדה לפגישה הבאה', data.nextMeetingAgenda || []]
  ];
  sectionsList.innerHTML = sections.map(([title, items]) => `<article class="section-block"><h4>${title}</h4><ul>${(items.length ? items : ['לא זוהה']).map((x) => `<li>${x}</li>`).join('')}</ul></article>`).join('');

  emptyState.classList.add('hidden');
  dashboard.classList.remove('hidden');
}

function localFallback() { return { executiveSummary: 'לא ניתן היה לקבל ניתוח מהשרת. מוצג מצב גיבוי.', meetingGoal: '', clientNeeds: [], topicsCovered: [], clientQuestions: [], issuesAndBugs: [], decisionsMade: [], tasks: [], followUpTasks: [], risks: ['השרת לא זמין כרגע'], implementerFeedback: { whatWentWell: [], whatCouldImprove: [], nextMeetingRecommendation: '' }, followUpEmail: 'אירעה שגיאה בניתוח אוטומטי, נחזור עם סיכום בהקדם.', nextMeetingAgenda: [] }; }

async function analyzeMeeting(payload) {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'כשל בניתוח הפגישה בשרת.');
  }
  return response.json();
}

async function handleFile(file) {
  if (!file) return;
  if (file.name.toLowerCase().endsWith('.txt')) {
    transcriptEl.value = await file.text(); uploadStatus.textContent = `נטען: ${file.name} | TXT`; return;
  }
  if (file.name.toLowerCase().endsWith('.docx')) {
    try { const data = await file.arrayBuffer(); const result = await window.mammoth.extractRawText({ arrayBuffer: data }); transcriptEl.value = result.value || ''; uploadStatus.textContent = `נטען: ${file.name} | DOCX`; } catch { uploadStatus.textContent = 'שגיאה בקריאת DOCX'; }
    return;
  }
  uploadStatus.textContent = 'ניתן להעלות רק TXT או DOCX';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    clientName: document.getElementById('clientName').value.trim(),
    meetingDate: document.getElementById('meetingDate').value,
    meetingType: document.getElementById('meetingType').value,
    transcript: transcriptEl.value.trim()
  };
  if (!payload.clientName || !payload.meetingDate || !payload.meetingType || !payload.transcript) return;

  renderMetadata({ 'לקוח': payload.clientName, 'תאריך': payload.meetingDate, 'סוג פגישה': payload.meetingType });
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'מנתח עם AI...';

  try {
    const data = await analyzeMeeting(payload);
    renderAnalysis(data);
  } catch (error) {
    analysisNote.textContent = `שגיאה: ${error.message}`;
    renderAnalysis(localFallback());
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'נתח פגישה';
  }
});

fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
['dragenter', 'dragover'].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('active'); }));
['dragleave', 'drop'].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('active'); }));
dropZone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

copySummaryBtn.addEventListener('click', () => navigator.clipboard.writeText(summaryText.textContent || ''));
copyEmailBtn.addEventListener('click', () => navigator.clipboard.writeText(followupEmail.textContent || ''));
copyTasksBtn.addEventListener('click', () => navigator.clipboard.writeText((lastAnalysis?.tasks || []).map((t) => `- [ ] ${t.title} | ${t.owner} | ${t.priority}`).join('\n')));
