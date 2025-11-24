# A11y Fix Suggestions – POC

This project is an accessibility productivity proof-of-concept:

- A **web demo** built with React + Vite + Monaco Editor.
- A **shared analyzer** that finds accessibility issues (e.g. missing `alt`, unlabeled buttons, duplicate IDs, heading jumps).
- A **Python backend** that generates placeholder descriptions / labels to help fix issues faster.

> Current focus: **web demo + Python backend**. The VS Code extension code is parked for later.

---

## Repository Structure

```text
.
├── src/
│   └── shared/
│       └── analyzer/           # core TypeScript rules + analyzer
├── web-demo/                   # Vite + React + Monaco web demo (frontend)
├── placeholder-generator/      # FastAPI (Python) backend for placeholder text
└── vscode-extension/           # parked VS Code extension (not used now)

## Prerequisites

You’ll need:

Node.js ≥ 18 (includes npm)

Python ≥ 3.9

Git (optional but recommended)

macOS / Linux / WSL / Windows – any OS is fine

## Clone the Repository

If you haven’t already:

git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>         

## Python Backend – Local Setup

The backend is a small FastAPI app that takes code as input and returns suggested edits
(e.g. insert alt="TODO: describe" or better heuristics).

3.1 Create and activate a virtual environment (recommended)
cd placeholder-generator

python3 -m venv .venv
# macOS / Linux:
source .venv/bin/activate

You should now see (.venv) at the start of your shell prompt.

3.2 Install dependencies

If you have a requirements.txt here:

pip install -r requirements.txt


If not, install the core packages:

pip install fastapi uvicorn

3.3 Run the backend server

From inside placeholder-generator with the venv active:

uvicorn server:app --reload --host 0.0.0.0 --port 5000


You should see something like:

INFO:     Uvicorn running on http://0.0.0.0:5000 (Press CTRL+C to quit)


You can sanity-check in another terminal:

curl http://localhost:5000/docs

## Frontend (web-demo) – Local Setup

The web demo is a Vite + React app using Monaco Editor.

4.1 Install frontend dependencies

From the repo root:

cd web-demo
npm install

4.2 Configure API base URL (connect to Python backend)

Create a .env file in web-demo:

cd web-demo
touch .env


Add:

VITE_API_BASE_URL=http://localhost:5000


Your React code should read this via:

const API_BASE = import.meta.env.VITE_API_BASE_URL;

4.3 Start the dev server

In web-demo:

npm run dev


You’ll see something like:

VITE vX.X.X  ready in XXX ms
  ➜  Local:   http://localhost:5173/


Open http://localhost:5173 in your browser.

Make sure the Python backend from step 3 is still running on port 5000.

## Using the Web Demo Locally

Once both servers are running:

Backend: http://localhost:5000 (Uvicorn/ FastAPI)

Frontend: http://localhost:5173 (Vite dev server)

5.1 Basic workflow

Open http://localhost:5173.

In the Monaco editor (left pane), paste something like:

<img src="hero.jpg" />
<button></button>
<div id="dup"></div>
<div id="dup"></div>


Use the top toolbar buttons:

Analyze
Runs the shared analyzeCode() and shows issues in the right panel.

Generate Placeholders
Sends the current code to the Python backend (/generate?mode=heuristic), then applies any returned edits (e.g. add alt="...", aria-label="...").

Generate (ML)
Similar, but may call a heavier ML-based mode if you implement it in server.py.

Fix All
Applies all auto-fixable edits from the analyzer at once inside Monaco.

Use per-issue actions in the Accessibility Issues panel (right side):

Fix – apply the fix for that specific issue.

Preview – open a modal with a small before/after diff of the code around the issue.

Jump – move the cursor and scroll to the location of the issue in the editor.

After applying fixes, the analyzer re-runs and the issues list updates.