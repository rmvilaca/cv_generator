# Design: CV tab on Job Posting Detail page

**Date:** 2026-04-20
**Status:** Approved — ready for implementation planning

## Problem

When a user generates a CV for a job posting, they're navigated to a separate page (`/job-postings/:id/cv/:cvId`). There is no way to return to that CV from the posting page afterward, and no affordance on the posting page to generate another one without scrolling back to the bottom-of-page button. The user wants the generated CV to live on the posting page itself — alongside the analysis — and to still be able to generate new CVs from there.

## Scope

Restructure `JobPostingDetailPage` into a two-tab view (`Analysis | CV`), show the latest CV inline in the CV tab, and gate re-generation behind a confirm modal. Backend exposes `latest_cv_generation` on the posting payload; the old `/cv/:cvId` route is retired via redirect.

> API paths in this spec are **nested** under the posting — `POST /api/job_postings/:id/cv_generations` for creation and `GET /api/job_postings/:postingId/cv_generations/:cvId` for polling. This matches `config/routes.rb` and the existing `JobPostingDetailPage`/`CvPreviewPage` call sites.

**Non-goals:**
- CV history UI (user chose "latest only" — earlier generations stay in the DB, unsurfaced).
- Per-CV permalinks.
- Any change to CV generation logic, PDF rendering, or billing rules.

## Design decisions (with user)

1. **History model:** Latest CV only. Older rows still exist in the DB but aren't listed.
2. **Layout:** Tabs (`Analysis | CV`), not stacked sections and not "navigate to separate page."
3. **Re-generation UX:** Confirm modal before firing `POST /api/job_postings/:id/cv_generations` for a replacement. First-time generation (no CV yet) skips the modal.
4. **Old `/cv/:cvId` route:** Redirect to `/job-postings/:id?tab=cv`. No reason to keep two entry points for the same view.
5. **Data fetch for latest CV:** Embed `latest_cv_generation` in `GET /api/job_postings/:id` (one request, one source of truth) rather than a separate CV-generations round-trip.

## Architecture

### Routes

- `/job-postings/:id` — posting detail, now tabbed. Active tab driven by `?tab=analysis|cv` via `useSearchParams`. Default `analysis`.
- `/job-postings/:postingId/cv/:cvId` — replaced with a tiny wrapper component that calls `useParams()` and returns `<Navigate to={`/job-postings/${postingId}?tab=cv`} replace />`. (A plain `<Navigate>` in the `<Route>` element won't interpolate `:postingId`.)

### Frontend components

- **`JobPostingDetailPage.jsx`** (modified): wraps the existing content in shadcn `<Tabs>`. Header (title, company, status badge) stays above the tabs. The existing Analysis Card becomes the `<TabsContent value="analysis">`. The CV tab delegates to a new `CvTab` component.
- **`CvTab.jsx`** (new, under `web/src/components/`): owns the four-state render, polling, profile fetch, PDF viewer, confirm modal, and POST call. Props: `{ posting, onPostingChanged }` — where `onPostingChanged` lets the parent re-fetch the posting after a new generation is created (so `latest_cv_generation` stays current).
- **`ui/tabs.jsx`** (new if not present): shadcn Tabs primitive. Check `web/src/components/ui/` before adding; add the standard shadcn implementation if missing.
- **`CvPreviewPage.jsx`** and **`CvPreviewPage.test.jsx`** — deleted. Their profile/polling/PDF logic migrates into `CvTab.jsx`.

### CV tab states

| Latest CV status       | Render                                                                          |
|------------------------|---------------------------------------------------------------------------------|
| `null` (no CV yet)     | Empty state + `Generate CV` button + "N free left" or "costs 1 token" hint.     |
| `pending` / `processing` | Spinner + "Generating your CV… ~15–30s". Polls `GET /api/job_postings/:postingId/cv_generations/:cvId` every 3s. 120s timeout shows "Taking longer than expected." alert. |
| `completed`            | `<PDFViewer>` + `Download PDF` button + `Generate new CV` button (opens confirm modal). |
| `failed`               | Red alert "CV generation failed" + `Try again` button (fires the POST flow, no modal). |

### Confirm modal (shadcn Dialog)

- Fires only from the `completed` state's `Generate new CV` button.
- Title: "Generate a new CV?"
- Body, cost-aware:
  - Free tier: "This will use 1 of your N remaining free generations."
  - Paid: "This will cost 1 token. You have N remaining."
- Buttons: `Cancel` (secondary) and `Generate` (primary).
- On `Generate`: close modal, call `POST /api/job_postings/:id/cv_generations`, update the local user (see below), replace the tab's latest-CV state with the new pending row, start polling.

**Counter update on POST success.** Mirror the existing `handleGenerate` in `JobPostingDetailPage.jsx:37` — local optimistic update via `refreshUser({...})`, no extra GET. Two counters move:
- Free tier (user had `free_generations_used < 3`): `refreshUser({ free_generations_used: user.free_generations_used + 1 })`. `tokens_used` is 0 so no token change.
- Paid (user had `free_generations_used >= 3`): `refreshUser({ token_balance: user.token_balance - r.data.tokens_used })`.

Branch on `free_generations_used < 3` at the time of click. This matches the server-side bookkeeping in `cv_generations_controller.rb:30-31` and keeps the UI in sync without a round-trip.

### Disabled / guarded paths (unchanged from today)

- Analysis not `completed` → `Generate CV` button disabled.
- `POST /api/job_postings/:id/cv_generations` returns 402 → surface the existing "Not enough tokens" alert inside the CV tab.

## Backend change

- Add a `latest_cv_generation` association on `JobPosting`: `has_one :latest_cv_generation, -> { order(created_at: :desc) }, class_name: "CvGeneration"`.
- Add a `latest_cv_generation` attribute to `JobPostingSerializer`. `JobPostingSerializer` uses `jsonapi-serializer`'s `attributes` DSL, which does **not** automatically delegate to `CvGenerationSerializer`. Use an explicit block that delegates:

  ```ruby
  attribute :latest_cv_generation do |posting|
    cv = posting.latest_cv_generation
    CvGenerationSerializer.new(cv).serializable_hash.dig(:data, :attributes) if cv
  end
  ```

  Value is `nil` when the posting has no generations, otherwise the same attribute hash `CvGenerationSerializer` emits today (`id`, `content`, `status`, `tokens_used`, `created_at`).
- No controller changes — `JobPostingsController#show` already renders through the serializer.

## Data flow

```
mount JobPostingDetailPage
  ├─ GET /api/profile                (for PDF rendering)
  └─ GET /api/job_postings/:id       (posting + latest_cv_generation)
       │
       ├─ tab=analysis → render Analysis card
       └─ tab=cv       → render CvTab
            │
            ├─ latest null     → empty state
            ├─ latest pending  → poll GET /api/job_postings/:postingId/cv_generations/:cvId every 3s
            ├─ latest complete → PDFViewer + "Generate new CV"
            │     └─ click → confirm modal → POST /api/job_postings/:id/cv_generations → poll new id
            └─ latest failed   → error + "Try again" → POST /api/job_postings/:id/cv_generations → poll new id
```

Profile is fetched once at the page level (not inside `CvTab`) because it's user-scoped, not posting-scoped.

## Error handling

- `GET /api/job_postings/:id` failure → existing "Posting not found" fallback.
- `GET /api/profile` failure → proceed with `user` fallback (existing behavior in `CvPreviewPage`).
- `POST /api/job_postings/:id/cv_generations` 402 → in-tab alert with copy "Not enough tokens. Please buy more on the Billing page." (current behavior).
- `POST /api/job_postings/:id/cv_generations` other non-2xx → in-tab alert with server-provided error or generic "Generation failed. Try again."
- Polling timeout at 120s → alert "Taking longer than expected. Please refresh."

## Testing

### Web (vitest + RTL)

- **`JobPostingDetailPage.test.jsx`** — new (no existing file under `web/src/__tests__/`): tab renders respect `?tab=`; switching tabs updates the URL param; CV tab empty state appears when `latest_cv_generation` is null; `Generate CV` disabled when analysis is pending/processing/failed.
- **`CvTab.test.jsx`** — new: each of the four states renders correctly; polling swaps pending → completed; `Generate new CV` opens the confirm modal; confirm fires POST and swaps to pending; Cancel closes without POST; failed state's `Try again` fires POST without the modal.
- **`CvPreviewPage.test.jsx`** — deleted.

### API (Minitest)

- `JobPostingsControllerTest#show` — one case: response includes `latest_cv_generation` as `nil` when none exist, and as the newest generation's attributes when one or more exist.

## Out of scope (deliberate)

- Showing a history of past CVs in the UI.
- Any change to generation pricing, token logic, or CV rendering.
- Any change to the analysis flow.
- Cross-posting CV views (e.g., a global "My CVs" list).
