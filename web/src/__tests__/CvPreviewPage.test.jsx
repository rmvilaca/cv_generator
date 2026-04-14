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

  it("shows generating message while status is pending", async () => {
    client.get = vi.fn().mockResolvedValue({
      data: { id: 42, status: "pending", content: null }
    });

    render(<CvPreviewPage />, { wrapper });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    // Component unmounts after this test which cancels the 3s poll timer via cleanup
    await waitFor(() => expect(screen.getByText(/generating/i)).toBeInTheDocument());
  });
});
