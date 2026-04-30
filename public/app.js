const form = document.getElementById('meeting-form');
const resultSection = document.getElementById('results');
const resultCards = document.getElementById('resultCards');
const analyzeBtn = document.getElementById('analyzeBtn');

function listToHtml(items) {
  return `<ul>${items.map((item) => `<li>• ${item}</li>`).join('')}</ul>`;
}

function createMockAnalysis(payload) {
  const name = payload.clientName || 'הלקוח';
  const date = payload.meetingDate || 'לא צוין';
  const type = payload.meetingType || 'פגישה';

  return {
    'סיכום מנהלים': `${name} קיים/ה פגישת ${type} בתאריך ${date}. התקיים דיון על יעדים, פערים ותעדוף פעולות להמשך.`,
    'בקשות לקוח': [
      'שיפור נראות דוחות המעקב במערכת.',
      'קיצור זמן תגובה לפניות תמיכה.',
      'קבלת עדכון סטטוס שבועי במייל.'
    ],
    'משימות שלי': [
      'להגדיר תהליך עבודה מעודכן ולהציגו ללקוח.',
      'לבדוק תקלות פתוחות ולספק הערכת זמנים.',
      'לקבוע שיחת המשך קצרה לאישור סדרי עדיפויות.'
    ],
    'משימות לקוח': [
      'להעביר רשימת משתמשים וצרכים מעודכנת.',
      'לאשר את לוחות הזמנים שהוצגו בפגישה.',
      'לשתף דוגמאות לדוחות הרצויים.'
    ],
    'סיכונים': [
      'עיכוב בקבלת נתונים מהלקוח עלול לדחות מסירה.',
      'פערי ציפיות לגבי היקף התמיכה עשויים לייצר עומס.',
      'חוסר זמינות בעלי עניין יכול לעכב החלטות.'
    ],
    'מייל המשך': `שלום ${name},\n\nתודה על פגישת ${type}.\nמצורף סיכום קצר: הוגדרו צעדים להמשך, תעדוף משימות ולוחות זמנים ראשוניים.\n\nאשמח לאישורכם למשימות שהוגדרו ולתיאום נקודת מעקב הבאה.\n\nבברכה,`
  };
}

function renderResults(analysis) {
  resultCards.innerHTML = Object.entries(analysis)
    .map(([title, content]) => {
      const body = Array.isArray(content) ? listToHtml(content) : `<p>${content.replaceAll('\n', '<br>')}</p>`;
      return `<article class="card"><h3>${title}</h3>${body}</article>`;
    })
    .join('');

  resultSection.classList.remove('hidden');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const payload = {
    clientName: document.getElementById('clientName').value.trim(),
    meetingDate: document.getElementById('meetingDate').value,
    meetingType: document.getElementById('meetingType').value,
    transcript: document.getElementById('transcript').value.trim(),
  };

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'מנתח...';

  setTimeout(() => {
    const analysis = createMockAnalysis(payload);
    renderResults(analysis);
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'נתח פגישה';
  }, 700);
});
