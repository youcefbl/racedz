"use client";

import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { tapHaptic } from "@/lib/native/haptics";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  body: string;
  fromAdmin: boolean;
  createdAt: string;
};

type ThreadView = {
  id: string;
  status: "OPEN" | "CLOSED";
  createdAt: string;
  lastMessageAt: string;
} | null;

type SupportView = { thread: ThreadView; messages: Message[] };

export type SupportChatLabels = {
  placeholder: string;
  send: string;
  sending: string;
  empty: string;
  you: string;
  team: string;
  loadError: string;
  sendError: string;
  closedNote: string;
};

const POLL_MS = 6000;

export function SupportChat({
  initial,
  labels,
  dir
}: {
  initial: SupportView;
  labels: SupportChatLabels;
  dir: "ltr" | "rtl";
}) {
  const [messages, setMessages] = useState<Message[]>(initial.messages);
  const [thread, setThread] = useState<ThreadView>(initial.thread);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(initial.messages.length);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);

  // Poll for new messages. Only re-render when the message count changes so typing isn't disrupted.
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/support", { cache: "no-store" });
      if (!res.ok) return;
      const payload = (await res.json()) as { data: SupportView };
      setThread(payload.data.thread);
      setMessages((prev) => (prev.length === payload.data.messages.length ? prev : payload.data.messages));
    } catch {
      /* transient — next poll retries */
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (messages.length !== lastCountRef.current) {
      lastCountRef.current = messages.length;
      scrollToBottom(true);
    }
  }, [messages.length, scrollToBottom]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    tapHaptic("light");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      });
      if (!res.ok) throw new Error("send failed");
      const payload = (await res.json()) as { data: SupportView };
      setThread(payload.data.thread);
      setMessages(payload.data.messages);
      setDraft("");
    } catch {
      setError(labels.sendError);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[24rem] flex-col rounded-2xl border border-gray-200 bg-white shadow-sm" dir={dir}>
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="mx-auto mt-8 max-w-xs text-center text-sm text-gray-500">{labels.empty}</p>
        ) : (
          messages.map((message) => <Bubble key={message.id} message={message} labels={labels} />)
        )}
      </div>

      {thread?.status === "CLOSED" ? (
        <p className="border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-500">{labels.closedNote}</p>
      ) : null}

      {error ? (
        <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-2 text-center text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex items-end gap-2 border-t border-gray-100 p-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder={labels.placeholder}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-950 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || draft.trim().length === 0}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-teal text-white transition active:scale-95 disabled:opacity-40"
          aria-label={sending ? labels.sending : labels.send}
        >
          <Send className="size-5 rtl:-scale-x-100" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function Bubble({ message, labels }: { message: Message; labels: SupportChatLabels }) {
  const mine = !message.fromAdmin;
  return (
    <div className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
      <span className="px-1 text-[11px] font-bold text-gray-400">{mine ? labels.you : labels.team}</span>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm",
          mine ? "rounded-br-sm bg-brand-teal text-white" : "rounded-bl-sm bg-gray-100 text-gray-950"
        )}
      >
        {message.body}
      </div>
      <span className="px-1 text-[10px] text-gray-400">{formatTime(message.createdAt)}</span>
    </div>
  );
}

function formatTime(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
