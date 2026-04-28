import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { extractTextFromFile } from '../lib/extractText'
import { useScrollReveal } from '../hooks/useScrollReveal'
import './MarketplaceUpload.css'

const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt']
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

export default function MarketplaceUpload() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const headerRef = useScrollReveal()

  const [file, setFile] = useState(null)
  const [pastedText, setPastedText] = useState('')
  const [stage, setStage] = useState('idle') // 'idle' | 'extracting' | 'parsing' | 'error'
  const [error, setError] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFileSelected(f) {
    setError(null)
    if (!f) return
    const lower = f.name.toLowerCase()
    if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      setError(`Unsupported file type. Use ${ACCEPTED_EXTENSIONS.join(', ')}.`)
      return
    }
    if (f.size > MAX_FILE_BYTES) {
      setError('File is larger than 10 MB.')
      return
    }
    setFile(f)
    setPastedText('')
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFileSelected(f)
  }

  async function handleSubmit(e) {
    e?.preventDefault?.()
    setError(null)

    let text = pastedText.trim()
    try {
      if (file) {
        setStage('extracting')
        text = await extractTextFromFile(file)
      }
      if (!text || text.length < 30) {
        setStage('error')
        setError('Job description is too short — paste at least a few sentences or upload a longer document.')
        return
      }

      setStage('parsing')
      const { data, error: fnError } = await supabase.functions.invoke('parse-jd', {
        body: { text },
      })
      if (fnError) {
        let message = fnError.message
        try {
          const body = await fnError.context?.json?.()
          if (body?.error) message = body.error
        } catch { /* ignore */ }
        throw new Error(message)
      }

      navigate('/marketplace/matches', {
        state: { parsed: data.parsed, candidates: data.candidates, totalConsidered: data.total_considered },
      })
    } catch (err) {
      setStage('error')
      setError(err.message || 'Something went wrong. Please try again.')
    }
  }

  const submitDisabled = (!file && pastedText.trim().length < 30) || stage === 'extracting' || stage === 'parsing'

  return (
    <div className="up-page">
      <button className="up-back-link press-scale" onClick={() => navigate('/marketplace')}>
        <span className="material-symbols-outlined">arrow_back</span>
        Back
      </button>

      <div className="up-header" ref={headerRef}>
        <h1 className="up-heading">Upload a job description</h1>
        <p className="up-subheading">
          Drop a PDF, DOCX, or paste the spec. We&rsquo;ll use AI to extract the role, seniority, skills, and other criteria, then surface the best-matching candidates from the network.
        </p>
      </div>

      <form className="up-card" onSubmit={handleSubmit}>
        <div
          className={`up-dropzone ${dragOver ? 'up-dropzone--over' : ''} ${file ? 'up-dropzone--filled' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={(e) => handleFileSelected(e.target.files?.[0])}
            style={{ display: 'none' }}
          />
          {file ? (
            <div className="up-file-pill">
              <span className="material-symbols-outlined">description</span>
              <div className="up-file-meta">
                <div className="up-file-name">{file.name}</div>
                <div className="up-file-size">{(file.size / 1024).toFixed(0)} KB</div>
              </div>
              <button
                type="button"
                className="up-file-remove"
                onClick={(e) => { e.stopPropagation(); setFile(null) }}
                aria-label="Remove file"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          ) : (
            <>
              <div className="up-dropzone-icon">
                <span className="material-symbols-outlined">cloud_upload</span>
              </div>
              <div className="up-dropzone-title">Drop a file or click to browse</div>
              <div className="up-dropzone-hint">Accepts PDF, DOCX, or TXT &middot; up to 10 MB</div>
            </>
          )}
        </div>

        <div className="up-divider"><span>or paste the job description</span></div>

        <textarea
          className="up-textarea"
          placeholder="Paste the job description here..."
          rows={10}
          value={pastedText}
          onChange={(e) => { setPastedText(e.target.value); if (file) setFile(null) }}
          disabled={!!file}
        />

        {error && <div className="up-error">{error}</div>}

        <button
          type="submit"
          className="up-submit press-scale"
          disabled={submitDisabled}
        >
          {stage === 'extracting' && (<><span className="up-spinner" /> Reading file...</>)}
          {stage === 'parsing' && (<><span className="up-spinner" /> Matching candidates...</>)}
          {(stage === 'idle' || stage === 'error') && (<>
            <span className="material-symbols-outlined">auto_awesome</span>
            Find matching candidates
          </>)}
        </button>
      </form>
    </div>
  )
}
