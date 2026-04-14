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
