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

  it("disables Generate CV when analysis is not completed", () => {
    renderTab({ posting: { id: 1, analysis_status: "pending", latest_cv_generation: null } });
    expect(screen.getByRole("button", { name: /generate cv/i })).toBeDisabled();
  });

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
});
