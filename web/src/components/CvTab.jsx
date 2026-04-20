import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import client from "../api/client";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { AlertCircle, FileText, Loader2 } from "lucide-react";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS  = 120_000;
const FREE_TIER_LIMIT  = 3;

export default function CvTab({ posting, profile: _profile, onPostingChanged: _onPostingChanged }) {
  const { user, refreshUser } = useAuth();
  const [gen, setGen]         = useState(posting.latest_cv_generation);
  const [genError, setGenError] = useState(null);
  const startedAt = useRef(null);

  async function startGeneration() {
    setGenError(null);
    const wasFreeTier = user.free_generations_used < FREE_TIER_LIMIT;

    try {
      const r = await client.post(`/job_postings/${posting.id}/cv_generations`);
      if (wasFreeTier) {
        refreshUser({ free_generations_used: user.free_generations_used + 1 });
      } else {
        refreshUser({ token_balance: user.token_balance - r.data.tokens_used });
      }
      setGen(r.data);
      startedAt.current = Date.now();
    } catch (err) {
      if (err.response?.status === 402) {
        setGenError("Not enough tokens. Please buy more on the Billing page.");
      } else {
        setGenError(err.response?.data?.error ?? "Generation failed. Try again.");
      }
    }
  }

  if (!gen) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
          <p className="text-muted-foreground">No CV generated yet for this posting.</p>
          {genError && (
            <Alert variant="destructive" className="max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{genError}</AlertDescription>
            </Alert>
          )}
          <Button onClick={startGeneration} disabled={posting.analysis_status !== "completed"}>
            <FileText className="h-4 w-4" /> Generate CV
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (gen.status === "pending" || gen.status === "processing") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Generating your CV… this takes about 15–30 seconds.</p>
        </CardContent>
      </Card>
    );
  }

  return null;
}
