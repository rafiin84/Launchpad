import { useState, useEffect } from 'react';
import {
  Users, Plus, AlertCircle, RefreshCw, Mail, Phone, Building2,
  Briefcase, Trash2, X, Search, UserPlus, MapPin, ChevronDown,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/ui/Avatar';
import {
  fetchCRMFounders, createCRMFounder, deleteCRMFounder,
  LEAD_SOURCE_OPTIONS, SALUTATION_OPTIONS,
  type CRMFounder, type CRMFounderFields,
} from '../services/crmFounders';
import { loadToken } from '../services/oauth';
import { cn } from '../lib/cn';

// ─── Form Field Component ────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1 block">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent";
const selectCls = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent appearance-none bg-white";

// ─── Add Founder Modal ───────────────────────────────────────────────────────

function AddFounderModal({ onClose, onAdded }: { onClose: () => void; onAdded: (f: CRMFounder) => void }) {
  const [form, setForm] = useState<CRMFounderFields>({
    salutation: '', firstName: '', lastName: '', email: '',
    secondaryEmail: '', phone: '', mobile: '', title: '',
    department: '', company: '', leadSource: '',
    mailingCity: '', mailingState: '', mailingCountry: '',
    mailingStreet: '', mailingZip: '', description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const set = (key: keyof CRMFounderFields) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const canSave = form.lastName.trim();

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true); setError('');
    try {
      const id = await createCRMFounder(form);
      onAdded({
        id,
        salutation:     form.salutation || '',
        firstName:      form.firstName,
        lastName:       form.lastName,
        email:          form.email,
        secondaryEmail: form.secondaryEmail || '',
        phone:          form.phone || '',
        mobile:         form.mobile || '',
        title:          form.title || '',
        department:     form.department || '',
        company:        form.company || '',
        leadSource:     form.leadSource || '',
        mailingCity:    form.mailingCity || '',
        mailingState:   form.mailingState || '',
        mailingCountry: form.mailingCountry || '',
        description:    form.description || '',
        createdTime:    new Date().toISOString(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add founder');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <UserPlus size={16} className="text-indigo-600" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Add Founder</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">

          {/* Section: Basic Info */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Basic Information</p>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Salutation">
              <div className="relative">
                <select value={form.salutation} onChange={set('salutation')} className={selectCls}>
                  <option value="">—</option>
                  {SALUTATION_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </Field>
            <Field label="First Name">
              <input type="text" value={form.firstName} onChange={set('firstName')} placeholder="John" className={inputCls} autoFocus />
            </Field>
            <Field label="Last Name" required>
              <input type="text" value={form.lastName} onChange={set('lastName')} placeholder="Doe" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input type="email" value={form.email} onChange={set('email')} placeholder="john@company.com" className={inputCls} />
            </Field>
            <Field label="Secondary Email">
              <input type="email" value={form.secondaryEmail} onChange={set('secondaryEmail')} placeholder="john.personal@email.com" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+91 98400 00000" className={inputCls} />
            </Field>
            <Field label="Mobile">
              <input type="tel" value={form.mobile} onChange={set('mobile')} placeholder="+91 98400 00000" className={inputCls} />
            </Field>
          </div>

          {/* Section: Company Info */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Company Details</p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Company">
              <input type="text" value={form.company} onChange={set('company')} placeholder="Startup Inc." className={inputCls} />
            </Field>
            <Field label="Title / Designation">
              <input type="text" value={form.title} onChange={set('title')} placeholder="CEO & Co-founder" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <input type="text" value={form.department} onChange={set('department')} placeholder="Engineering" className={inputCls} />
            </Field>
            <Field label="Lead Source">
              <div className="relative">
                <select value={form.leadSource} onChange={set('leadSource')} className={selectCls}>
                  <option value="">— Select —</option>
                  {LEAD_SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </Field>
          </div>

          {/* Section: Address */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Mailing Address</p>

          <Field label="Street">
            <input type="text" value={form.mailingStreet} onChange={set('mailingStreet')} placeholder="123 Main Street" className={inputCls} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="City">
              <input type="text" value={form.mailingCity} onChange={set('mailingCity')} placeholder="Chennai" className={inputCls} />
            </Field>
            <Field label="State">
              <input type="text" value={form.mailingState} onChange={set('mailingState')} placeholder="Tamil Nadu" className={inputCls} />
            </Field>
            <Field label="Zip Code">
              <input type="text" value={form.mailingZip} onChange={set('mailingZip')} placeholder="600001" className={inputCls} />
            </Field>
          </div>

          <Field label="Country">
            <input type="text" value={form.mailingCountry} onChange={set('mailingCountry')} placeholder="India" className={inputCls} />
          </Field>

          {/* Section: Description */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Additional</p>

          <Field label="Description">
            <textarea value={form.description} onChange={set('description')} placeholder="Notes about this founder…" rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
            />
          </Field>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 mt-3 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="px-5 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <UserPlus size={14} /> {saving ? 'Adding…' : 'Add Founder'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Founder Card ────────────────────────────────────────────────────────────

function FounderCard({ founder, onDelete }: { founder: CRMFounder; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const fullName = [founder.salutation, founder.firstName, founder.lastName].filter(Boolean).join(' ') || 'Unnamed';
  const displayName = [founder.firstName, founder.lastName].filter(Boolean).join(' ') || 'Unnamed';
  const location = [founder.mailingCity, founder.mailingState, founder.mailingCountry].filter(Boolean).join(', ');

  async function handleDelete() {
    if (!confirm(`Remove ${displayName}?`)) return;
    setDeleting(true);
    try {
      await deleteCRMFounder(founder.id);
      onDelete(founder.id);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 hover:shadow-sm transition-all group">
      <div className="flex items-start gap-4">
        <Avatar name={displayName} size="lg" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 truncate">{fullName}</h3>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all"
              title="Remove founder"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {founder.title && (
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
              <Briefcase size={11} className="text-gray-400" />
              {founder.title}{founder.department ? ` · ${founder.department}` : ''}
            </p>
          )}

          <div className="mt-2.5 space-y-1.5">
            {founder.email && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Mail size={11} className="text-gray-400 flex-shrink-0" />
                <span className="truncate">{founder.email}</span>
              </div>
            )}
            {(founder.phone || founder.mobile) && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Phone size={11} className="text-gray-400 flex-shrink-0" />
                {founder.phone || founder.mobile}
              </div>
            )}
            {founder.company && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Building2 size={11} className="text-gray-400 flex-shrink-0" />
                {founder.company}
              </div>
            )}
            {location && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <MapPin size={11} className="text-gray-400 flex-shrink-0" />
                {location}
              </div>
            )}
          </div>

          {/* Tags row */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {founder.leadSource && founder.leadSource !== '-None-' && (
              <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                {founder.leadSource}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Founders() {
  const [founders, setFounders]   = useState<CRMFounder[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch]       = useState('');
  const isConnected = !!loadToken();

  function load() {
    if (!isConnected) { setLoading(false); return; }
    setLoading(true); setError('');
    fetchCRMFounders()
      .then(setFounders)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = search.trim()
    ? founders.filter(f => {
        const q = search.toLowerCase();
        return (
          f.firstName.toLowerCase().includes(q) ||
          f.lastName.toLowerCase().includes(q) ||
          f.email.toLowerCase().includes(q) ||
          f.company.toLowerCase().includes(q) ||
          f.title.toLowerCase().includes(q) ||
          f.mailingCity.toLowerCase().includes(q)
        );
      })
    : founders;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Founders</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage your portfolio founders
            {!loading && founders.length > 0 && (
              <span className="ml-1.5 text-gray-300">· {founders.length} total</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={!isConnected}
          className="inline-flex items-center gap-2 text-sm font-semibold bg-black text-white px-4 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={15} /> Add Founder
        </button>
      </div>

      {/* Not connected */}
      {!isConnected && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-5 py-4 mb-6">
          <AlertCircle size={16} className="text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Connect Zoho CRM to manage founders</p>
            <p className="text-xs text-amber-600 mt-0.5">Sign in with Zoho CRM to get started.</p>
          </div>
          <Link to="/login" className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg">Connect</Link>
        </div>
      )}

      {/* Search */}
      {!loading && founders.length > 0 && (
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, company, city…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-20" />
                  <div className="h-3 bg-gray-100 rounded w-40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <AlertCircle size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-2 text-xs font-medium text-red-600 bg-red-100 hover:bg-red-200 px-3 py-1.5 rounded-lg">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && founders.length === 0 && isConnected && (
        <div className="text-center py-16 border-2 border-dashed border-gray-100 rounded-2xl bg-white">
          <Users size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No founders yet</p>
          <p className="text-xs text-gray-400 mb-4">Add founders to manage your portfolio network.</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 text-sm font-semibold bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <Plus size={14} /> Add First Founder
          </button>
        </div>
      )}

      {/* No search results */}
      {!loading && !error && founders.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12">
          <Search size={24} className="text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No founders match "{search}"</p>
        </div>
      )}

      {/* Founder cards */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(f => (
            <FounderCard
              key={f.id}
              founder={f}
              onDelete={(id) => setFounders(prev => prev.filter(p => p.id !== id))}
            />
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <AddFounderModal
          onClose={() => setShowModal(false)}
          onAdded={(f) => setFounders(prev => [f, ...prev])}
        />
      )}
    </div>
  );
}
