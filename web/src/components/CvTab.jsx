import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import client from "../api/client";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { AlertCircle, FileText, Loader2, Download } from "lucide-react";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
import CvDocument from "./CvDocument";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS  = 120_000;
const FREE_TIER_LIMIT  = 3;

export default function CvTab({ posting, profile, onPostingChanged }) {
  const { user, refreshUser } = useAuth();
  const [gen, setGen]         = useState(posting.latest_cv_generation);
  const [genError, setGenError] = useState(null);
  const startedAt = useRef(null);
  const [timedOut, setTimedOut] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!gen || (gen.status !== "pending" && gen.status !== "processing")) return;
    if (startedAt.current === null) startedAt.current = Date.now();

    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }
      try {
        const r = await client.get(`/job_postings/${posting.id}/cv_generations/${gen.id}`);
        if (cancelled) return;
        setGen(r.data);
        if (r.data.status === "completed" || r.data.status === "failed") {
          onPostingChanged?.();
        }
      } catch {
        // transient error — let the next tick retry
      }
    }, POLL_INTERVAL_MS);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [gen, posting.id, onPostingChanged]);

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

  function confirmAndGenerate() {
    setConfirmOpen(false);
    startGeneration();
  }

  const freeRemaining = Math.max(0, FREE_TIER_LIMIT - user.free_generations_used);
  const isFreeTier    = freeRemaining > 0;

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
          {timedOut && (
            <Alert variant="destructive" className="mt-4 max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Taking longer than expected. Please refresh.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  if (gen.status === "completed") {
    const profileName     = profile?.full_name ?? user?.full_name ?? user?.email ?? "Candidate";
    const profileEmail    = profile?.email    ?? user?.email ?? "";
    const profilePhone    = profile?.phone    ?? "";
    const profileLocation = profile?.location ?? "";
    const doc = (
      <CvDocument
        content={gen.content}
        profileName={profileName}
        profileEmail={profileEmail}
        profilePhone={profilePhone}
        profileLocation={profileLocation}
      />
    );

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end gap-2">
          <PDFDownloadLink document={doc} fileName="cv.pdf">
            {({ loading: pdfLoading }) => (
              <Button disabled={pdfLoading}>
                <Download className="h-4 w-4" />
                {pdfLoading ? "Preparing…" : "Download PDF"}
              </Button>
            )}
          </PDFDownloadLink>
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
            <FileText className="h-4 w-4" /> Generate new CV
          </Button>
        </div>
        <Card className="overflow-hidden">
          <PDFViewer width="100%" height={700} style={{ border: "none" }}>
            {doc}
          </PDFViewer>
        </Card>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate a new CV?</DialogTitle>
              <DialogDescription>
                {isFreeTier
                  ? `This will use ${freeRemaining} of your ${freeRemaining} remaining free generations.`
                  : `This will cost 1 token. You have ${user.token_balance} remaining.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button onClick={confirmAndGenerate}>Generate</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (gen.status === "failed") {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>CV generation failed. Please try again.</AlertDescription>
        </Alert>
        {genError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{genError}</AlertDescription>
          </Alert>
        )}
        <Button onClick={startGeneration}>
          <FileText className="h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }

  return null;
}
