
# Adaptive Assessment Platform (Quiz Master)

![React](https://img.shields.io/badge/React-19.0-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![SQLite](https://img.shields.io/badge/SQL.js-WASM-orange) ![Gemini](https://img.shields.io/badge/Google%20Gemini-AI-purple)

A high-performance educational tool designed to transform raw SQLite question banks into a dynamic, AI-enhanced examination environment. Built on a **local-first architecture**, this platform processes data entirely on the client side using WebAssembly (SQL.js). This design ensures **zero-latency interactions** and instant feedback, regardless of dataset size.

## 🌟 Key Features

### 📚 Book Companion Mode
*   **Structured Study:** Browse questions organized by **Source Book**, **Chapter**, and **Heading** instead of just abstract Domains.
*   **Remote Library:** Automatically fetches and indexes compatible database files from a configured manifest (`public/OBE/manifest.json`), allowing for a curated library of study materials.
*   **Journey Mode:** Experience questions in strict sequential order (Book -> Chapter -> Question) to mirror your reading progress.

### ⚡ Performance & Architecture
*   **Instant Local Processing:** Uploads SQLite (`.db`) files directly to browser memory. Interactions are instantaneous as there are no server round-trips for fetching questions.
*   **Local-First Architecture:** All database queries and answer grading occur locally within your browser using WebAssembly.
*   **Zero Data Egress:** As a benefit of the local-first architecture, your proprietary question banks remain on your device and are never uploaded to a server.
*   **Note:** An active internet connection is required to load the application shell and external libraries (React, Tailwind, SQL.js) upon initial launch.
*   **State Persistence:** Uses IndexedDB to auto-save sessions, allowing you to close the tab and resume exactly where you left off.

### 🧠 Adaptive Learning
*   **Save & Resume:** Multiple save slots allow you to pause long exams and return later without losing progress.
*   **Metacognitive Tagging:** Users must rate confidence (Low/Med/High) for every answer, feeding into "True Mastery" vs. "Lucky Guess" analytics.
*   **Multi-Format Support:** Natively handles:
    *   Standard Multiple Choice
    *   Multi-Select (`[MULTI]`)
    *   Drag-and-Drop Matching (`[MATCH]`)
*   **Simulation Personas:** Built-in developer tools to simulate user archetypes (e.g., "The Imposter," "The Overconfident," "Domain Specialist") to stress-test analytics.

### 🤖 AI-Powered (Google Gemini)
*   **Deep Explanations:** Generates "Plain English" simplifications and mnemonic hooks for complex questions.
*   **Real-Time Verification:** Uses Google Search grounding to verify if database answers match current standards (e.g., NIST, ISO changes) and provides citation links.
*   **Strategic Roadmaps:** Analyzes session performance to build a structured JSON study plan.
*   **Semantic Friction Analysis:** Identifies conceptual "connective tissue" causing errors across different domains.

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   npm or yarn
*   A Google Gemini API Key (for AI features)

### Installation (All steps should be done in Powershell with admin rights

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/quiz-master.git
    cd quiz-master
    ```
    
2. **Install your favorite package manager. I like Chocolatey - https://chocolatey.org/install**

3. **Install NPM With Cocolatey - https://vocon-it.com/2019/11/19/install-npm-using-chocolatey-on-windows/#:~:text=run%20as%20Administrator-,Step%201.2%3A%20Install,-Get%2DExecutionPolicy%0A%0A%23%20output**

4. **Revert your execution policy back to restricted (optional, but encouraged)**
   ```bash
   Set-ExecutionPolicy -ExecutionPolicy Restricted -Scope CurrentUser
   ```
   
5.  **Install dependencies (Make sure you are in your *~\quiz-master\* directory**
    ```bash
        npm install
    ```

6.  **Configure Environment (required, sorry)**
    Create a `.env` file in the root directory:
    ```env
    API_KEY=your_google_gemini_api_key_here
    ```

7.  **Run the application**
    ```bash
    npm start
    ```
    Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

---

## 📂 Database Format Guide

To use this application, you must upload a valid **SQLite 3** database file (`.db` or `.sqlite`). The application automatically detects the main table (often named `questions`, `data`, or `exam`), but the schema must contain specific columns to map correctly.

### Required Schema
The application prioritizes the following exact column headings (case-insensitive):

| Column Name | Description | Example |
| :--- | :--- | :--- |
| `ID` | Unique identifier (Text or Int). | `1` |
| `Domain` | High-level knowledge domain. | `Domain 7` |
| `Sub-Domain` | Specific sub-category within the domain. | `7.1 Understand and comply with investigations` |
| `Topic Area` | Granular topic for detailed analytics. | `7.1.4 Digital forensics tools, tactics, and procedures` |
| `Chapter`(Optional) | Book chapter or module reference. | `Chapter 19` |
| `Heading`(Optional) | Specific section heading. | `Artifacts, Evidence Collection, and Forensic Procedures` |
| `Question Text` | The body of the question. | `Which of the following...` |
| `Choice A` ... `Choice N` | Columns for options. | `Option Text` |
| `CorrectAnswer(s)` | The correct letter(s). | `C` or `A,B` |
| `Explanation` | The explanation. | `The reason C is correct...` |

> **Note:** Backward compatibility is maintained for standard columns like `question_text`, `correct_answer`, `category`, etc., but the schema above is preferred for the best analytics experience.

### Special Question Types

1.  **Multi-Select:**
    *   Add `[MULTI]` to the start of `Question Text` OR ensure `CorrectAnswer(s)` contains commas (e.g., "A,C").
2.  **Matching / Drag-and-Drop:**
    *   Add `[MATCH]` to the start of `Question Text`.
    *   Format your choices as adjacent pairs. `Choice A` matches with `Choice B`, `Choice C` matches with `Choice D`, and so on.
    *   *Example Choice A:* "HTTP" (The Item)
    *   *Example Choice B:* "Port 80" (The Match)
    *   *Example Choice C:* "HTTPS" (The Item)
    *   *Example Choice D:* "Port 443" (The Match)

---

## 📖 User Guide

### 1. Modes of Operation

#### 📤 Bring Your Own Database (BYODB)
Designed for users with custom question banks, proprietary exam dumps, or students who use **database creation as a study method**.
*   **The "Builder's Advantage":** Constructing your own database is a highly effective active learning strategy. By manually mapping questions to specific Domains and book locations, you are forced to analyze the *taxonomy* of the subject matter. This process of curation, validation, and metadata tagging promotes deeper encoding and retention than passive quiz-taking.
*   **Drag-and-Drop Interface:** Simply drop any valid SQLite (`.db`, `.sqlite`) file onto the landing zone.
*   **Intelligent Schema Mapping:** The application uses a heuristic algorithm to automatically detect columns. It looks for variations like `Question Text`, `Question`, `Body` for the prompt, and `Correct Answer`, `Answer`, `Key` for results. It maps specific metadata columns (`Domain`, `Topic`, `Chapter`) to the internal analytics engine without requiring manual mapping.
*   **Instant Integrity Check:** Upon upload, the system runs a health check, reporting total rows imported and flagging any "ghost rows" (entries missing question text) to ensure data quality before you start.

#### 📚 Book Companion Mode
A structured learning experience designed to mirror physical study guides and textbooks. **This mode acts as a 1-1 digital analog to your physical books**, providing an instant practice environment without the need to build or format your own database.
*   **Surgical Remediation:** Because every question is linked directly to the book's structure, the Summary Report goes beyond generic "Weak Domains." It identifies the **exact Chapter and Section Heading** you need to re-read based on your incorrect answers, bridging the gap between testing and studying.
*   **Curated Library:** Instead of manual uploads, this mode connects to a `manifest.json` file (located in `public/OBE/`) to fetch pre-configured database files from a server or local directory. This allows instructors to distribute a standard set of materials.
*   **Multi-Source Merging:** You can select multiple books (e.g., "Official Study Guide" + "Practice Tests") simultaneously. The system merges them into a single session while maintaining source attribution.
*   **Hierarchical Filtering:** Unlike BYODB which often relies on flat "Domains", this mode allows you to filter questions by **Book Source** → **Chapter** → **Section Heading**.
*   **Journey Mode:** A specialized session type available in this mode that serves questions in strict sequential order (Chapter 1, then Chapter 2...) rather than randomizing them. This is perfect for reinforcing material immediately after reading a chapter.

### 2. Session Configuration
Customize your exam experience:
*   **Focus Objectives:** Select specific **Domains** to practice.
*   **Evaluation Mode:**
    *   *Study Mode:* Immediate feedback, explanations, and hints enabled.
    *   *Exam Mode:* Blind testing, timer enabled, results hidden until end.
*   **Filters:** Choose between "Reviewed" (verified) or "Unreviewed" content if your database marks them.

### 3. The Quiz Interface
*   **Answering:** Click an option to select.
*   **Elimination:** **Right-click** (or long-press on mobile) an option to visually strike it out.
*   **Confidence:** You *must* select a confidence level (Shield icons) before submitting.
*   **Hints:** In Study Mode, click "Reveal Hint" to progressively see Domain -> Sub-Domain -> Topic hierarchy.
*   **AI Tutor:** Click "Ask AI Tutor" to generate a dynamic explanation verified against live web sources.
*   **Flagging:** Report issues with specific questions (typos, wrong keys) to a local exclusion list.

### 4. Analysis Dashboard
Upon completion, review the **Session Report**:
*   **Calibration Matrix:** See how often you were "Overconfident" (Danger Zone) vs "Underconfident" (Imposter Syndrome).
*   **Hierarchy Heatmap:** Drill down from **Domain -> Sub-Domain -> Topic** or **Chapter -> Heading** to find weak spots.
*   **Journey Metrics:** A slide-out panel available during Marathon sessions to track performance in real-time.
*   **AI Roadmap:** A generated study plan highlighting your top 3 weakness vectors.

---

## 🛠 Technical Architecture

### Core Components
*   **`services/sqliteService.ts`**: Handles the WASM interface for SQL.js. It normalizes column names dynamically to support schema variations.
*   **`services/aiService.ts`**: Manages communication with Google's GenAI SDK. Includes prompt engineering for "Study Coach" and "Contextual Analysis" personas.
*   **`services/persistenceService.ts`**: An abstraction layer over IndexedDB to save binary database chunks, library manifests, and JSON session state.

### State Management
The app uses a hybrid approach:
1.  **React State:** For immediate UI reactivity (current question, selected option).
2.  **IndexedDB:** For "Save & Resume" functionality. State is synced to IDB on every significant action (answer submission).

### Simulation Tools
Located in the specific "DevTools" menu (Wrench icon) inside the Quiz view.
*   **Logic:** Uses probability algorithms to programmatically answer questions to simulate specific user behaviors (e.g., `Math.random() < 0.25` accuracy for "Overconfident" mode).

---

## ⚠️ Troubleshooting

**App doesn't load after navigating to http://localhost:3000**
*   Ensure you've entered your Gemini API key into the .env.local file

**"Database is empty" error:**
*   Ensure your SQLite file has a table.
*   Ensure the table has a column containing the word "Question Text", "Question", or "text".

**AI Features not working:**
*   Check your internet connection.
*   Ensure a valid `API_KEY` is set in your `.env` file (or injected via your deployment platform).
*   Check the browser console for 403 (Permission) or 429 (Quota) errors.

**Performance issues with large files:**
*   The app loads the entire DB into memory. Files larger than 500MB may cause browser tab crashes on devices with low RAM.

---

## License
MIT License. Free for personal and educational use.
