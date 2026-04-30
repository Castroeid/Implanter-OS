import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const promptTemplate = `You are an implementation operations analyst.
Given a client meeting transcript and metadata, produce strict JSON with this schema:
{
  "executiveSummary": "string",
  "clientRequests": ["string"],
  "decisionsMade": ["string"],
  "openQuestions": ["string"],
  "tasksForImplementer": [{"title":"string","description":"string","priority":"Low|Medium|High","owner":"Implementer","dueDate":"YYYY-MM-DD or empty"}],
  "tasksForClient": [{"title":"string","description":"string","priority":"Low|Medium|High","owner":"Client","dueDate":"YYYY-MM-DD or empty"}],
  "tasksForSupportDevelopment": [{"title":"string","description":"string","priority":"Low|Medium|High","owner":"Support/Development","dueDate":"YYYY-MM-DD or empty"}],
  "risksBlockers": ["string"],
  "suggestedFollowupEmail": "string",
  "suggestedNextMeetingAgenda": ["string"],
  "status": "Open|In Progress|Waiting for Client|Waiting for Support|Waiting for Development|Done",
  "riskLevel": "Low|Medium|High"
}
Respond with valid JSON only.`;

app.post('/api/analyze', async (req, res) => {
  try {
    const { clientName, meetingDate, meetingType, transcript } = req.body || {};

    if (!clientName || !meetingDate || !meetingType || !transcript) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY server environment variable.' });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          { role: 'system', content: promptTemplate },
          {
            role: 'user',
            content: `Client: ${clientName}\nMeeting date: ${meetingDate}\nMeeting type: ${meetingType}\n\nTranscript:\n${transcript}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const outputText = data.output_text || '';

    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      parsed = {
        executiveSummary: outputText,
        clientRequests: [],
        decisionsMade: [],
        openQuestions: [],
        tasksForImplementer: [],
        tasksForClient: [],
        tasksForSupportDevelopment: [],
        risksBlockers: [],
        suggestedFollowupEmail: '',
        suggestedNextMeetingAgenda: [],
        status: 'Open',
        riskLevel: 'Medium',
      };
    }

    return res.json(parsed);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unknown server error.' });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Implanter OS running on http://localhost:${port}`);
});
