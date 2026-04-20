import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { FileText } from "lucide-react";

export default function CvTab({ posting, profile: _profile, onPostingChanged: _onPostingChanged }) {
  const latest = posting.latest_cv_generation;

  if (!latest) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-4">
          <p className="text-muted-foreground">No CV generated yet for this posting.</p>
          <Button disabled={posting.analysis_status !== "completed"}>
            <FileText className="h-4 w-4" /> Generate CV
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
