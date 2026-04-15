import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import EducationSection from "../components/EducationSection";

const sampleEdu = [
  {
    institution: "University of Lisbon",
    degree: "MSc Computer Science",
    field_of_study: "Computer Science",
    start_year: "2018",
    end_year: "2020",
    description: "Focus on distributed systems",
    skills: ["Python", "Machine Learning"],
    position: 0,
  },
];

describe("EducationSection", () => {
  it("shows empty state when no educations", () => {
    const onChange = vi.fn();
    render(<EducationSection educations={[]} onChange={onChange} />);
    expect(screen.getByText(/no education added yet/i)).toBeInTheDocument();
  });

  it("renders education entries", () => {
    const onChange = vi.fn();
    render(<EducationSection educations={sampleEdu} onChange={onChange} />);
    expect(screen.getByText("MSc Computer Science")).toBeInTheDocument();
    expect(screen.getByText(/University of Lisbon/)).toBeInTheDocument();
    expect(screen.getByText(/2018/)).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("Machine Learning")).toBeInTheDocument();
  });

  it("opens add dialog and saves new entry", () => {
    const onChange = vi.fn();
    render(<EducationSection educations={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(screen.getByText("Add Education")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/institution/i), { target: { value: "MIT" } });
    fireEvent.change(screen.getByLabelText(/degree/i), { target: { value: "BSc" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ institution: "MIT", degree: "BSc", position: 0 }),
    ]);
  });

  it("opens edit dialog with pre-filled data", () => {
    const onChange = vi.fn();
    render(<EducationSection educations={sampleEdu} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByText("Edit Education")).toBeInTheDocument();
    expect(screen.getByLabelText(/institution/i).value).toBe("University of Lisbon");
  });

  it("deletes an entry", () => {
    const onChange = vi.fn();
    render(<EducationSection educations={sampleEdu} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
