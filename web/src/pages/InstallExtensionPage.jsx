import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Download } from "lucide-react";

export default function InstallExtensionPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Install the extension</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The CV Generator extension extracts job postings from pages you visit and saves them to your account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              Download the extension:
              <div className="mt-2">
                <Button asChild size="sm">
                  <a href="/cv-generator-extension.zip" download>
                    <Download className="h-4 w-4" />
                    Download zip
                  </a>
                </Button>
              </div>
            </li>
            <li>Unzip the file somewhere you won&apos;t move or delete.</li>
            <li>
              Open <code className="rounded bg-muted px-1.5 py-0.5 text-xs">chrome://extensions</code> in a new tab.
            </li>
            <li>Toggle <strong>Developer mode</strong> on (top-right).</li>
            <li>Click <strong>Load unpacked</strong> and select the unzipped folder.</li>
            <li>Reload this page — the install banner should disappear.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
