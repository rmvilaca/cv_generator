import { useState, useEffect } from "react";
import client from "../api/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Alert, AlertDescription } from "../components/ui/alert";
import { AlertCircle, CheckCircle2, Plus, Trash2, Loader2 } from "lucide-react";

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    client.get("/profile")
      .then((r) => setProfile(r.data))
      .catch(() => setProfile({ full_name: "", email: "", phone: "", location: "",
                                 summary: "", skills: [], work_experiences: [], education_entries: [] }))
      .finally(() => setLoading(false));
  }, []);

  function updateExp(index, field, value) {
    const exps = [...profile.work_experiences];
    exps[index] = { ...exps[index], [field]: value };
    setProfile({ ...profile, work_experiences: exps });
  }

  function addExp() {
    setProfile({
      ...profile,
      work_experiences: [
        ...profile.work_experiences,
        { company: "", title: "", start_date: "", end_date: "", bullet_points: [], position: profile.work_experiences.length }
      ]
    });
  }

  function removeExp(index) {
    const exps = profile.work_experiences.filter((_, i) => i !== index);
    setProfile({ ...profile, work_experiences: exps });
  }

  function updateEdu(index, field, value) {
    const edus = [...profile.education_entries];
    edus[index] = { ...edus[index], [field]: value };
    setProfile({ ...profile, education_entries: edus });
  }

  function addEdu() {
    setProfile({
      ...profile,
      education_entries: [
        ...profile.education_entries,
        { institution: "", degree: "", year: "", position: profile.education_entries.length }
      ]
    });
  }

  function removeEdu(index) {
    const edus = profile.education_entries.filter((_, i) => i !== index);
    setProfile({ ...profile, education_entries: edus });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await client.put("/profile", {
        ...profile,
        skills: profile.skills,
      });
      setProfile(r.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prof_email">Email</Label>
                <Input id="prof_email" value={profile.email ?? ""} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={profile.location ?? ""} onChange={(e) => setProfile({ ...profile, location: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="summary">Professional summary</Label>
              <Textarea id="summary" value={profile.summary ?? ""} onChange={(e) => setProfile({ ...profile, summary: e.target.value })} rows={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skills">Skills (comma-separated)</Label>
              <Input
                id="skills"
                value={profile.skills.join(", ")}
                onChange={(e) => setProfile({ ...profile, skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Work Experience</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addExp}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.work_experiences.length === 0 && (
              <p className="text-sm text-muted-foreground">No work experience added yet.</p>
            )}
            {profile.work_experiences.map((exp, i) => (
              <div key={i}>
                {i > 0 && <Separator className="mb-4" />}
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Company</Label>
                      <Input value={exp.company} onChange={(e) => updateExp(i, "company", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input value={exp.title} onChange={(e) => updateExp(i, "title", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start date</Label>
                      <Input value={exp.start_date} onChange={(e) => updateExp(i, "start_date", e.target.value)} placeholder="e.g. Jan 2020" />
                    </div>
                    <div className="space-y-2">
                      <Label>End date</Label>
                      <Input value={exp.end_date ?? ""} onChange={(e) => updateExp(i, "end_date", e.target.value)} placeholder="Leave blank for Present" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Bullet points (one per line)</Label>
                    <Textarea
                      value={(exp.bullet_points ?? []).join("\n")}
                      onChange={(e) => updateExp(i, "bullet_points", e.target.value.split("\n").filter(Boolean))}
                      rows={4}
                    />
                  </div>
                  <Button type="button" variant="destructive" size="sm" onClick={() => removeExp(i)}>
                    <Trash2 className="h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Education</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addEdu}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile.education_entries.length === 0 && (
              <p className="text-sm text-muted-foreground">No education entries added yet.</p>
            )}
            {profile.education_entries.map((edu, i) => (
              <div key={i}>
                {i > 0 && <Separator className="mb-4" />}
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Institution</Label>
                      <Input value={edu.institution} onChange={(e) => updateEdu(i, "institution", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Degree</Label>
                      <Input value={edu.degree} onChange={(e) => updateEdu(i, "degree", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Year</Label>
                      <Input value={edu.year ?? ""} onChange={(e) => updateEdu(i, "year", e.target.value)} />
                    </div>
                  </div>
                  <Button type="button" variant="destructive" size="sm" onClick={() => removeEdu(i)}>
                    <Trash2 className="h-4 w-4" /> Remove
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {saved && (
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>Profile saved successfully.</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </div>
  );
}
