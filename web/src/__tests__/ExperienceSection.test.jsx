import { render, screen, fireEvent, within } from "@testing-library/react";
import { vi } from "vitest";
import ExperienceSection from "../components/ExperienceSection";

const sampleExp = [
  {
    company: "Acme Corp",
    title: "Senior Engineer",
    location: "Lisbon",
    start_date: "Jan 2022",
    end_date: "",
    description: "Led platform migration",
    bullet_points: ["Built API", "Mentored juniors"],
    skills: ["React", "Node.js"],
    position: 0,
  },
];

describe("ExperienceSection", () => {
  it("shows empty state when no experiences", () => {
    const onChange = vi.fn();
    render(<ExperienceSection experiences={[]} onChange={onChange} />);
    expect(screen.getByText(/no experience added yet/i)).toBeInTheDocument();
  });

  it("renders experience entries", () => {
    const onChange = vi.fn();
    render(<ExperienceSection experiences={sampleExp} onChange={onChange} />);
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 2022/)).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
  });

  it("opens add dialog and saves new entry", () => {
    const onChange = vi.fn();
    render(<ExperienceSection experiences={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(screen.getByText("Add Experience")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: "NewCo" } });
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: "Dev" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ company: "NewCo", title: "Dev", position: 0 }),
    ]);
  });

  it("opens edit dialog with pre-filled data", () => {
    const onChange = vi.fn();
    render(<ExperienceSection experiences={sampleExp} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByText("Edit Experience")).toBeInTheDocument();
    expect(screen.getByLabelText(/company/i).value).toBe("Acme Corp");
  });

  it("deletes an entry", () => {
    const onChange = vi.fn();
    render(<ExperienceSection experiences={sampleExp} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
