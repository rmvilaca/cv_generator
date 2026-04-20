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
