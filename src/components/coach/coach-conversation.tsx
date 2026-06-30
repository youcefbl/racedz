"use client";

import { AlertTriangle, BrainCircuit, CheckCircle2, Loader2, MessageSquareText, Mic, Send, ShieldAlert, Sparkles, Square } from "lucide-react";
import { useRef, useState } from "react";
import { coachRequest } from "@/components/coach/api";
import type { CoachCopy } from "@/components/coach/copy";
import { formatCoachDateTime, formatEnum } from "@/components/coach/format";
import type { CoachInteraction, CoachLocale } from "@/components/coach/types";
import { notifyHaptic, tapHaptic } from "@/lib/native/haptics";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function CoachConversation({
  interactions,
  locale,
  copy,
  pendingAction,
  canVoice = false,
  onAsk
}: {
  interactions: CoachInteraction[];
  locale: CoachLocale;
  copy: CoachCopy;
  pendingAction: string | null;
  canVoice?: boolean;
  onAsk: (message: string) => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const thinking = pendingAction === "CHAT" || pendingAction === "POST_RUN";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = message.trim();
    if (!value || thinking) return;
    setLocalError(null);
    try {
      await onAsk(value);
      setMessage("");
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : copy.requestFailed);
    }
  }

  async function startRecording() {
    setLocalError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void transcribe(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      tapHaptic("medium");
    } catch {
      setLocalError(copy.micDenied);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
    tapHaptic("light");
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    setLocalError(null);
    try {
      const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "mp4" : "webm";
      const form = new FormData();
      form.append("audio", blob, `coach-note.${ext}`);
      const payload = await coachRequest<{ data: { transcript: string } }>("/api/coach/transcribe", { method: "POST", body: form });
      const transcript = payload.data.transcript.trim();
      setMessage((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
      notifyHaptic("success");
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : copy.transcribeError);
      notifyHaptic("error");
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4">
          <BrainCircuit className="size-5 text-brand-teal" aria-hidden="true" />
          <h2 className="text-xl font-black text-gray-950">{copy.askTitle}</h2>
        </div>

        <div className="max-h-[620px] min-h-72 overflow-y-auto bg-gray-50 px-4 py-5 sm:px-5" role="log" aria-live="polite" aria-atomic="false" aria-busy={thinking}>
          {interactions.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <MessageSquareText className="size-8 text-gray-400" aria-hidden="true" />
              <p className="mt-3 max-w-sm text-sm leading-6 text-gray-600">{copy.noReview}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...interactions].reverse().map((interaction) => (
                <InteractionMessage key={interaction.id} interaction={interaction} locale={locale} copy={copy} />
              ))}
            </div>
          )}
          {thinking ? (
            <div className="mt-4 flex max-w-xl items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 shadow-sm">
              <Sparkles className="size-4 animate-pulse text-brand-orange" aria-hidden="true" />
              {copy.thinking}
            </div>
          ) : null}
        </div>

        <form onSubmit={submit} className="border-t border-gray-200 p-4 sm:p-5">
          {!message.trim() && !thinking ? (
            <div className="mb-3">
              <p className="mb-2 text-xs font-bold text-gray-500">{copy.suggestionsTitle}</p>
              <div className="flex flex-wrap gap-2">
                {copy.suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => setMessage(question)}
                    className="rounded-full border border-gray-300 px-3 py-1.5 text-start text-xs font-semibold text-gray-700 transition hover:border-brand-teal hover:text-brand-teal"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <label className="sr-only" htmlFor="coach-question">{copy.askTitle}</label>
          <div className="flex items-end gap-3">
            <textarea
              id="coach-question"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={1200}
              rows={2}
              placeholder={copy.askPlaceholder}
              className="min-h-12 flex-1 resize-none rounded-md border border-gray-300 bg-white px-3 py-3 text-sm text-gray-950 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
            />
            {canVoice ? (
              <Button
                type="button"
                variant="secondary"
                onClick={recording ? stopRecording : startRecording}
                disabled={thinking || transcribing}
                className={cn("size-12 px-0", recording && "!bg-red-600 !text-white animate-pulse")}
                aria-label={recording ? copy.recordStop : copy.record}
              >
                {transcribing ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : recording ? (
                  <Square className="size-5" aria-hidden="true" />
                ) : (
                  <Mic className="size-5" aria-hidden="true" />
                )}
              </Button>
            ) : null}
            <Button type="submit" disabled={!message.trim() || thinking} className="size-12 px-0" aria-label={copy.ask}>
              <Send className="size-5" aria-hidden="true" />
            </Button>
          </div>
          {recording ? <p className="mt-2 text-xs font-bold text-red-600">{copy.recording}</p> : null}
          {transcribing ? <p className="mt-2 text-xs font-semibold text-gray-500">{copy.transcribing}</p> : null}
          {localError ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{localError}</p> : null}
        </form>
      </section>

      <aside className="self-start rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-brand-orange" aria-hidden="true" />
          <h2 className="text-base font-black text-gray-950">{copy.safetyTitle}</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-gray-600">{copy.safetyText}</p>
        <div className="mt-5 border-t border-gray-200 pt-4">
          <p className="text-xs font-bold text-gray-500">{copy.storedContext}</p>
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            {copy.storedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function InteractionMessage({ interaction, locale, copy }: { interaction: CoachInteraction; locale: CoachLocale; copy: CoachCopy }) {
  const response = interaction.response;
  const failed = interaction.status === "FAILED";

  return (
    <article className="max-w-3xl rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={interaction.status === "BLOCKED" || failed ? "red" : "teal"}>{formatEnum(interaction.type)}</Badge>
        <span className="text-xs font-semibold text-gray-500">{formatCoachDateTime(interaction.createdAt, locale)}</span>
        {interaction.model ? <span className="text-xs text-gray-500">{interaction.model}</span> : null}
      </div>

      {interaction.userMessage ? (
        <div className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">{interaction.userMessage}</div>
      ) : null}

      {failed ? (
        <p className="mt-3 flex gap-2 text-sm font-semibold text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {interaction.errorCode || copy.requestFailed}
        </p>
      ) : response ? (
        <div className="mt-3">
          {response.requiresProfessionalAdvice ? (
            <p className="mb-3 flex gap-2 rounded-md bg-red-50 p-3 text-sm font-bold text-red-700">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {copy.professional}
            </p>
          ) : null}
          <p className="text-sm leading-6 text-gray-800">{response.summary}</p>
          <p className="mt-2 text-sm leading-6 text-gray-600">{response.progressAssessment}</p>
          {response.positiveSignals.map((signal) => (
            <p key={signal} className="mt-3 flex gap-2 text-sm text-gray-700"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden="true" />{signal}</p>
          ))}
          {response.warningSignals.map((signal) => (
            <p key={signal} className="mt-3 flex gap-2 text-sm text-gray-700"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand-orange" aria-hidden="true" />{signal}</p>
          ))}
        </div>
      ) : null}
    </article>
  );
}

