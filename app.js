const API_BASE_URL = "https://implanter-os.onrender.com";

const form = document.getElementById("meeting-form");
const transcriptEl = document.getElementById("transcript");
const analyzeBtn = document.getElementById("analyzeBtn");
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
const copySummaryBtn = document.getElementById("copySummaryBtn");
const copyEmailBtn = document.getElementById("copyEmailBtn");
const copyTasksBtn = document.getElementById("copyTasksBtn");
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const uploadStatus = document.getElementById("uploadStatus");

let lastAnalysis = null;

console.log("✅ Implanter OS app loaded");

function safeText(value, fallback = "לא זוהה") {
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  return value || fallback;
}

function renderMetadata(data = {}) {
  if (!metadataCard || !metadataContent) return;

  const metadata = data.meetingMetadata || data;

  metadataContent.innerHTML = `
    <div class="metadata-item"><span>לקוח</span><strong>${safeText(metadata.clientName || metadata["לקוח"])}</strong></div>
    <div class="metadata-item"><span>תאריך</span><strong>${safeText(metadata.meetingDate || metadata["תאריך"])}</strong></div>
    <div class="metadata-item"><span>שעה</span><strong>${safeText(metadata.meetingTime)}</strong></div>
    <div class="metadata-item"><span>משך</span><strong>${safeText(metadata.duration)}</strong></div>
    <div class="metadata-item"><span>סוג פגישה</span><strong>${safeText(metadata.meetingType || metadata["סוג פגישה"])}</strong></div>
    <div class="metadata-item"><span>משתתפים</span><strong>${safeText(metadata.participants)}</strong></div>
    <div class="metadata-item"><span>נושא מרכזי</span><strong>${safeText(metadata.mainTopic)}</strong></div>
  `;

  metadataCard.classList.remove("hidden");
}

function renderList(items) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return "<li>לא זוהה</li>";
  return list.map((item) => `<li>${item}</li>`).join("");
}

function renderAnalysis(data) {
  lastAnalysis = data;

  renderMetadata(data);

  if (summaryText) {
    summaryText.textContent = data.executiveSummary || "לא התקבל סיכום.";
  }

  const risks = Array.isArray(data.risks) ? data.risks : [];
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];

  if (riskList) {
    riskList.innerHTML = risks.length
      ? risks.map((risk) => `<li>${risk}</li>`).join("")
      : "<li>לא זוהו סיכונים מהותיים</li>";
  }

  if (followupEmail) {
    followupEmail.textContent = data.followUpEmail || "";
  }

  if (riskBadge) {
    riskBadge.textContent = risks.length > 2 ? "גבוה" : risks.length ? "בינוני" : "נמוך";
  }

  if (confidenceBadge) {
    confidenceBadge.textContent = "רמת ביטחון: גבוהה";
  }

  if (analysisNote) {
    analysisNote.textContent = "הניתוח הופק באמצעות AI דרך שרת מאובטח.";
  }

  if (summaryCards) {
    summaryCards.innerHTML = `
      <article class="summary-card"><span>משימות</span><strong>${tasks.length}</strong></article>
      <article class="summary-card"><span>שאלות לקוח</span><strong>${data.clientQuestions?.length || 0}</strong></article>
      <article class="summary-card"><span>תקלות</span><strong>${data.issuesAndBugs?.length || 0}</strong></article>
      <article class="summary-card"><span>החלטות</span><strong>${data.decisionsMade?.length || 0}</strong></article>
    `;
  }

  if (taskList) {
    taskList.innerHTML = tasks.length
      ? tasks.map((task, index) => `
        <li class="task-item">
          <input type="checkbox" data-id="${index}" />
          <span>
            <strong>${task.title || "משימה ללא כותרת"}</strong><br />
            ${task.description || ""}
            ${task.source ? `<small>מקור: ${task.source}</small>` : ""}
          </span>
          <span class="tag">${task.owner || "אני"}</span>
          <span class="tag">${task.priority || "בינונית"}</span>
        </li>
      `).join("")
      : `<li class="task-item">לא זוהו משימות ברורות מתוך התמלול.</li>`;
  }

  const sections = [
    ["מטרת הפגישה", [data.meetingGoal]],
    ["צרכי לקוח", data.clientNeeds],
    ["נושאים שנדונו", data.topicsCovered],
    ["שאלות לקוח", data.clientQuestions],
    ["תקלות ובאגים", data.issuesAndBugs],
    ["החלטות שהתקבלו", data.decisionsMade],
    ["משימות המשך", data.followUpTasks],
    ["מה עבר טוב", data.implementerFeedback?.whatWentWell],
    ["מה אפשר לשפר", data.implementerFeedback?.whatCouldImprove],
    ["המלצה לפגישה הבאה", [data.implementerFeedback?.nextMeetingRecommendation]],
    ["אג׳נדה לפגישה הבאה", data.nextMeetingAgenda]
  ];

  if (sectionsList) {
    sectionsList.innerHTML = sections.map(([title, items]) => `
      <article class="section-block">
        <h4>${title}</h4>
        <ul>${renderList(items)}</ul>
      </article>
    `).join("");
  }

  if (emptyState) emptyState.classList.add("hidden");
  if (dashboard) dashboard.classList.remove("hidden");
}

async function analyzeMeeting(payload) {
  console.log("📡 Sending to backend:", payload);

  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("❌ Backend error:", data);
    throw new Error(data.error || data.details || "כשל בניתוח הפגישה בשרת.");
  }

  console.log("✅ Backend response:", data);
  return data;
}

async function handleFile(file) {
  if (!file) return;

  console.log("📄 File selected:", file.name);

  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".txt")) {
    transcriptEl.value = await file.text();
    uploadStatus.textContent = `נטען: ${file.name} | TXT`;
    return;
  }

  if (lowerName.endsWith(".docx")) {
    try {
      if (!window.mammoth) {
        uploadStatus.textContent = "חסר רכיב לקריאת DOCX. ודא ש-mammoth נטען ב-index.html";
        return;
      }

      const buffer = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
      transcriptEl.value = result.value || "";
      uploadStatus.textContent = `נטען: ${file.name} | DOCX`;
    } catch (error) {
      console.error("❌ DOCX read error:", error);
      uploadStatus.textContent = "שגיאה בקריאת DOCX";
    }
    return;
  }

  uploadStatus.textContent = "ניתן להעלות רק TXT או DOCX";
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    console.log("🔥 Analyze submitted");

    const payload = {
      clientName: document.getElementById("clientName")?.value?.trim() || "לא ידוע",
      meetingDate: document.getElementById("meetingDate")?.value || "לא ידוע",
      meetingType: document.getElementById("meetingType")?.value || "לא ידוע",
      transcript: transcriptEl?.value?.trim() || ""
    };

    if (!payload.transcript) {
      alert("אין תמלול לניתוח");
      return;
    }

    renderMetadata(payload);

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "מנתח עם AI...";

    try {
      const data = await analyzeMeeting(payload);
      renderAnalysis(data);
    } catch (error) {
      console.error("❌ Analyze failed:", error);
      alert("שגיאה בחיבור לשרת הניתוח: " + error.message);
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = "נתח פגישה";
    }
  });
}

if (fileInput) {
  fileInput.addEventListener("change", (event) => {
    handleFile(event.target.files[0]);
  });
}

if (dropZone) {
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("active");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("active");
    });
  });

  dropZone.addEventListener("drop", (event) => {
    handleFile(event.dataTransfer.files[0]);
  });

  dropZone.addEventListener("click", () => {
    fileInput?.click();
  });

  dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      fileInput?.click();
    }
  });
}

copySummaryBtn?.addEventListener("click", () => {
  navigator.clipboard.writeText(summaryText?.textContent || "");
});

copyEmailBtn?.addEventListener("click", () => {
  navigator.clipboard.writeText(followupEmail?.textContent || "");
});

copyTasksBtn?.addEventListener("click", () => {
  const text = (lastAnalysis?.tasks || [])
    .map((task) => `- [ ] ${task.title} | ${task.owner} | ${task.priority}`)
    .join("\n");

  navigator.clipboard.writeText(text || "לא זוהו משימות");
});
