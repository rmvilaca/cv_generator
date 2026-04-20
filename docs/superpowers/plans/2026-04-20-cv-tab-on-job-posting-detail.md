# CV tab on Job Posting Detail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the CV preview into `JobPostingDetailPage` as a second tab so users can view and re-generate their latest CV without leaving the posting page.

**Architecture:** Backend adds `latest_cv_generation` to the `JobPostingSerializer` payload. Frontend restructures `JobPostingDetailPage` with shadcn `Tabs`; a new `CvTab` component owns all CV states (null/pending/completed/failed), polling, PDF rendering, and the confirm-modal regeneration flow. The old `/job-postings/:postingId/cv/:cvId` route becomes a dynamic redirect.

**Tech Stack:** Rails 8.1 (jsonapi-serializer, Minitest), React + Vite (vitest + React Testing Library), shadcn/ui (Radix primitives), @react-pdf/renderer, react-router-dom v6.

**Spec:** `docs/superpowers/specs/2026-04-20-cv-tab-on-job-posting-detail.md`.

---

## File Structure

**Backend**
- Modify `api/app/models/job_posting.rb` — add `has_one :latest_cv_generation`.
- Modify `api/app/serializers/job_posting_serializer.rb` — add `latest_cv_generation` attribute delegating to `CvGenerationSerializer`.
- Modify `api/test/controllers/api/job_postings_controller_test.rb` — add two tests.

**Frontend primitive**
- Modify `web/package.json` — add `@radix-ui/react-tabs`.
- Create `web/src/components/ui/tabs.jsx` — shadcn Tabs primitive.

**New feature component**
- Create `web/src/components/CvTab.jsx` — owns the four-state render + polling + POST + confirm modal.
- Create `web/src/__tests__/CvTab.test.jsx`.

**Page refactor**
- Modify `web/src/pages/JobPostingDetailPage.jsx` — tabbed layout, lift profile fetch, remove inline Generate button.
- Create `web/src/__tests__/JobPostingDetailPage.test.jsx`.

**Routing cleanup**
- Create `web/src/pages/CvPreviewRedirect.jsx` — wrapper that reads `:postingId` and redirects.
- Modify `web/src/main.jsx` — swap the CV route, drop the `CvPreviewPage` import.
- Delete `web/src/pages/CvPreviewPage.jsx`.
- Delete `web/src/__tests__/CvPreviewPage.test.jsx`.

**Commit convention:** match recent history (`feat:`, `refactor:`, `test:`, `deps:`, `db:`). Every commit runs the pre-commit hook (rubocop, brakeman, `rails test`, eslint, vitest). Run from `cv_generator/` root.

---

## Task 1: Backend — `latest_cv_generation` on posting payload

**Files:**
- Modify: `api/app/models/job_posting.rb`
- Modify: `api/app/serializers/job_posting_serializer.rb`
- Modify: `api/test/controllers/api/job_postings_controller_test.rb`

- [ ] **Step 1: Add two failing tests to `job_postings_controller_test.rb`**

Append inside `class Api::JobPostingsControllerTest < ActionDispatch::IntegrationTest`, just before the final `end`:

```ruby
test "GET show returns latest_cv_generation as nil when none exist" do
  posting = JobPosting.create!(user: @user, raw_text: "no cv yet", analysis_status: "completed")
  get "/api/job_postings/#{posting.id}", headers: @headers
  assert_response :ok
  body = JSON.parse(response.body)
  assert body.key?("latest_cv_generation"), "expected latest_cv_generation key in payload"
  assert_nil body["latest_cv_generation"]
end

test "GET show returns newest cv_generation attributes as latest_cv_generation" do
  posting = JobPosting.create!(user: @user, raw_text: "with cvs", analysis_status: "completed")
  older = CvGeneration.create!(user: @user, job_posting: posting, status: "completed",
                                content: { summary: "old" }, created_at: 2.days.ago)
  newer = CvGeneration.create!(user: @user, job_posting: posting, status: "pending",
                                content: nil,              created_at: 1.minute.ago)

  get "/api/job_postings/#{posting.id}", headers: @headers
  assert_response :ok
  latest = JSON.parse(response.body)["latest_cv_generation"]

  assert_equal newer.id,  latest["id"]
  assert_equal "pending", latest["status"]
  assert_not_equal older.id, latest["id"]
end
```

- [ ] **Step 2: Run the new tests — they must fail**

Run: `cd api && bin/rails test test/controllers/api/job_postings_controller_test.rb`
Expected: both new tests fail (missing `latest_cv_generation` key in payload).

- [ ] **Step 3: Add the `latest_cv_generation` association**

Edit `api/app/models/job_posting.rb` to read:

```ruby
class JobPosting < ApplicationRecord
  belongs_to :user
  has_many :cv_generations, dependent: :destroy
  has_one  :latest_cv_generation, -> { order(created_at: :desc) }, class_name: "CvGeneration"

  validates :raw_text, presence: true
  validates :analysis_status, inclusion: { in: %w[pending processing completed failed] }

  serialize :analysis, coder: JSON
end
```

- [ ] **Step 4: Add the serializer attribute**

Edit `api/app/serializers/job_posting_serializer.rb` to read:

```ruby
class JobPostingSerializer
  include JSONAPI::Serializer

  attributes :id, :raw_text, :url, :company_name, :job_title,
             :analysis, :analysis_status, :created_at

  attribute :latest_cv_generation do |posting|
    cv = posting.latest_cv_generation
    CvGenerationSerializer.new(cv).serializable_hash.dig(:data, :attributes) if cv
  end
end
```

- [ ] **Step 5: Run the full API suite — all green**

Run: `cd api && bin/rails test`
Expected: all tests pass (including the two new ones).

- [ ] **Step 6: Commit**

```bash
git add api/app/models/job_posting.rb \
        api/app/serializers/job_posting_serializer.rb \
        api/test/controllers/api/job_postings_controller_test.rb
git commit -m "feat: include latest_cv_generation in job posting payload"
```

---

## Task 2: Frontend — add Radix Tabs dependency and shadcn `tabs.jsx`

**Files:**
- Modify: `web/package.json`
- Create: `web/src/components/ui/tabs.jsx`

- [ ] **Step 1: Install the Radix Tabs package**

Run: `cd web && npm install @radix-ui/react-tabs@^1.1.0 --save-exact=false`
Expected: dep added to `package.json`, `package-lock.json` updates.

- [ ] **Step 2: Create `web/src/components/ui/tabs.jsx`**

```jsx
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
```

- [ ] **Step 3: Sanity-check eslint + vitest still pass**

Run: `cd web && npm run lint && npm test`
Expected: lint produces only the existing pre-existing warning in `ExperienceSection.test.jsx`; tests pass.

- [ ] **Step 4: Commit**

```bash
git add web/package.json web/package-lock.json web/src/components/ui/tabs.jsx
git commit -m "deps: add @radix-ui/react-tabs and shadcn Tabs primitive"
```

---

## Task 3: CvTab — null state (empty-state render)

**Files:**
- Create: `web/src/components/CvTab.jsx`
- Create: `web/src/__tests__/CvTab.test.jsx`

- [ ] **Step 1: Write the failing test for the null state**

Create `web/src/__tests__/CvTab.test.jsx`:

```jsx
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import CvTab from "../components/CvTab";
import { AuthContext } from "../contexts/AuthContext";
import client from "../api/client";

vi.mock("../api/client");
vi.mock("@react-pdf/renderer", () => ({
  PDFViewer:       ({ children }) => <div data-testid="pdf-viewer">{children}</div>,
  PDFDownloadLink: ({ children }) => <div data-testid="pdf-download">{children("", false, null)}</div>,
  Document:        ({ children }) => <div>{children}</div>,
  Page:            ({ children }) => <div>{children}</div>,
  Text:            ({ children }) => <span>{children}</span>,
  View:            ({ children }) => <div>{children}</div>,
  StyleSheet:      { create: (s) => s },
}));

const baseUser = { email: "j@test.com", token_balance: 5, free_generations_used: 0 };
const baseProfile = { full_name: "Jane", email: "jane@test.com", phone: "", location: "" };

function renderTab({ posting, user = baseUser, profile = baseProfile, onPostingChanged = vi.fn() } = {}) {
  return render(
    <AuthContext.Provider value={{ user, refreshUser: vi.fn() }}>
      <CvTab posting={posting} profile={profile} onPostingChanged={onPostingChanged} />
    </AuthContext.Provider>
  );
}

describe("CvTab", () => {
  it("renders empty state with Generate CV button when no latest_cv_generation", () => {
    renderTab({ posting: { id: 1, analysis_status: "completed", latest_cv_generation: null } });
    expect(screen.getByText(/no cv generated yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate cv/i })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run the test — it must fail**

Run: `cd web && npx vitest --run src/__tests__/CvTab.test.jsx`
Expected: FAIL — `Cannot find module '../components/CvTab'`.

- [ ] **Step 3: Create the minimal `CvTab.jsx`**

Create `web/src/components/CvTab.jsx`:

```jsx
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { FileText } from "lucide-react";

export default function CvTab({ posting, profile: _profile, onPostingChanged: _onPostingChanged }) {
  const latest = posting.latest_cv_generation;

  if (!latest) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
          <p className="text-muted-foreground">No CV generated yet for this posting.</p>
          <Button disabled={posting.analysis_status !== "completed"}>
            <FileText className="h-4 w-4" /> Generate CV
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
```

- [ ] **Step 4: Run the test — it must pass**

Run: `cd web && npx vitest --run src/__tests__/CvTab.test.jsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/CvTab.jsx web/src/__tests__/CvTab.test.jsx
git commit -m "feat: scaffold CvTab with empty state"
```

---

## Task 4: CvTab — generate POST flow from empty state

Adds the click handler that POSTs, updates the local user counters, and swaps into the pending state.

**Files:**
- Modify: `web/src/components/CvTab.jsx`
- Modify: `web/src/__tests__/CvTab.test.jsx`

- [ ] **Step 1: Add failing tests for the POST flow (both tiers)**

Append inside `describe("CvTab", ...)` in `CvTab.test.jsx`:

```jsx
it("free tier: Generate CV POSTs and bumps free_generations_used locally", async () => {
  const user = { ...baseUser, free_generations_used: 1, token_balance: 0 };
  const refreshUser = vi.fn();
  client.post = vi.fn().mockResolvedValue({
    data: { id: 99, status: "pending", content: null, tokens_used: 0 },
  });
  client.get = vi.fn().mockResolvedValue({
    data: { id: 99, status: "pending", content: null, tokens_used: 0 },
  });

  render(
    <AuthContext.Provider value={{ user, refreshUser }}>
      <CvTab
        posting={{ id: 7, analysis_status: "completed", latest_cv_generation: null }}
        profile={baseProfile}
        onPostingChanged={vi.fn()}
      />
    </AuthContext.Provider>
  );

  screen.getByRole("button", { name: /generate cv/i }).click();

  await screen.findByText(/generating your cv/i);
  expect(client.post).toHaveBeenCalledWith("/job_postings/7/cv_generations");
  expect(refreshUser).toHaveBeenCalledWith({ free_generations_used: 2 });
});

it("paid tier: Generate CV POSTs and decrements token_balance locally", async () => {
  const user = { ...baseUser, free_generations_used: 3, token_balance: 4 };
  const refreshUser = vi.fn();
  client.post = vi.fn().mockResolvedValue({
    data: { id: 100, status: "pending", content: null, tokens_used: 1 },
  });
  client.get = vi.fn().mockResolvedValue({
    data: { id: 100, status: "pending", content: null, tokens_used: 1 },
  });

  render(
    <AuthContext.Provider value={{ user, refreshUser }}>
      <CvTab
        posting={{ id: 8, analysis_status: "completed", latest_cv_generation: null }}
        profile={baseProfile}
        onPostingChanged={vi.fn()}
      />
    </AuthContext.Provider>
  );

  screen.getByRole("button", { name: /generate cv/i }).click();

  await screen.findByText(/generating your cv/i);
  expect(refreshUser).toHaveBeenCalledWith({ token_balance: 3 });
});

it("POST 402 surfaces in-tab 'Not enough tokens' alert", async () => {
  const user = { ...baseUser, free_generations_used: 3, token_balance: 0 };
  client.post = vi.fn().mockRejectedValue({ response: { status: 402 } });

  render(
    <AuthContext.Provider value={{ user, refreshUser: vi.fn() }}>
      <CvTab
        posting={{ id: 9, analysis_status: "completed", latest_cv_generation: null }}
        profile={baseProfile}
        onPostingChanged={vi.fn()}
      />
    </AuthContext.Provider>
  );

  screen.getByRole("button", { name: /generate cv/i }).click();
  await screen.findByText(/not enough tokens/i);
});
```

- [ ] **Step 2: Run the tests — three new ones must fail**

Run: `cd web && npx vitest --run src/__tests__/CvTab.test.jsx`
Expected: FAIL on the three new cases; the existing empty-state case still passes.

- [ ] **Step 3: Implement the POST + pending state in `CvTab.jsx`**

Replace `web/src/components/CvTab.jsx` with:

```jsx
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import client from "../api/client";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { AlertCircle, FileText, Loader2 } from "lucide-react";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS  = 120_000;
const FREE_TIER_LIMIT  = 3;

export default function CvTab({ posting, profile: _profile, onPostingChanged: _onPostingChanged }) {
  const { user, refreshUser } = useAuth();
  const [gen, setGen]         = useState(posting.latest_cv_generation);
  const [genError, setGenError] = useState(null);
  const startedAt = useRef(null);

  async function startGeneration() {
    setGenError(null);
    const wasFreeTier = user.free_generations_used < FREE_TIER_LIMIT;

    try {
      const r = await client.post(`/job_postings/${posting.id}/cv_generations`);
      if (wasFreeTier) {
        refreshUser({ free_generations_used: user.free_generations_used + 1 });
      } else {
        refreshUser({ token_balance: user.token_balance - r.data.tokens_used });
      }
      setGen(r.data);
      startedAt.current = Date.now();
    } catch (err) {
      if (err.response?.status === 402) {
        setGenError("Not enough tokens. Please buy more on the Billing page.");
      } else {
        setGenError(err.response?.data?.error ?? "Generation failed. Try again.");
      }
    }
  }

  if (!gen) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
          <p className="text-muted-foreground">No CV generated yet for this posting.</p>
          {genError && (
            <Alert variant="destructive" className="max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{genError}</AlertDescription>
            </Alert>
          )}
          <Button onClick={startGeneration} disabled={posting.analysis_status !== "completed"}>
            <FileText className="h-4 w-4" /> Generate CV
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (gen.status === "pending" || gen.status === "processing") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Generating your CV… this takes about 15–30 seconds.</p>
        </CardContent>
      </Card>
    );
  }

  return null;
}
```

- [ ] **Step 4: Run the tests — all four pass**

Run: `cd web && npx vitest --run src/__tests__/CvTab.test.jsx`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/CvTab.jsx web/src/__tests__/CvTab.test.jsx
git commit -m "feat: CvTab triggers POST and updates user counters locally"
```

---

## Task 5: CvTab — polling and 120s timeout

**Files:**
- Modify: `web/src/components/CvTab.jsx`
- Modify: `web/src/__tests__/CvTab.test.jsx`

- [ ] **Step 1: Add failing test for polling transition to completed**

Append to `CvTab.test.jsx`:

```jsx
it("polls a pending generation and transitions to completed", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const onPostingChanged = vi.fn();
  const responses = [
    { id: 55, status: "pending",   content: null,              tokens_used: 0 },
    { id: 55, status: "completed", content: { summary: "hi" }, tokens_used: 0 },
  ];
  client.get = vi.fn().mockImplementation(() => Promise.resolve({ data: responses.shift() }));

  render(
    <AuthContext.Provider value={{ user: baseUser, refreshUser: vi.fn() }}>
      <CvTab
        posting={{
          id: 10,
          analysis_status: "completed",
          latest_cv_generation: { id: 55, status: "pending", content: null, tokens_used: 0 },
        }}
        profile={baseProfile}
        onPostingChanged={onPostingChanged}
      />
    </AuthContext.Provider>
  );

  expect(screen.getByText(/generating your cv/i)).toBeInTheDocument();

  await vi.advanceTimersByTimeAsync(3000);
  expect(client.get).toHaveBeenCalledWith("/job_postings/10/cv_generations/55");

  await vi.advanceTimersByTimeAsync(3000);
  expect(onPostingChanged).toHaveBeenCalled();
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run the test — it must fail**

Run: `cd web && npx vitest --run src/__tests__/CvTab.test.jsx -t "polls a pending"`
Expected: FAIL — `client.get` is never called.

- [ ] **Step 3: Add the polling effect in `CvTab.jsx`**

Inside `CvTab`, just after the `startedAt` ref, add:

```jsx
const [timedOut, setTimedOut] = useState(false);

useEffect(() => {
  if (!gen || (gen.status !== "pending" && gen.status !== "processing")) return;
  if (startedAt.current === null) startedAt.current = Date.now();

  let cancelled = false;
  const timer = setTimeout(async () => {
    if (cancelled) return;
    if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
      setTimedOut(true);
      return;
    }
    try {
      const r = await client.get(`/job_postings/${posting.id}/cv_generations/${gen.id}`);
      if (cancelled) return;
      setGen(r.data);
      if (r.data.status === "completed" || r.data.status === "failed") {
        _onPostingChanged?.();
      }
    } catch {
      // transient error — let the next tick retry
    }
  }, POLL_INTERVAL_MS);

  return () => { cancelled = true; clearTimeout(timer); };
}, [gen, posting.id, _onPostingChanged]);
```

Also rename the destructured `_onPostingChanged` to `onPostingChanged` and remove the leading underscore so the effect reference matches. Full header line becomes:

```jsx
export default function CvTab({ posting, profile: _profile, onPostingChanged }) {
```

And update the effect to call `onPostingChanged?.()` (drop the underscore).

Update the pending state render to show the timeout alert when `timedOut`:

```jsx
if (gen.status === "pending" || gen.status === "processing") {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Generating your CV… this takes about 15–30 seconds.</p>
        {timedOut && (
          <Alert variant="destructive" className="mt-4 max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Taking longer than expected. Please refresh.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run the tests — all 5 pass**

Run: `cd web && npx vitest --run src/__tests__/CvTab.test.jsx`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/CvTab.jsx web/src/__tests__/CvTab.test.jsx
git commit -m "feat: poll pending CV generation and surface timeout"
```

---

## Task 6: CvTab — completed state (PDFViewer + Download + Generate new CV)

**Files:**
- Modify: `web/src/components/CvTab.jsx`
- Modify: `web/src/__tests__/CvTab.test.jsx`

- [ ] **Step 1: Add failing test for the completed state**

Append to `CvTab.test.jsx`:

```jsx
it("renders PDFViewer and Generate new CV when latest is completed", () => {
  renderTab({
    posting: {
      id: 11,
      analysis_status: "completed",
      latest_cv_generation: {
        id: 77,
        status: "completed",
        content: { summary: "ok", experience: [], skills: [], education: [] },
        tokens_used: 1,
      },
    },
  });

  expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /generate new cv/i })).toBeEnabled();
});
```

- [ ] **Step 2: Run the test — it must fail**

Run: `cd web && npx vitest --run src/__tests__/CvTab.test.jsx -t "completed"`
Expected: FAIL — no `pdf-viewer` testid.

- [ ] **Step 3: Implement the completed branch**

Add the imports at the top of `CvTab.jsx`:

```jsx
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
import CvDocument from "./CvDocument";
import { Download } from "lucide-react";
```

Update the function signature to accept `profile`:

```jsx
export default function CvTab({ posting, profile, onPostingChanged }) {
```

And replace the trailing `return null;` with:

```jsx
if (gen.status === "completed") {
  const profileName     = profile?.full_name ?? user?.full_name ?? user?.email ?? "Candidate";
  const profileEmail    = profile?.email    ?? user?.email ?? "";
  const profilePhone    = profile?.phone    ?? "";
  const profileLocation = profile?.location ?? "";
  const doc = (
    <CvDocument
      content={gen.content}
      profileName={profileName}
      profileEmail={profileEmail}
      profilePhone={profilePhone}
      profileLocation={profileLocation}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <PDFDownloadLink document={doc} fileName="cv.pdf">
          {({ loading: pdfLoading }) => (
            <Button disabled={pdfLoading}>
              <Download className="h-4 w-4" />
              {pdfLoading ? "Preparing…" : "Download PDF"}
            </Button>
          )}
        </PDFDownloadLink>
        <Button variant="secondary" onClick={startGeneration}>
          <FileText className="h-4 w-4" /> Generate new CV
        </Button>
      </div>
      <Card className="overflow-hidden">
        <PDFViewer width="100%" height={700} style={{ border: "none" }}>
          {doc}
        </PDFViewer>
      </Card>
    </div>
  );
}

return null;
```

> Note: the `Generate new CV` button here wires directly to `startGeneration` for now; Task 8 will intercept it with the confirm modal.

- [ ] **Step 4: Run the tests — all 6 pass**

Run: `cd web && npx vitest --run src/__tests__/CvTab.test.jsx`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/CvTab.jsx web/src/__tests__/CvTab.test.jsx
git commit -m "feat: render completed CV with download and regenerate buttons"
```

---

## Task 7: CvTab — failed state (error + Try again)

**Files:**
- Modify: `web/src/components/CvTab.jsx`
- Modify: `web/src/__tests__/CvTab.test.jsx`

- [ ] **Step 1: Add failing test for the failed state**

Append to `CvTab.test.jsx`:

```jsx
it("failed state: shows error and Try again fires POST (no modal)", async () => {
  const refreshUser = vi.fn();
  client.post = vi.fn().mockResolvedValue({
    data: { id: 200, status: "pending", content: null, tokens_used: 0 },
  });

  render(
    <AuthContext.Provider value={{ user: baseUser, refreshUser }}>
      <CvTab
        posting={{
          id: 12,
          analysis_status: "completed",
          latest_cv_generation: { id: 150, status: "failed", content: null, tokens_used: 0 },
        }}
        profile={baseProfile}
        onPostingChanged={vi.fn()}
      />
    </AuthContext.Provider>
  );

  expect(screen.getByText(/cv generation failed/i)).toBeInTheDocument();
  screen.getByRole("button", { name: /try again/i }).click();
  await screen.findByText(/generating your cv/i);
  expect(client.post).toHaveBeenCalledWith("/job_postings/12/cv_generations");
});
```

- [ ] **Step 2: Run it — it must fail**

Run: `cd web && npx vitest --run src/__tests__/CvTab.test.jsx -t "failed state"`
Expected: FAIL — no "CV generation failed" text.

- [ ] **Step 3: Add the failed branch in `CvTab.jsx`**

Insert before the `return null;` at the bottom:

```jsx
if (gen.status === "failed") {
  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>CV generation failed. Please try again.</AlertDescription>
      </Alert>
      {genError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{genError}</AlertDescription>
        </Alert>
      )}
      <Button onClick={startGeneration}>
        <FileText className="h-4 w-4" /> Try again
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests — 7 pass**

Run: `cd web && npx vitest --run src/__tests__/CvTab.test.jsx`
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/CvTab.jsx web/src/__tests__/CvTab.test.jsx
git commit -m "feat: CvTab failed state with retry"
```

---

## Task 8: CvTab — confirm modal on regenerate

Gates the `Generate new CV` button (completed state only) behind a shadcn Dialog with cost-aware copy.

**Files:**
- Modify: `web/src/components/CvTab.jsx`
- Modify: `web/src/__tests__/CvTab.test.jsx`

- [ ] **Step 1: Add failing tests for the modal**

Append to `CvTab.test.jsx`:

```jsx
const completedPosting = {
  id: 20,
  analysis_status: "completed",
  latest_cv_generation: {
    id: 500,
    status: "completed",
    content: { summary: "ok", experience: [], skills: [], education: [] },
    tokens_used: 1,
  },
};

it("Generate new CV opens modal; Cancel closes without POST", async () => {
  client.post = vi.fn();
  renderTab({ posting: completedPosting });
  screen.getByRole("button", { name: /generate new cv/i }).click();
  expect(await screen.findByText(/generate a new cv\?/i)).toBeInTheDocument();
  screen.getByRole("button", { name: /cancel/i }).click();
  expect(client.post).not.toHaveBeenCalled();
});

it("Generate in modal fires POST and transitions to pending", async () => {
  client.post = vi.fn().mockResolvedValue({
    data: { id: 501, status: "pending", content: null, tokens_used: 1 },
  });
  const refreshUser = vi.fn();

  render(
    <AuthContext.Provider value={{ user: { ...baseUser, free_generations_used: 3 }, refreshUser }}>
      <CvTab posting={completedPosting} profile={baseProfile} onPostingChanged={vi.fn()} />
    </AuthContext.Provider>
  );

  screen.getByRole("button", { name: /generate new cv/i }).click();
  const confirm = await screen.findByRole("button", { name: /^generate$/i });
  confirm.click();

  await screen.findByText(/generating your cv/i);
  expect(client.post).toHaveBeenCalledWith("/job_postings/20/cv_generations");
  expect(refreshUser).toHaveBeenCalledWith({ token_balance: baseUser.token_balance - 1 });
});

it("modal copy reflects free tier when free generations remain", async () => {
  renderTab({
    posting: completedPosting,
    user: { ...baseUser, free_generations_used: 1, token_balance: 0 },
  });
  screen.getByRole("button", { name: /generate new cv/i }).click();
  expect(await screen.findByText(/2 of your 2 remaining free generations/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — the three new tests must fail**

Run: `cd web && npx vitest --run src/__tests__/CvTab.test.jsx`
Expected: 3 failures (no modal today).

- [ ] **Step 3: Wire the modal into `CvTab.jsx`**

Add imports:

```jsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
```

Add state at the top of `CvTab`:

```jsx
const [confirmOpen, setConfirmOpen] = useState(false);
```

Add a helper next to `startGeneration`:

```jsx
function confirmAndGenerate() {
  setConfirmOpen(false);
  startGeneration();
}

const freeRemaining = Math.max(0, FREE_TIER_LIMIT - user.free_generations_used);
const isFreeTier    = freeRemaining > 0;
```

Change the **completed** branch's `Generate new CV` button to open the modal instead of calling `startGeneration` directly:

```jsx
<Button variant="secondary" onClick={() => setConfirmOpen(true)}>
  <FileText className="h-4 w-4" /> Generate new CV
</Button>
```

And render the dialog anywhere inside the component's return tree (the completed branch is fine — it's the only place that opens it):

```jsx
<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Generate a new CV?</DialogTitle>
      <DialogDescription>
        {isFreeTier
          ? `This will use 1 of your ${freeRemaining} remaining free generations.`
          : `This will cost 1 token. You have ${user.token_balance} remaining.`}
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
      <Button onClick={confirmAndGenerate}>Generate</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 4: Run the tests — all 10 pass**

Run: `cd web && npx vitest --run src/__tests__/CvTab.test.jsx`
Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/CvTab.jsx web/src/__tests__/CvTab.test.jsx
git commit -m "feat: confirm modal before regenerating CV"
```

---

## Task 9: Refactor `JobPostingDetailPage` to tabbed layout

**Files:**
- Modify: `web/src/pages/JobPostingDetailPage.jsx`
- Create: `web/src/__tests__/JobPostingDetailPage.test.jsx`

- [ ] **Step 1: Write failing tests for the tabbed page**

Create `web/src/__tests__/JobPostingDetailPage.test.jsx`:

```jsx
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import JobPostingDetailPage from "../pages/JobPostingDetailPage";
import { AuthContext } from "../contexts/AuthContext";
import client from "../api/client";

vi.mock("../api/client");
vi.mock("@react-pdf/renderer", () => ({
  PDFViewer:       ({ children }) => <div data-testid="pdf-viewer">{children}</div>,
  PDFDownloadLink: ({ children }) => <div data-testid="pdf-download">{children("", false, null)}</div>,
  Document:        ({ children }) => <div>{children}</div>,
  Page:            ({ children }) => <div>{children}</div>,
  Text:            ({ children }) => <span>{children}</span>,
  View:            ({ children }) => <div>{children}</div>,
  StyleSheet:      { create: (s) => s },
}));

const user = { email: "u@test.com", token_balance: 5, free_generations_used: 0 };

function mockFetch({ tab = "analysis", posting }) {
  client.get = vi.fn().mockImplementation((url) => {
    if (url === "/profile") return Promise.resolve({ data: { full_name: "Jane" } });
    if (url === `/job_postings/1`) return Promise.resolve({ data: posting });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
  return tab;
}

function wrapper(tab) {
  return ({ children }) => (
    <MemoryRouter initialEntries={[`/job-postings/1${tab === "cv" ? "?tab=cv" : ""}`]}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() }}>
        <Routes>
          <Route path="/job-postings/:id" element={children} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe("JobPostingDetailPage", () => {
  it("defaults to Analysis tab and renders analysis content", async () => {
    const tab = mockFetch({
      posting: {
        id: 1, job_title: "Rails Dev", company_name: "Acme", analysis_status: "completed",
        analysis: { skills: [], job: [], tech: [] }, latest_cv_generation: null,
      },
    });
    render(<JobPostingDetailPage />, { wrapper: wrapper(tab) });
    await waitFor(() => expect(screen.getByRole("tab", { name: /analysis/i })).toHaveAttribute("data-state", "active"));
    expect(screen.getByText(/analysis/i)).toBeInTheDocument();
  });

  it("with ?tab=cv, opens CV tab and shows empty state when no latest_cv_generation", async () => {
    const tab = mockFetch({
      tab: "cv",
      posting: {
        id: 1, job_title: "Rails Dev", company_name: "Acme", analysis_status: "completed",
        analysis: null, latest_cv_generation: null,
      },
    });
    render(<JobPostingDetailPage />, { wrapper: wrapper(tab) });
    await waitFor(() => expect(screen.getByText(/no cv generated yet/i)).toBeInTheDocument());
  });

  it("CV tab's Generate CV disabled when analysis not completed", async () => {
    const tab = mockFetch({
      tab: "cv",
      posting: {
        id: 1, job_title: "Rails Dev", company_name: "Acme", analysis_status: "pending",
        analysis: null, latest_cv_generation: null,
      },
    });
    render(<JobPostingDetailPage />, { wrapper: wrapper(tab) });
    await waitFor(() => expect(screen.getByRole("button", { name: /generate cv/i })).toBeDisabled());
  });
});
```

- [ ] **Step 2: Run — all three must fail**

Run: `cd web && npx vitest --run src/__tests__/JobPostingDetailPage.test.jsx`
Expected: 3 failures.

- [ ] **Step 3: Rewrite `JobPostingDetailPage.jsx`**

Replace the contents with:

```jsx
import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import client from "../api/client";
import CvTab from "../components/CvTab";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { AlertCircle, Loader2 } from "lucide-react";

const STATUS_VARIANT = {
  completed:  "success",
  failed:     "destructive",
  pending:    "warning",
  processing: "warning",
};

export default function JobPostingDetailPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "cv" ? "cv" : "analysis";

  const [posting, setPosting] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPosting = useCallback(async () => {
    const r = await client.get(`/job_postings/${id}`);
    setPosting(r.data);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      try {
        await fetchPosting();
        try {
          const pr = await client.get("/profile");
          if (!cancelled) setProfile(pr.data);
        } catch {
          if (!cancelled) setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAll();
    return () => { cancelled = true; };
  }, [fetchPosting]);

  function onTabChange(value) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === "analysis") next.delete("tab");
        else next.set("tab", value);
        return next;
      },
      { replace: true }
    );
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (!posting) return <p className="text-muted-foreground">Posting not found.</p>;

  const analysis = posting.analysis;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{posting.job_title ?? "Job Posting"}</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted-foreground">{posting.company_name ?? "Unknown company"}</span>
          <Badge variant={STATUS_VARIANT[posting.analysis_status] ?? "secondary"}>
            {posting.analysis_status}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="cv">CV</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis">
          {posting.analysis_status === "completed" && analysis && (
            <Card>
              <CardHeader><CardTitle>Analysis</CardTitle></CardHeader>
              <CardContent>
                <Accordion type="multiple" defaultValue={["skills", "job", "tech"]}>
                  {["skills", "job", "tech"].map((key) => (
                    <AccordionItem key={key} value={key}>
                      <AccordionTrigger>{key.charAt(0).toUpperCase() + key.slice(1)}</AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-2 ml-1">
                          {(analysis[key] ?? []).map((item, i) => {
                            const [title, details] = Object.entries(item)[0];
                            return (
                              <li key={i}>
                                <p className="font-medium">{title}</p>
                                <ul className="ml-4 text-muted-foreground list-disc">
                                  {details.map((d, j) => <li key={j}>{d}</li>)}
                                </ul>
                              </li>
                            );
                          })}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}

          {(posting.analysis_status === "pending" || posting.analysis_status === "processing") && (
            <Card>
              <CardContent className="flex items-center gap-3 py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Analyzing job posting… refresh in a moment.</p>
              </CardContent>
            </Card>
          )}

          {posting.analysis_status === "failed" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Analysis failed. Delete this posting and try again.</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="cv">
          <CvTab posting={posting} profile={profile} onPostingChanged={fetchPosting} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

Note: the inline `Generate CV` button, `genError` state, and `handleGenerate` are now gone — that flow lives in `CvTab`.

- [ ] **Step 4: Run the page tests — all 3 pass**

Run: `cd web && npx vitest --run src/__tests__/JobPostingDetailPage.test.jsx`
Expected: 3 tests pass.

- [ ] **Step 5: Run the full web test suite — nothing else regressed**

Run: `cd web && npm test`
Expected: all tests pass (CvPreviewPage tests still pass too — page deleted in Task 10). 

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/JobPostingDetailPage.jsx web/src/__tests__/JobPostingDetailPage.test.jsx
git commit -m "refactor: tabbed job posting detail page with CV tab"
```

---

## Task 10: Route redirect + delete `CvPreviewPage`

**Files:**
- Create: `web/src/pages/CvPreviewRedirect.jsx`
- Modify: `web/src/main.jsx`
- Delete: `web/src/pages/CvPreviewPage.jsx`
- Delete: `web/src/__tests__/CvPreviewPage.test.jsx`

- [ ] **Step 1: Create the redirect wrapper**

Create `web/src/pages/CvPreviewRedirect.jsx`:

```jsx
import { useParams, Navigate } from "react-router-dom";

export default function CvPreviewRedirect() {
  const { postingId } = useParams();
  return <Navigate to={`/job-postings/${postingId}?tab=cv`} replace />;
}
```

- [ ] **Step 2: Swap the route and drop the old import in `main.jsx`**

Edit `web/src/main.jsx`:
- Remove: `import CvPreviewPage from "./pages/CvPreviewPage";`
- Add: `import CvPreviewRedirect from "./pages/CvPreviewRedirect";`
- Replace the `/job-postings/:postingId/cv/:cvId` route line with:

```jsx
<Route path="/job-postings/:postingId/cv/:cvId" element={<ProtectedRoute><CvPreviewRedirect /></ProtectedRoute>} />
```

- [ ] **Step 3: Delete the old page and its test**

Run:

```bash
rm web/src/pages/CvPreviewPage.jsx web/src/__tests__/CvPreviewPage.test.jsx
```

- [ ] **Step 4: Run the full web test suite**

Run: `cd web && npm test`
Expected: all tests pass, no references to the deleted module.

- [ ] **Step 5: Build to confirm imports resolve**

Run: `cd web && npm run build`
Expected: Vite build succeeds.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/CvPreviewRedirect.jsx web/src/main.jsx
git rm web/src/pages/CvPreviewPage.jsx web/src/__tests__/CvPreviewPage.test.jsx
git commit -m "refactor: redirect legacy CV preview route to tabbed page"
```

---

## Task 11: End-to-end manual verification

- [ ] **Step 1: Start the dev servers**

Run from repo root: `bin/dev`
Expected: Rails server on :3000, Vite on :5173 (per existing setup).

- [ ] **Step 2: Walk through the golden path in the browser**

1. Log in, create a posting, wait for analysis to complete.
2. Navigate to the posting detail. Confirm the URL has no `tab` param and the Analysis tab is active.
3. Click the `CV` tab → URL changes to `?tab=cv`, empty state is visible, Generate CV is enabled.
4. Click `Generate CV` → spinner appears, polling ticks, PDF renders on completion.
5. Click `Generate new CV` → confirm modal opens with the correct free-vs-paid copy; click `Cancel` → no change.
6. Click `Generate new CV` again → click `Generate` → new pending generation replaces the previous CV, counter updates.
7. Visit the legacy URL `/job-postings/<id>/cv/<any>` → browser redirects to `/job-postings/<id>?tab=cv`.
8. Switch back to Analysis tab → URL drops `?tab=cv`, analysis content still rendered.

- [ ] **Step 3: Final commit if any cleanup was needed**

Only commit further changes if issues surfaced during step 2; otherwise this task closes with no commit.

---

## Self-review

**Spec coverage check:**

- History model (latest only) → Task 1 association uses `order(created_at: :desc)` single record.
- Tabs layout → Task 2 primitive, Task 9 page refactor.
- Re-generation confirm modal → Task 8.
- Legacy route redirect → Task 10 wrapper + route swap.
- `latest_cv_generation` embedded in posting payload → Task 1.
- Four CV states (null/pending/completed/failed) → Tasks 3, 5, 6, 7 (POST flow in Task 4).
- Disabled generate button when analysis not completed → covered in CvTab component (`disabled={posting.analysis_status !== "completed"}`) and asserted by Task 9 test.
- 402 "Not enough tokens" alert → Task 4 test + implementation.
- Other non-2xx error copy → Task 4 implementation (`err.response?.data?.error ?? "Generation failed. Try again."`).
- Profile fetched at page level → Task 9 `useEffect`.
- API test for nil + present `latest_cv_generation` → Task 1.
- Delete `CvPreviewPage.jsx` and its test → Task 10.

**Type / name consistency:**

- Prop name `onPostingChanged` used identically in tests (Task 3 onward) and page (Task 9).
- `startGeneration` name reused in Tasks 4, 6, 7, 8.
- Endpoint strings are consistent (`/job_postings/${id}/cv_generations` for POST, `/job_postings/${id}/cv_generations/${genId}` for poll).
- `FREE_TIER_LIMIT = 3` matches backend.

**Placeholder scan:** no TBD/TODO/"similar to Task N" left.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-20-cv-tab-on-job-posting-detail.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
