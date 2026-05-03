import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json({ limit: '4mb' }));
const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const ANALYSIS_SCHEMA = {"type":"object","additionalProperties":false,"properties":{"meetingMetadata":{"type":"object","additionalProperties":false,"properties":{"clientName":{"type":"string"},"meetingDate":{"type":"string"},"meetingTime":{"type":"string"},"duration":{"type":"string"},"meetingType":{"type":"string"},"participants":{"type":"array","items":{"type":"string"}},"mainTopic":{"type":"string"}},"required":["clientName","meetingDate","meetingTime","duration","meetingType","participants","mainTopic"]},"executiveSummary":{"type":"string"},"meetingGoal":{"type":"string"},"clientNeeds":{"type":"array","items":{"type":"string"}},"topicsCovered":{"type":"array","items":{"type":"string"}},"clientQuestions":{"type":"array","items":{"type":"string"}},"issuesAndBugs":{"type":"array","items":{"type":"string"}},"decisionsMade":{"type":"array","items":{"type":"string"}},"tasks":{"type":"array","items":{"type":"object","additionalProperties":false,"properties":{"title":{"type":"string"},"description":{"type":"string"},"owner":{"type":"string","enum":["אני","לקוח","תמיכה","פיתוח"]},"priority":{"type":"string","enum":["גבוהה","בינונית","נמוכה"]},"status":{"type":"string","enum":["פתוחה"]},"source":{"type":"string"}},"required":["title","description","owner","priority","status","source"]}},"followUpTasks":{"type":"array","items":{"type":"string"}},"risks":{"type":"array","items":{"type":"string"}},"implementerFeedback":{"type":"object","additionalProperties":false,"properties":{"whatWentWell":{"type":"array","items":{"type":"string"}},"whatCouldImprove":{"type":"array","items":{"type":"string"}},"nextMeetingRecommendation":{"type":"string"}},"required":["whatWentWell","whatCouldImprove","nextMeetingRecommendation"]},"followUpEmail":{"type":"string"},"nextMeetingAgenda":{"type":"array","items":{"type":"string"}}},"required":["meetingMetadata","executiveSummary","meetingGoal","clientNeeds","topicsCovered","clientQuestions","issuesAndBugs","decisionsMade","tasks","followUpTasks","risks","implementerFeedback","followUpEmail","nextMeetingAgenda"]};
app.post('/api/analyze', async (req, res) => {
  try {
    const { clientName, meetingDate, meetingType, transcript } = req.body || {};
    if (!clientName || !meetingDate || !meetingType || !transcript) return res.status(400).json({ error: 'חסרים שדות חובה: clientName, meetingDate, meetingType, transcript.' });
    if (!client) return res.status(500).json({ error: 'מפתח OPENAI_API_KEY לא הוגדר בשרת.' });
    const systemPrompt = `נתח את התמלול כמומחה יישום תוכנה דובר עברית. ענה בעברית בלבד, בצורה פרקטית ותמציתית. הבחן באופן ברור בין: הסברי מדריך, שאלות לקוח, בקשות לקוח אמיתיות, משימות אמיתיות, תקלות/באגים, החלטות, צורך בפגישת המשך, ופידבק מקצועי למיישם. חוקים: לא כל משפט הוא משימה. צור משימה רק אם יש התחייבות או המשך נדרש. אם נאמר "אני אבדוק", "אברר", "אעביר לפיתוח", "אקבע", "אשלח" => owner הוא "אני". אם הלקוח צריך לשלוח/לבדוק/להחליט => owner הוא "לקוח". אם יש תקלה/באג/דירוג AI שגוי/איטיות/פיצ'ר שבור => owner הוא "תמיכה" או "פיתוח". הסברי מדריך אינם משימות. שאלות לקוח אינן משימות, אלא אם הובטחה פעולת המשך. החזר JSON תקין בלבד.`;
    const result = await client.responses.create({ model: 'gpt-4.1-mini', input: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `clientName: ${clientName}\nmeetingDate: ${meetingDate}\nmeetingType: ${meetingType}\n\nTranscript:\n${transcript}` }], text: { format: { type: 'json_schema', name: 'meeting_analysis', strict: true, schema: ANALYSIS_SCHEMA } } });
    return res.json(JSON.parse(result.output_text || '{}'));
  } catch (error) {
    return res.status(500).json({ error: 'שגיאה בניתוח הפגישה.', details: error.message });
  }
});
app.get('/health', (_req, res) => res.json({ ok: true }));
app.listen(port, () => console.log(`Implanter backend listening on http://localhost:${port}`));
