# ClassBridge

Different languages. Different learning speeds. One inclusive classroom.

- **Frontend** (this folder): React + TanStack Start, built with Lovable.
- **Backend** (`backend/`): Python / FastAPI with Gemini or OpenAI. See [`backend/README.md`](backend/README.md).

## See the website (sample classroom, no backend needed)

```bash
npx bun install
npx bun run dev
```

Open the address it prints. Teacher portal: `/teacher`. Students: `/join` with code `FRC24B`.

## Turn on the real AI

1. Start the backend (needs Python 3.11+ and a free Gemini key from https://aistudio.google.com/apikey):
   ```bash
   cd backend
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env          # paste your key after GEMINI_API_KEY=
   uvicorn app.main:app --port 8000
   ```
2. In a second terminal, from this folder:
   ```bash
   cp .env.example .env          # sets VITE_API_URL=http://localhost:8000
   npx bun run dev
   ```
3. Create a session at `/teacher/sessions`, then join from other tabs at `/join`. Each tab can be a different student.
