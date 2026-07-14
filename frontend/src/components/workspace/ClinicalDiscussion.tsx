import React, { useState } from "react";
import { SectionHeader } from "../shared/SectionHeader";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { MessageSquare, Send } from "lucide-react";
import { sendChat } from "@/lib/api";

interface ClinicalDiscussionProps {
  sessionId: string | null;
  messages: { role: string; content: string }[]; // Kept generic based on index.tsx structure
  onSend: (msg: string) => Promise<void>;
}

export function ClinicalDiscussion({ sessionId, messages, onSend }: ClinicalDiscussionProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim() || !sessionId) return;
    setSending(true);
    try {
      await onSend(text);
      setText("");
    } finally {
      setSending(false);
    }
  };

  if (!sessionId) return null;

  return (
    <div className="flex flex-col gap-px bg-line border border-line h-[400px]">
      <div className="bg-void p-3 border-b border-line">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
          Clinical Discussion
        </span>
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-void-2">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted text-[10px] font-mono flex-col gap-2">
            <MessageSquare className="w-4 h-4 opacity-50" />
            No discussion history.
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "self-end items-end" : "self-start items-start"}`}
            >
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted mb-1 px-1">
                {msg.role === "user" ? "Physician" : msg.role === "assistant" ? "Board" : msg.role}
              </span>
              <div
                className={`p-2 px-3 text-xs leading-relaxed ${msg.role === "user" ? "bg-void border border-line text-cream" : "bg-void-3 border border-line text-cream"}`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input area */}
      <div className="p-2 border-t border-line bg-void flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Query the specialist board..."
          className="flex-1 h-8 bg-void-2 border-line text-xs font-mono"
          disabled={sending}
        />
        <Button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          variant="outline"
          className="text-gold border-gold/30 hover:bg-gold/10 h-8 px-3 font-mono text-[10px] uppercase tracking-widest gap-2"
        >
          <Send className="w-3 h-3" /> Send
        </Button>
      </div>
    </div>
  );
}
