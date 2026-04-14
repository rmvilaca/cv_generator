import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/ui/accordion";
import { AlertCircle, Loader2, FileText } from "lucide-react";

const STATUS_VARIANT = {
  completed:  "success",
  failed:     "destructive",
  pending:    "warning",
  processing: "warning",
};

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

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (!posting) return <p className="text-muted-foreground">Posting not found.</p>;

  const analysis = posting.analysis;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{posting.job_title ?? "Job Posting"}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-muted-foreground">{posting.company_name ?? "Unknown company"}</span>
            <Badge variant={STATUS_VARIANT[posting.analysis_status] ?? "secondary"}>
              {posting.analysis_status}
            </Badge>
          </div>
        </div>
      </div>

      {posting.analysis_status === "completed" && analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" defaultValue={["skills", "job", "tech"]}>
              {["skills", "job", "tech"].map((key) => (
                <AccordionItem key={key} value={key}>
                  <AccordionTrigger>{key.charAt(0).toUpperCase() + key.slice(1)}</AccordionTrigger>
                  <AccordionContent>
                    <ul className="space-y-2 ml-1">
                      {(analysis[key] ?? []).map((item, i) => {
                        const [title, details] = Object.entries(item)[0];
                        return (
                          <li key={i}>
                            <p className="font-medium">{title}</p>
                            <ul className="ml-4 text-muted-foreground list-disc">
                              {details.map((d, j) => <li key={j}>{d}</li>)}
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {(posting.analysis_status === "pending" || posting.analysis_status === "processing") && (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Analyzing job posting… refresh in a moment.</p>
          </CardContent>
        </Card>
      )}

      {posting.analysis_status === "failed" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Analysis failed. Delete this posting and try again.</AlertDescription>
        </Alert>
      )}

      {genError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{genError}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-4">
        <Button onClick={handleGenerate} disabled={generating || posting.analysis_status !== "completed"}>
          {generating ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
          ) : (
            <><FileText className="h-4 w-4" /> Generate CV</>
          )}
        </Button>
        <p className="text-sm text-muted-foreground">
          {user.free_generations_used < 3
            ? `${3 - user.free_generations_used} free generation(s) remaining`
            : `Costs 1 token · you have ${user.token_balance}`}
        </p>
      </div>
    </div>
  );
}
