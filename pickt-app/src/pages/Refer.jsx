import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ReferGate from "../components/refer/ReferGate";
import ReferralPanel from "../components/refer/ReferralPanel";
import { checkReferralStatus } from "../lib/supabaseQueries";
import { INDUSTRIES } from "../data/discoveryOptions";
import { supabase } from "../lib/supabase";
import { mapParsedDataToForm } from "../lib/cvFieldMapper";
import LocationSelect from "../components/forms/LocationSelect";
import CheckboxGroup from "../components/forms/CheckboxGroup";
import ChipPicker from "../components/forms/ChipPicker";
import InterviewNotesCard from "../components/refer/InterviewNotesCard";
import { DEVELOPMENT_GROUPS, STRENGTH_GROUPS } from "../data/feedbackOptions";
import { CARD_TEASER_LENGTH, feedbackTeaser } from "../../supabase/functions/_shared/profileShape.js";
import { upgradeReferDraft } from "../lib/referDraft";
import {
  EMPLOYMENT_TYPES, EXPERIENCE_BANDS, formatLocation, INTERVIEW_OUTCOMES, NOTICE_WEEKS_MAX, OTHER_OUTCOME, RESIDENCY_STATUSES,
  SILVER_MEDALLIST, VISA_STATUSES, WORK_PREFERENCES,
} from "../../supabase/functions/_shared/candidateFields.js";
import '../components/refer/InterviewNotesCard.css';
import './Refer.css';

// ── Constants ────────────────────────────────────────────────

const SENIORITY = ["Junior", "Mid", "Senior", "Lead", "Head of", "VP", "C-suite"];
const STAGES = ["1st round", "2nd round", "3rd round", "Final round"];
const RECOMMENDATIONS = ["Strong hire", "Hire", "Maybe"];
const STEP_LABELS = ["Role & experience", "Interview feedback", "CV & documents", "Review & publish"];
const STORAGE_KEY = "pickt_refer_draft";

// ── Initial state ───────────────────────────────────────────

const INITIAL = {
  industry: "",
  role_applied_for: "",
  seniority_level: "",
  experience_band: "",
  location_country: "Australia",
  location_country_code: "AU",
  location_state: "",
  location_state_code: "",
  location_city: "",
  residency_status: "",
  visa_type: "",
  preferred_work_types: [],
  willing_to_relocate: false,
  employment_types: [],
  notice_period_weeks: "",
  available_from: "",
  salary_expectation_min: "",
  salary_expectation_max: "",
  skills: [],
  interview_stage_reached: "",
  outcome: "",
  outcome_other: "",
  strengths_list: [],
  development_areas: [],
  note_impressed: "",
  note_why_not_offer: "",
  note_best_fit: "",
  recommendation: "",
  skill_ratings: [],
  cv: null,
  cover_letter: null,
  additional_docs: [],
  linkedin_url: "",
  portfolio_url: "",
  current_employer: "",
  current_job_title: "",
  full_name: "",
  email: "",
  mobile_number: "",
  consent_given: false,
};

function reducer(state, action) {
  switch (action.type) {
    case "SET":
      return { ...state, [action.field]: action.value };
    case "MERGE":
      return { ...state, ...action.values };
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
  const [searchParams] = useSearchParams();
  const [form, dispatch] = useReducer(reducer, INITIAL);
  // The email + mobile check has to pass before the form opens
  const [gatePassed, setGatePassed] = useState(false);
  // Fresh referral status for the Review step, in case the details changed
  const [reviewStatus, setReviewStatus] = useState(null);
  const [step, setStep] = useState(0);
  const [intakeMethod, setIntakeMethod] = useState(null); // null | 'cv' | 'ats' | 'manual'
  const [errors, setErrors] = useState([]);
  const [skillInput, setSkillInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  // Set when the candidate was already on Pickt and this referral was added to their profile
  const [mergedResult, setMergedResult] = useState(null);
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
        dispatch({ type: "RESTORE", state: upgradeReferDraft(parsed, INITIAL) });
        if (hasData) {
          setGatePassed(true);
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

  // 30s timeout for storage uploads — Supabase JS hangs silently on missing
  // buckets, so we surface that as a visible error instead of stranding the user
  function withUploadTimeout(promise) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Upload timed out — check that the candidate-documents bucket exists in Supabase")),
          30_000
        )
      ),
    ]);
  }

  // Each user's uploads go in their own folder: uploads/<user id>/<file>
  async function ownUploadPath(file) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("Please log in to upload documents.");
    const safeName = file.name.replace(/[^\w.-]+/g, "_");
    return `uploads/${session.user.id}/${Date.now()}_${safeName}`;
  }

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

    const { data, error } = await ownUploadPath(file)
      .then((path) => withUploadTimeout(
        supabase.storage.from("candidate-documents").upload(path, file, { upsert: false })
      ))
      .catch((err) => ({ data: null, error: err }));

    if (error) {
      console.error('[Refer] CV upload failed:', error)
      setErrors([`Upload failed: ${error.message}`]);
      if (field !== "additional_docs") set(field, null);
      return;
    }

    const done = {
      url: data.path,
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
      if (!form.role_applied_for) errs.push("Current role title is required.");
      if (!form.seniority_level) errs.push("Seniority level is required.");
      if (!form.location_country) errs.push("Country is required.");
      if (!form.location_city) errs.push("City is required.");
      if (VISA_STATUSES.includes(form.residency_status) && !form.visa_type.trim()) errs.push("Visa type is required.");
      if (form.preferred_work_types.length === 0) errs.push("Choose at least one work preference.");
      if (form.employment_types.length === 0) errs.push("Choose at least one employment type.");
      if (form.notice_period_weeks !== "" && !(Number.isInteger(Number(form.notice_period_weeks)) && Number(form.notice_period_weeks) >= 0 && Number(form.notice_period_weeks) <= NOTICE_WEEKS_MAX))
        errs.push(`Notice period must be a whole number of weeks from 0 to ${NOTICE_WEEKS_MAX}.`);
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
      if (!form.outcome) errs.push("Interview outcome is required.");
      if (form.outcome === OTHER_OUTCOME && !form.outcome_other.trim()) errs.push("Please describe the outcome.");
      if (form.strengths_list.length === 0) errs.push("Add at least one key strength.");
      if (form.development_areas.length === 0) errs.push("Add at least one development area.");
      if (!form.note_impressed.trim()) errs.push("Answer 'What impressed you most?'.");
      if (!form.note_why_not_offer.trim()) errs.push("Answer 'Why didn't they get the offer?'.");
      if (!form.recommendation) errs.push("Recommendation is required.");
    }
    if (s === 3) {
      if (!form.cv) errs.push("CV upload is required.");
      if (!form.email.trim() || !form.mobile_number.trim())
        errs.push("Add the candidate's email and mobile number — it's how we recognise candidates already on Pickt.");
      if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        errs.push("Enter a valid candidate email.");
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

  // Review step: re-check using the details as they are now
  useEffect(() => {
    if (step !== 4) return;
    let cancelled = false;
    setReviewStatus(null);
    checkReferralStatus({ email: form.email.trim(), mobile: form.mobile_number.trim() })
      .then((status) => { if (!cancelled) setReviewStatus(status); })
      .catch(() => { /* the server still enforces the rules when publishing */ });
    return () => { cancelled = true; };
  }, [step, form.email, form.mobile_number]);

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
      experience_band: form.experience_band || null,
      location_city: form.location_city,
      location_state: form.location_state || null,
      location_state_code: form.location_state_code || null,
      location_country: form.location_country,
      location_country_code: form.location_country_code || null,
      residency_status: form.residency_status || null,
      visa_type: VISA_STATUSES.includes(form.residency_status) ? form.visa_type.trim() : null,
      preferred_work_types: form.preferred_work_types,
      willing_to_relocate: form.willing_to_relocate,
      employment_types: form.employment_types,
      notice_period_weeks: form.notice_period_weeks === "" ? null : Number(form.notice_period_weeks),
      available_from: form.available_from || null,
      salary_expectation_min: form.salary_expectation_min || null,
      salary_expectation_max: form.salary_expectation_max || null,
      skills: form.skills,
      interview_stage_reached: form.interview_stage_reached,
      interviews_completed: form.interviews_completed || 0,
      outcome: form.outcome,
      outcome_other: form.outcome === OTHER_OUTCOME ? form.outcome_other.trim() : null,
      strengths_list: form.strengths_list,
      development_areas: form.development_areas,
      note_impressed: form.note_impressed.trim(),
      note_why_not_offer: form.note_why_not_offer.trim(),
      note_best_fit: form.note_best_fit.trim() || null,
      recommendation: form.recommendation,
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
      full_name: form.full_name.trim() || null,
      email: form.email.trim() || null,
      mobile_number: form.mobile_number || null,
      consent_given: form.consent_given,
    };

    try {
      const { data, error } = await supabase.functions.invoke("create-candidate", {
        body,
      });
      if (error) {
        let message = error.message || "Failed to publish";
        try {
          const errBody = await error.context?.json?.();
          if (errBody?.error) message = errBody.error;
        } catch { /* keep generic message */ }
        console.error('[Refer] create-candidate failed:', message, error);
        throw new Error(message);
      }

      localStorage.removeItem(STORAGE_KEY);
      // Already on Pickt: tell the referrer their interview was added
      if (data?.merged) {
        setMergedResult({ rate: data.referrerRate });
        setSubmitting(false);
        return;
      }
      window.location.href = "/my-candidates";
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

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

    try {
      const storagePath = await ownUploadPath(file);

      const { data: uploadData, error: uploadError } = await withUploadTimeout(
        supabase.storage.from("candidate-documents").upload(storagePath, file, { upsert: false })
      );

      if (uploadError) throw new Error(uploadError.message);

      // Set CV on form so it's pre-attached in Step 3
      set("cv", { url: uploadData.path, filename: file.name, uploading: false, progress: 100 });

      setCvUploading(false);
      setCvParsing(true);

      // Call parse-cv edge function
      const { data: parseResult, error: parseError } = await supabase.functions.invoke("parse-cv", {
        body: { storagePath, filename: file.name },
      });

      if (parseError) throw new Error(parseError.message);

      if (parseResult?.parsed) {
        const mapped = mapParsedDataToForm(parseResult.parsed, { ...INITIAL, cv: { url: uploadData.path, filename: file.name, uploading: false, progress: 100 } });
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
            <label className="rf-label" htmlFor="rf-role">Current Role Title *</label>
            <input id="rf-role" className="rf-input" placeholder="e.g. Senior Frontend Engineer" value={form.role_applied_for} onChange={(e) => set("role_applied_for", e.target.value)} />
          </div>
          <div>
            <label className="rf-label">Seniority level *</label>
            <select className="rf-select" value={form.seniority_level} onChange={(e) => set("seniority_level", e.target.value)}>
              <option value="">Select level</option>
              {SENIORITY.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="rf-label" htmlFor="rf-experience">Years of experience</label>
            <select id="rf-experience" className="rf-select" value={form.experience_band} onChange={(e) => set("experience_band", e.target.value)}>
              <option value="">Select experience</option>
              {EXPERIENCE_BANDS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
        </div>

        <LocationSelect
          required
          value={{
            countryCode: form.location_country_code,
            country: form.location_country,
            stateCode: form.location_state_code,
            state: form.location_state,
            city: form.location_city,
          }}
          onChange={(l) => dispatch({
            type: "MERGE",
            values: {
              location_country_code: l.countryCode,
              location_country: l.country,
              location_state_code: l.stateCode,
              location_state: l.state,
              location_city: l.city,
            },
          })}
        />

        <div className="rf-row">
          <div>
            <label className="rf-label" htmlFor="rf-residency">Residency status</label>
            <select
              id="rf-residency"
              className="rf-select"
              value={form.residency_status}
              onChange={(e) => {
                const status = e.target.value;
                // Leaving a visa status clears the visa type
                dispatch({ type: "MERGE", values: { residency_status: status, ...(VISA_STATUSES.includes(status) ? {} : { visa_type: "" }) } });
              }}
            >
              <option value="">Select status</option>
              {RESIDENCY_STATUSES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          {/* The live region stays on the page so screen readers announce the change */}
          <div aria-live="polite" aria-atomic="false">
            {VISA_STATUSES.includes(form.residency_status) && (
              <>
                <label className="rf-label" htmlFor="rf-visa-type">Visa type *</label>
                <input
                  id="rf-visa-type"
                  className="rf-input"
                  required
                  aria-required="true"
                  aria-describedby="rf-visa-hint"
                  placeholder="e.g. Subclass 482"
                  value={form.visa_type}
                  onChange={(e) => set("visa_type", e.target.value)}
                />
                <p id="rf-visa-hint" style={{ marginTop: '0.375rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  Only shown to employers after they unlock this profile.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="rf-row">
          <CheckboxGroup
            label="Work preferences"
            required
            options={WORK_PREFERENCES}
            value={form.preferred_work_types}
            onChange={(v) => set("preferred_work_types", v)}
          />
          <CheckboxGroup
            label="Employment type"
            required
            options={EMPLOYMENT_TYPES}
            value={form.employment_types}
            onChange={(v) => set("employment_types", v)}
          />
        </div>

        <div className="rf-row rf-row--3">
          <div>
            <label className="rf-label" htmlFor="rf-notice">Notice period (weeks)</label>
            <input id="rf-notice" className="rf-input" type="number" min={0} max={NOTICE_WEEKS_MAX} step={1} placeholder="e.g. 4" value={form.notice_period_weeks} onChange={(e) => set("notice_period_weeks", e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div>
            <label className="rf-label" htmlFor="rf-available">Available from</label>
            <input id="rf-available" className="rf-input" type="date" value={form.available_from} onChange={(e) => set("available_from", e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.25rem' }}>
            <label className="rf-checkbox-label">
              <input type="checkbox" checked={form.willing_to_relocate} onChange={(e) => set("willing_to_relocate", e.target.checked)} />
              Willing to relocate
            </label>
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
              <button key={s} type="button" onClick={() => set("interview_stage_reached", s)} className={`rf-card-option ${form.interview_stage_reached === s ? 'rf-card-option--active' : ''}`}>
                {s}
              </button>
            ))}
          </div>
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

        <div className="rf-row">
          <div>
            <label className="rf-label" htmlFor="rf-outcome">Interview outcome *</label>
            <select
              id="rf-outcome"
              className="rf-select"
              aria-required="true"
              aria-describedby="rf-outcome-hint"
              value={form.outcome}
              onChange={(e) => {
                const outcome = e.target.value;
                // Choosing anything else clears the description
                dispatch({ type: "MERGE", values: { outcome, ...(outcome === OTHER_OUTCOME ? {} : { outcome_other: "" }) } });
              }}
            >
              <option value="">Select outcome</option>
              {INTERVIEW_OUTCOMES.map((r) => <option key={r}>{r}</option>)}
            </select>
            <p id="rf-outcome-hint" style={{ marginTop: '0.375rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              {SILVER_MEDALLIST}: Runner-up – reached the final stage but another candidate was chosen
            </p>
          </div>
          {/* The live region stays on the page so screen readers announce the change */}
          <div aria-live="polite">
            {form.outcome === OTHER_OUTCOME && (
              <>
                <label className="rf-label" htmlFor="rf-outcome-other">Please describe the outcome *</label>
                <input id="rf-outcome-other" className="rf-input" required aria-required="true" value={form.outcome_other} onChange={(e) => set("outcome_other", e.target.value)} />
              </>
            )}
          </div>
        </div>

        <ChipPicker
          label="Key strengths"
          required
          groups={STRENGTH_GROUPS}
          value={form.strengths_list}
          onChange={(v) => set("strengths_list", v)}
          placeholder="Search strengths, or type your own"
        />

        <ChipPicker
          label="Development areas"
          required
          groups={DEVELOPMENT_GROUPS}
          value={form.development_areas}
          onChange={(v) => set("development_areas", v)}
          placeholder="Search development areas, or type your own"
        />

        <InterviewNotesCard values={form} onChange={set} />

        <div>
          <label className="rf-label">Your recommendation *</label>
          <div className="rf-card-grid rf-card-grid--3">
            {RECOMMENDATIONS.map((r) => (
              <button key={r} type="button" aria-pressed={form.recommendation === r} onClick={() => set("recommendation", r)} className={`rf-card-option ${form.recommendation === r ? 'rf-card-option--active' : ''}`}>
                {r}
              </button>
            ))}
          </div>
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
          <h2 className="rf-section-title">CV & documents</h2>
          <p className="rf-section-subtitle">Upload their CV and supporting documents.</p>
        </div>

        {ErrorBox()}

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
            <div className="rf-uploaded" style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--surface-container)' }}>
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

        <div className="rf-row">
          <div>
            <label className="rf-label" htmlFor="rf-full-name">Candidate full name</label>
            <input id="rf-full-name" className="rf-input" placeholder="First and last name" autoComplete="off" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </div>
          <div>
            <label className="rf-label" htmlFor="rf-email">Candidate email</label>
            <input id="rf-email" type="email" className="rf-input" placeholder="name@example.com" autoComplete="off" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="rf-label" htmlFor="rf-mobile">Mobile number</label>
          <input id="rf-mobile" className="rf-input" style={{ maxWidth: 300 }} placeholder="+61 4XX XXX XXX" value={form.mobile_number} onChange={(e) => set("mobile_number", e.target.value)} />
          <p style={{ marginTop: '0.375rem', fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
            Email and mobile are both required. If this candidate is already on Pickt, your interview is added to their profile.
          </p>
        </div>

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
      { label: "Feedback provided", ok: form.strengths_list.length > 0 && form.development_areas.length > 0 && !!form.note_impressed.trim() && !!form.note_why_not_offer.trim() },
      { label: "CV uploaded", ok: !!form.cv?.url },
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
            {[form.seniority_level || "Seniority", form.experience_band, formatLocation({ city: form.location_city, stateCode: form.location_state_code, state: form.location_state, country: form.location_country }), [...form.preferred_work_types].sort().join(" \u00B7 ")].filter(Boolean).join(" \u00B7 ")}
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
          </div>
          <div className="rf-preview-footer">
            <span>Marketplace preview</span>
            <span className="rf-preview-unlock">Unlock profile</span>
          </div>
        </div>

        {!mergedResult && (
          <ReferralPanel
            status={reviewStatus}
            salaryLow={reviewStatus?.salaryLow ?? form.salary_expectation_min}
            salaryHigh={reviewStatus?.salaryHigh ?? form.salary_expectation_max}
          />
        )}

        <section className="in-review" aria-labelledby="rf-review-feedback">
          <h3 className="in-review-title" id="rf-review-feedback">Your interview feedback</h3>
          <p className="in-review-q">Interview outcome</p>
          <p className="in-review-a">{form.outcome === OTHER_OUTCOME ? (form.outcome_other || OTHER_OUTCOME) : (form.outcome || "\u2014")}</p>
          <p className="in-review-q">Key strengths</p>
          <p className="in-review-a">{form.strengths_list.join(", ") || "\u2014"}</p>
          <p className="in-review-q">Development areas</p>
          <p className="in-review-a">{form.development_areas.join(", ") || "\u2014"}</p>
          <p className="in-review-q">What impressed you most?</p>
          <p className="in-review-a">{form.note_impressed || "\u2014"}</p>
          {form.note_impressed.trim() && (
            <p className="in-review-preview">Preview shown on the card: "{feedbackTeaser(form.note_impressed, CARD_TEASER_LENGTH)}"</p>
          )}
          <p className="in-review-q">Why didn't they get the offer?</p>
          <p className="in-review-a">{form.note_why_not_offer || "\u2014"}</p>
          <p className="in-review-q">What kind of role or team would suit them best?</p>
          <p className="in-review-a">{form.note_best_fit || "\u2014"}</p>
        </section>

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

        {mergedResult && (
          <div role="status" style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', background: 'var(--color-success-tint)', color: 'var(--color-success)', border: '1px solid var(--color-success)' }}>
            <p style={{ fontWeight: 800, margin: 0 }}>This candidate is already on Pickt</p>
            <p style={{ margin: '0.25rem 0 0.75rem' }}>
              Your interview has been added to their profile.
              {mergedResult.rate != null && ` You'll earn ${mergedResult.rate}% of their first-year salary if they're hired.`}
            </p>
            <a href="/my-candidates" style={{ fontWeight: 700, color: 'var(--color-success)', textDecoration: 'underline' }}>Go to my candidates</a>
          </div>
        )}
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────
  // These are called as plain functions, not used as <Step1 /> components: they're
  // defined inside this one, so as components they'd be rebuilt on every keystroke
  // and the input being typed in would lose focus.

  return (
    <div className="rf-page">
      <div className="rf-container">
        {/* Step 0: Intake method selection */}
        {step === 0 && !gatePassed && (
          <ReferGate
            candidateId={searchParams.get("candidate") || undefined}
            initialEmail={form.email}
            initialMobile={form.mobile_number}
            onContinue={({ email, mobile }) => {
              set("email", email);
              set("mobile_number", mobile);
              setGatePassed(true);
            }}
          />
        )}
        {step === 0 && gatePassed && !intakeMethod && IntakeSelector()}
        {step === 0 && intakeMethod === 'cv' && CvDropZone()}
        {step === 0 && intakeMethod === 'ats' && AtsImportFlow()}

        {/* Steps 1-4: Form wizard */}
        {step >= 1 && (
          <>
            {Stepper()}
            {ErrorBox()}

            <div key={step}>
              {step === 1 && Step1()}
              {step === 2 && Step2()}
              {step === 3 && Step3()}
              {step === 4 && Step4()}
            </div>

            <div className="rf-nav">
              {step > 1 ? (
                <button type="button" onClick={prevStep} className="rf-btn-back press-scale">Back</button>
              ) : (
                <button type="button" onClick={() => { setStep(0); setIntakeMethod(null); setGatePassed(false); }} className="rf-btn-back press-scale">
                  <span className="material-symbols-outlined" style={{ fontSize: 16, marginRight: 4 }}>arrow_back</span>
                  Start over
                </button>
              )}
              {step < 4 ? (
                <button type="button" onClick={nextStep} className="rf-btn-next press-scale">Continue</button>
              ) : (
                <button type="button" onClick={handlePublish} disabled={submitting || ["full", "hired", "yours"].includes(reviewStatus?.state)} className="rf-btn-next press-scale">
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
