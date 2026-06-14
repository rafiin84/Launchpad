import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Send, Star } from 'lucide-react';
import { conversationsService } from '../services/conversationsService';
import type { Conversation } from '../types';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Textarea } from '../components/ui/Input';
import { TimeAgo } from '../components/ui/TimeAgo';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';

export default function ConversationDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [reply, setReply] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!id) return;
    conversationsService.getById(id).then((c) => setConversation(c ?? null));
  }, [id]);

  const handleReply = async () => {
    if (!reply.trim() || !conversation) return;
    setPosting(true);
    try {
      const updated = await conversationsService.addMessage(conversation.id, {
        author: currentUser,
        content: reply.trim(),
      });
      setConversation(updated);
      setReply('');
    } finally {
      setPosting(false);
    }
  };

  if (!conversation) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-pulse space-y-4">
        <div className="h-6 bg-gray-100 rounded w-1/4" />
        <div className="h-24 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link to="/conversations" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
        <ArrowLeft size={16} />
        All Conversations
      </Link>

      {/* Thread header */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-2 mb-3 flex-wrap">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
            {conversation.topic}
          </span>
          {conversation.isAnswered && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
              <CheckCircle size={12} />
              Answered
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold text-gray-900 leading-snug mb-2">{conversation.title}</h1>
        <p className="text-sm text-gray-600 leading-relaxed">{conversation.description}</p>
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-50">
          <Avatar src={conversation.author.avatar} name={conversation.author.name} size="sm" />
          <span className="text-xs text-gray-500">
            Started by <strong className="text-gray-700">{conversation.author.name}</strong>
          </span>
          <span className="text-gray-300">·</span>
          <TimeAgo date={conversation.createdAt} className="text-xs text-gray-400" />
          <span className="text-gray-300">·</span>
          <span className="text-xs text-gray-400">{conversation.messageCount} replies</span>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4 mb-6">
        {conversation.messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'bg-white border rounded-2xl p-5',
              message.isAnswer ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-100'
            )}
          >
            {message.isAnswer && (
              <div className="flex items-center gap-1.5 mb-3 text-xs font-medium text-emerald-600">
                <Star size={13} className="fill-emerald-500 text-emerald-500" />
                Marked as Answer
              </div>
            )}
            <div className="flex items-start gap-3">
              <Avatar src={message.author.avatar} name={message.author.name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-gray-900">{message.author.name}</span>
                  {message.author.company && (
                    <span className="text-xs text-gray-500">· {message.author.company.name}</span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">
                    <TimeAgo date={message.createdAt} />
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{message.content}</p>
                {message.reactions.length > 0 && (
                  <div className="flex gap-1.5 mt-2">
                    {message.reactions.map((r) => (
                      <button
                        key={r.emoji}
                        className={cn(
                          'flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs',
                          r.userReacted ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        )}
                      >
                        {r.emoji} {r.count}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Reply box */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <div className="flex gap-3">
          <Avatar src={currentUser.avatar} name={currentUser.name} size="sm" />
          <div className="flex-1">
            <Textarea
              placeholder="Share your perspective, advice, or experience..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              className="bg-gray-50 border-gray-100"
            />
            <div className="flex justify-end mt-3">
              <Button
                size="sm"
                onClick={handleReply}
                loading={posting}
                disabled={!reply.trim()}
                icon={<Send size={14} />}
              >
                Reply
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
