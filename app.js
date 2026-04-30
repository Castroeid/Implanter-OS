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
const confidenceBadge = document.getElementById('confidenceBadge');
const analysisNote = document.getElementById('analysisNote');
const riskList = document.getElementById('riskList');
const taskFilters = document.getElementById('taskFilters');
const taskList = document.getElementById('taskList');
const sectionsList = document.getElementById('sectionsList');
const followupEmail = document.getElementById('followupEmail');
const copySummaryBtn = document.getElementById('copySummaryBtn');
const copyEmailBtn = document.getElementById('copyEmailBtn');
const copyTasksBtn = document.getElementById('copyTasksBtn');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const uploadStatus = document.getElementById('uploadStatus');

let state = { tasks: [], filter: 'הכל', lastAnalysis: null };
const filters = ['הכל', 'שלי', 'לקוח', 'תמיכה/פיתוח', 'פתוחות בלבד'];

const taskTriggers = [/צריך לבדוק/, /אני אבדוק/, /נבדוק/, /אברר/, /אשאל/, /אעביר לפיתוח/, /נשלח/, /נקבע/, /צריך לקבוע/, /נמשיך בפגישה הבאה/, /לפתוח קריאה/, /לטפל/, /לעדכן/, /לשלוח/, /לחזור אליכם/, /להוסיף/, /לתקן/, /לבדוק מול פיתוח/, /לבדוק מול תמיכה/];

const isQuestion = (s) => /\?|מה |איך |למה |מתי |האם |אפשר|ניתן/.test(s);
const speakerLine = /^([A-Za-zא-ת'".\- ]{2,})\s+(\d{1,2}:\d{2})$/;

function splitSentences(text) {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/[.!?]/))
    .map((s) => s.trim())
    .filter((s) => s.length > 5 && !speakerLine.test(s));
}

function extractMetadata(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const top = lines.slice(0, 20).join(' | ');

  const participants = new Set();
  for (const line of lines) {
    const match = line.match(speakerLine);
    if (match) participants.add(match[1].trim());
  }

  const company = top.match(/(?:חברה|לקוח|Client|Company)[:\-]?\s*([^|,\n]+)/i)?.[1]?.trim() || document.getElementById('clientName').value.trim() || 'לא זוהה';
  const date = text.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/)?.[1] || document.getElementById('meetingDate').value || 'לא זוהה';
  const time = text.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/)?.[0] || 'לא זוהה';
  const duration = text.match(/(?:משך|duration)[:\-]?\s*(\d+\s*(?:דקות|שעות|minutes|hours))/i)?.[1] || `${Math.max(30, Math.round(lines.length / 6))} דקות (משוער)`;
  const topic = lines[0]?.length > 6 ? lines[0].slice(0, 90) : top.match(/(?:נושא|כותרת|Title|Topic)[:\-]?\s*([^|\n]+)/i)?.[1]?.trim() || 'פגישת עבודה';

  const trainer = [...participants].find((name) => /support|מדריך|תמיכה|mida/i.test(name)) || 'לא זוהה';

  return { company, date, time, duration, topic, participants: participants.size ? [...participants] : ['לא זוהו'], trainer };
}

function classifyOwner(sentence) {
  if (/(אני|אבדוק|אשאל|אעביר|אשלח)/.test(sentence)) return 'אני';
  if (/(פיתוח|תקלה|שרת|דירוג לא עובד)/.test(sentence)) return 'פיתוח/תמיכה';
  if (/(אתם|תנסו|תשלחו|תקבעו|תבדקו אצלכם)/.test(sentence)) return 'לקוח';
  return 'אני';
}

function classifyPriority(sentence) {
  if (/(תקלה|לא עובד|נתקע|דחוף|פיתוח|לא מצליח)/.test(sentence)) return 'גבוהה';
  if (/(לבדוק|לקבוע|לשלוח|לעדכן)/.test(sentence)) return 'בינונית';
  return 'נמוכה';
}

function extractTasks(text) {
  const sentences = splitSentences(text);
  const tasks = [];
  sentences.forEach((sentence, index) => {
    if (isQuestion(sentence)) return;
    if (!taskTriggers.some((re) => re.test(sentence))) return;
    tasks.push({
      id: `task-${index}`,
      title: sentence,
      owner: classifyOwner(sentence),
      priority: classifyPriority(sentence),
      done: false
    });
  });
  return tasks;
}

function buildSections(text, tasks) {
  const sentences = splitSentences(text);
  const clientQuestions = sentences.filter((s) => isQuestion(s));
  const issues = sentences.filter((s) => /(לא עובד|תקלה|איטיות|נתקע|שלחתי לפיתוח)/.test(s));
  const followUp = tasks.filter((t) => /נקבע|פגישה הבאה|הדרכה נוספת|לקבוע עוד הדרכה|דוחות/.test(t.title));
  const decisions = sentences.filter((s) => /(הוחלט|נסכם|נסגר|סיכמנו|נקבע)/.test(s));

  if (/דירוג.*AI.*לא עובד|AI.*דירוג.*לא/.test(text)) {
    issues.unshift('דירוג ה-AI לא הוצג בזמן ההדרכה ונדרש לבדוק מול פיתוח/תמיכה.');
  }

  const risks = [];
  if (issues.length) risks.push('קיימות תקלות פתוחות שעשויות לעכב הטמעה.');
  if (followUp.length) risks.push('נדרש תיאום המשך כדי לוודא אימוץ מלא של התהליך.');
  if (!tasks.length) risks.push('לא זוהו משימות ברורות ולכן ייתכן חוסר המשכיות.');

  return {
    executiveSummary: `זוהו ${tasks.length} משימות אמיתיות, ${clientQuestions.length} שאלות לקוח ו-${issues.length} בעיות/תקלות מרכזיות.`,
    objective: sentences.find((s) => /(מטרת|מטרה|הדרכה|סקירה|הטמעה)/.test(s)) || 'מטרת הפגישה לא צוינה במפורש, אך התוכן מצביע על הדרכה ותיאום המשך.',
    trainedTopics: sentences.filter((s) => /(הדרכה|הסברתי|הודגם|הצגנו|דוחות|מערכת)/.test(s)).slice(0, 6),
    clientQuestions: clientQuestions.slice(0, 8),
    issues: issues.slice(0, 8),
    decisions: decisions.slice(0, 6),
    realTasks: tasks,
    followUpTasks: followUp,
    risks,
  };
}

function renderMetadata(metadata) {
  const fields = [
    ['חברה/לקוח', metadata.company], ['תאריך', metadata.date], ['שעה', metadata.time], ['משך', metadata.duration], ['נושא', metadata.topic], ['משתתפים', metadata.participants.join(', ')], ['מדריך/תמיכה', metadata.trainer],
  ];
  metadataContent.innerHTML = fields.map(([label, value]) => `<div class="metadata-item"><span>${label}</span><strong>${value}</strong></div>`).join('');
  metadataCard.classList.remove('hidden');
}

function getFilteredTasks() { const { tasks, filter } = state; if (filter === 'הכל') return tasks; if (filter === 'שלי') return tasks.filter((t) => t.owner === 'אני'); if (filter === 'לקוח') return tasks.filter((t) => t.owner === 'לקוח'); if (filter === 'תמיכה/פיתוח') return tasks.filter((t) => t.owner === 'פיתוח/תמיכה'); if (filter === 'פתוחות בלבד') return tasks.filter((t) => !t.done); return tasks; }
function renderTaskFilters() { taskFilters.innerHTML = filters.map((f) => `<button type="button" data-filter="${f}" class="filter-btn ${state.filter === f ? 'active' : ''}">${f}</button>`).join(''); }
function renderTasks() { taskList.innerHTML = getFilteredTasks().map((task) => `<li class="task-item ${task.done ? 'done' : ''}"><input type="checkbox" data-id="${task.id}" ${task.done ? 'checked' : ''} /><span>${task.title}</span><span class="tag">${task.owner}</span><span class="tag">${task.priority}</span></li>`).join(''); }

function renderSections(analysis) {
  const sectionRows = [
    ['מטרת הפגישה', [analysis.sections.objective]],
    ['נושאים שהודרכו', analysis.sections.trainedTopics],
    ['שאלות לקוח', analysis.sections.clientQuestions],
    ['בעיות/תקלות שעלו', analysis.sections.issues],
    ['החלטות שהתקבלו', analysis.sections.decisions],
    ['משימות לפגישת המשך', analysis.sections.followUpTasks.map((t) => t.title)],
    ['סיכונים', analysis.sections.risks],
  ];
  sectionsList.innerHTML = sectionRows.map(([title, items]) => `<article class="section-block"><h4>${title}</h4><ul>${(items.length ? items : ['לא זוהה']).map((i) => `<li>${i}</li>`).join('')}</ul></article>`).join('');
}

function renderAnalysis(analysis) {
  summaryText.textContent = analysis.sections.executiveSummary;
  riskList.innerHTML = analysis.sections.risks.map((risk) => `<li>• ${risk}</li>`).join('');
  followupEmail.textContent = analysis.email;
  riskBadge.textContent = analysis.riskLevel;
  confidenceBadge.textContent = analysis.confidence;
  analysisNote.textContent = 'זהו ניתוח מקומי ראשוני. ניתוח AI מלא יתווסף בשלב הבא.';
  renderSections(analysis);
  renderTaskFilters(); renderTasks();
  emptyState.classList.add('hidden'); dashboard.classList.remove('hidden');
}

function createAnalysis(metadata, transcript) {
  const tasks = extractTasks(transcript);
  const sections = buildSections(transcript, tasks);
  const issueCount = sections.issues.length;
  const riskLevel = issueCount > 2 ? 'גבוה' : issueCount > 0 ? 'בינוני' : 'נמוך';
  const confidence = tasks.length >= 3 ? 'גבוהה' : tasks.length >= 1 ? 'בינונית' : 'נמוכה';
  return { metadata, tasks, sections, riskLevel, confidence, email: `שלום ${metadata.company},\n\nתודה על הפגישה. להלן סיכום קצר:\n- משימות אמיתיות: ${tasks.length}\n- שאלות לקוח: ${sections.clientQuestions.length}\n- תקלות פתוחות: ${sections.issues.length}\n\nנשמח לתאם המשך לפי הצורך.\n\nבברכה,` };
}

async function copyText(text) { if (text) await navigator.clipboard.writeText(text); }

async function handleFile(file) {
  if (!file) return;
  const ext = file.name.toLowerCase();

  if (ext.endsWith('.txt')) {
    const reader = new FileReader();
    reader.onload = () => {
      transcriptEl.value = String(reader.result || '').trim();
      uploadStatus.textContent = `נטען: ${file.name} | סוג: TXT`;
      renderMetadata(extractMetadata(transcriptEl.value));
    };
    reader.readAsText(file, 'utf-8');
    return;
  }

  if (ext.endsWith('.docx')) {
    try {
      if (!window.mammoth) throw new Error('mammoth missing');
      const data = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer: data });
      transcriptEl.value = String(result.value || '').trim();
      uploadStatus.textContent = `נטען: ${file.name} | סוג: DOCX`;
      renderMetadata(extractMetadata(transcriptEl.value));
    } catch {
      uploadStatus.textContent = 'שגיאה בקריאת קובץ DOCX. נסו קובץ אחר או שמרו מחדש את המסמך.';
    }
    return;
  }

  uploadStatus.textContent = 'ניתן להעלות רק קבצי TXT או DOCX.';
}

fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
['dragenter', 'dragover'].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('active'); }));
['dragleave', 'drop'].forEach((ev) => dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('active'); }));
dropZone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));
dropZone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });
dropZone.addEventListener('click', () => fileInput.click());
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const transcript = transcriptEl.value.trim();
  if (!transcript) return;
  const metadata = extractMetadata(transcript);
  renderMetadata(metadata);
  analyzeBtn.disabled = true; analyzeBtn.textContent = 'מנתח...';
  setTimeout(() => {
    const analysis = createAnalysis(metadata, transcript);
    state.tasks = analysis.tasks; state.filter = 'הכל'; state.lastAnalysis = analysis;
    renderAnalysis(analysis);
    analyzeBtn.disabled = false; analyzeBtn.textContent = 'נתח פגישה';
  }, 500);
});

taskFilters.addEventListener('click', (e) => { const b = e.target.closest('button[data-filter]'); if (!b) return; state.filter = b.dataset.filter; renderTaskFilters(); renderTasks(); });
taskList.addEventListener('change', (e) => { const c = e.target.closest('input[type="checkbox"]'); if (!c) return; const task = state.tasks.find((t) => t.id === c.dataset.id); if (!task) return; task.done = c.checked; renderTasks(); });
copySummaryBtn.addEventListener('click', () => copyText(summaryText.textContent));
copyEmailBtn.addEventListener('click', () => copyText(followupEmail.textContent));
copyTasksBtn.addEventListener('click', () => copyText(state.tasks.map((t) => `- [${t.done ? 'x' : ' '}] ${t.title} | ${t.owner} | ${t.priority}`).join('\n')));
resultSection.classList.remove('hidden');
