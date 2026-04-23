import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { INDUSTRIES } from "../data/discoveryOptions";
import { supabase } from "../lib/supabase";
import { mapParsedDataToForm } from "../lib/cvFieldMapper";
import './Refer.css';

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

// ── Page ─────────────────────────────────────────────────────

export default function Refer() {
  const navigate = useNavigate();
  const [form, dispatch] = useReducer(reducer, INITIAL);
  const [step, setStep] = useState(0);
  const [intakeMethod, setIntakeMethod] = useState(null); // null | 'cv' | 'ats' | 'manual'
  const [errors, setErrors] = useState([]);
  const [skillInput, setSkillInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const saveTimer = useRef();

  // CV drop zone state
  const [dragActive, setDragActive] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvParsing, setCvParsing] = useState(false);
  const [cvParsed, setCvParsed] = useState(null); // parsed result summary
  const [cvError, setCvError] = useState(null);
  const fileInputRef = useRef(null);

  const set = useCallback(
    (field, value) => dispatch({ type: "SET", field, value }),
    []
  );

  // Restore draft from localStorage — if draft exists, skip intake selector
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasData = parsed.role_applied_for || parsed.industry || (parsed.skills && parsed.skills.length > 0);
        dispatch({ type: "RESTORE", state: { ...INITIAL, ...parsed } });
        if (hasData) {
          setStep(1);
          setIntakeMethod(parsed._intakeMethod || 'manual');
        }
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
      { round_number: form.interview_notes.length + 1, interviewer_role: "", outcome: "", note_text: "", score: "", date: "" },
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

  // ── CV upload & parse ───────────────────────────────────

  async function handleCvFile(file) {
    const maxSize = 10 * 1024 * 1024;
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) {
      setCvError("Only PDF and DOCX files are accepted.");
      return;
    }
    if (file.size > maxSize) {
      setCvError("File must be under 10 MB.");
      return;
    }

    setCvError(null);
    setCvUploading(true);

    const storagePath = `uploads/${Date.now()}_${file.name}`;

    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("candidate-documents")
        .upload(storagePath, file, { upsert: false });

      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = supabase.storage
        .from("candidate-documents")
        .getPublicUrl(uploadData.path);

      // Set CV on form so it's pre-attached in Step 3
      set("cv", { url: urlData.publicUrl, filename: file.name, uploading: false, progress: 100 });

      setCvUploading(false);
      setCvParsing(true);

      // Call parse-cv edge function
      const { data: parseResult, error: parseError } = await supabase.functions.invoke("parse-cv", {
        body: { storagePath, filename: file.name },
      });

      if (parseError) throw new Error(parseError.message);

      if (parseResult?.parsed) {
        const mapped = mapParsedDataToForm(parseResult.parsed, { ...INITIAL, cv: { url: urlData.publicUrl, filename: file.name, uploading: false, progress: 100 } });
        dispatch({ type: "RESTORE", state: mapped });
        setCvParsed(parseResult.parsed);
      } else {
        setCvParsed(null);
        setCvError(parseResult?.error || "Could not extract data from this file.");
      }
    } catch (e) {
      setCvError(e.message || "Upload failed.");
    } finally {
      setCvUploading(false);
      setCvParsing(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleCvFile(file);
  }

  function handleDragOver(e) { e.preventDefault(); setDragActive(true); }
  function handleDragLeave() { setDragActive(false); }

  // ── Intake Selector ────────────────────────────────────

  function IntakeSelector() {
    return (
      <div className="rf-intake">
        <h1 className="rf-heading">Refer a candidate</h1>
        <p className="rf-subheading">Choose how you'd like to get started</p>

        <div className="rf-intake-grid">
          <button type="button" className="rf-intake-card press-scale" onClick={() => setIntakeMethod('cv')}>
            <div className="rf-intake-icon">
              <span className="material-symbols-outlined">upload_file</span>
            </div>
            <h3 className="rf-intake-card-title">Upload CV</h3>
            <p className="rf-intake-card-desc">Drag & drop a CV and we'll auto-fill the form for you</p>
          </button>

          <button type="button" className="rf-intake-card press-scale" onClick={() => setIntakeMethod('ats')}>
            <div className="rf-intake-icon rf-intake-icon--ats">
              <span className="material-symbols-outlined">cloud_sync</span>
            </div>
            <h3 className="rf-intake-card-title">Import from ATS</h3>
            <p className="rf-intake-card-desc">Pull candidate data directly from your ATS platform</p>
          </button>
        </div>

        <button type="button" className="rf-intake-manual press-scale" onClick={() => { setIntakeMethod('manual'); setStep(1); }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit_note</span>
          Enter details manually
        </button>
      </div>
    );
  }

  // ── CV Drop Zone ───────────────────────────────────────

  function CvDropZone() {
    return (
      <div className="rf-intake">
        <button type="button" className="rf-back-link" onClick={() => { setIntakeMethod(null); setCvParsed(null); setCvError(null); }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          Back
        </button>

        <h1 className="rf-heading">Upload a CV</h1>
        <p className="rf-subheading">We'll extract candidate details and pre-fill the form</p>

        {!cvParsed && (
          <div
            className={`rf-dropzone ${dragActive ? 'rf-dropzone--active' : ''} ${cvUploading || cvParsing ? 'rf-dropzone--processing' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCvFile(f); }}
            />
            {cvUploading ? (
              <div className="rf-dropzone-content">
                <span className="material-symbols-outlined rf-dropzone-icon">cloud_upload</span>
                <p className="rf-dropzone-label">Uploading...</p>
              </div>
            ) : cvParsing ? (
              <div className="rf-dropzone-content">
                <span className="material-symbols-outlined rf-dropzone-icon">document_scanner</span>
                <p className="rf-dropzone-label">Parsing CV...</p>
                <p className="rf-dropzone-hint">Extracting candidate details</p>
              </div>
            ) : (
              <div className="rf-dropzone-content">
                <span className="material-symbols-outlined rf-dropzone-icon">upload_file</span>
                <p className="rf-dropzone-label">Drag & drop your CV here</p>
                <p className="rf-dropzone-hint">or click to browse — PDF or DOCX, max 10 MB</p>
              </div>
            )}
          </div>
        )}

        {cvError && (
          <div className="rf-errors" style={{ marginTop: '1rem' }}>
            <ul><li>{cvError}</li></ul>
          </div>
        )}

        {cvParsed && (
          <div className="rf-parse-result">
            <div className="rf-parse-header">
              <span className="material-symbols-outlined rf-parse-check">check_circle</span>
              <div>
                <h3 className="rf-parse-title">CV parsed successfully</h3>
                <p className="rf-parse-confidence">Confidence: {cvParsed.confidence || 'medium'}</p>
              </div>
            </div>

            <div className="rf-parse-fields">
              {cvParsed.current_job_title && (
                <div className="rf-parse-field">
                  <span className="rf-parse-field-label">Role</span>
                  <span className="rf-parse-field-value">{cvParsed.current_job_title}</span>
                </div>
              )}
              {cvParsed.current_employer && (
                <div className="rf-parse-field">
                  <span className="rf-parse-field-label">Company</span>
                  <span className="rf-parse-field-value">{cvParsed.current_employer}</span>
                </div>
              )}
              {cvParsed.location_city && (
                <div className="rf-parse-field">
                  <span className="rf-parse-field-label">Location</span>
                  <span className="rf-parse-field-value">{cvParsed.location_city}{cvParsed.location_country ? `, ${cvParsed.location_country}` : ''}</span>
                </div>
              )}
              {cvParsed.skills && cvParsed.skills.length > 0 && (
                <div className="rf-parse-field">
                  <span className="rf-parse-field-label">Skills</span>
                  <div className="rf-skill-tags" style={{ marginTop: 0 }}>
                    {cvParsed.skills.map(s => <span key={s} className="rf-skill-tag">{s}</span>)}
                  </div>
                </div>
              )}
              {cvParsed.years_experience && (
                <div className="rf-parse-field">
                  <span className="rf-parse-field-label">Experience</span>
                  <span className="rf-parse-field-value">{cvParsed.years_experience} years</span>
                </div>
              )}
            </div>

            <button type="button" className="rf-btn-next press-scale" style={{ width: '100%', marginTop: '1.25rem' }} onClick={() => setStep(1)}>
              Continue to form
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '0.5rem' }}>
              You can review and edit all fields before publishing
            </p>
          </div>
        )}

        {cvError && !cvParsed && (
          <button type="button" className="rf-btn-next press-scale" style={{ width: '100%', marginTop: '1rem' }} onClick={() => setStep(1)}>
            Continue manually
          </button>
        )}
      </div>
    );
  }

  // ── ATS Import Flow ────────────────────────────────────

  function AtsImportFlow() {
    return (
      <div className="rf-intake">
        <button type="button" className="rf-back-link" onClick={() => setIntakeMethod(null)}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          Back
        </button>

        <h1 className="rf-heading">Import from ATS</h1>
        <p className="rf-subheading">Connect your ATS to import candidate data</p>

        <div className="rf-ats-providers">
          {['Greenhouse', 'Lever', 'Workable'].map(provider => (
            <div key={provider} className="rf-ats-provider-card">
              <div className="rf-ats-provider-info">
                <span className="rf-ats-provider-name">{provider}</span>
                <span className="rf-ats-provider-status">Not connected</span>
              </div>
              <button type="button" className="rf-btn-back press-scale" onClick={() => navigate('/integrations')}>
                Connect
              </button>
            </div>
          ))}
        </div>

        <div className="rf-ats-cta">
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--on-surface-variant)' }}>info</span>
          <p>Connect an ATS on the <button type="button" className="rf-ats-link" onClick={() => navigate('/integrations')}>Integrations page</button> to import candidates directly.</p>
        </div>
      </div>
    );
  }

  // ── Stepper ─────────────────────────────────────────────

  function Stepper() {
    return (
      <div className="rf-stepper">
        {STEP_LABELS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div key={label} className="rf-step">
              {i > 0 && <div className={`rf-step-line ${done ? 'rf-step-line--done' : ''}`} />}
              <div className={`rf-step-dot ${active ? 'rf-step-dot--active' : done ? 'rf-step-dot--done' : 'rf-step-dot--pending'}`}>
                {done ? '\u2713' : n}
              </div>
              <span className={`rf-step-label ${active ? 'rf-step-label--active' : ''}`}>{label}</span>
            </div>
          );
        })}
      </div>
    );
  }

  function ErrorBox() {
    if (errors.length === 0) return null;
    return (
      <div className="rf-errors">
        <ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      </div>
    );
  }

  // ── Step 1 ──────────────────────────────────────────────

  function Step1() {
    return (
      <div className="rf-fields">
        <div>
          <h2 className="rf-section-title">Role & experience</h2>
          <p className="rf-section-subtitle">Tell us about the candidate and the role they applied for.</p>
        </div>

        <div className="rf-row">
          <div>
            <label className="rf-label">Industry *</label>
            <select className="rf-select" value={form.industry} onChange={(e) => set("industry", e.target.value)}>
              <option value="">Select industry</option>
              {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="rf-label">Role title *</label>
            <input className="rf-input" placeholder="e.g. Senior Frontend Engineer" value={form.role_applied_for} onChange={(e) => set("role_applied_for", e.target.value)} />
          </div>
          <div>
            <label className="rf-label">Seniority level *</label>
            <select className="rf-select" value={form.seniority_level} onChange={(e) => set("seniority_level", e.target.value)}>
              <option value="">Select level</option>
              {SENIORITY.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="rf-label">Years experience</label>
            <input className="rf-input" type="number" min={0} placeholder="e.g. 5" value={form.years_experience} onChange={(e) => set("years_experience", e.target.value ? Number(e.target.value) : "")} />
          </div>
        </div>

        <div className="rf-row rf-row--3">
          <div>
            <label className="rf-label">City *</label>
            <input className="rf-input" placeholder="e.g. Sydney" value={form.location_city} onChange={(e) => set("location_city", e.target.value)} />
          </div>
          <div>
            <label className="rf-label">State</label>
            <input className="rf-input" placeholder="e.g. NSW" value={form.location_state} onChange={(e) => set("location_state", e.target.value)} />
          </div>
          <div>
            <label className="rf-label">Country *</label>
            <input className="rf-input" placeholder="e.g. Australia" value={form.location_country} onChange={(e) => set("location_country", e.target.value)} />
          </div>
        </div>

        <div className="rf-row">
          <div>
            <label className="rf-label">Residency status</label>
            <select className="rf-select" value={form.residency_status} onChange={(e) => set("residency_status", e.target.value)}>
              <option value="">Select status</option>
              {RESIDENCY.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="rf-label">Work preference *</label>
            <select className="rf-select" value={form.preferred_work_type} onChange={(e) => set("preferred_work_type", e.target.value)}>
              <option value="">Select preference</option>
              {WORK_PREFS.map((w) => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <label className="rf-label">Employment type</label>
            <select className="rf-select" value={form.employment_type} onChange={(e) => set("employment_type", e.target.value)}>
              <option value="">Select type</option>
              {EMPLOYMENT.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.25rem' }}>
            <label className="rf-checkbox-label">
              <input type="checkbox" checked={form.willing_to_relocate} onChange={(e) => set("willing_to_relocate", e.target.checked)} />
              Willing to relocate
            </label>
          </div>
        </div>

        <div className="rf-row rf-row--3">
          <div>
            <label className="rf-label">Notice period (days)</label>
            <input className="rf-input" type="number" min={0} placeholder="e.g. 30" value={form.notice_period_days} onChange={(e) => set("notice_period_days", e.target.value ? Number(e.target.value) : "")} />
          </div>
          <div>
            <label className="rf-label">Available from</label>
            <input className="rf-input" type="date" value={form.available_from} onChange={(e) => set("available_from", e.target.value)} />
          </div>
        </div>

        <div className="rf-row">
          <div>
            <label className="rf-label">Salary expectation (min)</label>
            <input className="rf-input" type="number" min={0} placeholder="e.g. 120000" value={form.salary_expectation_min} onChange={(e) => set("salary_expectation_min", e.target.value ? Number(e.target.value) : "")} />
          </div>
          <div>
            <label className="rf-label">Salary expectation (max)</label>
            <input className="rf-input" type="number" min={0} placeholder="e.g. 150000" value={form.salary_expectation_max} onChange={(e) => set("salary_expectation_max", e.target.value ? Number(e.target.value) : "")} />
          </div>
        </div>

        <div>
          <label className="rf-label">Skills *</label>
          <div className="rf-skill-row">
            <input className="rf-input" placeholder="Type a skill and press Enter" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} />
            <button type="button" onClick={addSkill} className="rf-skill-add">Add</button>
          </div>
          {form.skills.length > 0 && (
            <div className="rf-skill-tags">
              {form.skills.map((s) => (
                <span key={s} className="rf-skill-tag">
                  {s}
                  <button type="button" onClick={() => removeSkill(s)} className="rf-skill-tag-remove">&times;</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="rf-label">Interview stage reached *</label>
          <div className="rf-card-grid rf-card-grid--4">
            {STAGES.map((s) => (
              <button key={s} type="button" onClick={() => { set("interview_stage_reached", s); const idx = STAGES.indexOf(s) + 1; if (form.interviews_completed === "" || form.interviews_completed === 0) { set("interviews_completed", idx); } }} className={`rf-card-option ${form.interview_stage_reached === s ? 'rf-card-option--active' : ''}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div style={{ maxWidth: 200 }}>
          <label className="rf-label">Interviews completed</label>
          <input className="rf-input" type="number" min={0} value={form.interviews_completed} onChange={(e) => set("interviews_completed", e.target.value ? Number(e.target.value) : "")} />
        </div>
      </div>
    );
  }

  // ── Step 2 ──────────────────────────────────────────────

  function Step2() {
    return (
      <div className="rf-fields">
        <div>
          <h2 className="rf-section-title">Interview feedback</h2>
          <p className="rf-section-subtitle">Share your assessment of this candidate.</p>
        </div>

        <div>
          <label className="rf-label">Why were they not hired? *</label>
          <select className="rf-select" value={form.why_not_hired} onChange={(e) => set("why_not_hired", e.target.value)}>
            <option value="">Select reason</option>
            {WHY_NOT_HIRED.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label className="rf-label">Key strengths *</label>
          <textarea className="rf-textarea" placeholder="What stood out about this candidate?" value={form.strengths} onChange={(e) => set("strengths", e.target.value)} />
        </div>

        <div>
          <label className="rf-label">Development areas *</label>
          <textarea className="rf-textarea" placeholder="Where could they improve?" value={form.gaps} onChange={(e) => set("gaps", e.target.value)} />
        </div>

        <div>
          <label className="rf-label">Feedback summary</label>
          <textarea className="rf-textarea" placeholder="This will be displayed on the marketplace profile." value={form.feedback_summary} onChange={(e) => set("feedback_summary", e.target.value)} />
        </div>

        <div>
          <label className="rf-label">Your recommendation *</label>
          <div className="rf-card-grid rf-card-grid--3">
            {RECOMMENDATIONS.map((r) => (
              <button key={r} type="button" onClick={() => set("recommendation", r)} className={`rf-card-option ${form.recommendation === r ? 'rf-card-option--active' : ''}`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="rf-note-header">
            <label className="rf-label" style={{ marginBottom: 0 }}>Interview notes</label>
            <button type="button" onClick={addInterviewNote} className="rf-note-add">+ Add round</button>
          </div>
          {form.interview_notes.map((note, i) => (
            <div key={i} className="rf-note-card">
              <div className="rf-note-top">
                <span className="rf-note-round">Round {note.round_number}</span>
                <button type="button" onClick={() => removeNote(i)} className="rf-note-remove">Remove</button>
              </div>
              <div className="rf-row rf-row--3">
                <input className="rf-input" placeholder="Interviewer role" value={note.interviewer_role} onChange={(e) => updateNote(i, "interviewer_role", e.target.value)} />
                <select className="rf-select" value={note.outcome} onChange={(e) => updateNote(i, "outcome", e.target.value)}>
                  <option value="">Outcome</option>
                  <option>Passed</option>
                  <option>Failed</option>
                  <option>Withdrew</option>
                </select>
                <div className="rf-row">
                  <input className="rf-input" type="number" min={0} max={10} placeholder="Score /10" value={note.score} onChange={(e) => updateNote(i, "score", e.target.value ? Number(e.target.value) : "")} />
                  <input className="rf-input" type="date" value={note.date} onChange={(e) => updateNote(i, "date", e.target.value)} />
                </div>
              </div>
              <textarea className="rf-textarea" style={{ marginTop: '0.75rem' }} placeholder="Notes from this round" value={note.note_text} onChange={(e) => updateNote(i, "note_text", e.target.value)} />
            </div>
          ))}
        </div>

        {form.skills.length > 0 && (
          <div>
            <label className="rf-label">Skill ratings</label>
            {form.skills.map((skill) => {
              const current = form.skill_ratings.find((r) => r.skill === skill)?.rating ?? 0;
              return (
                <div key={skill} className="rf-rating-row">
                  <span className="rf-rating-label">{skill}</span>
                  <div className="rf-rating-dots">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => updateSkillRating(skill, n)} className={`rf-rating-dot ${n <= current ? 'rf-rating-dot--on' : 'rf-rating-dot--off'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Step 3 ──────────────────────────────────────────────

  function Step3() {
    return (
      <div className="rf-fields">
        <div>
          <h2 className="rf-section-title">CV, documents & fee</h2>
          <p className="rf-section-subtitle">Upload their CV and set your referral fee.</p>
        </div>

        <div>
          <label className="rf-label">CV (PDF or DOCX) *</label>
          {form.cv ? (
            <div className="rf-uploaded">
              <span className="rf-uploaded-name">{form.cv.filename}</span>
              {form.cv.uploading ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Uploading...</span>
              ) : (
                <button type="button" onClick={() => set("cv", null)} className="rf-uploaded-remove">Remove</button>
              )}
            </div>
          ) : (
            <label className="rf-upload-zone">
              <span>Click to upload CV</span>
              <input type="file" style={{ display: 'none' }} accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFile(file, "cv"); }} />
            </label>
          )}
        </div>

        <div>
          <label className="rf-label">Cover letter (optional)</label>
          {form.cover_letter ? (
            <div className="rf-uploaded" style={{ borderColor: 'rgba(187,186,175,.15)', background: 'var(--surface-container)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--on-surface)' }}>{form.cover_letter.filename}</span>
              <button type="button" onClick={() => set("cover_letter", null)} className="rf-uploaded-remove">Remove</button>
            </div>
          ) : (
            <label className="rf-upload-zone rf-upload-zone--sm">
              <span>Click to upload</span>
              <input type="file" style={{ display: 'none' }} accept=".pdf,.docx" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadFile(file, "cover_letter"); }} />
            </label>
          )}
        </div>

        <div>
          <label className="rf-label">Additional documents (optional)</label>
          <label className="rf-upload-zone rf-upload-zone--sm">
            <span>Click to add files</span>
            <input type="file" style={{ display: 'none' }} accept=".pdf,.docx" multiple onChange={(e) => { const files = e.target.files; if (files) { Array.from(files).forEach((f) => uploadFile(f, "additional_docs")); } }} />
          </label>
          {form.additional_docs.length > 0 && form.additional_docs.map((d, i) => (
            <div key={i} className="rf-doc-item">
              <span style={{ color: 'var(--on-surface)' }}>{d.filename}</span>
              {d.uploading && <span style={{ color: 'var(--on-surface-variant)' }}>Uploading...</span>}
            </div>
          ))}
        </div>

        <div className="rf-row">
          <div>
            <label className="rf-label">LinkedIn URL</label>
            <input className="rf-input" placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} />
          </div>
          <div>
            <label className="rf-label">Portfolio URL</label>
            <input className="rf-input" placeholder="https://..." value={form.portfolio_url} onChange={(e) => set("portfolio_url", e.target.value)} />
          </div>
          <div>
            <label className="rf-label">Current employer</label>
            <input className="rf-input" placeholder="Company name" value={form.current_employer} onChange={(e) => set("current_employer", e.target.value)} />
          </div>
          <div>
            <label className="rf-label">Current job title</label>
            <input className="rf-input" placeholder="e.g. Senior Engineer" value={form.current_job_title} onChange={(e) => set("current_job_title", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="rf-label">Mobile number</label>
          <input className="rf-input" style={{ maxWidth: 300 }} placeholder="+61 4XX XXX XXX" value={form.mobile_number} onChange={(e) => set("mobile_number", e.target.value)} />
        </div>

        <div>
          <label className="rf-label">Referral fee (%) *</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input className="rf-input" style={{ maxWidth: 120 }} type="number" min={0} max={100} value={form.fee_percentage} onChange={(e) => set("fee_percentage", Number(e.target.value))} />
            <span style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>% of first-year salary</span>
          </div>
        </div>

        {savings && (
          <div className="rf-savings">
            <p className="rf-savings-title">pickt fee: ${savings.picktFee.toLocaleString()} vs. typical agency (20-25%)</p>
            <p className="rf-savings-body">Save ${savings.saveLow.toLocaleString()}-${savings.saveHigh.toLocaleString()} for the hiring company</p>
          </div>
        )}

        <div>
          <label className="rf-label">Privacy preview</label>
          <div className="rf-privacy">
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Before unlock</th>
                </tr>
              </thead>
              <tbody>
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
                  <tr key={field}>
                    <td style={{ color: 'var(--on-surface)' }}>{field}</td>
                    <td style={{ color: status === "Visible" ? 'var(--primary)' : 'var(--on-surface-variant)' }}>{status}</td>
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
      <div className="rf-fields">
        <div>
          <h2 className="rf-section-title">Review & publish</h2>
          <p className="rf-section-subtitle">Review the anonymised listing that will appear on the marketplace.</p>
        </div>

        <div className="rf-preview pikt-card">
          <h3 className="rf-preview-role">{form.role_applied_for || "Role title"}</h3>
          <p className="rf-preview-meta">
            {form.seniority_level || "Seniority"} &middot; {form.years_experience ? `${form.years_experience} yrs` : "\u2014"} &middot; {form.location_city || "City"}, {form.location_country || "Country"} &middot; {form.preferred_work_type || "Work type"}
          </p>
          <div className="rf-preview-pills">
            {form.skills.map((s) => (
              <span key={s} className="rf-preview-pill rf-preview-pill--skill">{s}</span>
            ))}
          </div>
          <div className="rf-preview-pills" style={{ marginTop: '0.5rem' }}>
            <span className="rf-preview-pill rf-preview-pill--stage">
              {form.interview_stage_reached || "Stage"}
            </span>
            <span className="rf-preview-pill rf-preview-pill--count">
              {form.interviews_completed || 0} interview{(form.interviews_completed || 0) !== 1 ? "s" : ""}
            </span>
          </div>
          {form.feedback_summary && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>{form.feedback_summary}</p>
          )}
          <div className="rf-preview-footer">
            <span><span className="rf-preview-fee">{form.fee_percentage}%</span> placement fee</span>
            <span className="rf-preview-unlock">Unlock profile</span>
          </div>
        </div>

        <div className="rf-checklist">
          {checks.map((c) => (
            <div key={c.label} className="rf-check-item">
              <span className={`rf-check-icon ${c.ok ? 'rf-check-icon--ok' : 'rf-check-icon--fail'}`}>
                {c.ok ? '\u2713' : '\u2717'}
              </span>
              <span style={{ color: c.ok ? 'var(--on-surface)' : 'var(--error)' }}>{c.label}</span>
            </div>
          ))}
        </div>

        <label className="rf-consent">
          <input type="checkbox" checked={form.consent_given} onChange={(e) => set("consent_given", e.target.checked)} />
          <span>
            This candidate has consented to being referred through pickt. Their PII will be redacted until a company unlocks their profile.
          </span>
        </label>

        {submitError && (
          <div className="rf-errors">
            <ul><li>{submitError}</li></ul>
          </div>
        )}
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────

  return (
    <div className="rf-page">
      <div className="rf-container">
        {/* Step 0: Intake method selection */}
        {step === 0 && !intakeMethod && <IntakeSelector />}
        {step === 0 && intakeMethod === 'cv' && <CvDropZone />}
        {step === 0 && intakeMethod === 'ats' && <AtsImportFlow />}

        {/* Steps 1-4: Form wizard */}
        {step >= 1 && (
          <>
            <Stepper />
            <ErrorBox />

            <div key={step}>
              {step === 1 && <Step1 />}
              {step === 2 && <Step2 />}
              {step === 3 && <Step3 />}
              {step === 4 && <Step4 />}
            </div>

            <div className="rf-nav">
              {step > 1 ? (
                <button type="button" onClick={prevStep} className="rf-btn-back press-scale">Back</button>
              ) : (
                <button type="button" onClick={() => { setStep(0); setIntakeMethod(null); }} className="rf-btn-back press-scale">
                  <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4 }}>arrow_back</span>
                  Start over
                </button>
              )}
              {step < 4 ? (
                <button type="button" onClick={nextStep} className="rf-btn-next press-scale">Continue</button>
              ) : (
                <button type="button" onClick={handlePublish} disabled={submitting} className="rf-btn-next press-scale">
                  {submitting ? "Publishing\u2026" : "Publish to marketplace"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
