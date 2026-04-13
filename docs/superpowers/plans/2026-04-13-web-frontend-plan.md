# CV Generator — React Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vite + React web app where users manage their profile, browse saved job postings, generate tailored CVs, and download them as PDFs.

**Architecture:** Single-page app with React Router. A central Axios instance attaches the JWT to every request. Auth state lives in a React context. CV content received from the API is rendered by `@react-pdf/renderer` directly in the browser — no server-side PDF generation.

**Tech Stack:** Vite, React 18, React Router v6, Axios, @react-pdf/renderer, Vitest + React Testing Library, plain CSS (no framework)

**Prerequisite:** The Rails API (see `2026-04-13-api-plan.md`) must be running on `http://localhost:3000` before the frontend can be tested end-to-end.

---

## File Map

```
cv_generator/web/
├── index.html
├── vite.config.js
├── package.json
├── src/
│   ├── main.jsx                   Entry point
│   ├── api/
│   │   └── client.js              Axios instance with JWT interceptor
│   ├── contexts/
│   │   └── AuthContext.jsx        JWT storage, login/logout helpers
│   ├── components/
│   │   ├── ProtectedRoute.jsx     Redirects to /login if not authed
│   │   ├── Nav.jsx                Top navigation bar
│   │   └── CvDocument.jsx        @react-pdf/renderer PDF document
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── RegisterPage.jsx
│   │   ├── ProfilePage.jsx
│   │   ├── JobPostingsPage.jsx
│   │   ├── JobPostingDetailPage.jsx
│   │   ├── CvPreviewPage.jsx
│   │   └── BillingPage.jsx
│   └── styles/
│       └── app.css
└── src/__tests__/
    ├── AuthContext.test.jsx
    ├── ProfilePage.test.jsx
    ├── JobPostingsPage.test.jsx
    └── CvPreviewPage.test.jsx
```

All commands run from `cv_generator/web/`.

---

## Task 1: Scaffold Vite + React project

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/styles/app.css`

- [ ] **Step 1: Create the project**

```bash
cd cv_generator
npm create vite@latest web -- --template react
cd web
```

- [ ] **Step 2: Install dependencies**

```bash
npm install react-router-dom axios @react-pdf/renderer
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 3: Configure Vite for testing**

Replace `vite.config.js`:
```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/__tests__/setup.js",
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
```

- [ ] **Step 4: Create test setup file**

Create `src/__tests__/setup.js`:
```js
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Add test script to package.json**

In `package.json`, ensure the scripts section includes:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "test": "vitest",
  "test:ui": "vitest --ui"
}
```

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```
Expected: Server starts on `http://localhost:5173`. Open in browser — see Vite default page. Kill with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
cd ..
git add web/
git commit -m "chore: scaffold Vite + React frontend"
```

---

## Task 2: API client

**Files:**
- Create: `src/api/client.js`

- [ ] **Step 1: Create Axios client**

Create `src/api/client.js`:
```js
import axios from "axios";

const client = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT from localStorage on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("jwt_token");
  if (token) config.headers["Authorization"] = token;
  return config;
});

export default client;
```

- [ ] **Step 2: Verify it imports cleanly**

```bash
node -e "import('./src/api/client.js').then(() => console.log('ok'))" 2>/dev/null || echo "ESM import - checked via test"
npm run test -- --run src/__tests__/client.test.js 2>/dev/null || echo "no test yet - ok"
```

- [ ] **Step 3: Commit**

```bash
git add src/api/client.js
git commit -m "feat: add Axios API client with JWT interceptor"
```

---

## Task 3: Auth context + Login and Register pages

**Files:**
- Create: `src/contexts/AuthContext.jsx`
- Create: `src/pages/LoginPage.jsx`
- Create: `src/pages/RegisterPage.jsx`
- Create: `src/__tests__/AuthContext.test.jsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/AuthContext.test.jsx`:
```jsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import client from "../api/client";

vi.mock("../api/client");

function TestComponent() {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="email">{user?.email ?? "not logged in"}</span>
      <button onClick={() => login("a@b.com", "pass")}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("starts with no user", () => {
    render(<AuthProvider><TestComponent /></AuthProvider>);
    expect(screen.getByTestId("email")).toHaveTextContent("not logged in");
  });

  it("sets user and token after login", async () => {
    client.post = vi.fn().mockResolvedValue({
      data: { email: "a@b.com", token_balance: 5, free_generations_used: 0 },
      headers: { authorization: "Bearer test-token" },
    });

    render(<AuthProvider><TestComponent /></AuthProvider>);
    fireEvent.click(screen.getByText("Login"));

    await waitFor(() => {
      expect(screen.getByTestId("email")).toHaveTextContent("a@b.com");
    });
    expect(localStorage.getItem("jwt_token")).toBe("Bearer test-token");
  });

  it("clears user and token on logout", async () => {
    localStorage.setItem("jwt_token", "Bearer old-token");
    client.post = vi.fn().mockResolvedValue({
      data: { email: "a@b.com", token_balance: 0, free_generations_used: 0 },
      headers: { authorization: "Bearer old-token" },
    });

    render(<AuthProvider><TestComponent /></AuthProvider>);
    fireEvent.click(screen.getByText("Login"));
    await waitFor(() => expect(screen.getByTestId("email")).toHaveTextContent("a@b.com"));

    fireEvent.click(screen.getByText("Logout"));
    expect(screen.getByTestId("email")).toHaveTextContent("not logged in");
    expect(localStorage.getItem("jwt_token")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test -- --run src/__tests__/AuthContext.test.jsx
```
Expected: Error — cannot find module `../contexts/AuthContext`

- [ ] **Step 3: Create AuthContext**

Create `src/contexts/AuthContext.jsx`:
```jsx
import { createContext, useContext, useState, useEffect } from "react";
import client from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    const stored = localStorage.getItem("user");
    if (token && stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  async function login(email, password) {
    const response = await client.post("/login", { user: { email, password } });
    const token = response.headers["authorization"];
    const userData = response.data;

    localStorage.setItem("jwt_token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    return userData;
  }

  async function register(email, password) {
    const response = await client.post("/signup", {
      user: { email, password, password_confirmation: password },
    });
    const token = response.headers["authorization"];
    const userData = response.data;

    localStorage.setItem("jwt_token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    return userData;
  }

  function logout() {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user");
    setUser(null);
  }

  function refreshUser(updated) {
    const merged = { ...user, ...updated };
    localStorage.setItem("user", JSON.stringify(merged));
    setUser(merged);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- --run src/__tests__/AuthContext.test.jsx
```
Expected: 3 tests pass.

- [ ] **Step 5: Create LoginPage**

Create `src/pages/LoginPage.jsx`:
```jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/job-postings");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Sign in</h1>
      <form onSubmit={handleSubmit}>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
      </form>
      <p>No account? <Link to="/register">Register</Link></p>
    </div>
  );
}
```

- [ ] **Step 6: Create RegisterPage**

Create `src/pages/RegisterPage.jsx`:
```jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password);
      navigate("/profile");
    } catch (err) {
      setError(err.response?.data?.errors?.join(", ") ?? "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Create account</h1>
      <form onSubmit={handleSubmit}>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? "Creating…" : "Create account"}</button>
      </form>
      <p>Already have an account? <Link to="/login">Sign in</Link></p>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/contexts/ src/pages/LoginPage.jsx src/pages/RegisterPage.jsx src/__tests__/AuthContext.test.jsx
git commit -m "feat: add auth context and login/register pages"
```

---

## Task 4: Layout, navigation, and routing

**Files:**
- Create: `src/components/ProtectedRoute.jsx`
- Create: `src/components/Nav.jsx`
- Modify: `src/main.jsx`
- Create: `src/styles/app.css`

- [ ] **Step 1: Create ProtectedRoute**

Create `src/components/ProtectedRoute.jsx`:
```jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
```

- [ ] **Step 2: Create Nav**

Create `src/components/Nav.jsx`:
```jsx
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (!user) return null;

  return (
    <nav className="main-nav">
      <span className="nav-brand">CV Generator</span>
      <div className="nav-links">
        <Link to="/job-postings">Job Postings</Link>
        <Link to="/profile">Profile</Link>
        <Link to="/billing">Billing ({user.token_balance} tokens)</Link>
        <button onClick={handleLogout}>Sign out</button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 3: Wire up main.jsx with all routes**

Replace `src/main.jsx`:
```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Nav from "./components/Nav";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import JobPostingsPage from "./pages/JobPostingsPage";
import JobPostingDetailPage from "./pages/JobPostingDetailPage";
import CvPreviewPage from "./pages/CvPreviewPage";
import BillingPage from "./pages/BillingPage";
import "./styles/app.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Nav />
        <main className="main-content">
          <Routes>
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<Navigate to="/job-postings" replace />} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/job-postings" element={<ProtectedRoute><JobPostingsPage /></ProtectedRoute>} />
            <Route path="/job-postings/:id" element={<ProtectedRoute><JobPostingDetailPage /></ProtectedRoute>} />
            <Route path="/job-postings/:postingId/cv/:cvId" element={<ProtectedRoute><CvPreviewPage /></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
```

- [ ] **Step 4: Create stub pages for routes not yet built**

Create `src/pages/JobPostingDetailPage.jsx` (stub — replaced in Task 6):
```jsx
export default function JobPostingDetailPage() {
  return <div>Job Posting Detail — coming soon</div>;
}
```

Create `src/pages/CvPreviewPage.jsx` (stub — replaced in Task 7):
```jsx
export default function CvPreviewPage() {
  return <div>CV Preview — coming soon</div>;
}
```

Create `src/pages/BillingPage.jsx` (stub — replaced in Task 8):
```jsx
export default function BillingPage() {
  return <div>Billing — coming soon</div>;
}
```

Create `src/pages/ProfilePage.jsx` (stub — replaced in Task 5):
```jsx
export default function ProfilePage() {
  return <div>Profile — coming soon</div>;
}
```

Create `src/pages/JobPostingsPage.jsx` (stub — replaced in Task 6):
```jsx
export default function JobPostingsPage() {
  return <div>Job Postings — coming soon</div>;
}
```

- [ ] **Step 5: Add baseline CSS**

Create `src/styles/app.css`:
```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: #f5f5f5; color: #1a1a1a; }
.main-nav { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.5rem; background: #fff; border-bottom: 1px solid #e0e0e0; }
.nav-brand { font-weight: 700; font-size: 1.1rem; }
.nav-links { display: flex; align-items: center; gap: 1rem; }
.nav-links a { text-decoration: none; color: #333; }
.nav-links button { background: none; border: none; cursor: pointer; color: #333; }
.main-content { max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
.auth-page { max-width: 380px; margin: 4rem auto; background: #fff; padding: 2rem; border-radius: 8px; }
.auth-page h1 { margin-bottom: 1.5rem; }
.auth-page label { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 1rem; font-size: 0.9rem; }
.auth-page input { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
.auth-page button { width: 100%; padding: 0.6rem; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
.auth-page button:disabled { opacity: 0.6; }
.error { color: #dc2626; font-size: 0.875rem; margin-bottom: 0.5rem; }
button { cursor: pointer; }
```

- [ ] **Step 6: Verify dev server starts without errors**

```bash
npm run dev
```
Open `http://localhost:5173`. Expected: redirects to `/login`. Login/register pages render. No console errors.

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "feat: add layout, navigation, routing, and page stubs"
```

---

## Task 5: Profile page

**Files:**
- Replace: `src/pages/ProfilePage.jsx`
- Create: `src/__tests__/ProfilePage.test.jsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/ProfilePage.test.jsx`:
```jsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ProfilePage from "../pages/ProfilePage";
import { AuthContext } from "../contexts/AuthContext";
import client from "../api/client";

vi.mock("../api/client");

const mockUser = { email: "j@test.com", token_balance: 5, free_generations_used: 0 };
const wrapper = ({ children }) => (
  <MemoryRouter>
    <AuthContext.Provider value={{ user: mockUser, refreshUser: vi.fn() }}>
      {children}
    </AuthContext.Provider>
  </MemoryRouter>
);

describe("ProfilePage", () => {
  it("shows loading then profile form", async () => {
    client.get = vi.fn().mockResolvedValue({
      data: { full_name: "Jane Doe", email: "j@test.com", skills: ["Ruby"],
              work_experiences: [], education_entries: [] }
    });
    render(<ProfilePage />, { wrapper });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByDisplayValue("Jane Doe")).toBeInTheDocument());
  });

  it("saves profile on submit", async () => {
    client.get = vi.fn().mockResolvedValue({
      data: { full_name: "Jane", email: "", skills: [], work_experiences: [], education_entries: [] }
    });
    client.put = vi.fn().mockResolvedValue({
      data: { full_name: "Jane Updated", email: "", skills: [], work_experiences: [], education_entries: [] }
    });

    render(<ProfilePage />, { wrapper });
    await waitFor(() => screen.getByDisplayValue("Jane"));

    fireEvent.change(screen.getByDisplayValue("Jane"), { target: { value: "Jane Updated" } });
    fireEvent.click(screen.getByText(/save/i));

    await waitFor(() => expect(client.put).toHaveBeenCalledWith("/profile", expect.objectContaining({ full_name: "Jane Updated" })));
  });
});
```

> **Note:** This test requires `AuthContext` to be exported as a named export. Update `src/contexts/AuthContext.jsx` to also export `export { AuthContext }` at the bottom.

- [ ] **Step 2: Export AuthContext from AuthContext.jsx**

In `src/contexts/AuthContext.jsx`, add this export at the top alongside the existing `createContext` call:
```jsx
export const AuthContext = createContext(null);
// (rename the existing `const AuthContext = createContext(null)` to use `export const`)
```
Also update `useAuth` to use `AuthContext` (it already does — just make it exported).

- [ ] **Step 3: Run to verify it fails**

```bash
npm run test -- --run src/__tests__/ProfilePage.test.jsx
```
Expected: Error — ProfilePage renders "coming soon" stub, test fails.

- [ ] **Step 4: Build ProfilePage**

Replace `src/pages/ProfilePage.jsx`:
```jsx
import { useState, useEffect } from "react";
import client from "../api/client";

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    client.get("/profile")
      .then((r) => setProfile(r.data))
      .catch(() => setProfile({ full_name: "", email: "", phone: "", location: "",
                                 summary: "", skills: [], work_experiences: [], education_entries: [] }))
      .finally(() => setLoading(false));
  }, []);

  function updateExp(index, field, value) {
    const exps = [...profile.work_experiences];
    exps[index] = { ...exps[index], [field]: value };
    setProfile({ ...profile, work_experiences: exps });
  }

  function addExp() {
    setProfile({
      ...profile,
      work_experiences: [
        ...profile.work_experiences,
        { company: "", title: "", start_date: "", end_date: "", bullet_points: [], position: profile.work_experiences.length }
      ]
    });
  }

  function removeExp(index) {
    const exps = profile.work_experiences.filter((_, i) => i !== index);
    setProfile({ ...profile, work_experiences: exps });
  }

  function updateEdu(index, field, value) {
    const edus = [...profile.education_entries];
    edus[index] = { ...edus[index], [field]: value };
    setProfile({ ...profile, education_entries: edus });
  }

  function addEdu() {
    setProfile({
      ...profile,
      education_entries: [
        ...profile.education_entries,
        { institution: "", degree: "", year: "", position: profile.education_entries.length }
      ]
    });
  }

  function removeEdu(index) {
    const edus = profile.education_entries.filter((_, i) => i !== index);
    setProfile({ ...profile, education_entries: edus });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await client.put("/profile", {
        ...profile,
        skills: profile.skills,
      });
      setProfile(r.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div className="profile-page">
      <h1>Your Profile</h1>
      <form onSubmit={handleSubmit}>
        <section>
          <h2>Personal Info</h2>
          <label>Full name<input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></label>
          <label>Email<input value={profile.email ?? ""} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
          <label>Phone<input value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label>
          <label>Location<input value={profile.location ?? ""} onChange={(e) => setProfile({ ...profile, location: e.target.value })} /></label>
          <label>Professional summary<textarea value={profile.summary ?? ""} onChange={(e) => setProfile({ ...profile, summary: e.target.value })} rows={4} /></label>
          <label>Skills (comma-separated)
            <input
              value={profile.skills.join(", ")}
              onChange={(e) => setProfile({ ...profile, skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
          </label>
        </section>

        <section>
          <h2>Work Experience</h2>
          {profile.work_experiences.map((exp, i) => (
            <div key={i} className="entry-card">
              <label>Company<input value={exp.company} onChange={(e) => updateExp(i, "company", e.target.value)} /></label>
              <label>Title<input value={exp.title} onChange={(e) => updateExp(i, "title", e.target.value)} /></label>
              <label>Start date<input value={exp.start_date} onChange={(e) => updateExp(i, "start_date", e.target.value)} placeholder="e.g. Jan 2020" /></label>
              <label>End date<input value={exp.end_date ?? ""} onChange={(e) => updateExp(i, "end_date", e.target.value)} placeholder="Leave blank for Present" /></label>
              <label>Bullet points (one per line)
                <textarea
                  value={(exp.bullet_points ?? []).join("\n")}
                  onChange={(e) => updateExp(i, "bullet_points", e.target.value.split("\n").filter(Boolean))}
                  rows={4}
                />
              </label>
              <button type="button" onClick={() => removeExp(i)}>Remove</button>
            </div>
          ))}
          <button type="button" onClick={addExp}>+ Add experience</button>
        </section>

        <section>
          <h2>Education</h2>
          {profile.education_entries.map((edu, i) => (
            <div key={i} className="entry-card">
              <label>Institution<input value={edu.institution} onChange={(e) => updateEdu(i, "institution", e.target.value)} /></label>
              <label>Degree<input value={edu.degree} onChange={(e) => updateEdu(i, "degree", e.target.value)} /></label>
              <label>Year<input value={edu.year ?? ""} onChange={(e) => updateEdu(i, "year", e.target.value)} /></label>
              <button type="button" onClick={() => removeEdu(i)}>Remove</button>
            </div>
          ))}
          <button type="button" onClick={addEdu}>+ Add education</button>
        </section>

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={saving}>{saving ? "Saving…" : saved ? "Saved!" : "Save profile"}</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test -- --run src/__tests__/ProfilePage.test.jsx
```
Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ProfilePage.jsx src/contexts/AuthContext.jsx src/__tests__/ProfilePage.test.jsx
git commit -m "feat: add profile page with work experience and education forms"
```

---

## Task 6: Job Postings list and detail pages

**Files:**
- Replace: `src/pages/JobPostingsPage.jsx`
- Replace: `src/pages/JobPostingDetailPage.jsx`
- Create: `src/__tests__/JobPostingsPage.test.jsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/JobPostingsPage.test.jsx`:
```jsx
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import JobPostingsPage from "../pages/JobPostingsPage";
import { AuthContext } from "../contexts/AuthContext";
import client from "../api/client";

vi.mock("../api/client");

const mockUser = { email: "j@test.com", token_balance: 5, free_generations_used: 0 };
const wrapper = ({ children }) => (
  <MemoryRouter>
    <AuthContext.Provider value={{ user: mockUser }}>
      {children}
    </AuthContext.Provider>
  </MemoryRouter>
);

describe("JobPostingsPage", () => {
  it("shows empty state when no postings", async () => {
    client.get = vi.fn().mockResolvedValue({ data: [] });
    render(<JobPostingsPage />, { wrapper });
    await waitFor(() => expect(screen.getByText(/no job postings/i)).toBeInTheDocument());
  });

  it("renders posting cards", async () => {
    client.get = vi.fn().mockResolvedValue({
      data: [
        { id: 1, company_name: "Acme Corp", job_title: "Rails Dev", analysis_status: "completed", created_at: "2026-04-01" },
        { id: 2, company_name: null, job_title: null, analysis_status: "pending", created_at: "2026-04-02" },
      ]
    });
    render(<JobPostingsPage />, { wrapper });
    await waitFor(() => expect(screen.getByText("Acme Corp")).toBeInTheDocument());
    expect(screen.getByText("Rails Dev")).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test -- --run src/__tests__/JobPostingsPage.test.jsx
```
Expected: tests fail — stub renders "coming soon".

- [ ] **Step 3: Build JobPostingsPage**

Replace `src/pages/JobPostingsPage.jsx`:
```jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

export default function JobPostingsPage() {
  const [postings, setPostings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get("/job_postings")
      .then((r) => setPostings(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <h1>Job Postings</h1>
      <p className="hint">Save job postings using the Chrome extension. They appear here automatically.</p>
      {postings.length === 0 ? (
        <p>No job postings saved yet. Install the extension and extract a job posting to get started.</p>
      ) : (
        <div className="postings-list">
          {postings.map((p) => (
            <Link key={p.id} to={`/job-postings/${p.id}`} className="posting-card">
              <div className="posting-card-header">
                <strong>{p.company_name ?? "Unknown company"}</strong>
                <span className={`status-badge status-${p.analysis_status}`}>{p.analysis_status}</span>
              </div>
              <div>{p.job_title ?? "Unknown role"}</div>
              <div className="posting-date">{new Date(p.created_at).toLocaleDateString()}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Build JobPostingDetailPage**

Replace `src/pages/JobPostingDetailPage.jsx`:
```jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../contexts/AuthContext";

export default function JobPostingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [posting, setPosting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  useEffect(() => {
    client.get(`/job_postings/${id}`).then((r) => setPosting(r.data)).finally(() => setLoading(false));
  }, [id]);

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const r = await client.post(`/job_postings/${id}/cv_generations`);
      refreshUser({ token_balance: user.token_balance - r.data.tokens_used });
      navigate(`/job-postings/${id}/cv/${r.data.id}`);
    } catch (err) {
      if (err.response?.status === 402) {
        setGenError("Not enough tokens. Please buy more on the Billing page.");
      } else {
        setGenError(err.response?.data?.error ?? "Generation failed. Try again.");
      }
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (!posting) return <p>Posting not found.</p>;

  const analysis = posting.analysis;

  return (
    <div>
      <h1>{posting.job_title ?? "Job Posting"}</h1>
      <p className="subheading">{posting.company_name ?? "Unknown company"} · {posting.analysis_status}</p>

      {posting.analysis_status === "completed" && analysis && (
        <div className="analysis">
          <h2>Analysis</h2>
          {["skills", "job", "tech"].map((key) => (
            <details key={key}>
              <summary>{key.charAt(0).toUpperCase() + key.slice(1)}</summary>
              <ul>
                {(analysis[key] ?? []).map((item, i) => {
                  const [title, details] = Object.entries(item)[0];
                  return (
                    <li key={i}>
                      <strong>{title}</strong>
                      <ul>{details.map((d, j) => <li key={j}>{d}</li>)}</ul>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </div>
      )}

      {posting.analysis_status === "pending" || posting.analysis_status === "processing" ? (
        <p>Analyzing job posting… refresh in a moment.</p>
      ) : posting.analysis_status === "failed" ? (
        <p className="error">Analysis failed. Delete this posting and try again.</p>
      ) : null}

      {genError && <p className="error">{genError}</p>}

      <button onClick={handleGenerate} disabled={generating || posting.analysis_status !== "completed"}>
        {generating ? "Generating…" : "Generate CV"}
      </button>
      <p className="hint">
        {user.free_generations_used < 3
          ? `${3 - user.free_generations_used} free generation(s) remaining`
          : `Costs 1 token · you have ${user.token_balance}`}
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test -- --run src/__tests__/JobPostingsPage.test.jsx
```
Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/JobPostingsPage.jsx src/pages/JobPostingDetailPage.jsx src/__tests__/JobPostingsPage.test.jsx
git commit -m "feat: add job postings list and detail pages"
```

---

## Task 7: CV preview page with PDF rendering

**Files:**
- Create: `src/components/CvDocument.jsx`
- Replace: `src/pages/CvPreviewPage.jsx`
- Create: `src/__tests__/CvPreviewPage.test.jsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/CvPreviewPage.test.jsx`:
```jsx
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CvPreviewPage from "../pages/CvPreviewPage";
import { AuthContext } from "../contexts/AuthContext";
import client from "../api/client";

vi.mock("../api/client");
// @react-pdf/renderer renders in a Worker — mock it in tests
vi.mock("@react-pdf/renderer", () => ({
  PDFViewer:        ({ children }) => <div data-testid="pdf-viewer">{children}</div>,
  PDFDownloadLink:  ({ children }) => <div data-testid="pdf-download">{children("", false, null)}</div>,
  Document:         ({ children }) => <div>{children}</div>,
  Page:             ({ children }) => <div>{children}</div>,
  Text:             ({ children }) => <span>{children}</span>,
  View:             ({ children }) => <div>{children}</div>,
  StyleSheet:       { create: (s) => s },
}));

const mockUser = { email: "j@test.com" };
const wrapper = ({ children }) => (
  <MemoryRouter initialEntries={["/job-postings/1/cv/42"]}>
    <AuthContext.Provider value={{ user: mockUser }}>
      <Routes>
        <Route path="/job-postings/:postingId/cv/:cvId" element={children} />
      </Routes>
    </AuthContext.Provider>
  </MemoryRouter>
);

describe("CvPreviewPage", () => {
  it("shows loading then renders pdf viewer when complete", async () => {
    client.get = vi.fn().mockResolvedValue({
      data: { id: 42, status: "completed", content: {
        summary: "Great dev", experience: [], skills: ["Ruby"], education: []
      }}
    });

    render(<CvPreviewPage />, { wrapper });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument());
  });

  it("polls while pending then shows preview when complete", async () => {
    vi.useFakeTimers();
    let callCount = 0;
    client.get = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) return Promise.resolve({ data: { id: 42, status: "pending", content: null } });
      return Promise.resolve({ data: { id: 42, status: "completed", content: {
        summary: "Done", experience: [], skills: [], education: []
      }}});
    });

    render(<CvPreviewPage />, { wrapper });
    await waitFor(() => screen.getByText(/generating/i));

    await vi.runAllTimersAsync();
    await waitFor(() => expect(screen.getByTestId("pdf-viewer")).toBeInTheDocument());
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test -- --run src/__tests__/CvPreviewPage.test.jsx
```
Expected: Stub renders "coming soon", tests fail.

- [ ] **Step 3: Create CvDocument component**

Create `src/components/CvDocument.jsx`:
```jsx
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page:     { padding: 40, fontFamily: "Helvetica", fontSize: 11, color: "#1a1a1a" },
  name:     { fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  section:  { marginTop: 16 },
  heading:  { fontSize: 13, fontWeight: "bold", borderBottom: "1px solid #ccc",
               paddingBottom: 2, marginBottom: 6 },
  expTitle: { fontWeight: "bold" },
  expMeta:  { color: "#555", marginBottom: 3 },
  bullet:   { marginLeft: 12, marginBottom: 2 },
  skill:    { marginRight: 8 },
  skillRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
});

export default function CvDocument({ content, profileName }) {
  const { summary, experience = [], skills = [], education = [] } = content;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.name}>{profileName}</Text>

        {summary && (
          <View style={styles.section}>
            <Text style={styles.heading}>Summary</Text>
            <Text>{summary}</Text>
          </View>
        )}

        {experience.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Experience</Text>
            {experience.map((exp, i) => (
              <View key={i} style={{ marginBottom: 8 }}>
                <Text style={styles.expTitle}>{exp.title} — {exp.company}</Text>
                <Text style={styles.expMeta}>{exp.period}</Text>
                {(exp.bullets ?? []).map((b, j) => (
                  <Text key={j} style={styles.bullet}>• {b}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Skills</Text>
            <View style={styles.skillRow}>
              {skills.map((s, i) => <Text key={i} style={styles.skill}>{s}</Text>)}
            </View>
          </View>
        )}

        {education.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.heading}>Education</Text>
            {education.map((edu, i) => (
              <View key={i} style={{ marginBottom: 4 }}>
                <Text style={styles.expTitle}>{edu.degree} — {edu.institution}</Text>
                {edu.year && <Text style={styles.expMeta}>{edu.year}</Text>}
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
```

- [ ] **Step 4: Build CvPreviewPage**

Replace `src/pages/CvPreviewPage.jsx`:
```jsx
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
import client from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import CvDocument from "../components/CvDocument";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS  = 120_000;

export default function CvPreviewPage() {
  const { postingId, cvId } = useParams();
  const { user } = useAuth();
  const [generation, setGeneration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let timer;

    async function fetchAndMaybePoll() {
      try {
        const r = await client.get(`/job_postings/${postingId}/cv_generations/${cvId}`);
        setGeneration(r.data);

        if (r.data.status === "pending" || r.data.status === "processing") {
          if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
            setTimedOut(true);
          } else {
            timer = setTimeout(fetchAndMaybePoll, POLL_INTERVAL_MS);
          }
        }
      } finally {
        setLoading(false);
      }
    }

    fetchAndMaybePoll();
    return () => clearTimeout(timer);
  }, [postingId, cvId]);

  if (loading) return <p>Loading…</p>;

  if (!generation) return <p>CV not found.</p>;

  if (generation.status === "pending" || generation.status === "processing") {
    return (
      <div>
        <p>Generating your CV… this takes about 15–30 seconds.</p>
        {timedOut && <p className="error">Taking longer than expected. Please refresh.</p>}
      </div>
    );
  }

  if (generation.status === "failed") {
    return <p className="error">CV generation failed. Please try again from the job posting page.</p>;
  }

  const profileName = user?.full_name ?? user?.email ?? "Candidate";

  return (
    <div className="cv-preview-page">
      <div className="cv-preview-header">
        <h1>Your CV</h1>
        <PDFDownloadLink
          document={<CvDocument content={generation.content} profileName={profileName} />}
          fileName="cv.pdf"
        >
          {({ loading: pdfLoading }) => (
            <button disabled={pdfLoading}>{pdfLoading ? "Preparing…" : "Download PDF"}</button>
          )}
        </PDFDownloadLink>
      </div>

      <PDFViewer width="100%" height={700} style={{ border: "1px solid #ccc" }}>
        <CvDocument content={generation.content} profileName={profileName} />
      </PDFViewer>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test -- --run src/__tests__/CvPreviewPage.test.jsx
```
Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/CvDocument.jsx src/pages/CvPreviewPage.jsx src/__tests__/CvPreviewPage.test.jsx
git commit -m "feat: add CV preview page with PDF rendering and polling"
```

---

## Task 8: Billing page

**Files:**
- Replace: `src/pages/BillingPage.jsx`

- [ ] **Step 1: Build BillingPage**

Replace `src/pages/BillingPage.jsx`:
```jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import client from "../api/client";

const TOKEN_PACKAGES = [
  { amount: 5,  label: "5 tokens",   price: "€5" },
  { amount: 10, label: "10 tokens",  price: "€10" },
  { amount: 20, label: "20 tokens",  price: "€20" },
];

export default function BillingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null); // token amount being purchased
  const [error, setError] = useState(null);

  async function handlePurchase(tokenAmount) {
    setLoading(tokenAmount);
    setError(null);
    try {
      const r = await client.post("/checkout", {
        token_amount: tokenAmount,
        success_url:  `${window.location.origin}/billing?success=true`,
        cancel_url:   `${window.location.origin}/billing?cancelled=true`,
      });
      window.location.href = r.data.checkout_url;
    } catch {
      setError("Failed to start checkout. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  const urlParams = new URLSearchParams(window.location.search);
  const justPurchased = urlParams.get("success") === "true";

  return (
    <div className="billing-page">
      <h1>Billing</h1>

      <div className="balance-card">
        <p><strong>Token balance:</strong> {user.token_balance}</p>
        <p><strong>Free generations used:</strong> {user.free_generations_used} / 3</p>
        {user.free_generations_used < 3 && (
          <p className="hint">{3 - user.free_generations_used} free CV generation(s) remaining</p>
        )}
      </div>

      {justPurchased && <p className="success">Purchase successful! Your tokens have been added.</p>}

      <h2>Buy tokens</h2>
      <p>1 token = 1 CV generation = €1.00</p>

      <div className="token-packages">
        {TOKEN_PACKAGES.map(({ amount, label, price }) => (
          <div key={amount} className="package-card">
            <strong>{label}</strong>
            <span>{price}</span>
            <button onClick={() => handlePurchase(amount)} disabled={loading !== null}>
              {loading === amount ? "Redirecting…" : "Buy"}
            </button>
          </div>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```
Log in, navigate to `/billing`. Expected: shows token balance, free generations count, and purchase buttons.

- [ ] **Step 3: Commit**

```bash
git add src/pages/BillingPage.jsx
git commit -m "feat: add billing page with Stripe checkout redirect"
```

---

## Task 9: Run full test suite and polish

- [ ] **Step 1: Run all tests**

```bash
npm run test -- --run
```
Expected: All tests pass with 0 failures.

- [ ] **Step 2: Add remaining CSS for new page elements**

Append to `src/styles/app.css`:
```css
.postings-list { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
.posting-card { display: block; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 1rem; text-decoration: none; color: inherit; }
.posting-card:hover { border-color: #2563eb; }
.posting-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; }
.posting-date { font-size: 0.8rem; color: #666; margin-top: 0.25rem; }
.status-badge { font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 99px; background: #e5e7eb; }
.status-badge.status-completed { background: #dcfce7; color: #166534; }
.status-badge.status-failed    { background: #fee2e2; color: #991b1b; }
.status-badge.status-processing, .status-badge.status-pending { background: #fef9c3; color: #713f12; }
.entry-card { background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 1rem; margin-bottom: 0.75rem; }
.entry-card label { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.75rem; font-size: 0.9rem; }
.entry-card input, .entry-card textarea { padding: 0.4rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.95rem; }
.profile-page section { margin-top: 1.5rem; }
.profile-page label { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.75rem; font-size: 0.9rem; }
.profile-page input, .profile-page textarea { padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; }
.cv-preview-page { display: flex; flex-direction: column; gap: 1rem; }
.cv-preview-header { display: flex; align-items: center; justify-content: space-between; }
.balance-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; }
.token-packages { display: flex; gap: 1rem; margin-top: 1rem; }
.package-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; align-items: center; min-width: 120px; }
.hint { font-size: 0.875rem; color: #555; }
.success { color: #166534; background: #dcfce7; padding: 0.5rem 1rem; border-radius: 4px; }
.analysis details { margin-bottom: 0.5rem; }
.analysis summary { cursor: pointer; font-weight: 600; padding: 0.25rem 0; }
```

- [ ] **Step 3: Final commit**

```bash
git add src/styles/app.css
git commit -m "feat: add page styles"
```
