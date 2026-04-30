# Implanter OS (MVP)

Hebrew-first (RTL) internal web app for implementation teams to analyze client meeting transcripts and turn them into structured follow-up work.

## Features
- Manual transcript upload/paste flow.
- Meeting metadata capture (client name, date, type).
- Server-side OpenAI analysis call.
- Structured outputs:
  - Executive summary
  - Client requests
  - Decisions made
  - Open questions
  - Tasks by owner groups
  - Risks/blockers
  - Suggested follow-up email
  - Suggested next-meeting agenda
- Dashboard cards with filters (client, status, risk, owner).
- Extracted todo list with required task fields.
- Future integration-ready meeting source model (`integrationSource`).

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set your OpenAI key:
   ```bash
   export OPENAI_API_KEY="your_key"
   ```
3. Run:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`

## Notes
- Current version supports manual paste only.
- Teams/Zoom integrations are not implemented yet, but data model includes integration metadata for future connectors.
