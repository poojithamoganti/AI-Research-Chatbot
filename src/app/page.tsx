'use client';

import { useState } from "react";
import { Share2, PlusCircle } from "lucide-react";
import { Source, Message, Conversation } from '@/types';

interface HomeProps {
  initialConversationId?: string;
}

export default function Home({ initialConversationId }: HomeProps) {
  const [activeConversation, setActiveConversation] = useState<string>(() => 
    initialConversationId || generateConversationId()
  );
  const [conversations, setConversations] = useState<Record<string, Conversation>>(() => ({
    [activeConversation]: {
      id: activeConversation,
      messages: [{ role: "ai", content: "Hello! How can I help you today?" }],
      urls: ""
    }
  }));
  const [isLoading, setIsLoading] = useState(false);
  const [showShareNotification, setShowShareNotification] = useState(false);

  function generateConversationId() {
    return Math.random().toString(36).substring(2, 15);
  }

  const handleNewChat = () => {
    const newId = generateConversationId();
    setConversations(prev => ({
      ...prev,
      [newId]: {
        id: newId,
        messages: [{ role: "ai", content: "Hello! How can I help you today?" }],
        urls: ""
      }
    }));
    setActiveConversation(newId);
  };

  const handleShare = async () => {
    try {
      // Save conversation to backend
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation: conversations[activeConversation]
        }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to share conversation');
      }
  
      const shareableUrl = `${window.location.origin}/chat/${activeConversation}`;
      await navigator.clipboard.writeText(shareableUrl);
      setShowShareNotification(true);
      setTimeout(() => setShowShareNotification(false), 3000);
    } catch (error) {
      console.error('Error sharing conversation:', error);
      // Show error notification
      setShowShareNotification(true);
      setTimeout(() => setShowShareNotification(false), 3000);
    }
  };

  const handleUpdateUrls = (newUrls: string) => {
    setConversations(prev => ({
      ...prev,
      [activeConversation]: {
        ...prev[activeConversation],
        urls: newUrls
      }
    }));
  };

  const handleSend = async (message: string) => {
    if (!message.trim()) return;

    const conversation = conversations[activeConversation];
    const urlList = conversation.urls.split(',').map(url => url.trim()).filter(Boolean);

    // Add user message
    setConversations(prev => ({
      ...prev,
      [activeConversation]: {
        ...prev[activeConversation],
        messages: [...prev[activeConversation].messages, { role: "user", content: message }]
      }
    }));

    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: message, urls: urlList }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const data = await response.json();

      // Add AI response
      setConversations(prev => ({
        ...prev,
        [activeConversation]: {
          ...prev[activeConversation],
          messages: [...prev[activeConversation].messages, {
            role: "ai",
            content: data.answer,
            sources: data.sources
          }]
        }
      }));
    } catch (error) {
      console.error("Error:", error);
      setConversations(prev => ({
        ...prev,
        [activeConversation]: {
          ...prev[activeConversation],
          messages: [...prev[activeConversation].messages, {
            role: "ai",
            content: "Sorry, an error occurred while processing your request."
          }]
        }
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const conversation = conversations[activeConversation];

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header with Controls */}
      <div className="w-full bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">ResearchBot</h1>
          <div className="flex gap-4">
            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            >
              <PlusCircle size={18} />
              New Chat
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            >
              <Share2 size={18} />
              Share
            </button>
          </div>
        </div>
      </div>

      {/* Share Notification */}
      {showShareNotification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg">
            Conversation link copied to clipboard!
          </div>
        </div>
      )}

      {/* URL Input */}
      <div className="w-full bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-3xl mx-auto">
          <input
            type="text"
            value={conversation.urls}
            onChange={e => handleUpdateUrls(e.target.value)}
            placeholder="Paste comma-separated URLs to search (e.g., https://example.com, https://another.com)"
            className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent placeholder-gray-400"
          />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto pb-32 pt-4">
        <div className="max-w-3xl mx-auto px-4">
          {conversation.messages.map((msg, index) => (
            <div
              key={index}
              className={`flex gap-4 mb-4 ${
                msg.role === "ai" ? "justify-start" : "justify-end flex-row-reverse"
              }`}
            >
              <div
                className={`px-4 py-2 rounded-2xl max-w-[80%] ${
                  msg.role === "ai"
                    ? "bg-gray-800 border border-gray-700 text-gray-100"
                    : "bg-cyan-600 text-white ml-auto"
                }`}
              >
                {msg.content}
                {msg.role === "ai" && msg.sources && (
                  <div className="mt-2 text-sm text-gray-400">
                    <details>
                      <summary className="cursor-pointer">Sources</summary>
                      <ul className="mt-2 space-y-2">
                        {msg.sources.map((source, idx) => (
                          <li key={idx} className="bg-gray-800 rounded-lg p-2">
                            <a 
                              href={source.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:underline block mb-1"
                            >
                              {source.title || source.url}
                            </a>
                            <p className="text-xs text-gray-500 line-clamp-2">
                              {source.content.slice(0, 200)}...
                            </p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 w-full bg-gray-800 border-t border-gray-700 p-4">
        <div className="max-w-3xl mx-auto">
          <MessageInput onSend={handleSend} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}

// Message Input Component
function MessageInput({ onSend, isLoading }: { onSend: (message: string) => void; isLoading: boolean }) {
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    if (message.trim()) {
      onSend(message);
      setMessage("");
    }
  };

  return (
    <div className="flex gap-3 items-center">
      <input
        type="text"
        value={message}
        onChange={e => setMessage(e.target.value)}
        onKeyPress={e => e.key === "Enter" && handleSubmit()}
        placeholder="Ask a question about the provided URLs..."
        className="flex-1 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent placeholder-gray-400"
      />
      <button
        onClick={handleSubmit}
        disabled={isLoading || !message.trim()}
        className="bg-cyan-600 text-white px-5 py-3 rounded-xl hover:bg-cyan-700 transition-all disabled:bg-cyan-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Sending..." : "Send"}
      </button>
    </div>
  );
}