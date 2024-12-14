'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Conversation } from '@/types';
import Home from '@/app/page';

export default function SharedChat({ params }: { params: { id: string } }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadSharedConversation() {
      try {
        const response = await fetch(`/api/share?id=${params.id}`);
        if (!response.ok) {
          throw new Error('Failed to load conversation');
        }
        const data = await response.json();
        setConversation(data.conversation);
        setIsLoading(false);
      } catch (error) {
        setError('Failed to load shared conversation');
        setIsLoading(false);
      }
    }

    loadSharedConversation();
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">Loading shared conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-red-400">{error}</p>
          <button 
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Start New Chat
          </button>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return null;
  }

  return <Home initialConversationId={params.id} />;
}