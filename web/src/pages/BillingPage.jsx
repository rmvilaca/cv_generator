import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import client from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { AlertCircle, CheckCircle2, CreditCard, Coins } from "lucide-react";

const TOKEN_PACKAGES = [
  { amount: 5,  label: "5 tokens",   price: "€5" },
  { amount: 10, label: "10 tokens",  price: "€10" },
  { amount: 20, label: "20 tokens",  price: "€20" },
];

export default function BillingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(null);
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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Billing</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" /> Balance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Token balance</span>
            <span className="font-semibold">{user.token_balance}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Free generations used</span>
            <span className="font-semibold">{user.free_generations_used} / 3</span>
          </div>
          {user.free_generations_used < 3 && (
            <p className="text-sm text-muted-foreground pt-2">
              {3 - user.free_generations_used} free CV generation(s) remaining
            </p>
          )}
        </CardContent>
      </Card>

      {justPurchased && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Purchase successful! Your tokens have been added.</AlertDescription>
        </Alert>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-1">Buy tokens</h2>
        <p className="text-sm text-muted-foreground mb-4">1 token = 1 CV generation = €1.00</p>

        <div className="grid gap-4 sm:grid-cols-3">
          {TOKEN_PACKAGES.map(({ amount, label, price }) => (
            <Card key={amount}>
              <CardContent className="flex flex-col items-center gap-3 pt-6">
                <CreditCard className="h-8 w-8 text-muted-foreground" />
                <p className="font-semibold text-lg">{label}</p>
                <p className="text-2xl font-bold">{price}</p>
              </CardContent>
              <CardFooter className="justify-center">
                <Button onClick={() => handlePurchase(amount)} disabled={loading !== null} className="w-full">
                  {loading === amount ? "Redirecting…" : "Buy"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
