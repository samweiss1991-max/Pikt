import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { INDUSTRIES } from "../data/discoveryOptions";
import { supabase } from "../lib/supabase";

// ── Constants ────────────────────────────────────────────────

const SENIORITY = ["Junior", "Mid", "Senior", "Lead", "Head of", "VP", "C-suite"];
const WORK_PREFS = ["Remote", "Hybrid", "On-site"];
const RESIDENCY = ["Citizen", "Permanent resident", "Work visa", "Student visa", "Other"];
const EMPLOYMENT = ["Full-time", "Part-time", "Contract", "Casual"];
const STAGES = ["1st round", "2nd round", "3rd round", "Final round"];
const WHY_NOT_HIRED = ["Headcount freeze", "Skills mismatch", "Timing", "Overqualified", "Culture fit", "Other"];
const RECOMMENDATIONS = ["Strong hire", "Hire", "Maybe"];
const STEP_LABELS = ["Role & experience", "Interview feedback", "CV & documents", "Review & publish"];
const STORAGE_KEY = "pickt_refer_draft";

// ── Initial state ───────────────────────────────────────────

const INITIAL = {
  industry: "",
  role_applied_for: "",
  seniority_level: "",
  years_experience: "",
  location_city: "",
  location_state: "",
  location_country: "",
  residency_status: "",
  preferred_work_type: "",
  willing_to_relocate: false,
  employment_type: "",
  notice_period_days: "",
  available_from: "",
  salary_expectation_min: "",
  salary_expectation_max: "",
  skills: [],
  interview_stage_reached: "",
  interviews_completed: "",
  why_not_hired: "",
  strengths: "",
  gaps: "",
  feedback_summary: "",
  recommendation: "",
  interview_notes: [],
  skill_ratings: [],
  cv: null,
  cover_letter: null,
  additional_docs: [],
  linkedin_url: "",
  portfolio_url: "",
  current_employer: "",
  current_job_title: "",
  mobile_number: "",
  fee_percentage: 8,
  consent_given: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET":
      return { ...state, [action.field]: action.value };
    case "RESTORE":
      return action.state;
    case "RESET":
      return INITIAL;
    default:
      return state;
  }
}

// ── Styles ───────────────────────────────────────────────────

const INPUT =
  "w-full rounded-xl border border-[var(--outline-variant)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--on-surface)] placeholder-[var(--on-surface-variant)] outline-none transition-colors focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]";
const SELECT = INPUT + " appearance-none";
const TEXTAREA = INPUT + " min-h-[80px] resize-y";
const LABEL = "block text-sm font-medium text-[var(--on-surface-variant)] mb-1.5";
const CARD_OPTION =
  "flex-1 cursor-pointer rounded-2xl border-2 px-4 py-3 text-center text-sm font-medium transition-all";
const CARD_ACTIVE = "border-[var(--primary)] bg-[var(--primary-container)] text-[var(--primary)]";
const CARD_INACTIVE = "border-[var(--outline-variant)] bg-[var(--surface-container)] text-[var(--on-surface-variant)] hover:border-[var(--primary)]/40";

// ── Page ─────────────────────────────────────────────────────

export default function Refer() {
  const [form, dispatch] = useReducer(reducer, INITIAL);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState([]);
  const [skillInput, setSkillInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const saveTimer = useRef();

  const set = useCallback(
    (field, value) => dispatch({ type: "SET", field, value }),
    []
  );

  // Restore draft from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        dispatch({ type: "RESTORE", state: { ...INITIAL, ...parsed } });
      }
    } catch { /* ignore */ }
  }, []);

  // Auto-save draft (debounced)
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const toSave = { ...form, cv: null, cover_letter: null, additional_docs: [] };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch { /* ignore */ }
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [form]);

  // ── File upload ─────────────────────────────────────────

  async function uploadFile(file, field) {
    const maxSize = 10 * 1024 * 1024;
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      setErrors(["Only PDF and DOCX files are allowed."]);
      return;
    }
    if (file.size > maxSize) {
      setErrors(["File must be under 10 MB."]);
      return;
    }

    const upload = { url: "", filename: file.name, uploading: true, progress: 0 };
    if (field === "additional_docs") {
      set(field, [...form.additional_docs, upload]);
    } else {
      set(field, upload);
    }

    const path = `uploads/${Date.now()}_${file.name}`;

    const { data, error } = await supabase.storage
      .from("candidate-documents")
      .upload(path, file, { upsert: false });

    if (error) {
      setErrors([`Upload failed: ${error.message}`]);
      if (field !== "additional_docs") set(field, null);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("candidate-documents")
      .getPublicUrl(data.path);

    const done = {
      url: urlData.publicUrl,
      filename: file.name,
      uploading: false,
      progress: 100,
    };

    if (field === "additional_docs") {
      set(
        field,
        form.additional_docs.map((d) =>
          d.filename === file.name && d.uploading ? done : d
        )
      );
    } else {
      set(field, done);
    }
  }

  // ── Validation ──────────────────────────────────────────

  function validateStep(s) {
    const errs = [];
    if (s === 1) {
      if (!form.industry) errs.push("Industry is required.");
      if (!form.role_applied_for) errs.push("Role title is required.");
      if (!form.seniority_level) errs.push("Seniority level is required.");
      if (!form.location_city) errs.push("City is required.");
      if (!form.location_country) errs.push("Country is required.");
      if (!form.preferred_work_type) errs.push("Work preference is required.");
      if (form.skills.length === 0) errs.push("Add at least one skill.");
      if (!form.interview_stage_reached) errs.push("Interview stage is required.");
      if (
        form.salary_expectation_min !== "" &&
        form.salary_expectation_max !== "" &&
        Number(form.salary_expectation_min) > Number(form.salary_expectation_max)
      ) {
        errs.push("Salary min cannot exceed max.");
      }
    }
    if (s === 2) {
      if (!form.why_not_hired) errs.push("Reason for not hiring is required.");
      if (!form.strengths.trim()) errs.push("Key strengths are required.");
      if (!form.gaps.trim()) errs.push("Development areas are required.");
      if (!form.recommendation) errs.push("Recommendation is required.");
    }
    if (s === 3) {
      if (!form.cv) errs.push("CV upload is required.");
      if (form.fee_percentage < 0 || form.fee_percentage > 100)
        errs.push("Fee must be between 0 and 100.");
    }
    if (s === 4) {
      if (!form.consent_given) errs.push("Candidate consent is required.");
    }
    return errs;
  }

  function nextStep() {
    const errs = validateStep(step);
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setStep((s) => Math.min(4, s + 1));
  }

  function prevStep() {
    setErrors([]);
    setStep((s) => Math.max(1, s - 1));
  }

  // ── Submit ──────────────────────────────────────────────

  async function handlePublish() {
    const allErrors = [1, 2, 3, 4].flatMap(validateStep);
    if (allErrors.length > 0) {
      setErrors(allErrors);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    const body = {
      industry: form.industry,
      role_applied_for: form.role_applied_for,
      seniority_level: form.seniority_level,
      years_experience: form.years_experience || null,
      location_city: form.location_city,
      location_state: form.location_state || null,
      location_country: form.location_country,
      residency_status: form.residency_status || null,
      preferred_work_type: form.preferred_work_type,
      willing_to_relocate: form.willing_to_relocate,
      employment_type: form.employment_type || null,
      notice_period_days: form.notice_period_days || null,
      available_from: form.available_from || null,
      salary_expectation_min: form.salary_expectation_min || null,
      salary_expectation_max: form.salary_expectation_max || null,
      skills: form.skills,
      interview_stage_reached: form.interview_stage_reached,
      interviews_completed: form.interviews_completed || 0,
      why_not_hired: form.why_not_hired,
      strengths: form.strengths,
      gaps: form.gaps,
      feedback_summary: form.feedback_summary || null,
      recommendation: form.recommendation,
      interview_notes: form.interview_notes.length > 0 ? form.interview_notes : null,
      skill_ratings: form.skill_ratings.length > 0 ? form.skill_ratings : null,
      cv_file_url: form.cv?.url,
      cv_filename: form.cv?.filename,
      cover_letter_url: form.cover_letter?.url || null,
      additional_documents:
        form.additional_docs.length > 0
          ? form.additional_docs.map((d) => ({ url: d.url, filename: d.filename }))
          : null,
      linkedin_url: form.linkedin_url || null,
      portfolio_url: form.portfolio_url || null,
      current_employer: form.current_employer || null,
      current_job_title: form.current_job_title || null,
      mobile_number: form.mobile_number || null,
      fee_percentage: form.fee_percentage,
      consent_given: form.consent_given,
    };

    try {
      // Will be replaced with supabase.functions.invoke('create-candidate', ...) once Edge Functions are deployed
      const { error } = await supabase.functions.invoke("create-candidate", {
        body,
      });
      if (error) throw new Error(error.message || "Failed to publish");

      localStorage.removeItem(STORAGE_KEY);
      window.location.href = "/my-candidates";
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  // ── Savings calculation ─────────────────────────────────

  const savings = useMemo(() => {
    const min = Number(form.salary_expectation_min) || 0;
    const max = Number(form.salary_expectation_max) || 0;
    const avg = min && max ? (min + max) / 2 : min || max;
    if (!avg) return null;
    const picktFee = avg * (form.fee_percentage / 100);
    const agencyLow = avg * 0.2;
    const agencyHigh = avg * 0.25;
    return {
      picktFee: Math.round(picktFee),
      saveLow: Math.round(agencyLow - picktFee),
      saveHigh: Math.round(agencyHigh - picktFee),
    };
  }, [form.salary_expectation_min, form.salary_expectation_max, form.fee_percentage]);

  // ── Render helpers ──────────────────────────────────────

  function addSkill() {
    const s = skillInput.trim();
    if (s && !form.skills.includes(s)) {
      set("skills", [...form.skills, s]);
    }
    setSkillInput("");
  }

  function removeSkill(skill) {
    set("skills", form.skills.filter((s) => s !== skill));
    set("skill_ratings", form.skill_ratings.filter((r) => r.skill !== skill));
  }

  function addInterviewNote() {
    set("interview_notes", [
      ...form.interview_notes,
      {
        round_number: form.interview_notes.length + 1,
        interviewer_role: "",
        outcome: "",
        note_text: "",
        score: "",
        date: "",
      },
    ]);
  }

  function updateNote(index, field, value) {
    const notes = [...form.interview_notes];
    notes[index] = { ...notes[index], [field]: value };
    set("interview_notes", notes);
  }

  function removeNote(index) {
    set("interview_notes", form.interview_notes.filter((_, i) => i !== index));
  }

  function updateSkillRating(skill, rating) {
    const existing = form.skill_ratings.filter((r) => r.skill !== skill);
    set("skill_ratings", [...existing, { skill, rating }]);
  }

  // ── Stepper ─────────────────────────────────────────────

  function Stepper() {
    return (
      <div className="mb-8 flex items-center justify-center gap-2">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`h-px w-8 ${done ? "bg-[var(--primary)]" : "bg-[var(--outline-variant)]"}`}
                />
              )}
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    active
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : done
                        ? "bg-[var(--primary-container)] text-[var(--primary)]"
                        : "bg-[var(--surface-container)] text-[var(--on-surface-variant)]"
                  }`}
                >
                  {done ? "\u2713" : n}
                </div>
                <span
                  className={`hidden text-xs sm:block ${active ? "font-medium text-[var(--on-surface)]" : "text-[var(--on-surface-variant)]"}`}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Errors ──────────────────────────────────────────────

  function ErrorBox() {
    if (errors.length === 0) return null;
    return (
      <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <ul className="space-y-1 text-sm text-red-500">
          {errors.map((e) => (
            <li key={e}>&bull; {e}</li>
          ))}
        </ul>
      </div>
    );
  }

  // ── Step 1 ──────────────────────────────────────────────

  function Step1() {
    return (
      <div className="space-y-5">
        <h2 className="text-2xl font-semibold text-[var(--on-surface)]">Role & experience</h2>
        <p className="text-sm text-[var(--on-surface-variant)]">Tell us about the candidate and the role they applied for.</p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL}>Industry *</label>
            <select className={SELECT} value={form.industry} onChange={(e) => set("industry", e.target.value)}>
              <option value="">Select industry</option>
              {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Role title *</label>
            <input className={INPUT} placeholder="e.g. Senior Frontend Engineer" value={form.role_applied_for} onChange={(e) => set("role_applied_for", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Seniority level *</label>
            <select className={SELECT} value={form.seniority_level} onChange={(e) => set("seniority_level", e.target.value)}>
              <option value="">Select level</option>
              {SENIORITY.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Years experience</label>
            <input className={INPUT} type="number" min={0} placeholder="e.g. 5" value={form.years_experience} onChange={(e) => set("years_experience", e.target.value ? Number(e.target.value) : "")} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className={LABEL}>City *</label>
            <input className={INPUT} placeholder="e.g. Sydney" value={form.location_city} onChange={(e) => set("location_city", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>State</label>
            <input className={INPUT} placeholder="e.g. NSW" value={form.location_state} onChange={(e) => set("location_state", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Country *</label>
            <input className={INPUT} placeholder="e.g. Australia" value={form.location_country} onChange={(e) => set("location_country", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL}>Residency status</label>
            <select className={SELECT} value={form.residency_status} onChange={(e) => set("residency_status", e.target.value)}>
              <option value="">Select status</option>
              {RESIDENCY.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Work preference *</label>
            <select className={SELECT} value={form.preferred_work_type} onChange={(e) => set("preferred_work_type", e.target.value)}>
              <option value="">Select preference</option>
              {WORK_PREFS.map((w) => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Employment type</label>
            <select className={SELECT} value={form.employment_type} onChange={(e) => set("employment_type", e.target.value)}>
              <option value="">Select type</option>
              {EMPLOYMENT.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-3 pb-1">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--on-surface)]">
              <input type="checkbox" checked={form.willing_to_relocate} onChange={(e) => set("willing_to_relocate", e.target.checked)} className="h-4 w-4 rounded border-[var(--outline-variant)] bg-[var(--surface)] accent-[var(--primary)]" />
              Willing to relocate
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className={LABEL}>Notice period (days)</label>
            <input className={INPUT} type="number" min={0} placeholder="e.g. 30" value={form.notice_period_days} onChange={(e) => set("notice_period_days", e.target.value ? Number(e.target.value) : "")} />
          </div>
          <div>
            <label className={LABEL}>Available from</label>
            <input className={INPUT} type="date" value={form.available_from} onChange={(e) => set("available_from", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL}>Salary expectation (min)</label>
            <input className={INPUT} type="number" min={0} placeholder="e.g. 120000" value={form.salary_expectation_min} onChange={(e) => set("salary_expectation_min", e.target.value ? Number(e.target.value) : "")} />
          </div>
          <div>
            <label className={LABEL}>Salary expectation (max)</label>
            <input className={INPUT} type="number" min={0} placeholder="e.g. 150000" value={form.salary_expectation_max} onChange={(e) => set("salary_expectation_max", e.target.value ? Number(e.target.value) : "")} />
          </div>
        </div>

        {/* Skills tag input */}
        <div>
          <label className={LABEL}>Skills *</label>
          <div className="flex gap-2">
            <input className={INPUT} placeholder="Type a skill and press Enter" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} />
            <button type="button" onClick={addSkill} className="shrink-0 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] px-4 py-2.5 text-sm text-[var(--on-surface-variant)] transition-colors hover:text-[var(--on-surface)]">
              Add
            </button>
          </div>
          {form.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {form.skills.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-container)] px-3 py-1 text-xs font-medium text-[var(--primary)]">
                  {s}
                  <button type="button" onClick={() => removeSkill(s)} className="text-[var(--primary)]/60 hover:text-[var(--primary)]">&times;</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Interview stage card selector */}
        <div>
          <label className={LABEL}>Interview stage reached *</label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {STAGES.map((s) => (
              <button key={s} type="button" onClick={() => { set("interview_stage_reached", s); const idx = STAGES.indexOf(s) + 1; if (form.interviews_completed === "" || form.interviews_completed === 0) { set("interviews_completed", idx); } }} className={`${CARD_OPTION} ${form.interview_stage_reached === s ? CARD_ACTIVE : CARD_INACTIVE}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-[200px]">
          <label className={LABEL}>Interviews completed</label>
          <input className={INPUT} type="number" min={0} value={form.interviews_completed} onChange={(e) => set("interviews_completed", e.target.value ? Number(e.target.value) : "")} />
        </div>
      </div>
    );
  }

  // ── Step 2 ──────────────────────────────────────────────

  function Step2() {
    return (
      <div className="space-y-5">
        <h2 className="text-2xl font-semibold text-[var(--on-surface)]">Interview feedback</h2>
        <p className="text-sm text-[var(--on-surface-variant)]">Share your assessment of this candidate.</p>

        <div>
          <label className={LABEL}>Why were they not hired? *</label>
          <select className={SELECT} value={form.why_not_hired} onChange={(e) => set("why_not_hired", e.target.value)}>
            <option value="">Select reason</option>
            {WHY_NOT_HIRED.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label className={LABEL}>Key strengths *</label>
          <textarea className={TEXTAREA} placeholder="What stood out about this candidate?" value={form.strengths} onChange={(e) => set("strengths", e.target.value)} />
        </div>

        <div>
          <label className={LABEL}>Development areas *</label>
          <textarea className={TEXTAREA} placeholder="Where could they improve?" value={form.gaps} onChange={(e) => set("gaps", e.target.value)} />
        </div>

        <div>
          <label className={LABEL}>Feedback summary</label>
          <textarea className={TEXTAREA} placeholder="This will be displayed on the marketplace profile." value={form.feedback_summary} onChange={(e) => set("feedback_summary", e.target.value)} />
        </div>

        {/* Recommendation card selector */}
        <div>
          <label className={LABEL}>Your recommendation *</label>
          <div className="grid grid-cols-3 gap-3">
            {RECOMMENDATIONS.map((r) => (
              <button key={r} type="button" onClick={() => set("recommendation", r)} className={`${CARD_OPTION} ${form.recommendation === r ? CARD_ACTIVE : CARD_INACTIVE}`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Interview notes (repeatable) */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <label className={LABEL + " mb-0"}>Interview notes</label>
            <button type="button" onClick={addInterviewNote} className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] px-3 py-1.5 text-xs text-[var(--on-surface-variant)] transition-colors hover:text-[var(--on-surface)]">
              + Add round
            </button>
          </div>
          {form.interview_notes.map((note, i) => (
            <div key={i} className="mb-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--on-surface)]">Round {note.round_number}</span>
                <button type="button" onClick={() => removeNote(i)} className="text-xs text-[var(--on-surface-variant)] hover:text-red-500">Remove</button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input className={INPUT} placeholder="Interviewer role" value={note.interviewer_role} onChange={(e) => updateNote(i, "interviewer_role", e.target.value)} />
                <select className={SELECT} value={note.outcome} onChange={(e) => updateNote(i, "outcome", e.target.value)}>
                  <option value="">Outcome</option>
                  <option>Passed</option>
                  <option>Failed</option>
                  <option>Withdrew</option>
                </select>
                <div className="flex gap-2">
                  <input className={INPUT} type="number" min={0} max={10} placeholder="Score /10" value={note.score} onChange={(e) => updateNote(i, "score", e.target.value ? Number(e.target.value) : "")} />
                  <input className={INPUT} type="date" value={note.date} onChange={(e) => updateNote(i, "date", e.target.value)} />
                </div>
              </div>
              <textarea className={TEXTAREA + " mt-3"} placeholder="Notes from this round" value={note.note_text} onChange={(e) => updateNote(i, "note_text", e.target.value)} />
            </div>
          ))}
        </div>

        {/* Skill ratings (auto from step 1 skills) */}
        {form.skills.length > 0 && (
          <div>
            <label className={LABEL}>Skill ratings</label>
            <div className="space-y-2">
              {form.skills.map((skill) => {
                const current = form.skill_ratings.find((r) => r.skill === skill)?.rating ?? 0;
                return (
                  <div key={skill} className="flex items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] px-4 py-2.5">
                    <span className="min-w-[120px] text-sm text-[var(--on-surface)]">{skill}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" onClick={() => updateSkillRating(skill, n)} className={`h-7 w-7 rounded-full text-xs font-semibold transition-colors ${n <= current ? "bg-[var(--primary)] text-[var(--on-primary)]" : "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)] hover:bg-[var(--primary-container)]"}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Step 3 ──────────────────────────────────────────────

  function Step3() {
    return (
      <div className="space-y-5">
        <h2 className="text-2xl font-semibold text-[var(--on-surface)]">CV, documents & fee</h2>
        <p className="text-sm text-[var(--on-surface-variant)]">Upload their CV and set your referral fee.</p>

        {/* CV upload */}
        <div>
          <label className={LABEL}>CV (PDF or DOCX) *</label>
          {form.cv ? (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary-container)] px-4 py-3">
              <span className="text-sm text-[var(--primary)]">{form.cv.filename}</span>
              {form.cv.uploading ? (
                <span className="text-xs text-[var(--on-surface-variant)]">Uploading...</span>
              ) : (
                <button type="button" onClick={() => set("cv", null)} className="ml-auto text-xs text-[var(--on-surface-variant)] hover:text-red-500">Remove</button>
              )}
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[var(--outline-variant)] bg-[var(--surface-container)] px-4 py-8 text-sm text-[var(--on-surface-variant)] transition-colors hover:border-[var(--primary)]/40">
              <span>Click to upload CV</span>
              <input type="file" className="hidden" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFile(file, "cv"); }} />
            </label>
          )}
        </div>

        {/* Cover letter */}
        <div>
          <label className={LABEL}>Cover letter (optional)</label>
          {form.cover_letter ? (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] px-4 py-3">
              <span className="text-sm text-[var(--on-surface)]">{form.cover_letter.filename}</span>
              <button type="button" onClick={() => set("cover_letter", null)} className="ml-auto text-xs text-[var(--on-surface-variant)] hover:text-red-500">Remove</button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container)] px-4 py-4 text-sm text-[var(--on-surface-variant)] transition-colors hover:border-[var(--primary)]/40">
              <span>Click to upload</span>
              <input type="file" className="hidden" accept=".pdf,.docx" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFile(file, "cover_letter"); }} />
            </label>
          )}
        </div>

        {/* Additional docs */}
        <div>
          <label className={LABEL}>Additional documents (optional)</label>
          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container)] px-4 py-4 text-sm text-[var(--on-surface-variant)] transition-colors hover:border-[var(--primary)]/40">
            <span>Click to add files</span>
            <input type="file" className="hidden" accept=".pdf,.docx" multiple onChange={(e) => { const files = e.target.files; if (files) { Array.from(files).forEach((f) => uploadFile(f, "additional_docs")); } }} />
          </label>
          {form.additional_docs.length > 0 && (
            <div className="mt-2 space-y-1">
              {form.additional_docs.map((d, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container)] px-3 py-2 text-xs">
                  <span className="text-[var(--on-surface)]">{d.filename}</span>
                  {d.uploading && <span className="text-[var(--on-surface-variant)]">Uploading...</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL}>LinkedIn URL</label>
            <input className={INPUT} placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Portfolio URL</label>
            <input className={INPUT} placeholder="https://..." value={form.portfolio_url} onChange={(e) => set("portfolio_url", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Current employer</label>
            <input className={INPUT} placeholder="Company name" value={form.current_employer} onChange={(e) => set("current_employer", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Current job title</label>
            <input className={INPUT} placeholder="e.g. Senior Engineer" value={form.current_job_title} onChange={(e) => set("current_job_title", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Mobile number</label>
            <input className={INPUT} placeholder="+61 4XX XXX XXX" value={form.mobile_number} onChange={(e) => set("mobile_number", e.target.value)} />
          </div>
        </div>

        {/* Fee */}
        <div>
          <label className={LABEL}>Referral fee (%) *</label>
          <div className="flex items-center gap-3">
            <input className={INPUT + " max-w-[120px]"} type="number" min={0} max={100} value={form.fee_percentage} onChange={(e) => set("fee_percentage", Number(e.target.value))} />
            <span className="text-sm text-[var(--on-surface-variant)]">% of first-year salary</span>
          </div>
        </div>

        {/* Savings comparison */}
        {savings && (
          <div className="rounded-xl border border-[var(--tertiary)]/30 bg-[var(--tertiary-container)] p-4">
            <p className="text-sm font-medium text-[var(--tertiary)]">
              pickt fee: ${savings.picktFee.toLocaleString()} vs. typical agency (20-25%)
            </p>
            <p className="mt-1 text-sm text-[var(--tertiary)]/80">
              Save ${savings.saveLow.toLocaleString()}-${savings.saveHigh.toLocaleString()} for the hiring company
            </p>
          </div>
        )}

        {/* Privacy preview */}
        <div>
          <label className={LABEL}>Privacy preview</label>
          <div className="overflow-hidden rounded-2xl border border-[var(--outline-variant)]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--surface-container)]">
                  <th className="px-4 py-2.5 text-left font-medium text-[var(--on-surface-variant)]">Field</th>
                  <th className="px-4 py-2.5 text-left font-medium text-[var(--primary)]">Before unlock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline-variant)]">
                {[
                  ["Role, skills, seniority", "Visible"],
                  ["Location, work type", "Visible"],
                  ["Interview feedback", "Visible"],
                  ["Fee percentage", "Visible"],
                  ["Full name, email, phone", "Hidden"],
                  ["LinkedIn, portfolio", "Hidden"],
                  ["Current employer & title", "Hidden"],
                  ["CV & documents", "Hidden"],
                ].map(([field, status]) => (
                  <tr key={field} className="bg-[var(--surface)]">
                    <td className="px-4 py-2 text-[var(--on-surface)]">{field}</td>
                    <td className={`px-4 py-2 ${status === "Visible" ? "text-[var(--primary)]" : "text-[var(--on-surface-variant)]"}`}>{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 4 ──────────────────────────────────────────────

  function Step4() {
    const checks = [
      { label: "Skills added", ok: form.skills.length > 0 },
      { label: "Feedback provided", ok: !!form.strengths && !!form.gaps },
      { label: "CV uploaded", ok: !!form.cv?.url },
      { label: "Fee set", ok: form.fee_percentage > 0 },
      { label: "PII will be redacted", ok: true },
    ];

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-[var(--on-surface)]">Review & publish</h2>
        <p className="text-sm text-[var(--on-surface-variant)]">Review the anonymised listing that will appear on the marketplace.</p>

        {/* Preview card */}
        <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-5">
          <h3 className="text-[15px] font-semibold text-[var(--on-surface)]">{form.role_applied_for || "Role title"}</h3>
          <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
            {form.seniority_level || "Seniority"} &middot; {form.years_experience ? `${form.years_experience} yrs` : "\u2014"} &middot; {form.location_city || "City"}, {form.location_country || "Country"} &middot; {form.preferred_work_type || "Work type"}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {form.skills.map((s) => (
              <span key={s} className="rounded-full bg-[var(--primary-container)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--primary)]">{s}</span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--primary)]/35 bg-[var(--primary-container)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--primary)]">
              {form.interview_stage_reached || "Stage"}
            </span>
            <span className="rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-high)] px-2.5 py-0.5 text-[11px] text-[var(--on-surface-variant)]">
              {form.interviews_completed || 0} interview{(form.interviews_completed || 0) !== 1 ? "s" : ""}
            </span>
          </div>
          {form.feedback_summary && (
            <p className="mt-3 line-clamp-2 text-sm text-[var(--on-surface-variant)]">{form.feedback_summary}</p>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-[var(--outline-variant)] pt-4 text-xs text-[var(--on-surface-variant)]">
            <span>
              <span className="font-medium text-[var(--on-surface)]">{form.fee_percentage}%</span> placement fee
            </span>
            <span className="rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--on-primary)]">
              Unlock profile
            </span>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-2">
          {checks.map((c) => (
            <div key={c.label} className="flex items-center gap-3 text-sm">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${c.ok ? "bg-[var(--primary-container)] text-[var(--primary)]" : "bg-red-500/15 text-red-500"}`}>
                {c.ok ? "\u2713" : "\u2717"}
              </span>
              <span className={c.ok ? "text-[var(--on-surface)]" : "text-red-500"}>{c.label}</span>
            </div>
          ))}
        </div>

        {/* Consent */}
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-4">
          <input type="checkbox" checked={form.consent_given} onChange={(e) => set("consent_given", e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-[var(--outline-variant)] bg-[var(--surface)] accent-[var(--primary)]" />
          <span className="text-sm text-[var(--on-surface)]">
            This candidate has consented to being referred through pickt. Their PII will be redacted until a company unlocks their profile.
          </span>
        </label>

        {submitError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-500">{submitError}</div>
        )}
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────

  return (
    <div className="flex min-h-0 flex-1 flex-col p-8">
      <div className="mx-auto w-full max-w-3xl">
        <Stepper />
        <ErrorBox />

        <div className="animate-fade-up" key={step}>
          {step === 1 && <Step1 />}
          {step === 2 && <Step2 />}
          {step === 3 && <Step3 />}
          {step === 4 && <Step4 />}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between border-t border-[var(--outline-variant)] pt-6">
          {step > 1 ? (
            <button type="button" onClick={prevStep} className="rounded-xl border border-[var(--outline-variant)] px-5 py-2.5 text-sm text-[var(--on-surface-variant)] transition-colors hover:text-[var(--on-surface)]">
              Back
            </button>
          ) : (
            <div />
          )}
          {step < 4 ? (
            <button type="button" onClick={nextStep} className="rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-[var(--on-primary)] transition-all hover:brightness-110">
              Continue
            </button>
          ) : (
            <button type="button" onClick={handlePublish} disabled={submitting} className="rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-[var(--on-primary)] transition-all hover:brightness-110 disabled:opacity-50">
              {submitting ? "Publishing\u2026" : "Publish to marketplace"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
