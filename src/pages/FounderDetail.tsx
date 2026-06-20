import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, Building2, MapPin, Briefcase,
  Trash2, User, Calendar, FileText, Send, CheckCircle,
  AlertCircle, ExternalLink, Globe,
} from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { getCRMFounder, deleteCRMFounder, sendPortalInvitation, type CRMFounder } from '../services/crmFounders';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { registerPortalUser } from '../services/portalUsers';
import type { UserRole } from '../types';

export default function FounderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [founder, setFounder] = useState<CRMFounder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Portal invite state
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [inviteRole, setInviteRole] = useState<UserRole>('founder');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCRMFounder(id)
      .then(setFounder)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load founder'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteCRMFounder(id);
      navigate('/founders');
    } catch {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleSendInvite = async () => {
    if (!id || inviting || !founder?.email) return;
    setInviting(true);
    setInviteResult(null);
    try {
      const msg = await sendPortalInvitation(id);

      // Register this user in the portal users registry with their assigned role
      const displayName = [founder.firstName, founder.lastName].filter(Boolean).join(' ') || 'User';
      registerPortalUser({
        email: founder.email,
        role: inviteRole,
        name: displayName,
        contactId: id,
        invitedAt: new Date().toISOString(),
      });

      setInviteResult({ type: 'success', message: `${msg} — User registered as ${inviteRole}.` });
    } catch (err) {
      setInviteResult({ type: 'error', message: err instanceof Error ? err.message : 'Failed to send invitation' });
    } finally {
      setInviting(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="w-24 h-4 bg-gray-100 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 animate-pulse space-y-3">
                <div className="h-3 bg-gray-100 rounded w-1/3" />
                {[1, 2, 3].map(j => <div key={j} className="h-3 bg-gray-100 rounded" />)}
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-6 animate-pulse space-y-3">
              <div className="h-3 bg-gray-100 rounded w-1/2" />
              {[1, 2].map(j => <div key={j} className="h-3 bg-gray-100 rounded" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error / Not found ──
  if (error || !founder) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/founders" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6">
          <ArrowLeft size={15} /> Founders
        </Link>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
          <AlertCircle size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-red-700">{error || 'Founder not found'}</p>
        </div>
      </div>
    );
  }

  const fullName = [founder.salutation, founder.firstName, founder.lastName].filter(Boolean).join(' ') || 'Unnamed';
  const displayName = [founder.firstName, founder.lastName].filter(Boolean).join(' ') || 'Unnamed';
  const location = [founder.mailingCity, founder.mailingState, founder.mailingCountry].filter(Boolean).join(', ');
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const joined = founder.createdTime
    ? new Date(founder.createdTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 pb-12">
      {showDeleteModal && (
        <DeleteConfirmModal
          title="Delete Founder"
          message={`Are you sure you want to remove "${displayName}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          deleting={deleting}
        />
      )}

      {/* Back link */}
      <div className="pt-6 pb-4">
        <Link to="/founders" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 transition-colors">
          <ArrowLeft size={15} /> Founders
        </Link>
      </div>

      {/* Banner */}
      <div className="relative rounded-2xl overflow-hidden h-40 sm:h-52 mb-0">
        <img
          src="https://images.unsplash.com/photo-1557804506-669a67965ba0?fm=jpg&q=80&w=1600&auto=format&fit=crop"
          alt="Founder banner"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Actions top-right */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-red-500/70 backdrop-blur-sm border border-red-400/50 px-3 py-1.5 rounded-xl hover:bg-red-500/90 transition-colors"
          >
            <Trash2 size={13} /> <span className="hidden sm:inline">Delete</span>
          </button>
        </div>

        {/* Avatar overlapping banner */}
        <div className="absolute -bottom-8 left-6">
          <div className="w-20 h-20 rounded-full bg-white border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
            <Avatar name={displayName} size="xl" />
          </div>
        </div>
      </div>

      {/* Name + title */}
      <div className="mt-12 mb-2 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{fullName}</h1>
          {founder.title && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
              <Briefcase size={13} className="text-gray-400" />
              {founder.title}{founder.department ? ` · ${founder.department}` : ''}
            </p>
          )}
        </div>

        {/* Send Portal Invitation button */}
        {founder.email && (
          <button
            onClick={handleSendInvite}
            disabled={inviting || inviteResult?.type === 'success'}
            className={`inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all ${
              inviteResult?.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                : 'bg-black text-white hover:bg-gray-800 disabled:opacity-50'
            }`}
          >
            {inviting ? (
              <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</>
            ) : inviteResult?.type === 'success' ? (
              <><CheckCircle size={15} /> Invitation Sent</>
            ) : (
              <><Send size={14} /> Send Portal Invitation</>
            )}
          </button>
        )}
      </div>

      {/* Invite result message */}
      {inviteResult && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-4 ${
          inviteResult.type === 'success'
            ? 'bg-emerald-50 border border-emerald-100 text-emerald-700'
            : 'bg-red-50 border border-red-100 text-red-700'
        }`}>
          {inviteResult.type === 'success'
            ? <CheckCircle size={15} className="flex-shrink-0" />
            : <AlertCircle size={15} className="flex-shrink-0" />
          }
          {inviteResult.message}
        </div>
      )}

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">

        {/* Left: Contact details + Description */}
        <div className="lg:col-span-2 space-y-5">

          {/* Contact Information */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-5">Contact Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {founder.email && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Mail size={14} className="text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Email</p>
                    <a href={`mailto:${founder.email}`} className="text-sm text-indigo-600 hover:underline">
                      {founder.email}
                    </a>
                  </div>
                </div>
              )}
              {founder.secondaryEmail && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Mail size={14} className="text-violet-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Secondary Email</p>
                    <a href={`mailto:${founder.secondaryEmail}`} className="text-sm text-indigo-600 hover:underline">
                      {founder.secondaryEmail}
                    </a>
                  </div>
                </div>
              )}
              {founder.phone && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Phone size={14} className="text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Phone</p>
                    <a href={`tel:${founder.phone}`} className="text-sm text-gray-700 hover:underline">
                      {founder.phone}
                    </a>
                  </div>
                </div>
              )}
              {founder.mobile && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Phone size={14} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Mobile</p>
                    <a href={`tel:${founder.mobile}`} className="text-sm text-gray-700 hover:underline">
                      {founder.mobile}
                    </a>
                  </div>
                </div>
              )}
              {location && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin size={14} className="text-rose-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Location</p>
                    <p className="text-sm text-gray-700">{location}</p>
                  </div>
                </div>
              )}
              {joined && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Calendar size={14} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Added</p>
                    <p className="text-sm text-gray-700">{joined}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {founder.description && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Description</h3>
              <div className="space-y-2">
                {founder.description.split('\n').filter(Boolean).map((para, i) => (
                  <p key={i} className="text-sm text-gray-600 leading-relaxed">{para}</p>
                ))}
              </div>
            </div>
          )}

          {/* Portal Invitation Card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Portal Access</h3>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Send a portal invitation so this user can log in to Launchpad.
              Choose their role to determine which dashboard and features they'll see.
            </p>

            {founder.email ? (
              <div className="space-y-3">
                {/* Role selector */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Assign Role</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setInviteRole('investor')}
                      className={`flex-1 text-xs font-semibold px-3 py-2.5 rounded-xl border-2 transition-all ${
                        inviteRole === 'investor'
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      Investor
                    </button>
                    <button
                      onClick={() => setInviteRole('founder')}
                      className={`flex-1 text-xs font-semibold px-3 py-2.5 rounded-xl border-2 transition-all ${
                        inviteRole === 'founder'
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      Founder
                    </button>
                  </div>
                </div>

                {/* Email + send button */}
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <Mail size={15} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">Invitation will be sent to</p>
                    <p className="text-xs text-indigo-600 truncate">{founder.email}</p>
                  </div>
                  <button
                    onClick={handleSendInvite}
                    disabled={inviting || inviteResult?.type === 'success'}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-all flex-shrink-0 ${
                      inviteResult?.type === 'success'
                        ? 'bg-emerald-100 text-emerald-700 cursor-default'
                        : 'bg-black text-white hover:bg-gray-800 disabled:opacity-50'
                    }`}
                  >
                    {inviting ? (
                      <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
                    ) : inviteResult?.type === 'success' ? (
                      <><CheckCircle size={12} /> Sent</>
                    ) : (
                      <><Send size={12} /> Send Invite</>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-amber-50 rounded-xl px-4 py-3">
                <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700">No email address available. Add an email to send an invitation.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-4">

          {/* Company card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Company</h3>
            {founder.company ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Building2 size={16} className="text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{founder.company}</p>
                  {founder.title && (
                    <p className="text-xs text-gray-500 truncate">{founder.title}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No company listed</p>
            )}
            {founder.department && (
              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2">
                <Briefcase size={12} className="text-gray-400" />
                <p className="text-xs text-gray-600">{founder.department}</p>
              </div>
            )}
          </div>

          {/* Lead source & metadata */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Details</h3>
            <div className="space-y-3">
              {founder.leadSource && founder.leadSource !== '-None-' && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Lead Source</p>
                  <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-medium">
                    {founder.leadSource}
                  </span>
                </div>
              )}
              {founder.salutation && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Salutation</p>
                  <p className="text-sm text-gray-700">{founder.salutation}</p>
                </div>
              )}
              {joined && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Created</p>
                  <p className="text-sm text-gray-700">{joined}</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Quick Actions</h3>
            <div className="space-y-2">
              {founder.email && (
                <a
                  href={`mailto:${founder.email}`}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Mail size={14} className="text-gray-400" /> Send Email
                </a>
              )}
              {(founder.phone || founder.mobile) && (
                <a
                  href={`tel:${founder.phone || founder.mobile}`}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Phone size={14} className="text-gray-400" /> Call
                </a>
              )}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
              >
                <Trash2 size={14} /> Remove Founder
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
