import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import client from "../api/client";
import CvTab from "../components/CvTab";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { AlertCircle, Loader2 } from "lucide-react";

const STATUS_VARIANT = {
  completed:  "success",
  failed:     "destructive",
  pending:    "warning",
  processing: "warning",
};

export default function JobPostingDetailPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "cv" ? "cv" : "analysis";

  const [posting, setPosting] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPosting = useCallback(async () => {
    const r = await client.get(`/job_postings/${id}`);
    setPosting(r.data);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      try {
        await fetchPosting();
        try {
          const pr = await client.get("/profile");
          if (!cancelled) setProfile(pr.data);
        } catch {
          if (!cancelled) setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAll();
    return () => { cancelled = true; };
  }, [fetchPosting]);

  function onTabChange(value) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === "analysis") next.delete("tab");
        else next.set("tab", value);
        return next;
      },
      { replace: true }
    );
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (!posting) return <p className="text-muted-foreground">Posting not found.</p>;

  const analysis = posting.analysis;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{posting.job_title ?? "Job Posting"}</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted-foreground">{posting.company_name ?? "Unknown company"}</span>
          <Badge variant={STATUS_VARIANT[posting.analysis_status] ?? "secondary"}>
            {posting.analysis_status}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="cv">CV</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis">
          {posting.analysis_status === "completed" && analysis && (
            <Card>
              <CardContent className="pt-6">
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
        </TabsContent>

        <TabsContent value="cv">
          <CvTab posting={posting} profile={profile} onPostingChanged={fetchPosting} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
