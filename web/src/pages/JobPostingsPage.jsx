import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

export default function JobPostingsPage() {
  const [postings, setPostings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get("/job_postings")
      .then((r) => setPostings(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <h1>Job Postings</h1>
      <p className="hint">Save job postings using the Chrome extension. They appear here automatically.</p>
      {postings.length === 0 ? (
        <p>No job postings saved yet. Install the extension and extract a job posting to get started.</p>
      ) : (
        <div className="postings-list">
          {postings.map((p) => (
            <Link key={p.id} to={`/job-postings/${p.id}`} className="posting-card">
              <div className="posting-card-header">
                <strong>{p.company_name ?? "Unknown company"}</strong>
                <span className={`status-badge status-${p.analysis_status}`}>{p.analysis_status}</span>
              </div>
              <div>{p.job_title ?? "Unknown role"}</div>
              <div className="posting-date">{new Date(p.created_at).toLocaleDateString()}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
