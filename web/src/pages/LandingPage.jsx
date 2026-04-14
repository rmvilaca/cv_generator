import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Briefcase, FileText, Sparkles } from "lucide-react";

export default function LandingPage() {
  const { user } = useAuth();

  if (user) return <Navigate to="/job-postings" replace />;

  return (
    <div className="flex flex-col items-center">
      <section className="py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          CV Generator
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
          Save job postings, analyze them, and generate tailored CVs - all in
          one place.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Button size="lg" asChild>
            <Link to="/register">Get started</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </div>
      </section>

      <section className="grid w-full max-w-3xl gap-6 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
            <Briefcase className="h-8 w-8 text-primary" />
            <h3 className="font-semibold">Save job postings</h3>
            <p className="text-sm text-muted-foreground">
              Use our browser extension to capture job descriptions from 
              linkedin with one click.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
            <Sparkles className="h-8 w-8 text-primary" />
            <h3 className="font-semibold">AI analysis</h3>
            <p className="text-sm text-muted-foreground">
              Each posting is automatically analyzed to extract key
              requirements and skills.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
            <FileText className="h-8 w-8 text-primary" />
            <h3 className="font-semibold">Tailored CVs</h3>
            <p className="text-sm text-muted-foreground">
              Generate a CV customized to each job posting, highlighting the
              most relevant experience.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
