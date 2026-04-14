import { useState, useEffect } from "react";
import client from "../api/client";

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

  if (loading) return <p>Loading…</p>;

  return (
    <div className="profile-page">
      <h1>Your Profile</h1>
      <form onSubmit={handleSubmit}>
        <section>
          <h2>Personal Info</h2>
          <label>Full name<input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></label>
          <label>Email<input value={profile.email ?? ""} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
          <label>Phone<input value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label>
          <label>Location<input value={profile.location ?? ""} onChange={(e) => setProfile({ ...profile, location: e.target.value })} /></label>
          <label>Professional summary<textarea value={profile.summary ?? ""} onChange={(e) => setProfile({ ...profile, summary: e.target.value })} rows={4} /></label>
          <label>Skills (comma-separated)
            <input
              value={profile.skills.join(", ")}
              onChange={(e) => setProfile({ ...profile, skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
          </label>
        </section>

        <section>
          <h2>Work Experience</h2>
          {profile.work_experiences.map((exp, i) => (
            <div key={i} className="entry-card">
              <label>Company<input value={exp.company} onChange={(e) => updateExp(i, "company", e.target.value)} /></label>
              <label>Title<input value={exp.title} onChange={(e) => updateExp(i, "title", e.target.value)} /></label>
              <label>Start date<input value={exp.start_date} onChange={(e) => updateExp(i, "start_date", e.target.value)} placeholder="e.g. Jan 2020" /></label>
              <label>End date<input value={exp.end_date ?? ""} onChange={(e) => updateExp(i, "end_date", e.target.value)} placeholder="Leave blank for Present" /></label>
              <label>Bullet points (one per line)
                <textarea
                  value={(exp.bullet_points ?? []).join("\n")}
                  onChange={(e) => updateExp(i, "bullet_points", e.target.value.split("\n").filter(Boolean))}
                  rows={4}
                />
              </label>
              <button type="button" onClick={() => removeExp(i)}>Remove</button>
            </div>
          ))}
          <button type="button" onClick={addExp}>+ Add experience</button>
        </section>

        <section>
          <h2>Education</h2>
          {profile.education_entries.map((edu, i) => (
            <div key={i} className="entry-card">
              <label>Institution<input value={edu.institution} onChange={(e) => updateEdu(i, "institution", e.target.value)} /></label>
              <label>Degree<input value={edu.degree} onChange={(e) => updateEdu(i, "degree", e.target.value)} /></label>
              <label>Year<input value={edu.year ?? ""} onChange={(e) => updateEdu(i, "year", e.target.value)} /></label>
              <button type="button" onClick={() => removeEdu(i)}>Remove</button>
            </div>
          ))}
          <button type="button" onClick={addEdu}>+ Add education</button>
        </section>

        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={saving}>{saving ? "Saving…" : saved ? "Saved!" : "Save profile"}</button>
      </form>
    </div>
  );
}
