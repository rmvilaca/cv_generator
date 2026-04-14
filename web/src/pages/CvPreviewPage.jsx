import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
import client from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import CvDocument from "../components/CvDocument";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS  = 120_000;

export default function CvPreviewPage() {
  const { postingId, cvId } = useParams();
  const { user } = useAuth();
  const [generation, setGeneration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let timer;

    async function fetchAndMaybePoll() {
      try {
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

  if (loading) return <p>Loading…</p>;

  if (!generation) return <p>CV not found.</p>;

  if (generation.status === "pending" || generation.status === "processing") {
    return (
      <div>
        <p>Generating your CV… this takes about 15–30 seconds.</p>
        {timedOut && <p className="error">Taking longer than expected. Please refresh.</p>}
      </div>
    );
  }

  if (generation.status === "failed") {
    return <p className="error">CV generation failed. Please try again from the job posting page.</p>;
  }

  const profileName = user?.full_name ?? user?.email ?? "Candidate";

  return (
    <div className="cv-preview-page">
      <div className="cv-preview-header">
        <h1>Your CV</h1>
        <PDFDownloadLink
          document={<CvDocument content={generation.content} profileName={profileName} />}
          fileName="cv.pdf"
        >
          {({ loading: pdfLoading }) => (
            <button disabled={pdfLoading}>{pdfLoading ? "Preparing…" : "Download PDF"}</button>
          )}
        </PDFDownloadLink>
      </div>

      <PDFViewer width="100%" height={700} style={{ border: "1px solid #ccc" }}>
        <CvDocument content={generation.content} profileName={profileName} />
      </PDFViewer>
    </div>
  );
}
