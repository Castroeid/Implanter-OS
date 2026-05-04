const API_BASE_URL = "https://implanter-os.onrender.com";
const HISTORY_KEY = "implanter_os_meeting_history_v1";
const TASKS_KEY = "implanter_os_tasks";

const form = document.getElementById("meeting-form");
const transcriptEl = document.getElementById("transcript");
const analyzeBtn = document.getElementById("analyzeBtn");
const topSaveMeetingBtn = document.getElementById("topSaveMeetingBtn");
const topNewMeetingBtn = document.getElementById("topNewMeetingBtn");
const topExportPdfBtn = document.getElementById("topExportPdfBtn");
const clearMeetingBtn = document.getElementById("clearMeetingBtn");
const metadataCard = document.getElementById("metadataCard");
const metadataContent = document.getElementById("metadataContent");
const emptyState = document.getElementById("emptyState");
const dashboard = document.getElementById("dashboard");
const statsStrip = document.getElementById("statsStrip");
const summaryCards = document.getElementById("summaryCards");
const summaryText = document.getElementById("summaryText");
const riskBadge = document.getElementById("riskBadge");
const confidenceBadge = document.getElementById("confidenceBadge");
const analysisNote = document.getElementById("analysisNote");
const riskList = document.getElementById("riskList");
const taskList = document.getElementById("taskList");
const sectionsList = document.getElementById("sectionsList");
const followupEmail = document.getElementById("followupEmail");
const implementerTip = document.getElementById("implementerTip");
const loadingPanel = document.getElementById("analysisLoadingPanel");
const toastContainer = document.getElementById("toastContainer");
const copySummaryBtn = document.getElementById("copySummaryBtn");
const copyEmailBtn = document.getElementById("copyEmailBtn");
const copyTasksBtn = document.getElementById("copyTasksBtn");
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const uploadStatus = document.getElementById("uploadStatus");
const analysisTabBtn = document.getElementById("analysisTabBtn");
const historyTabBtn = document.getElementById("historyTabBtn");
const tasksTabBtn = document.getElementById("tasksTabBtn");
const analysisView = document.getElementById("analysisView");
const historyView = document.getElementById("historyView");
const tasksView = document.getElementById("tasksView");
const tasksBoard = document.getElementById("tasksBoard");
const addTasksBtn = document.getElementById("addTasksBtn");
const tasksSearchFilter = document.getElementById("tasksSearchFilter");
const tasksClientFilter = document.getElementById("tasksClientFilter");
const tasksOwnerFilter = document.getElementById("tasksOwnerFilter");
const tasksStatusFilter = document.getElementById("tasksStatusFilter");
const tasksPriorityFilter = document.getElementById("tasksPriorityFilter");
const tasksDateFromFilter = document.getElementById("tasksDateFromFilter");
const tasksDateToFilter = document.getElementById("tasksDateToFilter");
const historyList = document.getElementById("historyList");
const historyClientFilter = document.getElementById("historyClientFilter");
const historyTypeFilter = document.getElementById("historyTypeFilter");
const historyDateFilter = document.getElementById("historyDateFilter");
const storageWarning = document.getElementById("storageWarning");

let lastAnalysis = null;
let lastPayload = null;
let currentMeetingId = null;
let taskState = [];
let localStorageAvailable = true;

function getMeetingSnapshot() {
  return {
    clientName: document.getElementById("clientName")?.value?.trim() || "",
    meetingDate: document.getElementById("meetingDate")?.value || "",
    meetingType: document.getElementById("meetingType")?.value || "",
    transcript: transcriptEl?.value?.trim() || "",
    analysis: lastAnalysis ? { ...lastAnalysis, tasks: taskState.map(({ checked, ...task }) => task) } : null,
    taskCheckboxStates: taskState.map((task) => task.checked),
    taskStatuses: taskState.map((task) => task.status)
  };
}

function hasUnsavedAnalysis() {
  if (!lastAnalysis || !localStorageAvailable) return false;
  if (!currentMeetingId) return true;
  const existing = getHistory().find((item) => item.id === currentMeetingId);
  if (!existing) return true;
  const current = JSON.stringify(getMeetingSnapshot());
  const saved = JSON.stringify({
    clientName: existing.clientName || "",
    meetingDate: existing.meetingDate || "",
    meetingType: existing.meetingType || "",
    transcript: existing.transcript || "",
    analysis: existing.analysis || null,
    taskCheckboxStates: existing.taskCheckboxStates || [],
    taskStatuses: existing.taskStatuses || []
  });
  return current !== saved;
}

const safeText = (v, f = "לא זוהה") => (Array.isArray(v) ? (v.length ? v.join(", ") : f) : v || f);
const getRiskLevel = (risks = []) => (risks.length > 2 ? "גבוה" : risks.length ? "בינוני" : "נמוך");
const riskClassByLevel = { נמוך: "low", בינוני: "medium", גבוה: "high" };

function showToast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
function setLoading(isLoading) {
  analyzeBtn.disabled = isLoading;
  analyzeBtn.textContent = isLoading ? "מנתח ההטמעה עובד..." : "נתח פגישה";
  loadingPanel.classList.toggle("hidden", !isLoading);
}
function renderMetadata(data = {}) {
  const metadata = data.meetingMetadata || data;
  metadataContent.innerHTML = `<div class="metadata-item"><span>לקוח</span><strong>${safeText(metadata.clientName)}</strong></div><div class="metadata-item"><span>תאריך</span><strong>${safeText(metadata.meetingDate)}</strong></div><div class="metadata-item"><span>שעה</span><strong>${safeText(metadata.meetingTime)}</strong></div><div class="metadata-item"><span>משך</span><strong>${safeText(metadata.duration)}</strong></div><div class="metadata-item"><span>סוג פגישה</span><strong>${safeText(metadata.meetingType)}</strong></div><div class="metadata-item"><span>משתתפים</span><strong>${safeText(metadata.participants)}</strong></div><div class="metadata-item"><span>נושא מרכזי</span><strong>${safeText(metadata.mainTopic)}</strong></div>`;
  metadataCard.classList.remove("hidden");
}
const renderList = (items) => (Array.isArray(items) && items.filter(Boolean).length ? items.filter(Boolean).map((i) => `<li>${i}</li>`).join("") : "<li>לא זוהה</li>");

function renderTasks() {
  if (!taskState.length) {
    taskList.innerHTML = `<li class="task-item">לא זוהו משימות ברורות מתוך התמלול.</li>`;
    return;
  }
  taskList.innerHTML = taskState
    .map((task, index) => `<li class="task-item ${task.checked ? "done" : ""}"><input type="checkbox" data-id="${index}" ${task.checked ? "checked" : ""}/><span><strong>${task.title || "משימה ללא כותרת"}</strong><br />${task.description || ""}${task.source ? `<small>מקור: ${task.source}</small>` : ""}</span><span class="tag">${task.owner || "אני"}</span><span class="task-status ${task.status === "בוצעה" ? "done" : "open"}">${task.status}</span></li>`)
    .join("");
}

function renderAnalysis(data) {
  lastAnalysis = structuredClone(data);
  taskState = (data.tasks || []).map((task) => ({ ...task, checked: task.status === "בוצעה", status: task.status === "בוצעה" ? "בוצעה" : "פתוחה" }));
  renderMetadata(data);
  summaryText.textContent = data.executiveSummary || "לא התקבל סיכום.";
  const risks = Array.isArray(data.risks) ? data.risks : [];
  riskList.innerHTML = risks.length ? risks.map((risk) => `<li>${risk}</li>`).join("") : "<li>לא זוהו סיכונים מהותיים</li>";
  followupEmail.textContent = data.followUpEmail || "";
  const riskLevel = getRiskLevel(risks);
  statsStrip.innerHTML = `<article class="stat-item"><span>לקוח</span><strong>${safeText(data.meetingMetadata?.clientName || document.getElementById("clientName")?.value || "לא זוהה")}</strong></article><article class="stat-item"><span>תאריך</span><strong>${safeText(data.meetingMetadata?.meetingDate || document.getElementById("meetingDate")?.value || "לא זוהה")}</strong></article><article class="stat-item"><span>מספר משימות</span><strong>${taskState.length}</strong></article><article class="stat-item"><span>רמת סיכון</span><strong>${riskLevel}</strong></article>`;
  riskBadge.textContent = riskLevel;
  riskBadge.className = `risk-badge ${riskClassByLevel[riskLevel] || "low"}`;
  confidenceBadge.textContent = "רמת ביטחון: גבוהה";
  analysisNote.textContent = "הניתוח הופק באמצעות מנתח ההטמעה דרך שרת מאובטח.";
  implementerTip.textContent = data.implementerFeedback?.nextMeetingRecommendation || "לא התקבלה המלצה לפגישה הבאה.";

  summaryCards.innerHTML = `<article class="summary-card"><span>משימות</span><strong>${taskState.length}</strong></article><article class="summary-card"><span>שאלות לקוח</span><strong>${data.clientQuestions?.length || 0}</strong></article><article class="summary-card"><span>תקלות</span><strong>${data.issuesAndBugs?.length || 0}</strong></article><article class="summary-card"><span>החלטות</span><strong>${data.decisionsMade?.length || 0}</strong></article>`;
  renderTasks();

  const sections = [["מטרת הפגישה", [data.meetingGoal]], ["צרכי לקוח", data.clientNeeds], ["נושאים שנדונו", data.topicsCovered], ["שאלות לקוח", data.clientQuestions], ["תקלות ובאגים", data.issuesAndBugs], ["החלטות שהתקבלו", data.decisionsMade], ["משימות המשך", data.followUpTasks], ["מה עבר טוב", data.implementerFeedback?.whatWentWell], ["מה אפשר לשפר", data.implementerFeedback?.whatCouldImprove], ["אג׳נדה לפגישה הבאה", data.nextMeetingAgenda]];
  sectionsList.innerHTML = sections.map(([title, items]) => `<article class="section-block"><h4>${title}</h4><ul>${renderList(items)}</ul></article>`).join("");
  emptyState.classList.add("hidden");
  dashboard.classList.remove("hidden");
}

function getHistory() { if (!localStorageAvailable) return []; try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; } }
function saveHistory(items) { if (!localStorageAvailable) return; localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); }
function saveOrUpdateMeeting() {
  if (!localStorageAvailable) return;
  const clientNameInput = document.getElementById("clientName")?.value?.trim() || "";
  const fallbackName = clientNameInput || "פגישה ללא שם";
  const meetingDate = document.getElementById("meetingDate")?.value || "";
  const meetingType = document.getElementById("meetingType")?.value || "";
  const transcript = transcriptEl?.value?.trim() || "";
  const hasAnalysis = Boolean(lastAnalysis);
  const payload = { clientName: fallbackName, meetingDate, meetingType, transcript };
  if (!lastPayload) lastPayload = payload;
  const now = new Date().toISOString();
  const history = getHistory();
  const existing = history.find((h) => h.id === currentMeetingId);
  const analysisWithTasks = hasAnalysis ? { ...lastAnalysis, tasks: taskState.map(({ checked, ...t }) => t) } : null;
  const item = {
    id: currentMeetingId || crypto.randomUUID(),
    clientName: fallbackName,
    meetingDate,
    meetingType,
    transcript,
    transcriptPreview: transcript.slice(0, 240),
    analysis: analysisWithTasks,
    taskCheckboxStates: taskState.map((t) => t.checked),
    taskStatuses: taskState.map((t) => t.status),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  const next = [item, ...history.filter((h) => h.id !== item.id)].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  currentMeetingId = item.id;
  lastPayload = payload;
  saveHistory(next);
  renderHistory();
  showToast("הפגישה נשמרה בהצלחה");
}
function getTasksStore() { if (!localStorageAvailable) return []; try { return JSON.parse(localStorage.getItem(TASKS_KEY) || "[]"); } catch { return []; } }
function saveTasksStore(items) { if (!localStorageAvailable) return; localStorage.setItem(TASKS_KEY, JSON.stringify(items)); }
function normalizeTask(task, meetingInfo = {}) {
  const now = new Date().toISOString();
  return {
    id: task.id || crypto.randomUUID(), title: task.title || "משימה ללא כותרת", description: task.description || "",
    clientName: task.clientName || meetingInfo.clientName || "לקוח לא זוהה", meetingDate: task.meetingDate || meetingInfo.meetingDate || "", meetingId: task.meetingId || meetingInfo.meetingId || null,
    owner: task.owner || "אני", priority: task.priority || "בינונית", status: task.status || "פתוחה", source: task.source || "ניתוח פגישה",
    createdAt: task.createdAt || now, updatedAt: now
  };
}
function addCurrentAnalysisTasksToBoard() {
  if (!lastAnalysis || !taskState.length) return showToast("אין ניתוח פעיל לייצוא");
  const meetingInfo = { clientName: document.getElementById("clientName")?.value?.trim() || lastAnalysis.meetingMetadata?.clientName || "לקוח לא זוהה", meetingDate: document.getElementById("meetingDate")?.value || lastAnalysis.meetingMetadata?.meetingDate || "", meetingId: currentMeetingId };
  const existing = getTasksStore();
  const existingKeys = new Set(existing.map((t) => `${t.meetingId || ""}__${(t.title || "").trim()}`));
  const toAdd = taskState.map((task) => normalizeTask({ ...task, source: task.source || "מתוך ניתוח פגישה" }, meetingInfo)).filter((task) => !existingKeys.has(`${task.meetingId || ""}__${task.title.trim()}`));
  saveTasksStore([...toAdd, ...existing]);
  renderTasksBoard();
  showToast("המשימות נוספו ללוח המשימות");
}
function renderTasksBoard() {
 const tasks = getTasksStore(); const search=(tasksSearchFilter?.value||"").trim(); const client=(tasksClientFilter?.value||"").trim();
 const owner=tasksOwnerFilter?.value||""; const status=tasksStatusFilter?.value||""; const priority=tasksPriorityFilter?.value||""; const df=tasksDateFromFilter?.value||""; const dt=tasksDateToFilter?.value||"";
 const filtered = tasks.filter((t)=> (!search || `${t.title} ${t.description} ${t.source}`.includes(search)) && (!client || (t.clientName||"").includes(client)) && (!owner || t.owner===owner) && (!status || t.status===status) && (!priority || t.priority===priority) && (!df || (t.meetingDate && t.meetingDate>=df)) && (!dt || (t.meetingDate && t.meetingDate<=dt)));
 if (!filtered.length) { tasksBoard.innerHTML='<p class="muted">לא נמצאו משימות תואמות.</p>'; return; }
 const groups = filtered.reduce((acc,t)=>{ const key=(t.clientName||"").trim()||"פגישה ללא שם"; (acc[key]=acc[key]||[]).push(t); return acc; },{});
 tasksBoard.innerHTML = Object.entries(groups).map(([clientName,items])=>{ const openCount=items.filter((t)=>t.status!=="בוצעה").length; const highCount=items.filter((t)=>t.priority==="גבוהה").length; const lastDate=items.map((t)=>t.meetingDate||"").sort().reverse()[0]||"לא זוהה"; return `<article class="client-group"><h3>${clientName}</h3><p class="muted">פתוחות: ${openCount} | עדיפות גבוהה: ${highCount} | פגישה אחרונה: ${lastDate}</p><div class="task-cards">${items.map((t)=>`<div class="task-card" data-id="${t.id}"><input type="checkbox" class="board-check" ${t.status==="בוצעה"?"checked":""}/><div><strong>${t.title}</strong><p>${t.description||""}</p><p class="muted">תאריך: ${t.meetingDate||"לא זוהה"} | מקור: ${t.source||""}</p></div><select class="board-owner"><option ${t.owner==="אני"?"selected":""}>אני</option><option ${t.owner==="לקוח"?"selected":""}>לקוח</option><option ${t.owner==="תמיכה"?"selected":""}>תמיכה</option><option ${t.owner==="פיתוח"?"selected":""}>פיתוח</option></select><select class="board-priority"><option ${t.priority==="גבוהה"?"selected":""}>גבוהה</option><option ${t.priority==="בינונית"?"selected":""}>בינונית</option><option ${t.priority==="נמוכה"?"selected":""}>נמוכה</option></select><select class="board-status"><option ${t.status==="פתוחה"?"selected":""}>פתוחה</option><option ${t.status==="בטיפול"?"selected":""}>בטיפול</option><option ${t.status==="ממתין ללקוח"?"selected":""}>ממתין ללקוח</option><option ${t.status==="ממתין לפיתוח"?"selected":""}>ממתין לפיתוח</option><option ${t.status==="בוצעה"?"selected":""}>בוצעה</option></select><button class="ghost open-task-meeting" ${t.meetingId?"":"disabled"}>פתח פגישה</button><button class="danger delete-task">מחק משימה</button></div>`).join("")}</div></article>`}).join('');
}
function updateBoardTask(id, patch) { const tasks=getTasksStore(); const idx=tasks.findIndex((t)=>t.id===id); if (idx<0) return; tasks[idx]={...tasks[idx],...patch,updatedAt:new Date().toISOString()}; saveTasksStore(tasks); renderTasksBoard(); showToast("המשימה עודכנה"); }
function renderHistory() { /* unchanged-ish */
  const clientFilter = (historyClientFilter.value || "").trim();
  const typeFilter = historyTypeFilter.value || "";
  const dateFilter = historyDateFilter.value || "";
  const items = getHistory().filter((item) => (!(item.clientName || "").trim() ? "פגישה ללא שם" : item.clientName).includes(clientFilter) && (!typeFilter || item.meetingType === typeFilter) && (!dateFilter || item.meetingDate === dateFilter));
  if (!items.length) { historyList.innerHTML = '<p class="muted">לא נמצאו פגישות תואמות.</p>'; return; }
  historyList.innerHTML = items.map((item) => `<article class="history-card"><div><h3>${safeText(item.clientName || "פגישה ללא שם")}</h3><p class="muted">תאריך: ${safeText(item.meetingDate)} | סוג: ${safeText(item.meetingType)}</p><p class="muted">משימות: ${item.analysis?.tasks?.length || 0} | רמת סיכון: ${getRiskLevel(item.analysis?.risks || [])}</p></div><div class="history-actions"><button class="ghost open-history" data-id="${item.id}" type="button">פתח ניתוח</button><button class="danger delete-history" data-id="${item.id}" type="button">מחק</button></div></article>`).join("");
}
function loadHistoryAnalysis(id) {
  const item = getHistory().find((h) => h.id === id); if (!item) return;
  currentMeetingId = item.id;
  document.getElementById("clientName").value = item.clientName || "";
  document.getElementById("meetingDate").value = item.meetingDate || "";
  document.getElementById("meetingType").value = item.meetingType || "";
  transcriptEl.value = item.transcript || item.transcriptPreview || "";
  lastPayload = { clientName: item.clientName || "פגישה ללא שם", meetingDate: item.meetingDate || "", meetingType: item.meetingType || "", transcript: transcriptEl.value };
  if (item.analysis) {
    renderAnalysis(item.analysis);
    if (item.taskCheckboxStates?.length === taskState.length) taskState = taskState.map((t, i) => ({ ...t, checked: Boolean(item.taskCheckboxStates[i]), status: item.taskCheckboxStates[i] ? "בוצעה" : "פתוחה" }));
    renderTasks();
  }
  switchTab("analysis");
}
function clearMeeting() {
  if (!confirm("לנקות את הטופס ואת תוצאות הניתוח הנוכחיות?")) return;
  resetMeetingWorkspace();
}

function resetMeetingWorkspace() {
  form.reset();
  transcriptEl.value = "";
  if (fileInput) fileInput.value = "";
  uploadStatus.textContent = "לא נבחר קובץ";
  lastAnalysis = null;
  lastPayload = null;
  currentMeetingId = null;
  taskState = [];
  setLoading(false);
  metadataCard.classList.add("hidden"); dashboard.classList.add("hidden"); emptyState.classList.remove("hidden");
  if (statsStrip) statsStrip.innerHTML = "";
}

function startNewMeeting() {
  if (lastAnalysis && hasUnsavedAnalysis()) {
    const shouldContinue = confirm("האם להתחיל פגישה חדשה? שינויים שלא נשמרו יאבדו.");
    if (!shouldContinue) return;
  }
  resetMeetingWorkspace();
  showToast("נפתחה פגישה חדשה");
}
function deleteHistoryItem(id) { if (!confirm("למחוק את הפגישה מההיסטוריה?")) return; saveHistory(getHistory().filter((item) => item.id !== id)); renderHistory(); }
function switchTab(tab) { const analysisActive = tab === "analysis"; const historyActive = tab === "history"; const tasksActive = tab === "tasks"; analysisTabBtn.classList.toggle("active", analysisActive); historyTabBtn.classList.toggle("active", historyActive); tasksTabBtn.classList.toggle("active", tasksActive); analysisTabBtn.setAttribute("aria-selected", String(analysisActive)); historyTabBtn.setAttribute("aria-selected", String(historyActive)); tasksTabBtn.setAttribute("aria-selected", String(tasksActive)); analysisView.classList.toggle("hidden", !analysisActive); historyView.classList.toggle("hidden", !historyActive); tasksView.classList.toggle("hidden", !tasksActive); if (tasksActive) renderTasksBoard(); }

function exportAnalysisPdf() {
  if (!lastAnalysis) { showToast("אין ניתוח פעיל לייצוא"); return; }
  try {
    const md = lastAnalysis.meetingMetadata || {};
    const meetingDate = document.getElementById("meetingDate")?.value || md.meetingDate || "";
    const sections = [["סיכום מנהלים", lastAnalysis.executiveSummary],["מטרת הפגישה", lastAnalysis.meetingGoal],["צרכי לקוח", lastAnalysis.clientNeeds],["נושאים שנדונו", lastAnalysis.topicsCovered],["שאלות לקוח", lastAnalysis.clientQuestions],["תקלות ובאגים", lastAnalysis.issuesAndBugs],["החלטות", lastAnalysis.decisionsMade],["משימות", taskState.map((t)=>`${t.checked ? "☑" : "☐"} ${t.title || "משימה"} - ${t.status || "פתוחה"}`)],["סיכונים", lastAnalysis.risks],["משוב מטמיע", [...(lastAnalysis.implementerFeedback?.whatWentWell || []), ...(lastAnalysis.implementerFeedback?.whatCouldImprove || [])]],["אג׳נדה לפגישה הבאה", lastAnalysis.nextMeetingAgenda]];
    const renderField = (label, value) => `<p><strong>${label}:</strong> ${safeText(value, "לא זוהה")}</p>`;
    const renderSection = (title, value) => `<section><h2>${title}</h2>${Array.isArray(value) ? `<ul>${renderList(value)}</ul>` : `<p>${safeText(value, "לא זוהה")}</p>`}</section>`;
    const printHtml = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><title>סיכום פגישה - Implanter OS</title><style>@page { size: A4; margin: 16mm; } body { direction: rtl; text-align: right; font-family: Arial, sans-serif; color: #111827; line-height: 1.65; } section { page-break-inside: avoid; margin-bottom: 18px; } h1, h2, h3 { color: #0f2f5f; } ul { padding-right: 24px; } .email-preview { white-space: pre-wrap; border: 1px solid #dbe5f0; padding: 12px; border-radius: 10px; }</style></head><body><h1>Implanter OS - סיכום פגישה</h1>${renderField("שם לקוח", md.clientName || document.getElementById("clientName")?.value || "פגישה ללא שם")}${renderField("תאריך פגישה", meetingDate)}${renderField("סוג פגישה", md.meetingType || document.getElementById("meetingType")?.value || "")}${renderField("משתתפים", md.participants || "")}${sections.map(([t,v])=>renderSection(t,v)).join("")}<section><h2>מייל המשך</h2><div class="email-preview">${safeText(lastAnalysis.followUpEmail || "")}</div></section></body></html>`;
    const printWindow = window.open("", "_blank");
    if (!printWindow) { showToast("הדפדפן חסם את חלון הייצוא. אפשר פתיחת חלונות קופצים ונסה שוב."); return; }
    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 600);
  } catch { showToast("אירעה שגיאה בייצוא ל-PDF"); }
}
async function analyzeMeeting(payload) { const response = await fetch(`${API_BASE_URL}/api/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || data.details || "כשל בניתוח הפגישה בשרת."); return data; }
async function handleFile(file) { if (!file) return; const lowerName = file.name.toLowerCase(); if (lowerName.endsWith(".txt")) { transcriptEl.value = await file.text(); uploadStatus.textContent = `נטען: ${file.name} | TXT`; return; } if (lowerName.endsWith(".docx")) { try { const buffer = await file.arrayBuffer(); const result = await window.mammoth.extractRawText({ arrayBuffer: buffer }); transcriptEl.value = result.value || ""; uploadStatus.textContent = `נטען: ${file.name} | DOCX`; } catch { uploadStatus.textContent = "שגיאה בקריאת DOCX"; } return; } uploadStatus.textContent = "ניתן להעלות רק TXT או DOCX"; }

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = { clientName: document.getElementById("clientName")?.value?.trim() || "לא ידוע", meetingDate: document.getElementById("meetingDate")?.value || "לא ידוע", meetingType: document.getElementById("meetingType")?.value || "לא ידוע", transcript: transcriptEl?.value?.trim() || "" };
  if (!payload.transcript) return alert("אין תמלול לניתוח");
  lastPayload = payload; currentMeetingId = null; renderMetadata(payload); setLoading(true);
  try { const data = await analyzeMeeting(payload); renderAnalysis(data); showToast("הניתוח הושלם בהצלחה"); }
  catch (error) { alert("שגיאה בחיבור לשרת הניתוח: " + error.message); }
  finally { setLoading(false); }
});

taskList?.addEventListener("change", (event) => {
  const idx = Number(event.target?.dataset?.id);
  if (!Number.isInteger(idx) || !taskState[idx]) return;
  const checked = Boolean(event.target.checked);
  taskState[idx].checked = checked;
  taskState[idx].status = checked ? "בוצעה" : "פתוחה";
  renderTasks();
});
topSaveMeetingBtn?.addEventListener("click", saveOrUpdateMeeting);
topNewMeetingBtn?.addEventListener("click", startNewMeeting);
clearMeetingBtn?.addEventListener("click", clearMeeting);
fileInput?.addEventListener("change", (event) => handleFile(event.target.files[0]));
["dragenter", "dragover"].forEach((n) => dropZone?.addEventListener(n, (e) => { e.preventDefault(); dropZone.classList.add("active"); }));
["dragleave", "drop"].forEach((n) => dropZone?.addEventListener(n, (e) => { e.preventDefault(); dropZone.classList.remove("active"); }));
dropZone?.addEventListener("drop", (event) => handleFile(event.dataTransfer.files[0]));
dropZone?.addEventListener("click", () => fileInput?.click());
dropZone?.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") fileInput?.click(); });
copySummaryBtn?.addEventListener("click", () => { navigator.clipboard.writeText(summaryText?.textContent || ""); showToast("הועתק ללוח"); });
copyEmailBtn?.addEventListener("click", () => { navigator.clipboard.writeText(followupEmail?.textContent || ""); showToast("הועתק ללוח"); });
copyTasksBtn?.addEventListener("click", () => { navigator.clipboard.writeText(taskState.map((task) => `- [${task.checked ? "x" : " "}] ${task.title} | ${task.owner} | ${task.priority} | ${task.status}`).join("\n") || "לא זוהו משימות"); showToast("הועתק ללוח"); });
topExportPdfBtn?.addEventListener("click", exportAnalysisPdf);
analysisTabBtn?.addEventListener("click", () => switchTab("analysis"));
historyTabBtn?.addEventListener("click", () => switchTab("history"));
historyList?.addEventListener("click", (event) => { const id = event.target?.dataset?.id; if (!id) return; if (event.target.classList.contains("open-history")) loadHistoryAnalysis(id); if (event.target.classList.contains("delete-history")) deleteHistoryItem(id); });
[historyClientFilter, historyTypeFilter, historyDateFilter].forEach((el) => el?.addEventListener("input", renderHistory));

try { localStorage.setItem("__implanter_test", "1"); localStorage.removeItem("__implanter_test"); } catch { localStorageAvailable = false; storageWarning.classList.remove("hidden"); }
renderHistory();

addTasksBtn?.addEventListener("click", addCurrentAnalysisTasksToBoard);
tasksTabBtn?.addEventListener("click", () => switchTab("tasks"));
[tasksSearchFilter, tasksClientFilter, tasksOwnerFilter, tasksStatusFilter, tasksPriorityFilter, tasksDateFromFilter, tasksDateToFilter].forEach((el)=>el?.addEventListener("input", renderTasksBoard));
tasksBoard?.addEventListener("change", (event) => { const card = event.target.closest(".task-card"); if (!card) return; const id = card.dataset.id; if (event.target.classList.contains("board-check")) return updateBoardTask(id, { status: event.target.checked ? "בוצעה" : "פתוחה" }); if (event.target.classList.contains("board-owner")) return updateBoardTask(id, { owner: event.target.value }); if (event.target.classList.contains("board-priority")) return updateBoardTask(id, { priority: event.target.value }); if (event.target.classList.contains("board-status")) return updateBoardTask(id, { status: event.target.value }); });
tasksBoard?.addEventListener("click", (event) => { const card = event.target.closest(".task-card"); if (!card) return; const id = card.dataset.id; const task = getTasksStore().find((t)=>t.id===id); if (event.target.classList.contains("delete-task")) { saveTasksStore(getTasksStore().filter((t)=>t.id!==id)); renderTasksBoard(); showToast("המשימה נמחקה"); } if (event.target.classList.contains("open-task-meeting") && task?.meetingId) loadHistoryAnalysis(task.meetingId); });
renderTasksBoard();
