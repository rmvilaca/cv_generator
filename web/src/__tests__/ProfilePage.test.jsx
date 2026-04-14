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
