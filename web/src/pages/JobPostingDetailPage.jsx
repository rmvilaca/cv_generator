import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../contexts/AuthContext";

export default function JobPostingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [posting, setPosting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  useEffect(() => {
    client.get(`/job_postings/${id}`).then((r) => setPosting(r.data)).finally(() => setLoading(false));
  }, [id]);

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const r = await client.post(`/job_postings/${id}/cv_generations`);
      refreshUser({ token_balance: user.token_balance - r.data.tokens_used });
      navigate(`/job-postings/${id}/cv/${r.data.id}`);
    } catch (err) {
      if (err.response?.status === 402) {
        setGenError("Not enough tokens. Please buy more on the Billing page.");
      } else {
        setGenError(err.response?.data?.error ?? "Generation failed. Try again.");
      }
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (!posting) return <p>Posting not found.</p>;

  const analysis = posting.analysis;

  return (
    <div>
      <h1>{posting.job_title ?? "Job Posting"}</h1>
      <p className="subheading">{posting.company_name ?? "Unknown company"} · {posting.analysis_status}</p>

      {posting.analysis_status === "completed" && analysis && (
        <div className="analysis">
          <h2>Analysis</h2>
          {["skills", "job", "tech"].map((key) => (
            <details key={key}>
              <summary>{key.charAt(0).toUpperCase() + key.slice(1)}</summary>
              <ul>
                {(analysis[key] ?? []).map((item, i) => {
                  const [title, details] = Object.entries(item)[0];
                  return (
                    <li key={i}>
                      <strong>{title}</strong>
                      <ul>{details.map((d, j) => <li key={j}>{d}</li>)}</ul>
                    </li>
                  );
                })}
              </ul>
            </details>
          ))}
        </div>
      )}

      {(posting.analysis_status === "pending" || posting.analysis_status === "processing") ? (
        <p>Analyzing job posting… refresh in a moment.</p>
      ) : posting.analysis_status === "failed" ? (
        <p className="error">Analysis failed. Delete this posting and try again.</p>
      ) : null}

      {genError && <p className="error">{genError}</p>}

      <button onClick={handleGenerate} disabled={generating || posting.analysis_status !== "completed"}>
        {generating ? "Generating…" : "Generate CV"}
      </button>
      <p className="hint">
        {user.free_generations_used < 3
          ? `${3 - user.free_generations_used} free generation(s) remaining`
          : `Costs 1 token · you have ${user.token_balance}`}
      </p>
    </div>
  );
}
