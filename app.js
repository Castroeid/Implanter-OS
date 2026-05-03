const API_BASE_URL = "https://implanter-os.onrender.com";
const HISTORY_KEY = "implanter_os_meeting_history_v1";

const form = document.getElementById("meeting-form");
const transcriptEl = document.getElementById("transcript");
const analyzeBtn = document.getElementById("analyzeBtn");
const saveAnalysisBtn = document.getElementById("saveAnalysisBtn");
const clearMeetingBtn = document.getElementById("clearMeetingBtn");
const metadataCard = document.getElementById("metadataCard");
const metadataContent = document.getElementById("metadataContent");
const emptyState = document.getElementById("emptyState");
const dashboard = document.getElementById("dashboard");
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
const exportPdfBtn = document.getElementById("exportPdfBtn");
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const uploadStatus = document.getElementById("uploadStatus");
const analysisTabBtn = document.getElementById("analysisTabBtn");
const historyTabBtn = document.getElementById("historyTabBtn");
const analysisView = document.getElementById("analysisView");
const historyView = document.getElementById("historyView");
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
  saveAnalysisBtn.classList.remove("hidden");
}

function getHistory() { if (!localStorageAvailable) return []; try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; } }
function saveHistory(items) { if (!localStorageAvailable) return; localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); }
function saveOrUpdateMeeting() {
  if (!lastPayload || !lastAnalysis || !localStorageAvailable) return;
  const now = new Date().toISOString();
  const history = getHistory();
  const existing = history.find((h) => h.id === currentMeetingId);
  const analysisWithTasks = { ...lastAnalysis, tasks: taskState.map(({ checked, ...t }) => t) };
  const item = {
    id: currentMeetingId || crypto.randomUUID(),
    clientName: lastPayload.clientName,
    meetingDate: lastPayload.meetingDate,
    meetingType: lastPayload.meetingType,
    transcriptPreview: (lastPayload.transcript || "").slice(0, 240),
    analysis: analysisWithTasks,
    taskCheckboxStates: taskState.map((t) => t.checked),
    taskStatuses: taskState.map((t) => t.status),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  const next = [item, ...history.filter((h) => h.id !== item.id)].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  currentMeetingId = item.id;
  saveHistory(next);
  renderHistory();
  showToast("הניתוח נשמר בהצלחה");
}
function renderHistory() { /* unchanged-ish */
  const clientFilter = (historyClientFilter.value || "").trim();
  const typeFilter = historyTypeFilter.value || "";
  const dateFilter = historyDateFilter.value || "";
  const items = getHistory().filter((item) => (!clientFilter || item.clientName.includes(clientFilter)) && (!typeFilter || item.meetingType === typeFilter) && (!dateFilter || item.meetingDate === dateFilter));
  if (!items.length) { historyList.innerHTML = '<p class="muted">לא נמצאו פגישות תואמות.</p>'; return; }
  historyList.innerHTML = items.map((item) => `<article class="history-card"><div><h3>${safeText(item.clientName)}</h3><p class="muted">תאריך: ${safeText(item.meetingDate)} | סוג: ${safeText(item.meetingType)}</p><p class="muted">משימות: ${item.analysis?.tasks?.length || 0} | רמת סיכון: ${getRiskLevel(item.analysis?.risks || [])}</p></div><div class="history-actions"><button class="ghost open-history" data-id="${item.id}" type="button">פתח ניתוח</button><button class="danger delete-history" data-id="${item.id}" type="button">מחק</button></div></article>`).join("");
}
function loadHistoryAnalysis(id) {
  const item = getHistory().find((h) => h.id === id); if (!item) return;
  currentMeetingId = item.id;
  document.getElementById("clientName").value = item.clientName || "";
  document.getElementById("meetingDate").value = item.meetingDate || "";
  document.getElementById("meetingType").value = item.meetingType || "";
  transcriptEl.value = item.transcriptPreview || "";
  renderAnalysis(item.analysis);
  if (item.taskCheckboxStates?.length === taskState.length) taskState = taskState.map((t, i) => ({ ...t, checked: Boolean(item.taskCheckboxStates[i]), status: item.taskCheckboxStates[i] ? "בוצעה" : "פתוחה" }));
  renderTasks();
  switchTab("analysis");
}
function clearMeeting() {
  if (!confirm("לנקות את הטופס ואת תוצאות הניתוח הנוכחיות?")) return;
  form.reset(); transcriptEl.value = ""; uploadStatus.textContent = "לא נבחר קובץ";
  lastAnalysis = null; lastPayload = null; currentMeetingId = null; taskState = [];
  metadataCard.classList.add("hidden"); dashboard.classList.add("hidden"); emptyState.classList.remove("hidden"); saveAnalysisBtn.classList.add("hidden");
}
function deleteHistoryItem(id) { if (!confirm("למחוק את הפגישה מההיסטוריה?")) return; saveHistory(getHistory().filter((item) => item.id !== id)); renderHistory(); }
function switchTab(tab) { const analysisActive = tab === "analysis"; analysisTabBtn.classList.toggle("active", analysisActive); historyTabBtn.classList.toggle("active", !analysisActive); analysisView.classList.toggle("hidden", !analysisActive); historyView.classList.toggle("hidden", analysisActive); }

function exportAnalysisPdf() {
  if (!lastAnalysis || !window.html2pdf) { alert("לא ניתן לייצא PDF כרגע. נסו שוב בעוד רגע."); return; }
  try {
    showToast("ייצוא PDF התחיל");
    const md = lastAnalysis.meetingMetadata || {};
    const html = `<div dir="rtl" style="font-family:Arial;padding:24px;line-height:1.8;color:#1d2a3a"><h1 style="margin-top:0">סיכום פגישה - Implanter OS</h1><p><strong>לקוח:</strong> ${safeText(md.clientName)}</p><p><strong>תאריך פגישה:</strong> ${safeText(md.meetingDate)}</p><p><strong>סוג פגישה:</strong> ${safeText(md.meetingType)}</p><p><strong>משתתפים:</strong> ${safeText(md.participants)}</p><hr/><h3>סיכום מנהלים</h3><p>${safeText(lastAnalysis.executiveSummary)}</p><h3>מייל המשך</h3><p style="white-space:pre-line">${safeText(lastAnalysis.followUpEmail)}</p></div>`;
    const el = document.createElement("div");
    el.innerHTML = html;
    const clientName = (md.clientName || "client").replace(/\s+/g, "-");
    const meetingDate = md.meetingDate || new Date().toISOString().slice(0, 10);
    window.html2pdf().from(el).set({ margin: 10, filename: `implanter-os-${clientName}-${meetingDate}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" } }).save().then(() => showToast("ייצוא PDF הושלם"));
  } catch { alert("אירעה שגיאה בייצוא ל-PDF. ניתן להמשיך לעבוד ולנסות שוב."); }
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
saveAnalysisBtn?.addEventListener("click", saveOrUpdateMeeting);
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
exportPdfBtn?.addEventListener("click", exportAnalysisPdf);
analysisTabBtn?.addEventListener("click", () => switchTab("analysis"));
historyTabBtn?.addEventListener("click", () => switchTab("history"));
historyList?.addEventListener("click", (event) => { const id = event.target?.dataset?.id; if (!id) return; if (event.target.classList.contains("open-history")) loadHistoryAnalysis(id); if (event.target.classList.contains("delete-history")) deleteHistoryItem(id); });
[historyClientFilter, historyTypeFilter, historyDateFilter].forEach((el) => el?.addEventListener("input", renderHistory));

try { localStorage.setItem("__implanter_test", "1"); localStorage.removeItem("__implanter_test"); } catch { localStorageAvailable = false; storageWarning.classList.remove("hidden"); }
renderHistory();
