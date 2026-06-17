import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Upload, FileText, Video, Link2, X } from 'lucide-react';
import { cn } from '../lib/cn';
import { getCRMApplication, updateCRMApplication } from '../services/crmApplications';
import { savePitchVideo, loadPitchVideoUrl, deletePitchVideo } from '../lib/pitchVideoStore';

// ─── Options ──────────────────────────────────────────────────────────────────

const INDUSTRY_OPTIONS = [
  { value: 'FinTech',                  label: 'FinTech' },
  { value: 'HealthTech',               label: 'HealthTech' },
  { value: 'SaaS',                     label: 'SaaS' },
  { value: 'EdTech',                   label: 'EdTech' },
  { value: 'CleanTech',                label: 'CleanTech' },
  { value: 'AI/ML',                    label: 'AI / ML' },
  { value: 'E-Commerce',               label: 'E-Commerce' },
  { value: 'Cybersecurity',            label: 'Cybersecurity' },
  { value: 'AgriTech',                 label: 'AgriTech' },
  { value: 'Data & Analytics',         label: 'Data & Analytics' },
  { value: 'Mental Health Tech',       label: 'Mental Health Tech' },
  { value: 'BioTech / Pharma',         label: 'BioTech / Pharma' },
  { value: 'Construction Tech',        label: 'Construction Tech' },
  { value: 'Logistics & Supply Chain', label: 'Logistics & Supply Chain' },
  { value: 'Developer Tools',          label: 'Developer Tools' },
  { value: 'Retail Tech',              label: 'Retail Tech' },
  { value: 'Artificial Intelligence',  label: 'Artificial Intelligence' },
  { value: 'Other',                    label: 'Other' },
];

const COMPANY_STAGE_OPTIONS = [
  { value: 'pre-seed', label: 'Pre-Seed' },
  { value: 'seed',     label: 'Seed' },
  { value: 'series-a', label: 'Series A' },
  { value: 'series-b', label: 'Series B' },
  { value: 'series-c', label: 'Series C' },
];

const PIPELINE_STAGE_OPTIONS = [
  { value: 'New',               label: 'New' },
  { value: 'Under Review',      label: 'Under Review' },
  { value: 'Meeting Scheduled', label: 'Meeting Scheduled' },
  { value: 'Due Diligence',     label: 'Due Diligence' },
  { value: 'IC Review',         label: 'IC Review' },
  { value: 'Rejected',          label: 'Rejected' },
];

// ─── Shared styles ─────────────────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
      {label}{required && <span className="text-red-400 ml-0.5 normal-case"> *</span>}
    </label>
  );
}

// ─── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  logo: string;
  companyName: string;
  website: string;
  location: string;
  industry: string;
  companyStage: string;
  foundedYear: string;
  teamSize: string;
  companyDescription: string;
  fundingAsk: string;
  previousFunding: string;
  useOfFunds: string;
  pitchDeckName: string;
  pitchVideoUrl: string;
  founderName: string;
  founderEmail: string;
  founderPhone: string;
  founderLinkedin: string;
  founderBio: string;
  pipelineStage: string;
}

const EMPTY: FormState = {
  logo: '', companyName: '', website: '', location: '', industry: '',
  companyStage: '', foundedYear: '', teamSize: '', companyDescription: '',
  fundingAsk: '', previousFunding: '', useOfFunds: '',
  pitchDeckName: '', pitchVideoUrl: '',
  founderName: '', founderEmail: '', founderPhone: '', founderLinkedin: '', founderBio: '',
  pipelineStage: 'New',
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function EditApplication() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [form, setForm]       = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [videoTab, setVideoTab]         = useState<'url' | 'upload'>('url');
  const [pitchVideoFile, setPitchVideoFile]       = useState<File | null>(null);
  const [pitchVideoPreview, setPitchVideoPreview] = useState('');

  const logoRef       = useRef<HTMLInputElement>(null);
  const pitchDeckRef  = useRef<HTMLInputElement>(null);
  const pitchVideoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    getCRMApplication(id)
      .then(app => {
        if (!app) { setError('Application not found'); setLoading(false); return; }
        // Load any locally-uploaded pitch video from IndexedDB
        const localVideoUrl = await loadPitchVideoUrl(id!);
        setForm({
          logo:               localStorage.getItem(`lp_applogo_${id}`) || '',
          companyName:        app.companyName,
          website:            app.website,
          location:           app.location,
          industry:           app.industry,
          companyStage:       '',
          foundedYear:        app.foundedYear,
          teamSize:           app.teamSize,
          companyDescription: app.companyDescription,
          fundingAsk:         app.fundingAsk,
          previousFunding:    app.previousFunding,
          useOfFunds:         app.useOfFunds,
          pitchDeckName:      '',
          pitchVideoUrl:      localVideoUrl ? '' : (app.pitchVideoUrl || ''),
          founderName:        app.founderName,
          founderEmail:       app.founderEmail,
          founderPhone:       app.founderPhone,
          founderLinkedin:    app.founderLinkedin,
          founderBio:         '',
          pipelineStage:      app.pipelineStage || 'New',
        });
        if (localVideoUrl) {
          setPitchVideoPreview(localVideoUrl);
          setVideoTab('upload');
        }
        setLoading(false);
      })
      .catch(err => { setError(err instanceof Error ? err.message : 'Failed to load'); setLoading(false); });
  }, [id]);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(p => ({ ...p, logo: ev.target?.result as string }));
    reader.readAsDataURL(file);
  }

  function handlePitchDeck(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setForm(p => ({ ...p, pitchDeckName: file.name }));
  }

  function handlePitchVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (pitchVideoPreview) URL.revokeObjectURL(pitchVideoPreview);
    const objectUrl = URL.createObjectURL(file);
    setPitchVideoFile(file);
    setPitchVideoPreview(objectUrl);
    setForm(p => ({ ...p, pitchVideoUrl: '' }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) { setError('Company name is required.'); return; }
    if (!form.founderName.trim()) { setError('Founder name is required.'); return; }
    setError('');
    setSaving(true);
    try {
      await updateCRMApplication(id!, {
        companyName:        form.companyName,
        industry:           form.industry,
        website:            form.website,
        fundingAsk:         form.fundingAsk,
        useOfFunds:         form.useOfFunds,
        previousFunding:    form.previousFunding,
        companyDescription: form.companyDescription,
        founderName:        form.founderName,
        founderEmail:       form.founderEmail,
        founderPhone:       form.founderPhone,
        founderLinkedin:    form.founderLinkedin,
        pipelineStage:      form.pipelineStage,
        location:           form.location,
        teamSize:           form.teamSize,
        foundedYear:        form.foundedYear,
        pitchVideoUrl:      form.pitchVideoUrl,
      });
      // Persist local-only fields
      if (id) {
        if (form.logo) localStorage.setItem(`lp_applogo_${id}`, form.logo);
        if (pitchVideoFile) {
          await savePitchVideo(id, pitchVideoFile);
        } else if (form.pitchVideoUrl) {
          // User switched to URL mode — remove any stored blob
          await deletePitchVideo(id);
        }
      }
      navigate(`/applications/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-4 bg-gray-100 rounded w-32" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    </div>
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-3xl mx-auto">

        <Link to={`/applications/${id}`}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors mb-6">
          <ArrowLeft size={15} /> Back to Application
        </Link>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Edit Application</h1>
          <p className="text-sm text-gray-400 mt-0.5">Update the application details below</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Company Info ── */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Company Information</h2>

            {/* Logo */}
            <div>
              <FieldLabel label="Company Logo" />
              <button type="button" onClick={() => logoRef.current?.click()}
                className={cn('w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-all overflow-hidden', form.logo ? 'border-solid p-0' : 'gap-1')}>
                {form.logo
                  ? <img src={form.logo} alt="Logo" className="w-full h-full object-cover" />
                  : <><Upload className="w-5 h-5 text-gray-400" /><span className="text-xs text-gray-400 text-center leading-tight px-1">Upload logo</span></>}
              </button>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel label="Company Name" required />
                <input type="text" value={form.companyName} onChange={set('companyName')} placeholder="Acme Inc." className={inputCls} />
              </div>
              <div>
                <FieldLabel label="Website" />
                <input type="url" value={form.website} onChange={set('website')} placeholder="https://acme.com" className={inputCls} />
              </div>
              <div>
                <FieldLabel label="Location" />
                <input type="text" value={form.location} onChange={set('location')} placeholder="San Francisco, CA" className={inputCls} />
              </div>
              <div>
                <FieldLabel label="Industry" />
                <select value={form.industry} onChange={set('industry')} className={inputCls + ' appearance-none'}>
                  <option value="">Select industry</option>
                  {INDUSTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel label="Company Stage" />
                <select value={form.companyStage} onChange={set('companyStage')} className={inputCls + ' appearance-none'}>
                  <option value="">Select stage</option>
                  {COMPANY_STAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel label="Founded Year" />
                <input type="number" value={form.foundedYear} onChange={set('foundedYear')} placeholder="2021" className={inputCls} />
              </div>
              <div>
                <FieldLabel label="Team Size" />
                <input type="number" value={form.teamSize} onChange={set('teamSize')} placeholder="10" className={inputCls} />
              </div>
            </div>

            <div>
              <FieldLabel label="Company Description" />
              <textarea rows={4} value={form.companyDescription} onChange={set('companyDescription')}
                placeholder="Describe the company, mission, and market…" className={inputCls + ' resize-none'} />
            </div>
          </div>

          {/* ── Funding ── */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Funding Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel label="Funding Ask ($)" />
                <input type="number" value={form.fundingAsk} onChange={set('fundingAsk')} placeholder="500000" className={inputCls} />
              </div>
              <div>
                <FieldLabel label="Previous Funding ($)" />
                <input type="number" value={form.previousFunding} onChange={set('previousFunding')} placeholder="0" className={inputCls} />
              </div>
            </div>
            <div>
              <FieldLabel label="Use of Funds" />
              <textarea rows={3} value={form.useOfFunds} onChange={set('useOfFunds')}
                placeholder="How will the funding be used?" className={inputCls + ' resize-none'} />
            </div>

            {/* Pitch Deck */}
            <div>
              <FieldLabel label="Pitch Deck (PDF)" />
              <button type="button" onClick={() => pitchDeckRef.current?.click()}
                className={cn('w-full border-2 border-dashed border-gray-200 rounded-xl px-4 py-5 flex flex-col items-center gap-2 hover:border-gray-400 hover:bg-gray-50 transition-all')}>
                <FileText className="w-7 h-7 text-gray-400" />
                {form.pitchDeckName
                  ? <span className="text-sm text-gray-700 font-medium">{form.pitchDeckName}</span>
                  : <><span className="text-sm font-medium text-gray-700">Click to upload PDF</span><span className="text-xs text-gray-400">PDF up to 50 MB</span></>}
              </button>
              <input ref={pitchDeckRef} type="file" accept=".pdf" className="hidden" onChange={handlePitchDeck} />
            </div>

            {/* Pitch Video */}
            <div>
              <FieldLabel label="Pitch Video" />

              {/* Tab toggle */}
              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-3">
                <button type="button"
                  onClick={() => { setVideoTab('url'); setForm(p => ({ ...p, pitchVideoData: '' })); }}
                  className={cn('flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all', videoTab === 'url' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                  <Link2 size={12} /> Video URL
                </button>
                <button type="button"
                  onClick={() => { setVideoTab('upload'); setForm(p => ({ ...p, pitchVideoUrl: '' })); }}
                  className={cn('flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all', videoTab === 'upload' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                  <Upload size={12} /> Upload File
                </button>
              </div>

              {videoTab === 'url' ? (
                <div>
                  <div className="relative">
                    <Video size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="url" value={form.pitchVideoUrl}
                      onChange={e => setForm(p => ({ ...p, pitchVideoUrl: e.target.value }))}
                      placeholder="https://youtube.com/watch?v=... or Vimeo / Loom link"
                      className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">Supports YouTube, Vimeo, Loom, or any direct .mp4 URL</p>
                </div>
              ) : (
                <div>
                  {pitchVideoPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-black">
                      <video src={pitchVideoPreview} controls className="w-full max-h-48 object-contain" />
                      <button type="button"
                        onClick={() => { URL.revokeObjectURL(pitchVideoPreview); setPitchVideoFile(null); setPitchVideoPreview(''); }}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors">
                        <X size={13} className="text-white" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => pitchVideoRef.current?.click()}
                      className={cn('w-full border-2 border-dashed border-gray-200 rounded-xl px-4 py-6 flex flex-col items-center gap-2 hover:border-gray-400 hover:bg-gray-50 transition-all')}>
                      <Video className="w-7 h-7 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">Click to upload video</span>
                      <span className="text-xs text-gray-400">MP4, MOV, WebM — max 100 MB</span>
                    </button>
                  )}
                  <input ref={pitchVideoRef} type="file" accept="video/*" className="hidden" onChange={handlePitchVideoUpload} />
                </div>
              )}
            </div>
          </div>

          {/* ── Pipeline Stage ── */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Pipeline Stage</h2>
            <div>
              <FieldLabel label="Current Stage" />
              <select value={form.pipelineStage} onChange={set('pipelineStage')} className={inputCls + ' appearance-none'}>
                {PIPELINE_STAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* ── Founder ── */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Founder Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel label="Founder Name" required />
                <input type="text" value={form.founderName} onChange={set('founderName')} placeholder="Jane Doe" className={inputCls} />
              </div>
              <div>
                <FieldLabel label="Founder Email" />
                <input type="email" value={form.founderEmail} onChange={set('founderEmail')} placeholder="jane@acme.com" className={inputCls} />
              </div>
              <div>
                <FieldLabel label="Founder Phone" />
                <input type="tel" value={form.founderPhone} onChange={set('founderPhone')} placeholder="+1 555 000 0000" className={inputCls} />
              </div>
              <div>
                <FieldLabel label="Founder LinkedIn" />
                <input type="url" value={form.founderLinkedin} onChange={set('founderLinkedin')} placeholder="https://linkedin.com/in/..." className={inputCls} />
              </div>
            </div>
            <div>
              <FieldLabel label="Founder Bio" />
              <textarea rows={3} value={form.founderBio} onChange={set('founderBio')}
                placeholder="Brief background on the founder(s)…" className={inputCls + ' resize-none'} />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pb-8">
            <Link to={`/applications/${id}`}
              className="flex-1 text-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              Cancel
            </Link>
            <button type="submit" disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-60">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
