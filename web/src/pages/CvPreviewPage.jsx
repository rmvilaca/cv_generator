import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
import client from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import CvDocument from "../components/CvDocument";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { AlertCircle, Download, Loader2 } from "lucide-react";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS  = 120_000;

export default function CvPreviewPage() {
  const { postingId, cvId } = useParams();
  const { user } = useAuth();
  const [generation, setGeneration] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let timer;

    async function fetchProfile() {
      try {
        const response = await client.get("/profile");
        setProfile(response.data);
      } catch {
        // Profile may not exist yet for newly registered users.
        setProfile(null);
      }
    }

    async function fetchAndMaybePoll() {
      try {
        await fetchProfile();
        const r = await client.get(`/job_postings/${postingId}/cv_generations/${cvId}`);
        setGeneration(r.data);

        if (r.data.status === "pending" || r.data.status === "processing") {
          if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
            setTimedOut(true);
          } else {
            timer = setTimeout(fetchAndMaybePoll, POLL_INTERVAL_MS);
          }
        }
      } finally {
        setLoading(false);
      }
    }

    fetchAndMaybePoll();
    return () => clearTimeout(timer);
  }, [postingId, cvId]);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  if (!generation) return <p className="text-muted-foreground">CV not found.</p>;

  if (generation.status === "pending" || generation.status === "processing") {
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

  if (generation.status === "failed") {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>CV generation failed. Please try again from the job posting page.</AlertDescription>
      </Alert>
    );
  }

  const profileName = profile?.full_name ?? user?.full_name ?? user?.email ?? "Candidate";
  const profileEmail = profile?.email ?? user?.email ?? "";
  const profilePhone = profile?.phone ?? "";
  const profileLocation = profile?.location ?? "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Your CV</h1>
        <PDFDownloadLink
          document={(
            <CvDocument
              content={generation.content}
              profileName={profileName}
              profileEmail={profileEmail}
              profilePhone={profilePhone}
              profileLocation={profileLocation}
            />
          )}
          fileName="cv.pdf"
        >
          {({ loading: pdfLoading }) => (
            <Button disabled={pdfLoading}>
              <Download className="h-4 w-4" />
              {pdfLoading ? "Preparing…" : "Download PDF"}
            </Button>
          )}
        </PDFDownloadLink>
      </div>

      <Card className="overflow-hidden">
        <PDFViewer width="100%" height={700} style={{ border: "none" }}>
          <CvDocument
            content={generation.content}
            profileName={profileName}
            profileEmail={profileEmail}
            profilePhone={profilePhone}
            profileLocation={profileLocation}
          />
        </PDFViewer>
      </Card>
    </div>
  );
}
