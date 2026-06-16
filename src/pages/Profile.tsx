import { useState } from 'react';
import { MapPin, ExternalLink, Calendar, Edit3, Trophy, MessageSquare, Lightbulb, Link2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';
import { FeedCard } from '../components/feed/FeedCard';

const TABS = [
  { id: 'posts', label: 'Posts' },
  { id: 'about', label: 'About' },
];

export default function Profile() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('posts');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userPosts: any[] = [];

  return (
    <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      {/* Profile header */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-6">
        {/* Cover */}
        <div className="h-24 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50" />

        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-8 mb-4">
            <div className="ring-4 ring-white rounded-2xl overflow-hidden">
              <Avatar src={currentUser.avatar} name={currentUser.name} size="xl" />
            </div>
            <Button variant="outline" size="sm" icon={<Edit3 size={14} />}>
              Edit Profile
            </Button>
          </div>

          <h1 className="text-xl font-bold text-gray-900">{currentUser.name}</h1>
          <p className="text-sm text-gray-500 capitalize mt-0.5">
            {currentUser.role}
            {currentUser.company && ` · ${currentUser.company.name}`}
          </p>

          {currentUser.bio && (
            <p className="text-sm text-gray-700 mt-3 leading-relaxed max-w-lg">{currentUser.bio}</p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            {currentUser.location && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <MapPin size={13} />
                {currentUser.location}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar size={13} />
              Joined {new Date(currentUser.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            {currentUser.twitter && (
              <a href={`https://twitter.com/${currentUser.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors">
                <Link2 size={13} />
                {currentUser.twitter}
              </a>
            )}
            {currentUser.linkedIn && (
              <a href={currentUser.linkedIn} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors">
                <ExternalLink size={13} />
                LinkedIn
              </a>
            )}
          </div>

          {/* Expertise */}
          {currentUser.expertise.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {currentUser.expertise.map((exp) => (
                <span key={exp} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-medium">
                  {exp}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Posts', value: userPosts.length, icon: <MessageSquare size={16} className="text-gray-400" /> },
          { label: 'Followers', value: currentUser.followersCount || 0, icon: null },
          { label: 'Wins Shared', value: userPosts.filter((p) => p.type === 'win').length, icon: <Trophy size={16} className="text-emerald-400" /> },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl px-4 py-4 text-center">
            <div className="flex justify-center mb-1">{s.icon}</div>
            <p className="text-xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

      {activeTab === 'posts' && (
        <div className="space-y-4">
          {userPosts.length > 0 ? (
            userPosts.map((post) => <FeedCard key={post.id} post={post} />)
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center">
              <Lightbulb size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No posts yet. Share a win or ask for advice!</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'about' && (
        <div className="space-y-4">
          {currentUser.company && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Current Company</h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100">
                  <img src={currentUser.company.logo} alt={currentUser.company.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{currentUser.company.name}</p>
                  <p className="text-xs text-gray-500">{currentUser.company.industry}</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs">{currentUser.company.shortDescription}</p>
                </div>
              </div>
            </div>
          )}

          {currentUser.expertise.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Areas of Expertise</h3>
              <div className="flex flex-wrap gap-2">
                {currentUser.expertise.map((exp) => (
                  <span key={exp} className="bg-indigo-50 text-indigo-700 text-sm px-3 py-1.5 rounded-xl font-medium">
                    {exp}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
