import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

const EMPTY_EXP = {
  company: "",
  title: "",
  location: "",
  start_date: "",
  end_date: "",
  description: "",
  bullet_points: [],
  skills: [],
  position: 0,
};

export default function ExperienceSection({ experiences, onChange }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [form, setForm] = useState(EMPTY_EXP);

  function openAdd() {
    setEditingIndex(null);
    setForm({ ...EMPTY_EXP, position: experiences.length });
    setDialogOpen(true);
  }

  function openEdit(index) {
    setEditingIndex(index);
    setForm({ ...experiences[index] });
    setDialogOpen(true);
  }

  function handleSave() {
    const updated = [...experiences];
    if (editingIndex !== null) {
      updated[editingIndex] = form;
    } else {
      updated.push(form);
    }
    onChange(updated);
    setDialogOpen(false);
  }

  function handleDelete(index) {
    onChange(experiences.filter((_, i) => i !== index));
  }

  function updateForm(field, value) {
    setForm({ ...form, [field]: value });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Work Experience</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {experiences.length === 0 && (
          <p className="text-sm text-muted-foreground">No experience added yet.</p>
        )}
        {experiences.map((exp, i) => (
          <div key={i}>
            {i > 0 && <Separator className="mb-4" />}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{exp.title || "Untitled"}</p>
                <p className="text-sm text-muted-foreground">
                  {[exp.company, exp.location].filter(Boolean).join(" · ")}
                </p>
                {(exp.start_date || exp.end_date) && (
                  <p className="text-xs text-muted-foreground">
                    {[exp.start_date, exp.end_date || (exp.start_date && "Present")].filter(Boolean).join(" - ")}
                  </p>
                )}
                {exp.description && (
                  <p className="mt-1 text-sm">{exp.description}</p>
                )}
                {exp.skills?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {exp.skills.map((skill) => (
                      <Badge key={skill} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(i)} aria-label="Edit">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => handleDelete(i)} aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{editingIndex !== null ? "Edit Experience" : "Add Experience"}</DialogTitle>
            <DialogDescription>
              {editingIndex !== null ? "Update this work experience entry." : "Add a new work experience entry."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="exp-company">Company</Label>
                <Input id="exp-company" value={form.company} onChange={(e) => updateForm("company", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-title">Title</Label>
                <Input id="exp-title" value={form.title} onChange={(e) => updateForm("title", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="exp-location">Location</Label>
                <Input id="exp-location" value={form.location} onChange={(e) => updateForm("location", e.target.value)} placeholder="e.g. Lisbon, Portugal" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-start">Start date</Label>
                <Input id="exp-start" value={form.start_date} onChange={(e) => updateForm("start_date", e.target.value)} placeholder="e.g. Jan 2020" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-end">End date</Label>
                <Input id="exp-end" value={form.end_date} onChange={(e) => updateForm("end_date", e.target.value)} placeholder="Leave blank for Present" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-desc">Description</Label>
              <Textarea id="exp-desc" value={form.description} onChange={(e) => updateForm("description", e.target.value)} rows={3} placeholder="General description of the role" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-bullets">Bullet points (one per line)</Label>
              <Textarea id="exp-bullets" value={(form.bullet_points ?? []).join("\n")} onChange={(e) => updateForm("bullet_points", e.target.value.split("\n").filter(Boolean))} rows={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-skills">Skills (comma-separated)</Label>
              <Input id="exp-skills" value={(form.skills ?? []).join(", ")} onChange={(e) => updateForm("skills", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="e.g. React, TypeScript, Node.js" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
