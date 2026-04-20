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

const EMPTY_EDU = {
  institution: "",
  degree: "",
  field_of_study: "",
  start_year: "",
  end_year: "",
  description: "",
  skills: [],
  position: 0,
};

export default function EducationSection({ educations, onChange }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [form, setForm] = useState(EMPTY_EDU);

  function openAdd() {
    setEditingIndex(null);
    setForm({ ...EMPTY_EDU, position: educations.length });
    setDialogOpen(true);
  }

  function openEdit(index) {
    setEditingIndex(index);
    setForm({ ...educations[index] });
    setDialogOpen(true);
  }

  function handleSave() {
    const updated = [...educations];
    if (editingIndex !== null) {
      updated[editingIndex] = form;
    } else {
      updated.push(form);
    }
    onChange(updated);
    setDialogOpen(false);
  }

  function handleDelete(index) {
    onChange(educations.filter((_, i) => i !== index));
  }

  function updateForm(field, value) {
    setForm({ ...form, [field]: value });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Education</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {educations.length === 0 && (
          <p className="text-sm text-muted-foreground">No education added yet.</p>
        )}
        {educations.map((edu, i) => (
          <div key={i}>
            {i > 0 && <Separator className="mb-4" />}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{edu.degree || "Untitled"}</p>
                <p className="text-sm text-muted-foreground">
                  {[edu.institution, edu.field_of_study].filter(Boolean).join(" · ")}
                </p>
                {(edu.start_year || edu.end_year) && (
                  <p className="text-xs text-muted-foreground">
                    {[edu.start_year, edu.end_year || (edu.start_year && "Present")].filter(Boolean).join(" - ")}
                  </p>
                )}
                {edu.description && (
                  <p className="mt-1 text-sm">{edu.description}</p>
                )}
                {edu.skills?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {edu.skills.map((skill) => (
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
            <DialogTitle>{editingIndex !== null ? "Edit Education" : "Add Education"}</DialogTitle>
            <DialogDescription>
              {editingIndex !== null ? "Update this education entry." : "Add a new education entry."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edu-institution">Institution</Label>
                <Input id="edu-institution" value={form.institution} onChange={(e) => updateForm("institution", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edu-degree">Degree</Label>
                <Input id="edu-degree" value={form.degree} onChange={(e) => updateForm("degree", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="edu-field">Field of study</Label>
                <Input id="edu-field" value={form.field_of_study} onChange={(e) => updateForm("field_of_study", e.target.value)} placeholder="e.g. Computer Science" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edu-start">Start year</Label>
                <Input id="edu-start" value={form.start_year} onChange={(e) => updateForm("start_year", e.target.value)} placeholder="e.g. 2016" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edu-end">End year</Label>
                <Input id="edu-end" value={form.end_year} onChange={(e) => updateForm("end_year", e.target.value)} placeholder="e.g. 2020" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edu-desc">Description</Label>
              <Textarea id="edu-desc" value={form.description} onChange={(e) => updateForm("description", e.target.value)} rows={3} placeholder="Notable achievements, thesis, relevant coursework" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edu-skills">Skills (comma-separated)</Label>
              <Input id="edu-skills" value={(form.skills ?? []).join(", ")} onChange={(e) => updateForm("skills", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="e.g. Python, Machine Learning, Statistics" />
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
