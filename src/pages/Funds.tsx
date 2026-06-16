import React from 'react';
import { Briefcase } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';

export default function Funds() {
  return (
    <div className="max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
      <PageHeader
        title="Funds"
        description="Manage your fund vehicles and capital deployment"
      />

      <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
          <Briefcase size={24} className="text-gray-300" />
        </div>
        <h2 className="text-base font-semibold text-gray-700 mb-2">Fund Management Coming Soon</h2>
        <p className="text-sm text-gray-400 max-w-sm mx-auto leading-relaxed">
          Fund tracking, capital deployment, and LP reporting will be available in a future update.
        </p>
      </div>
    </div>
  );
}
