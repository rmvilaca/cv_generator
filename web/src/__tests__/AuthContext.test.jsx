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
      data: { status: { code: 200 }, data: { email: "a@b.com", token_balance: 5, free_generations_used: 0 } },
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
      data: { status: { code: 200 }, data: { email: "a@b.com", token_balance: 0, free_generations_used: 0 } },
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
