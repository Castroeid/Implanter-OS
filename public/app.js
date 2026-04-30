const STORAGE_KEY = 'implanter_os_data_v1';
const statusOptions = ['Open', 'In Progress', 'Waiting for Client', 'Waiting for Support', 'Waiting for Development', 'Done'];

const state = { meetings: [], tasks: [] };

const form = document.getElementById('meeting-form');
const statusFilterSelect = document.getElementById('filterStatus');
statusOptions.forEach((s) => {
  const opt = document.createElement('option');
  opt.value = s;
  opt.textContent = s;
  statusFilterSelect.appendChild(opt);
});

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  Object.assign(state, JSON.parse(raw));
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function flattenTasks(meetingId, analysis) {
  const groups = [
    ...(analysis.tasksForImplementer || []),
    ...(analysis.tasksForClient || []),
    ...(analysis.tasksForSupportDevelopment || []),
  ];

  return groups.map((task, i) => ({
    id: `${meetingId}-task-${i + 1}`,
    title: task.title,
    description: task.description,
    owner: task.owner || 'Implementer',
    sourceMeeting: meetingId,
    priority: task.priority || 'Medium',
    status: 'Open',
    dueDate: task.dueDate || '',
  }));
}

function render() {
  const fc = document.getElementById('filterClient').value.toLowerCase();
  const fs = document.getElementById('filterStatus').value;
  const fr = document.getElementById('filterRisk').value;
  const fo = document.getElementById('filterOwner').value;

  const cardsContainer = document.getElementById('meetingCards');
  const tasksContainer = document.getElementById('taskList');

  const filteredMeetings = state.meetings.filter((m) =>
    (!fc || m.clientName.toLowerCase().includes(fc)) &&
    (!fs || m.status === fs) &&
    (!fr || m.riskLevel === fr) &&
    (!fo || state.tasks.some((t) => t.sourceMeeting === m.id && t.owner === fo))
  );

  cardsContainer.innerHTML = filteredMeetings.map((m) => {
    const openTasks = state.tasks.filter((t) => t.sourceMeeting === m.id && t.status !== 'Done').length;
    return `<article class="card">
      <h3>${m.clientName}</h3>
      <div class="badges">
        <span class="badge">${m.meetingDate}</span>
        <span class="badge">${m.meetingType}</span>
        <span class="badge">Status: ${m.status}</span>
        <span class="badge">Open Tasks: ${openTasks}</span>
        <span class="badge">Risk: ${m.riskLevel}</span>
      </div>
      <p class="summary">${m.executiveSummary || ''}</p>
    </article>`;
  }).join('');

  const visibleMeetingIds = new Set(filteredMeetings.map((m) => m.id));
  const filteredTasks = state.tasks.filter((t) => visibleMeetingIds.has(t.sourceMeeting));

  tasksContainer.innerHTML = filteredTasks.map((t) => `<article class="task">
    <strong>${t.title}</strong>
    <span>${t.description || ''}</span>
    <span>Owner: ${t.owner} | Priority: ${t.priority} | Status: ${t.status}</span>
    <span>Due: ${t.dueDate || 'N/A'} | Meeting: ${t.sourceMeeting}</span>
  </article>`).join('');
}

async function analyzeMeeting(payload) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Analysis failed');
  return data;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const analyzeBtn = document.getElementById('analyzeBtn');
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'מנתח...';

  const payload = {
    clientName: document.getElementById('clientName').value,
    meetingDate: document.getElementById('meetingDate').value,
    meetingType: document.getElementById('meetingType').value,
    transcript: document.getElementById('transcript').value,
  };

  try {
    const analysis = await analyzeMeeting(payload);
    const id = `mtg-${Date.now()}`;

    const meeting = {
      id,
      ...payload,
      ...analysis,
      integrationSource: {
        provider: 'manual',
        externalMeetingId: null,
        transcriptUrl: null,
      },
    };

    state.meetings.unshift(meeting);
    state.tasks.unshift(...flattenTasks(id, analysis));
    saveState();
    render();
    form.reset();
  } catch (err) {
    alert(err.message);
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'ניתוח עם OpenAI';
  }
});

document.querySelectorAll('#filterClient,#filterStatus,#filterRisk,#filterOwner').forEach((el) => {
  el.addEventListener('input', render);
  el.addEventListener('change', render);
});

loadState();
render();
