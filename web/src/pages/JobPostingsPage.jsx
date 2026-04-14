import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Briefcase } from "lucide-react";

const STATUS_VARIANT = {
  completed:  "success",
  failed:     "destructive",
  pending:    "warning",
  processing: "warning",
};

export default function JobPostingsPage() {
  const [postings, setPostings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get("/job_postings")
      .then((r) => setPostings(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Job Postings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Save job postings using the Chrome extension. They appear here automatically.
        </p>
      </div>

      {postings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No job postings saved yet.</p>
            <p className="text-sm text-muted-foreground">Install the extension and extract a job posting to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {postings.map((p) => (
            <Link key={p.id} to={`/job-postings/${p.id}`} className="block">
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <p className="font-semibold">{p.company_name ?? "Unknown company"}</p>
                    <p className="text-sm text-muted-foreground">{p.job_title ?? "Unknown role"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[p.analysis_status] ?? "secondary"}>
                    {p.analysis_status}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
