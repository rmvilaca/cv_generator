# CV Generator — Design Spec

**Date:** 2026-04-13
**Status:** Approved

## Overview

A web platform that generates tailored CVs based on a user's structured profile and a specific job posting. Users browse job postings with the Chrome extension, which saves the raw text to their account. The website lets them manage their profile, view saved job postings with AI analysis, and generate a company-specific CV with a live preview and PDF download.

---

## Architecture

Three components with clear, separate responsibilities:

```
Chrome Extension          Rails API               Vite + React App
─────────────────         ──────────────          ────────────────
Extract job text    ───▶  Store JobPosting   ◀─── Browse saved postings
(no AI)                   Run Stage 1 AI          Build/edit profile
                          Run Stage 2 AI    ────▶  Live CV preview + PDF
                          Stripe / tokens         Buy tokens
```

- **Extension** — authenticated text extractor. Sends raw job posting text to the API. No AI code.
- **Rails API** — all business logic: auth, job posting storage, AI pipeline, token billing, CV generation.
- **React app (Vite)** — UI for profile management, saved job postings, CV preview, and billing.

The extension and web app share the same user account via JWT (existing Devise JWT setup).

---

## Data Models

### `UserProfile` (belongs to `User`, one per user)
- `full_name`, `email`, `phone`, `location`
- `summary` (text) — professional summary
- `has_many :work_experiences` — company, title, start/end dates, bullet points
- `has_many :education_entries` — institution, degree, year
- `skills` (text array)

### `JobPosting` (belongs to `User`)
- `raw_text` (text) — full extracted text from extension
- `url` (string, optional) — source page URL
- `company_name`, `job_title` — extracted by Stage 1 AI from raw text; user can edit via the job postings UI
- `analysis` (jsonb) — Stage 1 result: `{ skills, job, tech }`
- `analysis_status` — `pending | processing | completed | failed`

### `CvGeneration` (belongs to `User` and `JobPosting`)
- `content` (jsonb) — structured CV: `{ summary, experience, skills, education }`
- `status` — `pending | processing | completed | failed`
- `tokens_used` (integer)

### `User` additions
- `free_generations_used` (integer, default 0)

---

## API Endpoints

All endpoints require JWT authentication unless noted.

### Extension
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/job_postings` | Receive `{ raw_text, url }`, create JobPosting, enqueue Stage 1 |

### Job Postings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/job_postings` | List user's postings (with analysis status) |
| GET | `/api/job_postings/:id` | Single posting with full analysis |
| DELETE | `/api/job_postings/:id` | Delete a posting |

### User Profile
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile` | Fetch current user's profile |
| PUT | `/api/profile` | Create or update profile (upsert) |

### CV Generation
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/job_postings/:id/cv_generations` | Trigger Stage 2, gate by tokens |
| GET | `/api/job_postings/:id/cv_generations` | List all generations for a posting (to load previous results) |
| GET | `/api/job_postings/:id/cv_generations/:id` | Poll for result / fetch completed CV |

### Existing (updated)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/me` | Add `token_balance` and `free_generations_used` to response |

---

## AI Pipeline

### Stage 1 — Job Analysis (background job, runs on save)

- **Input:** `JobPosting#raw_text`
- **Model:** `gpt-4o-mini`
- **Output:** `{ skills: [...], job: [...], tech: [...] }` — same structure as the current extension `ai.js`
- **Stored in:** `JobPosting#analysis`, status updated to `completed` or `failed`
- **Purpose:** Powers the job posting detail view in the web app; cached and reused

### Stage 2 — CV Generation (background job, triggered by user)

- **Input:**
  - `UserProfile` (full structured data)
  - `JobPosting#analysis` (Stage 1 structured output — skills, topics, technologies)
  - `JobPosting#raw_text` (full context — tone, culture, specific phrasing)
- **Model:** `gpt-4o`
- **Output:** `{ summary, experience, skills, education }` — structured JSON CV sections
- **Stored in:** `CvGeneration#content`, status updated to `completed` or `failed`

Passing both raw text and structured analysis to Stage 2 ensures no context is lost while giving the model a pre-computed signal about what to prioritize.

### Token Gating (before Stage 2 is enqueued)

```
if free_generations_used < 3
  allow → increment free_generations_used
elsif token_balance >= 1
  allow → deduct 1 token
else
  return 402 Payment Required
end
```

---

## React Frontend (Vite + React)

### Pages

**Auth** — Login / Register using existing Devise JWT endpoints.

**Profile** — Structured form for personal info, work experience (multiple entries), education (multiple entries), and skills. Saves via `PUT /api/profile`. Filled once, reused for all generations.

**Job Postings** — List of postings saved via the extension. Each card shows company, job title, analysis status, and a "Generate CV" button. Clicking a card shows the Stage 1 analysis (skills, topics, technologies) before generating.

**CV Preview** — Side-by-side layout:
- Left: structured CV sections (read-only output)
- Right: live rendered CV preview using `@react-pdf/renderer`
- "Download PDF" button exports the CV client-side

**Billing** — Token balance, free generations remaining, "Buy tokens" button → existing Stripe checkout flow.

### Generation Polling

After "Generate CV" is clicked, the frontend polls `GET /api/job_postings/:id/cv_generations/:id` every 2–3 seconds until `status === "completed"`, then renders the CV preview.

---

## Chrome Extension Changes

### Removed
- `ai.js` — OpenAI integration, API key storage, analysis rendering
- Settings panel (API key input)
- "Analyze with AI" button and analysis UI

### Added
- **Login flow** — if no JWT in `chrome.storage.local`, popup shows a login form calling `POST /api/users/sign_in` and stores the token
- **"Save to account" button** — sends `POST /api/job_postings` with `{ raw_text, url }`, shows confirmation with a link to the website

### Kept
- Content script (CSS selector text extraction)
- Extract button and extracted text display
- `chrome.storage.local` (now stores JWT instead of OpenAI key)

**New popup flow:** Extract → review text → Save to account → "Saved! View on website"

---

## Error Handling

- Stage 1/2 job failures: set status to `failed`, surface error in UI with a retry option
- `402` on CV generation: direct user to billing page
- Extension not logged in: show login form in popup
- Polling timeout (> 2 minutes without completion): show error with retry

---

## Out of Scope (for this version)

- Multiple CV templates / styles
- Editing generated CV content inline
- Streaming CV generation
- Email notifications when CV is ready
- Sharing CV via public link
