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

const speakerLine = /^([A-Za-zא-ת'".\- ]{2,})\s+(\d{1,2}:\d{2})$/;
const strictTaskRegex = /(צריך לבדוק|אני אבדוק|נבדוק|אברר|אשאל|אעביר|נשלח|אשלח|נקבע|צריך לקבוע|נמשיך|לפתוח קריאה|לטפל|לעדכן|לתקן|לחזור אליכם)/;
const issueRegex = /(לא עובד|תקלה|נתקע|איטי|איטית|איטיות)/;
const englishMonthDateRegex = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4}),\s*(\d{1,2}:\d{2}\s?(?:AM|PM))\b/i;
const durationLineRegex = /^\s*(\d+h\s+)?\d+m\s+\d+s\s*$/i;
const inlineDurationRegex = /\b(?:\d+h\s+)?\d+m\s+\d+s\b/i;

const isQuestion = (s) => /\?/.test(s) || /^(מה|איך|למה|מתי|האם)\s/.test(s.trim());

function splitIntoSpeakerBlocks(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const blocks = [];
  let current = { speaker: 'לא ידוע', text: [] };

  lines.forEach((line) => {
    const m = line.match(/^([^:]{2,40}):\s*(.+)$/);
    if (m) {
      if (current.text.length) blocks.push({ ...current, text: current.text.join(' ') });
      current = { speaker: m[1].trim(), text: [m[2].trim()] };
      return;
    }

    const metaSpeaker = line.match(speakerLine);
    if (metaSpeaker) {
      if (current.text.length) blocks.push({ ...current, text: current.text.join(' ') });
      current = { speaker: metaSpeaker[1].trim(), text: [] };
      return;
    }

    current.text.push(line);
  });

  if (current.text.length) blocks.push({ ...current, text: current.text.join(' ') });
  return blocks.filter((b) => b.text.length > 4);
}

function classifyRole(speaker) {
  if (/(support|trainer|מדריך|תמיכה|יישום|implementer)/i.test(speaker)) return 'Support / trainer';
  return 'Client';
}

function splitSentencesFromBlocks(blocks) {
  return blocks.flatMap((block) => block.text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5)
    .map((sentence) => ({ sentence, speaker: block.speaker, role: classifyRole(block.speaker) })));
}

function classifySentenceType(sentence) {
  if (issueRegex.test(sentence)) return 'בעיה';
  if (isQuestion(sentence)) return 'שאלה';
  if (/(צריך|אפשר|תבקשו|תשלחו|תעדכנו|נא )/.test(sentence)) return 'בקשה';
  if (strictTaskRegex.test(sentence)) return 'פעולה';
  return 'הסבר';
}

function formatEnglishMonthDateToHebrew(text) {
  const m = text.match(englishMonthDateRegex);
  if (!m) return null;
  const months = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
  const day = String(Number(m[2])).padStart(2, '0');
  const month = String(months[m[1].toLowerCase()]).padStart(2, '0');
  return `${day}/${month}/${m[3]}`;
}

function isValidParticipantName(name) {
  if (!name || name.length < 2) return false;
  if (strictTaskRegex.test(name)) return false;
  if (englishMonthDateRegex.test(name)) return false;
  if (/started transcription/i.test(name)) return false;
  if (/^\d{1,2}[:/]\d{1,2}[:/]\d{2,4}$/.test(name)) return false;
  return true;
}

function extractMetadata(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const top = lines.slice(0, 20).join(' | ');

  const participants = new Set();
  for (const line of lines) {
    const match = line.match(speakerLine);
    if (match) {
      const name = match[1].trim();
      if (isValidParticipantName(name)) participants.add(name);
    }
    const colonMatch = line.match(/^([^:]{2,40}):/);
    if (colonMatch) {
      const name = colonMatch[1].trim();
      if (isValidParticipantName(name)) participants.add(name);
    }
  }

  const company = top.match(/(?:חברה|לקוח|Client|Company)[:\-]?\s*([^|,\n]+)/i)?.[1]?.trim() || document.getElementById('clientName').value.trim() || 'לא זוהה';
  const englishDate = formatEnglishMonthDateToHebrew(text);
  const numericDate = text.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/)?.[1];
  const date = englishDate || numericDate || document.getElementById('meetingDate').value || 'לא זוהה';
  const time = text.match(englishMonthDateRegex)?.[4]?.replace(/\s+/g, '') || 'לא זוהה';
  const duration = lines.find((line) => durationLineRegex.test(line)) || text.match(inlineDurationRegex)?.[0] || `${Math.max(30, Math.round(lines.length / 6))} דקות (משוער)`;
  const explicitTopic = top.match(/(?:נושא|כותרת|Title|Topic)[:\-]?\s*([^|\n]+)/i)?.[1]?.trim();
  const firstContentLine = lines.find((line) => (
    !speakerLine.test(line)
    && !/^(?:חברה|לקוח|Client|Company|תאריך|שעה|משך|duration|משתתפים|נושא|כותרת|Title|Topic)[:\-]/i.test(line)
  ));
  const topic = explicitTopic || (firstContentLine?.length > 6 ? firstContentLine.slice(0, 90) : 'פגישת עבודה');

  const trainer = [...participants].find((name) => /support|מדריך|תמיכה|mida|trainer/i.test(name)) || 'לא זוהה';

  return { company, date, time, duration, topic, participants: participants.size ? [...participants] : ['לא זוהו'], trainer };
}

function classifyOwner(sentence, role) {
  if (role === 'Support / trainer' || /(אני|נבדוק|אבדוק|נעביר|אעביר)/.test(sentence)) return 'אני';
  if (/(פיתוח|שרת|api|באג|תקלה)/i.test(sentence)) return 'פיתוח/תמיכה';
  return 'לקוח';
}

function classifyPriority(sentence) {
  if (/(תקלה|לא עובד|נתקע|דחוף|פיתוח|לא מצליח)/.test(sentence)) return 'גבוהה';
  if (/(לבדוק|לקבוע|לשלוח|לעדכן)/.test(sentence)) return 'בינונית';
  return 'נמוכה';
}

function extractStructuredAnalysis(text) {
  const blocks = splitIntoSpeakerBlocks(text);
  const entries = splitSentencesFromBlocks(blocks).map((entry, idx) => ({ ...entry, id: `s-${idx}`, type: classifySentenceType(entry.sentence) }));

  const objective = entries.slice(0, 10).find((e) => /(מטרה|מטרת|היום נעבור|נעבור על|הדרכה|סקירה|הטמעה)/.test(e.sentence))?.sentence
    || 'מטרת הפגישה זוהתה כהדרכה ותיאום המשך סביב תהליך ההטמעה.';

  const explanationLines = entries.filter((e) => e.type === 'הסבר');
  const topicBuckets = new Map();
  explanationLines.forEach((line) => {
    const key = line.sentence.split(' ').slice(0, 4).join(' ');
    if (!topicBuckets.has(key)) topicBuckets.set(key, []);
    topicBuckets.get(key).push(line.sentence);
  });

  const mainTopics = [...topicBuckets.values()].map((group) => group[0]).slice(0, 6);
  const clientQuestions = entries.filter((e) => e.role === 'Client' && e.type === 'שאלה').map((e) => e.sentence).slice(0, 8);
  const issues = entries.filter((e) => issueRegex.test(e.sentence)).map((e) => e.sentence).slice(0, 8);
  const decisions = entries.filter((e) => /(סיכמנו|נחליט|נקבע)/.test(e.sentence)).map((e) => e.sentence).slice(0, 6);

  const actionable = entries.filter((e) => strictTaskRegex.test(e.sentence));
  const deduped = [];
  const seen = new Set();
  actionable.forEach((e) => {
    const key = e.sentence.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(e);
    }
  });

  const strictTasks = deduped.slice(0, 8).map((e, i) => ({
    id: `task-${i}`,
    title: e.sentence,
    owner: classifyOwner(e.sentence, e.role),
    priority: classifyPriority(e.sentence),
    done: false
  }));

  const devTasks = issues
    .filter((s) => issueRegex.test(s))
    .slice(0, 5)
    .map((s) => `לטפל בבעיה: ${s}`);

  const realTasks = strictTasks.length >= 2 ? strictTasks : [];
  const discussionPoints = entries
    .filter((e) => !strictTaskRegex.test(e.sentence) && e.type !== 'שאלה')
    .map((e) => e.sentence)
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .slice(0, 8);

  const summaryParagraph = `בפגישה הוגדרה מטרה ברורה סביב ${objective}. במהלך השיחה עלו ${mainTopics.length} נושאים מרכזיים, נשאלו ${clientQuestions.length} שאלות מצד הלקוח, וזוהו ${issues.length} בעיות הדורשות התייחסות. בנוסף התקבלו ${decisions.length} החלטות והוגדרו ${realTasks.length} משימות ישימות להמשך עבודה.`;

  const risks = [];
  if (issues.length) risks.push('קיימות תקלות פתוחות שעשויות לעכב את ההטמעה.');
  if (!realTasks.length) risks.push('לא זוהו פעולות מחייבות ולכן קיים סיכון לחוסר המשכיות.');

  return {
    tasks: realTasks,
    sections: {
      executiveSummary: summaryParagraph,
      objective,
      trainedTopics: mainTopics,
      clientQuestions,
      issues,
      decisions,
      realTasks,
      tasksFallbackMessage: realTasks.length < 2 ? 'לא זוהו משימות ברורות מתוך התמלול' : '',
      discussionPoints,
      followUpTasks: realTasks.filter((t) => /נקבע|נתאם|פגישה/.test(t.title)),
      developmentTasks: devTasks,
      risks,
    }
  };
}

function renderMetadata(metadata) { const fields = [ ['חברה/לקוח', metadata.company], ['תאריך', metadata.date], ['שעה', metadata.time], ['משך', metadata.duration], ['נושא', metadata.topic], ['משתתפים', metadata.participants.join(', ')], ['מדריך/תמיכה', metadata.trainer], ]; metadataContent.innerHTML = fields.map(([label, value]) => `<div class="metadata-item"><span>${label}</span><strong>${value}</strong></div>`).join(''); metadataCard.classList.remove('hidden'); }
function getFilteredTasks() { const { tasks, filter } = state; if (filter === 'הכל') return tasks; if (filter === 'שלי') return tasks.filter((t) => t.owner === 'אני'); if (filter === 'לקוח') return tasks.filter((t) => t.owner === 'לקוח'); if (filter === 'תמיכה/פיתוח') return tasks.filter((t) => t.owner === 'פיתוח/תמיכה'); if (filter === 'פתוחות בלבד') return tasks.filter((t) => !t.done); return tasks; }
function renderTaskFilters() { taskFilters.innerHTML = filters.map((f) => `<button type="button" data-filter="${f}" class="filter-btn ${state.filter === f ? 'active' : ''}">${f}</button>`).join(''); }
function renderTasks() { taskList.innerHTML = getFilteredTasks().map((task) => `<li class="task-item ${task.done ? 'done' : ''}"><input type="checkbox" data-id="${task.id}" ${task.done ? 'checked' : ''} /><span>${task.title}</span><span class="tag">${task.owner}</span><span class="tag">${task.priority}</span></li>`).join(''); }

function renderSections(analysis) {
  const sectionRows = [
    ['מטרת הפגישה', [analysis.sections.objective]],
    ['נושאים מרכזיים', analysis.sections.trainedTopics],
    ['שאלות לקוח', analysis.sections.clientQuestions],
    ['בעיות', analysis.sections.issues],
    ['החלטות', analysis.sections.decisions],
    ['משימות', analysis.sections.realTasks.length >= 2 ? analysis.sections.realTasks.map((t) => t.title) : [analysis.sections.tasksFallbackMessage]],
    ['דברים שעלו בפגישה', analysis.sections.discussionPoints],
    ['משימות לפיתוח', analysis.sections.developmentTasks],
    ['סיכונים', analysis.sections.risks],
  ];
  sectionsList.innerHTML = sectionRows.map(([title, items]) => `<article class="section-block"><h4>${title}</h4><ul>${(items.length ? items : ['לא זוהה']).map((i) => `<li>${i}</li>`).join('')}</ul></article>`).join('');
}

function renderAnalysis(analysis) {
  summaryText.textContent = analysis.sections.executiveSummary;
  riskList.innerHTML = analysis.sections.risks.map((risk) => `<li>• ${risk}</li>`).join('');
  followupEmail.textContent = analysis.email;
  riskBadge.textContent = analysis.riskLevel;
  riskBadge.classList.remove('medium', 'high');
  if (analysis.riskLevel === 'גבוה') riskBadge.classList.add('high');
  if (analysis.riskLevel === 'בינוני') riskBadge.classList.add('medium');
  confidenceBadge.textContent = analysis.confidence;
  analysisNote.textContent = 'זהו ניתוח מקומי מובנה מבוסס כוונה ותפקידי דוברים.';
  renderSections(analysis);
  renderTaskFilters(); renderTasks();
  emptyState.classList.add('hidden'); dashboard.classList.remove('hidden');
}

function createAnalysis(metadata, transcript) {
  const structured = extractStructuredAnalysis(transcript);
  const issueCount = structured.sections.issues.length;
  const riskLevel = issueCount > 2 ? 'גבוה' : issueCount > 0 ? 'בינוני' : 'נמוך';
  const confidence = structured.tasks.length >= 3 ? 'גבוהה' : structured.tasks.length >= 1 ? 'בינונית' : 'נמוכה';
  return {
    metadata,
    tasks: structured.tasks,
    sections: structured.sections,
    riskLevel,
    confidence,
    email: `שלום ${metadata.company},\n\nתודה על הפגישה. סיכום מובנה: ${structured.sections.executiveSummary}\n\nנשמח לתאם המשך לפי הצורך.\n\nבברכה,`
  };
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
