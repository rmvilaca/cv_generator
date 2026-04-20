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
  function Wrapper({ children }) {
    return (
      <MemoryRouter initialEntries={[`/job-postings/1${tab === "cv" ? "?tab=cv" : ""}`]}>
        <AuthContext.Provider value={{ user, refreshUser: vi.fn() }}>
          <Routes>
            <Route path="/job-postings/:id" element={children} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    );
  }
  return Wrapper;
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
    expect(screen.getByRole("button", { name: /^skills$/i })).toBeInTheDocument();
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
