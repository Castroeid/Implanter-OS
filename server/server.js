import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors({
  origin: ["https://castroeid.github.io", "http://localhost:3000", "http://localhost:5173"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "20mb" }));

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

app.get("/", (_req, res) => {
  res.send("Implanter OS API is running. Use /api/health or POST /api/analyze");
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "implanter-os-api" });
});

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    meetingMetadata: {
      type: "object",
      additionalProperties: false,
      properties: {
        clientName: { type: "string" },
        meetingDate: { type: "string" },
        meetingTime: { type: "string" },
        duration: { type: "string" },
        meetingType: { type: "string" },
        participants: { type: "array", items: { type: "string" } },
        mainTopic: { type: "string" }
      },
      required: ["clientName", "meetingDate", "meetingTime", "duration", "meetingType", "participants", "mainTopic"]
    },
    executiveSummary: { type: "string" },
    meetingGoal: { type: "string" },
    clientNeeds: { type: "array", items: { type: "string" } },
    topicsCovered: { type: "array", items: { type: "string" } },
    clientQuestions: { type: "array", items: { type: "string" } },
    issuesAndBugs: { type: "array", items: { type: "string" } },
    decisionsMade: { type: "array", items: { type: "string" } },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          owner: { type: "string", enum: ["אני", "לקוח", "תמיכה", "פיתוח"] },
          priority: { type: "string", enum: ["גבוהה", "בינונית", "נמוכה"] },
          status: { type: "string", enum: ["פתוחה"] },
          source: { type: "string" }
        },
        required: ["title", "description", "owner", "priority", "status", "source"]
      }
    },
    followUpTasks: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    implementerFeedback: {
      type: "object",
      additionalProperties: false,
      properties: {
        whatWentWell: { type: "array", items: { type: "string" } },
        whatCouldImprove: { type: "array", items: { type: "string" } },
        nextMeetingRecommendation: { type: "string" }
      },
      required: ["whatWentWell", "whatCouldImprove", "nextMeetingRecommendation"]
    },
    followUpEmail: { type: "string" },
    nextMeetingAgenda: { type: "array", items: { type: "string" } }
  },
  required: [
    "meetingMetadata",
    "executiveSummary",
    "meetingGoal",
    "clientNeeds",
    "topicsCovered",
    "clientQuestions",
    "issuesAndBugs",
    "decisionsMade",
    "tasks",
    "followUpTasks",
    "risks",
    "implementerFeedback",
    "followUpEmail",
    "nextMeetingAgenda"
  ]
};

app.post("/api/analyze", async (req, res) => {
  try {
    console.log("📥 Analyze request received");

    const { clientName = "לא ידוע", meetingDate = "לא ידוע", meetingType = "לא ידוע", transcript } = req.body || {};

    if (!transcript || transcript.trim().length < 20) {
      return res.status(400).json({ error: "חסר תמלול תקין לניתוח." });
    }

    if (!client) {
      return res.status(500).json({ error: "OPENAI_API_KEY לא מוגדר בשרת." });
    }

    const systemPrompt = `
אתה מנתח פגישות הטמעה מקצועי בעברית.

נתח את התמלול כמו מטמיע תוכנה מנוסה.
המטרה היא לא לסכם מילולית, אלא להבין את הפגישה מקצועית.

חשוב מאוד:
- אל תהפוך כל משפט למשימה.
- הסבר של המטמיע אינו משימה.
- שאלה של לקוח אינה משימה, אלא אם הובטחה פעולה.
- משימה נוצרת רק כשיש צורך ברור בהמשך טיפול.
- אם המטמיע אומר: "אני אבדוק", "אברר", "אשאל", "אעביר לפיתוח", "אשלח", "אקבע" — זו משימה.
- אם הלקוח צריך לשלוח, לבדוק, להחליט או לאשר — זו משימת לקוח.
- אם יש תקלה, באג, איטיות, משהו שלא עובד, או צורך לבדוק מול פיתוח — זו משימה לתמיכה/פיתוח.
- הפרד בין שאלות לקוח, בעיות, החלטות, משימות ופידבק למטמיע.
- כתוב בעברית בלבד.
- החזר JSON בלבד לפי הסכמה.

הנחיות קשיחות לשדה followUpEmail:
- הטון חייב להיות מקצועי, ברור, רגוע, ממוקד יישום ובטוח.
- אין להשתמש בניסוחים חלשים/מתנצלים כגון: "השתדלנו", "ניסינו", "מקווה שזה עזר", "מצטערים", "אם לא הספקנו".
- יש לנסח את המטמיע כמוביל תהליך.
- אם קיימות פעולות ברורות, יש לכלול אותן כסעיפים תחת "להמשך, מומלץ".
- אם קיימת תקלה טכנית, יש לנסח באופן מקצועי בלבד: "הנושא ייבדק מול הגורם הרלוונטי לצורך המשך טיפול.".
- מבנה חובה:
שלום [שם הלקוח],

תודה על פגישת ההדרכה.

במהלך הפגישה עברנו על:
• [נושא 1]
• [נושא 2]
• [נושא 3]

בנוסף, התייחסנו לשאלות שעלו במהלך ההדרכה והצגנו דגשים לעבודה נכונה במערכת.

להמשך, מומלץ:
• [פעולה / המלצה 1]
• [פעולה / המלצה 2]
• [פעולה / המלצה 3]

ככל שנדרש, ניתן להמשיך ולהעמיק בנושאים שעלו במסגרת פגישת המשך ממוקדת.

בברכה,
[שם המטמיע]
`;

    const result = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `
שם לקוח: ${clientName}
תאריך שהוזן: ${meetingDate}
סוג פגישה: ${meetingType}

תמלול:
${transcript}
`
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "meeting_analysis",
          strict: true,
          schema: ANALYSIS_SCHEMA
        }
      }
    });

    const outputText = result.output_text;

    if (!outputText) {
      console.error("❌ No output_text from OpenAI", result);
      return res.status(500).json({ error: "לא התקבלה תשובת AI תקינה." });
    }

    const parsed = JSON.parse(outputText);
    console.log("✅ Analysis completed");

    return res.json(parsed);

  } catch (error) {
    console.error("🔥 Analyze error:", error);
    return res.status(500).json({
      error: "שגיאה בניתוח הפגישה",
      details: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Implanter backend listening on port ${port}`);
});
