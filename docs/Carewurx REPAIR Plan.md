# Carewurx Project Repair Plan

## ❶ Investigation Log

Here is a list of identified defects, their symptoms, proposed fixes, estimated effort, and priority.

1.  **Hardcoded Firebase Admin SDK Key**
    *   **File(s):** `services/firebase.js` (and potentially `carewurx-firebase-adminsdk-fbsvc-e7fcc4b08e.json` if present in the repo).
    *   **Symptom:** Firebase Admin SDK service account key path is hardcoded. The filename `carewurx-firebase-adminsdk-fbsvc-e7fcc4b08e.json` is referenced in `services/firebase.js`. This file is listed in `.gitignore`, but might have been committed previously or exist locally without being tracked.
    *   **Proposed Fix:** Modify `services/firebase.js` to initialize Firebase Admin SDK from environment variables (e.g., `GOOGLE_APPLICATION_CREDENTIALS` pointing to the key file path, or by parsing a base64 encoded key from an environment variable like `FIREBASE_ADMIN_SDK_JSON_BASE64`). Ensure the actual key file is not in the repository.
    *   **Effort:** M
    *   **Priority:** Blocking ✔
    *   **Status:** ✔ Done (Commit: `fix/firebase-admin-env-var`)

2.  **Hardcoded Firebase Client SDK Config**
    *   **File(s):** `frontend/src/services/firebase.js`.
    *   **Symptom:** Firebase client SDK configuration (apiKey, authDomain, projectId, etc.) is likely hardcoded directly into the frontend JavaScript.
    *   **Proposed Fix:** Utilize environment variables for the React app (prefixed with `REACT_APP_`, e.g., `REACT_APP_FIREBASE_API_KEY`). These variables will be embedded during the build process. Update `frontend/src/services/firebase.js` to use these `process.env.REACT_APP_...` variables.
    *   **Effort:** M
    *   **Priority:** Blocking ✔
    *   **Status:** ⚠ BLOCKED - Frontend linting (`eslint src/**/*.{js,jsx}` within `frontend/`) fails with "Parsing error: 'import' and 'export' may appear only with 'sourceType: module'" even after `npm install` in `frontend/`. This seems to be a deeper ESLint configuration issue (related to Defect #9) preventing satisfaction of G-2. Code changes made, but cannot commit.

3.  **Outdated Firebase Client SDK (v8)**
    *   **File(s):** `frontend/src/services/firebase.js`, `frontend/src/services/firebaseService.js`, and any components directly using Firebase v8 syntax. `frontend/package.json` shows `firebase: "^8.6.8"`.
    *   **Symptom:** The frontend uses Firebase JS SDK version 8, which is deprecated and uses a non-modular, namespaced API.
    *   **Proposed Fix:** Upgrade to Firebase JS SDK v9 (or latest stable, currently v10+). This involves changing `firebase` import statements to be modular (e.g., `import { initializeApp } from 'firebase/app'; import { getFirestore } from 'firebase/firestore';`) and updating API calls accordingly (e.g., `firebase.firestore()` becomes `getFirestore()`).
    *   **Effort:** L (This can be extensive depending on how widely the v8 syntax is used across components and services. It will require careful testing.)
    *   **Priority:** Non-blocking

4.  **Groq API Key Read from File**
    *   **File(s):** `agents/core/llm-service.js` (inferred from `FRONTEND_MIGRATION_PLAN_PART1.md` mentioning reading `Groq API KEY.txt`). The file `Groq API KEY.txt` itself (if present).
    *   **Symptom:** Groq API key is read from a local text file (`Groq API KEY.txt`) in the backend. This is insecure and not portable.
    *   **Proposed Fix:** Modify `agents/core/llm-service.js` (and any other backend Groq integrations) to initialize the Groq SDK using the `GROQ_API_KEY` environment variable, as per Carewurx Master Prompt rule 0-2. Delete the `Groq API KEY.txt` file from the repository and ensure it's in `.gitignore`.
    *   **Effort:** S
    *   **Priority:** Blocking ✔
    *   **Status:** ✔ Done (Commit: `fix/groq-env-var`)

5.  **Direct Groq API Call from Frontend**
    *   **File(s):** `FRONTEND_INTEGRATION_PLAN.md` mentions a direct `fetch` to Groq API. This pattern might be implemented in components like `frontend/src/components/AgentChat.jsx`, `frontend/src/components/ResponseStreamingUI.jsx`, or related frontend services.
    *   **Symptom:** Frontend JavaScript code makes direct HTTP calls to the Groq API endpoints. This requires the Groq API key to be exposed/handled on the client-side, which is a security risk. (Initial concern based on planning documents).
    *   **Proposed Fix:** Refactor frontend components/services to make requests to the Electron backend (main process) via IPC (e.g., using a preload script and `ipcRenderer.invoke`). The Electron backend will then securely make the API call to Groq using the `GROQ_API_KEY` environment variable and return the response to the frontend.
    *   **Effort:** M
    *   **Priority:** Non-blocking (but high for security best practices)
    *   **Status:** ✔ Done (Investigation revealed that the frontend (`AgentChat.jsx`, `ResponseStreamingUI.jsx`, `agentService.js`) already correctly delegates Groq-related calls to the Electron backend via `window.electronAPI` (IPC). No direct frontend-to-Groq HTTP calls found in the current code. The backend `llm-service.js` handles Groq calls and was addressed in Defect #4.)

6.  **Potentially Unused `app/` Directory**
    *   **File(s):** Entire `app/` directory (includes `admin.html`, `admin.js`, `index.html`, `renderer.js`, `style.css`, `components/`, `services/`).
    *   **Symptom:** Contains a full set of files for an Electron renderer process (HTML, JS, CSS, components). However, the primary and more modern frontend seems to be the React application in `frontend/`. The root `package.json` builds the `frontend/` app.
    *   **Proposed Fix:** Thoroughly investigate if any part of the `app/` directory is imported, referenced, or used by the Electron main process (`main.js`) or any build scripts. If confirmed unused, delete the entire `app/` directory and remove any dead references.
    *   **Effort:** M (Investigation can take time to ensure no hidden usages)
    *   **Priority:** Non-blocking

7.  **Potentially Unused/Redundant `python_agent/` Directory**
    *   **File(s):** Entire `python_agent/` directory (includes `main.py`, `requirements.txt` listing `groq`).
    *   **Symptom:** Contains a Python-based agent setup, including Groq integration. The primary backend and agent logic seems to be Node.js-based within the `agents/` and `services/` directories.
    *   **Proposed Fix:** Determine if the Python agent is actively used, invoked by any part of the system, or if its functionality is (or should be) handled by the Node.js backend. If it's redundant or deprecated, delete the entire `python_agent/` directory.
    *   **Effort:** M (Investigation required to understand its role, if any)
    *   **Priority:** Non-blocking

8.  **Missing Root Test Script**
    *   **File(s):** `package.json` (at the repository root).
    *   **Symptom:** The `scripts.test` field in the root `package.json` is `"echo \"Error: no test specified\" && exit 1"`.
    *   **Proposed Fix:** Implement a useful root test script. At a minimum, it should run the frontend tests: `cd frontend && npm test`. Ideally, it should also be configured to run any backend tests (e.g., for `services/` and `agents/` if/when they are added or improved).
    *   **Effort:** S
    *   **Priority:** Non-blocking
    *   **Status:** ⚠ BLOCKED-FINAL - infrastructure - UNBLOCK C directive failed. Attempts to run frontend tests using `CI=true react-scripts test --watchAll=false --runInBand --detectOpenHandles --testTimeout=60000` still result in timeouts. Underlying Jest/test suite issue persists.

9.  **Inconsistent ESLint Setup / Lack of Backend Linting**
    *   **File(s):** `eslint.config.js` (root), `frontend/.eslintrc.json`.
    *   **Symptom:** Two separate ESLint configurations exist. The root `eslint.config.js` is very basic and uses the new flat config format, while `frontend/.eslintrc.json` uses the traditional format and `react-app` presets. Backend JavaScript files in `services/`, `agents/`, `main.js`, `preload.js` might not be linted effectively by the current root config.
    *   **Proposed Fix:** Consolidate ESLint configuration or enhance the root `eslint.config.js` to properly lint all JavaScript/JSX files across the project (root, `services/`, `agents/`, `frontend/src/`). This might involve choosing one config format or making them work together. Ensure consistent rules are applied.
    *   **Effort:** M
    *   **Priority:** Non-blocking
    *   **Status:** ⚠ BLOCKED-FINAL - infrastructure - UNBLOCK B directive failed. Attempts to configure ESLint (renaming flat config, modifying `frontend/.eslintrc.json`, changing root lint script to target frontend) resulted in `npm run lint` timeout. Original ESLint configurations restored. This continues to block Defect #2.

10. **Buggy `firebaseServiceMock.js`**
    *   **File(s):** `frontend/src/services/firebaseServiceMock.js`. (Identified from `ANALYSIS.md` and `DEEP_ANALYSIS.md`).
    *   **Symptom:** The mock Firebase service used in frontend tests is reportedly incomplete, buggy, or improperly mocks asynchronous behavior, potentially leading to unreliable tests or false positives/negatives.
    *   **Proposed Fix:** Review `firebaseServiceMock.js`. Identify discrepancies with the actual `firebaseService.js`. Rewrite or augment the mock to accurately simulate Firebase interactions relevant to frontend tests, including CRUD operations, authentication, and data querying. Ensure it correctly handles promises and asynchronous operations.
    *   **Effort:** M
    *   **Priority:** Non-blocking (but important for improving frontend test reliability)

11. **Committed Secret File in `.gitignore` History / Local Presence**
    *   **File(s):** `.gitignore` lists `carewurx-firebase-adminsdk-fbsvc-e7fcc4b08e.json`. The actual file `carewurx-firebase-adminsdk-fbsvc-e7fcc4b08e.json` if it exists in the working directory or was committed before being gitignored. `services/firebase.js` references this filename.
    *   **Symptom:** The Firebase admin SDK key file, which is highly sensitive, is explicitly named. Even if gitignored now, it might exist in local developer environments untracked, or worse, might have been committed to the repository's history before the `.gitignore` entry was added.
    *   **Proposed Fix:**
        *   Immediate: Ensure the file `carewurx-firebase-adminsdk-fbsvc-e7fcc4b08e.json` is not present in the current working tree of the repository. Reinforce that `services/firebase.js` must not load the key from a hardcoded file path (Covered by Defect #1).
        *   History Check (Long-term): Investigate git history for any accidental commits of this file. If found, it must be purged from history using tools like `git filter-repo` or BFG Repo-Cleaner. This is a complex operation and typically done as a separate, dedicated task. For now, the focus is on securing the current state.
    *   **Effort:** S (for immediate checks and reinforcing Defect #1), L (for history purge, deferred)
    *   **Priority:** Blocking ✔ (for ensuring current code doesn't use a local file and the file isn't in current staging/commit)
    *   **Status:** ✔ Done (Immediate actions for current code completed via Defect #1 fix. Commit: `fix/firebase-admin-env-var`. History purge deferred.)

12. **Empty `README.md`**
    *   **File(s):** `README.md` (at the repository root).
    *   **Symptom:** The main project `README.md` file is present but contains no content beyond a title.
    *   **Proposed Fix:** Populate `README.md` with essential project information:
        *   A brief description of what Carewurx is and its purpose.
        *   Prerequisites for development (e.g., Node.js version, npm/yarn).
        *   Step-by-step setup instructions: how to clone, install dependencies (root and frontend).
        *   How to run the application in development mode.
        *   How to build the application for production.
        *   How to run linters and tests.
    *   **Effort:** M
    *   **Priority:** Non-blocking
    *   **Status:** ⚠ BLOCKED-FINAL - infrastructure - Attempts to write to README.md using `overwrite_file_with_block` consistently fail, even with minimal content.
```
