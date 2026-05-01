import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BillingPage from "../pages/BillingPage";
import { AuthContext } from "../contexts/AuthContext";
import client from "../api/client";

vi.mock("../api/client");

const baseUser = { email: "j@test.com", token_balance: 5, free_generations_used: 0 };

function renderPage({ user = baseUser, refreshUser = vi.fn() } = {}) {
  render(
    <AuthContext.Provider value={{ user, refreshUser }}>
      <BillingPage />
    </AuthContext.Provider>
  );
  return { refreshUser };
}

async function flushPendingPromises() {
  await act(async () => { await Promise.resolve(); });
}

describe("BillingPage", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/billing");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("does not refetch or show a banner when there is no ?success param", () => {
    client.get = vi.fn();
    renderPage();
    expect(client.get).not.toHaveBeenCalled();
    expect(screen.queryByText(/purchase successful/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/finalising your purchase/i)).not.toBeInTheDocument();
  });

  it("polls /me after Stripe redirect and shows success once balance increases", async () => {
    window.history.replaceState({}, "", "/billing?success=true");
    client.get = vi.fn().mockResolvedValueOnce({
      data: { data: { ...baseUser, token_balance: 10 } },
    });

    const { refreshUser } = renderPage();

    // Processing banner renders synchronously.
    expect(screen.getByText(/finalising your purchase/i)).toBeInTheDocument();

    await flushPendingPromises();

    expect(client.get).toHaveBeenCalledWith("/me");
    expect(refreshUser).toHaveBeenCalledWith(
      expect.objectContaining({ token_balance: 10 })
    );
    expect(await screen.findByText(/purchase successful/i)).toBeInTheDocument();
  });

  it("falls back to a pending banner when fulfillment never arrives", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/billing?success=true");

    // Every /me response returns the same (stale) balance as the cached user.
    client.get = vi.fn().mockResolvedValue({
      data: { data: { ...baseUser } },
    });

    const refreshUser = vi.fn();
    render(
      <AuthContext.Provider value={{ user: baseUser, refreshUser }}>
        <BillingPage />
      </AuthContext.Provider>
    );

    // Exhaust all polling attempts plus the final refresh.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByText(/payment received/i)).toBeInTheDocument();
    // Client was polled multiple times before giving up.
    expect(client.get.mock.calls.length).toBeGreaterThan(1);
    // Final refresh still flushed whatever the server had through refreshUser.
    expect(refreshUser).toHaveBeenCalled();
  });
});
