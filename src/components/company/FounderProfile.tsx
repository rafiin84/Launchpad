import { useEffect, useState } from 'react';
import {
  Mail, Phone, Smartphone, Link2, AtSign, MapPin, Briefcase,
  Building2, Loader2, AlertCircle, ExternalLink, Tag, CalendarClock,
  FileText, UserCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { findContactByEmail, getCRMFounder, type CRMFounder } from '../../services/crmFounders';

/**
 * The founder, in full, on the investor's Company page.
 *
 * The Portfolios record carries four founder fields — name, email, phone,
 * LinkedIn — typed by whoever created the portfolio entry. The founder's
 * Contacts record carries around twenty and is the one they maintain
 * themselves, so it is the better source; this reads that and keeps the
 * portfolio values as the fallback, because a company whose founder has no
 * Contact record yet should still show what it has rather than less than
 * before.
 *
 * Read-only. The founder's own Profile page and the Portal Users page are
 * where this gets edited; two edit surfaces for one record is how they drift.
 */

interface Fallback {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
}

function href(url: string): string {
  return url.startsWith('http') ? url : `https://${url}`;
}

function fullName(f: CRMFounder): string {
  return [f.salutation, f.firstName, f.lastName].filter(Boolean).join(' ').trim();
}

/** One label/value row. Renders nothing at all when there is no value. */
function Row({
  icon: Icon, label, children,
}: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
      <Icon size={13} className="text-gray-300 flex-shrink-0 mt-0.5" />
      <span className="text-xs text-gray-400 w-32 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-800 min-w-0 break-words">{children}</span>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{title}</p>
      <div className="bg-gray-50/60 rounded-xl px-3.5 py-1">{children}</div>
    </div>
  );
}

export default function FounderProfile({
  founderEmail, fallback, photoUrl,
}: {
  founderEmail: string;
  fallback: Fallback;
  photoUrl?: string;
}) {
  const [contact, setContact] = useState<CRMFounder | null>(null);
  const [loading, setLoading] = useState(!!founderEmail);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!founderEmail) return;
    let cancelled = false;
    (async () => {
      try {
        const id = await findContactByEmail(founderEmail);
        if (cancelled) return;
        if (!id) { setContact(null); setLoading(false); return; }
        const full = await getCRMFounder(id);
        if (cancelled) return;
        setContact(full);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load the founder record.');
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [founderEmail]);

  const hasAnything = contact
    || fallback.name || fallback.email || fallback.phone || fallback.linkedin;

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <Loader2 size={16} className="animate-spin" /> Loading founder record…
        </div>
      </div>
    );
  }

  if (!hasAnything) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Founder</h3>
        <p className="text-sm text-gray-400">No founder information on this company yet.</p>
        <p className="text-xs text-gray-400 mt-1">
          Add the founder's email to the portfolio record and their full profile appears here.
        </p>
      </div>
    );
  }

  // Contact wins where it has a value; the portfolio record fills the gaps, so
  // this view is never worse than the four fields it replaced.
  const name    = (contact && fullName(contact)) || fallback.name;
  const email   = contact?.email || fallback.email;
  const phone   = contact?.phone || fallback.phone;
  const linked  = contact?.linkedIn || fallback.linkedin;
  const place   = contact
    ? contact.location
      || [contact.mailingCity, contact.mailingState, contact.mailingCountry].filter(Boolean).join(', ')
    : '';

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
      {/* Identity */}
      <div className="flex items-start gap-5 flex-wrap">
        <Avatar src={photoUrl || undefined} name={name || '?'} size="xl" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-gray-900">{name || 'Unnamed founder'}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {[contact?.title || 'Founder', contact?.department].filter(Boolean).join(' · ')}
          </p>
          {contact?.company && (
            <p className="text-xs text-gray-400 mt-0.5 inline-flex items-center gap-1">
              <Building2 size={11} /> {contact.company}
            </p>
          )}
          {contact && (
            <Link
              to={`/applicants/${contact.id}`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
            >
              Open full record <ExternalLink size={11} />
            </Link>
          )}
        </div>
      </div>

      {/* The lookup failed, or there is no Contact yet — say which, because
          "only four fields" otherwise looks like the founder supplied nothing. */}
      {error && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          Showing what the portfolio record holds — the founder's full record could
          not be loaded: {error}
        </p>
      )}
      {!error && !contact && founderEmail && (
        <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 flex items-start gap-1.5">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          No contact record found for {founderEmail}, so this is only what was typed
          on the portfolio record. Invite them from Portal Users to create one.
        </p>
      )}

      <Group title="Contact">
        {email && (
          <Row icon={Mail} label="Email">
            <a href={`mailto:${email}`} className="text-indigo-600 hover:underline">{email}</a>
          </Row>
        )}
        {contact?.secondaryEmail && (
          <Row icon={Mail} label="Secondary email">
            <a href={`mailto:${contact.secondaryEmail}`} className="text-indigo-600 hover:underline">
              {contact.secondaryEmail}
            </a>
          </Row>
        )}
        {phone && (
          <Row icon={Phone} label="Phone">
            <a href={`tel:${phone}`} className="hover:underline">{phone}</a>
          </Row>
        )}
        {contact?.mobile && (
          <Row icon={Smartphone} label="Mobile">
            <a href={`tel:${contact.mobile}`} className="hover:underline">{contact.mobile}</a>
          </Row>
        )}
        {linked && (
          <Row icon={Link2} label="LinkedIn">
            <a href={href(linked)} target="_blank" rel="noopener noreferrer"
               className="text-indigo-600 hover:underline inline-flex items-center gap-1">
              {linked.replace(/^https?:\/\/(www\.)?/, '')} <ExternalLink size={10} />
            </a>
          </Row>
        )}
        {contact?.twitter && (
          <Row icon={AtSign} label="Twitter / X">
            <a href={href(contact.twitter.replace(/^@/, 'https://x.com/'))}
               target="_blank" rel="noopener noreferrer"
               className="text-indigo-600 hover:underline">{contact.twitter}</a>
          </Row>
        )}
        {place && <Row icon={MapPin} label="Location">{place}</Row>}
      </Group>

      {contact && (contact.bio || contact.description || contact.skills.length > 0) && (
        <Group title="Background">
          {contact.bio && (
            <Row icon={UserCircle2} label="Bio">
              <span className="leading-relaxed">{contact.bio}</span>
            </Row>
          )}
          {contact.description && (
            <Row icon={FileText} label="Notes">
              <span className="leading-relaxed">{contact.description}</span>
            </Row>
          )}
          {contact.skills.length > 0 && (
            <Row icon={Tag} label="Skills">
              <span className="flex flex-wrap gap-1.5">
                {contact.skills.map(s => (
                  <span key={s} className="text-[11px] bg-white ring-1 ring-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                    {s}
                  </span>
                ))}
              </span>
            </Row>
          )}
        </Group>
      )}

      {contact && (contact.leadSource || contact.createdTime) && (
        <Group title="Record">
          {contact.leadSource && <Row icon={Briefcase} label="Lead source">{contact.leadSource}</Row>}
          {contact.createdTime && (
            <Row icon={CalendarClock} label="In CRM since">
              {new Date(contact.createdTime).toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </Row>
          )}
        </Group>
      )}
    </div>
  );
}
