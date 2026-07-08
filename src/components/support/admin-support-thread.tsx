"use client";

import { CheckCircle2, RotateCcw, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { setSupportThreadStatusAction } from "@/app/admin/support/actions";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  body: string;
  fromAdmin: boolean;
  createdAt: string;
};

type ThreadUser = { id: string; name: string; email: string; avatarUrl: string | null };

type ThreadView = {
  id: string;
  status: "OPEN" | "CLOSED";
  createdAt: string;
  lastMessageAt: string;
  user: ThreadUser;
};

type AdminThreadPayload = { thread: ThreadView; messages: Message[] };

const POLL_MS = 6000;

export function AdminSupportThread({ initial }: { initial: AdminThreadPayload }) {
  const [messages, setMessages] = useState<Message[]>(initial.messages);
  const [status, setStatus] = useState<"OPEN" | "CLOSED">(initial.thread.status);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, startStatus] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(initial.messages.length);
  const threadId = initial.thread.id;

  const scrollToBottom = useCallback((smooth: boolean) => {
    const node = scrollRef.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/support/${threadId}`, { cache: "no-store" });
      if (!res.ok) return;
      const payload = (await res.json()) as { data: AdminThreadPayload };
      setStatus(payload.data.thread.status);
      setMessages((prev) => (prev.length === payload.data.messages.length ? prev : payload.data.messages));
    } catch {
      /* transient — next poll retries */
    }
  }, [threadId]);

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
    try {
      const res = await fetch(`/api/admin/support/${threadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      });
      if (!res.ok) throw new Error("send failed");
      const payload = (await res.json()) as { data: AdminThreadPayload };
      setMessages(payload.data.messages);
      setStatus(payload.data.thread.status);
      setDraft("");
    } catch {
      setError("Couldn't send the reply. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function toggleStatus() {
    const next = status === "OPEN" ? "CLOSED" : "OPEN";
    startStatus(async () => {
      await setSupportThreadStatusAction(threadId, next);
      setStatus(next);
    });
  }

  return (
    <div className="flex h-[calc(100vh-15rem)] min-h-[26rem] flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-black text-gray-950">{initial.thread.user.name}</p>
          <p className="truncate text-xs text-gray-500">{initial.thread.user.email}</p>
        </div>
        <button
          type="button"
          onClick={toggleStatus}
          disabled={pendingStatus}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition disabled:opacity-60",
            status === "OPEN"
              ? "border-gray-300 text-gray-700 hover:bg-gray-50"
              : "border-brand-teal text-brand-teal hover:bg-teal-50"
          )}
        >
          {status === "OPEN" ? (
            <>
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Mark resolved
            </>
          ) : (
            <>
              <RotateCcw className="size-4" aria-hidden="true" />
              Reopen
            </>
          )}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <Bubble key={message.id} message={message} userName={initial.thread.user.name} />
        ))}
      </div>

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
          placeholder="Type your reply…"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-950 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || draft.trim().length === 0}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-teal text-white transition active:scale-95 disabled:opacity-40"
          aria-label="Send reply"
        >
          <Send className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function Bubble({ message, userName }: { message: Message; userName: string }) {
  const mine = message.fromAdmin;
  return (
    <div className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
      <span className="px-1 text-[11px] font-bold text-gray-400">{mine ? "You" : userName}</span>
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm",
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
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
