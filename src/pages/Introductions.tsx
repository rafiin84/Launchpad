import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Plus, CheckCircle, Clock, XCircle, Link2 } from 'lucide-react';
import { introductionsService } from '../services/introductionsService';
import type { Introduction, IntroductionStatus } from '../types';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea } from '../components/ui/Input';
import { PageHeader } from '../components/layout/PageHeader';
import { TimeAgo } from '../components/ui/TimeAgo';
import { cn } from '../lib/cn';
import { useAuth } from '../context/AuthContext';

const statusConfig: Record<IntroductionStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pending: { label: 'Pending', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  facilitated: { label: 'Facilitated', icon: ArrowLeftRight, color: 'text-blue-600', bg: 'bg-blue-50' },
  connected: { label: 'Connected', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  declined: { label: 'Declined', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
};

const purposeLabels: Record<string, string> = {
  customer: '🛍️ Customer',
  partner: '🤝 Partner',
  advisor: '💡 Advisor',
  investor: '💰 Investor',
  expert: '🎓 Expert',
};

function IntroCard({ intro, onStatusUpdate }: { intro: Introduction; onStatusUpdate: (id: string, status: IntroductionStatus) => void }) {
  const config = statusConfig[intro.status];
  const Icon = config.icon;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">
          {purposeLabels[intro.purposeType]?.split(' ')[0] || '🤝'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-semibold text-gray-900">
              {intro.requestedBy.name} → {intro.targetName}
            </h3>
            <span className={cn('flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', config.bg, config.color)}>
              <Icon size={11} />
              {config.label}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500">{intro.targetRole}</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs font-medium text-gray-700">{intro.targetCompany}</span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-500">{purposeLabels[intro.purposeType]}</span>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed mb-3">{intro.purpose}</p>

          {intro.facilitatedBy && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500">Facilitated by</span>
              <div className="flex items-center gap-1.5">
                <Avatar src={intro.facilitatedBy.avatar} name={intro.facilitatedBy.name} size="xs" />
                <span className="text-xs font-medium text-gray-700">{intro.facilitatedBy.name}</span>
              </div>
            </div>
          )}

          {intro.notes && (
            <p className="text-xs text-gray-500 italic mb-3">{intro.notes}</p>
          )}

          <div className="flex items-center gap-3">
            <TimeAgo date={intro.createdAt} className="text-xs text-gray-400" />
            {intro.connectedAt && (
              <>
                <span className="text-gray-300">·</span>
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <Link2 size={11} />
                  Connected <TimeAgo date={intro.connectedAt} />
                </span>
              </>
            )}
          </div>
        </div>

        {/* Quick actions for investor */}
        {intro.status === 'pending' && (
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button
              onClick={() => onStatusUpdate(intro.id, 'facilitated')}
              className="px-3 py-1.5 bg-black text-white text-xs font-medium rounded-xl hover:bg-gray-800 transition-colors"
            >
              Facilitate
            </button>
            <button
              onClick={() => onStatusUpdate(intro.id, 'declined')}
              className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-xl hover:bg-gray-200 transition-colors"
            >
              Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RequestIntroModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { currentUser } = useAuth();
  const [form, setForm] = useState({
    targetName: '',
    targetCompany: '',
    targetRole: '',
    purpose: '',
    purposeType: 'customer' as 'customer' | 'partner' | 'advisor' | 'expert',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.targetName || !form.purpose) return;
    setSubmitting(true);
    try {
      await introductionsService.create({
        requestedBy: currentUser,
        ...form,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request an Introduction"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>Send Request</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-500">Ask your investor to make a warm introduction.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Contact Name"
            placeholder="Jane Smith"
            value={form.targetName}
            onChange={(e) => setForm({ ...form, targetName: e.target.value })}
          />
          <Input
            label="Company"
            placeholder="Acme Corp"
            value={form.targetCompany}
            onChange={(e) => setForm({ ...form, targetCompany: e.target.value })}
          />
        </div>
        <Input
          label="Their Role"
          placeholder="VP of Engineering"
          value={form.targetRole}
          onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Introduction Type</label>
          <div className="flex gap-2 flex-wrap">
            {(['customer', 'partner', 'advisor', 'expert'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setForm({ ...form, purposeType: type })}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-medium border transition-all capitalize',
                  form.purposeType === type ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                )}
              >
                {purposeLabels[type]}
              </button>
            ))}
          </div>
        </div>
        <Textarea
          label="Why this introduction?"
          placeholder="Briefly explain what you're hoping to get from this connection..."
          value={form.purpose}
          onChange={(e) => setForm({ ...form, purpose: e.target.value })}
          rows={3}
        />
      </div>
    </Modal>
  );
}

export default function Introductions() {
  const [introductions, setIntroductions] = useState<Introduction[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<IntroductionStatus | 'all'>('all');
  const { isFounder } = useAuth();

  useEffect(() => {
    introductionsService.getAll().then(setIntroductions);
  }, []);

  const handleStatusUpdate = async (id: string, status: IntroductionStatus) => {
    const updated = await introductionsService.updateStatus(id, status);
    setIntroductions((prev) => prev.map((i) => (i.id === id ? updated : i)));
  };

  const filtered = filter === 'all' ? introductions : introductions.filter((i) => i.status === filter);

  const stats = {
    total: introductions.length,
    pending: introductions.filter((i) => i.status === 'pending').length,
    connected: introductions.filter((i) => i.status === 'connected').length,
    facilitated: introductions.filter((i) => i.status === 'facilitated').length,
  };

  return (
    <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <PageHeader
        title="Introductions"
        description="Warm introductions facilitated through your investor network"
        action={
          isFounder && (
            <Button size="sm" icon={<Plus size={15} />} onClick={() => setShowModal(true)}>
              Request Intro
            </Button>
          )
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Requests', value: stats.total },
          { label: 'Connected', value: stats.connected, accent: true },
          { label: 'Pending', value: stats.pending },
        ].map((s) => (
          <div
            key={s.label}
            className={cn(
              'rounded-2xl px-4 py-4 text-center',
              s.accent ? 'bg-black text-white' : 'bg-white border border-gray-100'
            )}
          >
            <p className={cn('text-2xl font-bold', s.accent ? 'text-white' : 'text-gray-900')}>{s.value}</p>
            <p className={cn('text-xs mt-0.5', s.accent ? 'text-gray-300' : 'text-gray-500')}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-5">
        {(['all', 'pending', 'facilitated', 'connected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-medium transition-all capitalize',
              filter === f ? 'bg-black text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((intro) => (
          <IntroCard key={intro.id} intro={intro} onStatusUpdate={handleStatusUpdate} />
        ))}
        {filtered.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
            <ArrowLeftRight size={32} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No introductions yet</p>
            {isFounder && (
              <button onClick={() => setShowModal(true)} className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                Request your first introduction →
              </button>
            )}
          </div>
        )}
      </div>

      <RequestIntroModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
