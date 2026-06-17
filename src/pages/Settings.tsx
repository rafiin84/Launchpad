import React, { useState } from 'react';
import { Lock, Check } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';

function SettingsSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-0.5">{title}</h3>
      {description && <p className="text-xs text-gray-500 mb-4">{description}</p>}
      <div className={description ? '' : 'mt-4'}>{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  defaultOn = false,
}: {
  label: string;
  description?: string;
  defaultOn?: boolean;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-start justify-between py-3 border-b border-gray-50 last:border-0">
      <div className="flex-1 pr-4">
        <p className="text-sm text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => setOn(!on)}
        className={cn(
          'w-10 h-6 rounded-full transition-all flex-shrink-0 relative',
          on ? 'bg-black' : 'bg-gray-200'
        )}
      >
        <span
          className={cn(
            'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all',
            on ? 'left-5' : 'left-1'
          )}
        />
      </button>
    </div>
  );
}

export default function Settings() {
  const { currentUser } = useAuth();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <PageHeader title="Settings" description="Manage your account and preferences" />

      {/* Profile */}
      <SettingsSection title="Profile" description="Update your public profile information">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="First Name" defaultValue={currentUser.name.split(' ')[0]} />
            <Input label="Last Name" defaultValue={currentUser.name.split(' ').slice(1).join(' ')} />
          </div>
          <Input label="Email" defaultValue={currentUser.email} type="email" />
          <Input label="Location" defaultValue={currentUser.location || ''} placeholder="City, Country" />
          <Input label="LinkedIn URL" defaultValue={currentUser.linkedIn || ''} placeholder="https://linkedin.com/in/..." />
          <Input label="Twitter" defaultValue={currentUser.twitter || ''} placeholder="@username" />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSave}
              icon={saved ? <Check size={14} /> : undefined}
              variant={saved ? 'secondary' : 'primary'}
            >
              {saved ? 'Saved!' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection title="Notifications" description="Choose what you want to be notified about">
        <ToggleRow label="New replies to your posts" defaultOn />
        <ToggleRow label="Someone asks for advice in your area" defaultOn />
        <ToggleRow label="New introduction requests" description="When a founder requests an intro" defaultOn />
        <ToggleRow label="Portfolio company milestones" defaultOn />
        <ToggleRow label="New knowledge articles" description="Weekly digest of top articles" />
        <ToggleRow label="Email notifications" defaultOn />
      </SettingsSection>

      {/* Privacy */}
      <SettingsSection title="Privacy" description="Control what others can see">
        <ToggleRow label="Show my profile in the directory" defaultOn />
        <ToggleRow label="Allow direct messages from founders" defaultOn />
        <ToggleRow
          label="Show activity in portfolio feed"
          description="Others in the portfolio can see your posts"
          defaultOn
        />
        <ToggleRow label="Make profile searchable" defaultOn />
      </SettingsSection>

      {/* Data visibility */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-4">
        <div className="flex items-start gap-3">
          <Lock size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Private by Default</p>
            <p className="text-xs text-gray-600 leading-relaxed">
              Financial data, employee information, investment amounts, cap table details, and private documents are <strong>never</strong> visible to other portfolio companies — only to you and your investors.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
