"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bot, Send, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useChatSend } from "@/lib/hooks/use-chat";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Why was this invoice flagged?",
  "Explain the discrepancy",
  "Compare invoice with QuickBooks",
  "Summarize this invoice",
];

interface ChatMessage {
  role: "user" | "bot";
  text: string;
}

export function ChatWidget() {
  const params = useParams<{ id?: string }>();
  const invoiceId = typeof params?.id === "string" ? params.id : undefined;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const chat = useChatSend();

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, pending]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    setPending(true);
    chat.mutate(
      { message: trimmed, invoiceId },
      {
        onSuccess: (res) => {
          setMessages((m) => [...m, { role: "bot", text: res.reply }]);
          setPending(false);
        },
        onError: () => {
          setMessages((m) => [...m, { role: "bot", text: "Something went wrong reaching the assistant." }]);
          setPending(false);
        },
      },
    );
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-[90px] right-6 z-[150] w-[380px] max-h-[560px] bg-card border border-border rounded-[18px] shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-border">
              <div className="size-9 rounded-[9px] bg-brand-soft text-primary flex items-center justify-center shrink-0">
                <Bot className="size-[18px]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm">Audix Assistant</div>
                <div className="text-[11.5px] text-muted-foreground truncate">
                  {invoiceId ? `Discussing this invoice` : "Ask about any invoice"}
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div ref={bodyRef} className="flex-1 overflow-y-auto px-[18px] py-4 flex flex-col gap-3 min-h-[180px]">
              {messages.length === 0 && (
                <div className="max-w-[85%] px-3.5 py-2.5 rounded-xl rounded-bl-[3px] bg-secondary text-[13px] leading-relaxed">
                  Hi, I&apos;m the Audix AI assistant.{" "}
                  {invoiceId ? "Ask me anything about this invoice." : "Open an invoice and ask me why it was flagged."}
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed",
                    m.role === "bot"
                      ? "bg-secondary self-start rounded-bl-[3px]"
                      : "bg-primary text-primary-foreground self-end rounded-br-[3px]",
                  )}
                >
                  {m.text}
                </div>
              ))}
              {pending && (
                <div className="max-w-[85%] px-3.5 py-2.5 rounded-xl rounded-bl-[3px] bg-secondary self-start">
                  <span className="inline-flex gap-1">
                    <span className="size-1.5 rounded-full bg-text-faint animate-bounce [animation-delay:0ms]" />
                    <span className="size-1.5 rounded-full bg-text-faint animate-bounce [animation-delay:150ms]" />
                    <span className="size-1.5 rounded-full bg-text-faint animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5 px-[18px] pb-3.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[12px] px-2.5 py-1.5 rounded-full bg-secondary border border-border text-muted-foreground hover:bg-indigo-soft hover:text-indigo hover:border-transparent transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex gap-2 px-3.5 py-3 border-t border-border">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(input)}
                placeholder="Ask a question..."
                className="flex-1 border border-border bg-secondary rounded-[9px] px-3 py-2 text-[13px] outline-none focus:border-primary"
              />
              <Button size="icon" className="size-9 shrink-0" onClick={() => send(input)}>
                <Send className="size-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-[150] size-[54px] rounded-full bg-gradient-to-br from-primary to-indigo text-white flex items-center justify-center shadow-2xl hover:scale-105 transition-transform"
      >
        {open ? <X className="size-6" /> : <Bot className="size-6" />}
      </button>
    </>
  );
}
