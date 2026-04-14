import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import client from "../api/client";

const TOKEN_PACKAGES = [
  { amount: 5,  label: "5 tokens",   price: "€5" },
  { amount: 10, label: "10 tokens",  price: "€10" },
  { amount: 20, label: "20 tokens",  price: "€20" },
];

export default function BillingPage() {
  const { user } = useAuth();
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
