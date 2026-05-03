import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

// ✅ CORS חשוב מאוד
app.use(cors({
  origin: [
    "https://castroeid.github.io",
    "http://localhost:3000"
  ]
}));

app.use(express.json({ limit: '10mb' }));

// ✅ OpenAI
const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ✅ health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: "implanter-os-api" });
});

// ✅ analyze endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    console.log("📥 Incoming request");

    const { clientName, meetingDate, meetingType, transcript } = req.body || {};

    if (!clientName || !meetingDate || !meetingType || !transcript) {
      return res.status(400).json({
        error: 'חסרים שדות חובה'
      });
    }

    if (!client) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY לא מוגדר בשרת'
      });
    }

    const systemPrompt = `
אתה מומחה יישום תוכנה שמנתח פגישות הטמעה.

חוקים:
- אל תיצור משימה מכל משפט
- משימה רק אם יש פעולה אמיתית
- הבחנה בין:
  הסבר / שאלה / תקלה / משימה / החלטה

בעלים:
- "אני אבדוק" → אני
- "אתם תשלחו" → לקוח
- "תקלה / באג" → פיתוח/תמיכה

ענה בעברית בלבד.
החזר JSON בלבד.
`;

    const result = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `
לקוח: ${clientName}
תאריך: ${meetingDate}
סוג פגישה: ${meetingType}

תמלול:
${transcript}
`
        }
      ]
    });

    console.log("✅ OpenAI response received");

    let parsed;
    try {
      parsed = JSON.parse(result.output_text || "{}");
    } catch (e) {
      console.error("❌ JSON parse failed", e);
      return res.status(500).json({
        error: "שגיאה בפענוח תשובת AI"
      });
    }

    return res.json(parsed);

  } catch (error) {
    console.error("🔥 Analyze error:", error);

    return res.status(500).json({
      error: "שגיאה בניתוח הפגישה",
      details: error.message
    });
  }
});

// 🚀 start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
