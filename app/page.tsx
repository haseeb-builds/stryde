"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CheckinPage() {
  const params = useParams<{ id: string }>();
  const [actionText, setActionText] = useState("");
  const [intentionText, setIntentionText] = useState("");
  const [shrinkCount, setShrinkCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState <
  "asking" | "shrinking" | "summary" | "ceiling"
  >("asking");
  const [newAction, setNewAction] = useState("");
  const [intended, setIntended] = useState("");
  const [happened, setHappened] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function fetchLoop() {
      const { data } = await supabase
        .from("loops")
        .select("action_text, intention_text, shrink_count")
        .eq("id", params.id)
        .single();
      if (data) {
        setActionText(data.action_text);
        setIntentionText(data.intention_text);
        setShrinkCount(data.shrink_count);
      }
      setLoading(false);
    }
    fetchLoop();
  }, [params.id]);

  async function handleYes() {
    await supabase
      .from("loops")
      .update({ evidence_result: "yes", loop_status: "closed-evidence" })
      .eq("id", params.id);
    setIntended(intentionText);
    setHappened("Done — completed as planned.");
    setNextStep("Start a new loop when ready.");
    setState("summary");
  }

  async function handleNo() {
    if (shrinkCount >= 2) {
      await supabase
        .from("loops")
        .update({ evidence_result: "no", loop_status: "closed-ceiling" })
        .eq("id", params.id);
      setState("ceiling");
    } else {
      setState("shrinking");
    }
  }

  async function submitShrink() {
    const nextCheckin = new Date();
    nextCheckin.setDate(nextCheckin.getDate() + 1);

    const { data: current } = await supabase
      .from("loops")
      .select("action_history, action_text")
      .eq("id", params.id)
      .single();

    const priorHistory = current?.action_history || [];
    const updatedHistory = [...priorHistory, current?.action_text];

    await supabase
      .from("loops")
      .update({
        action_text: newAction,
        action_history: updatedHistory,
        shrink_count: shrinkCount + 1,
        checkin_scheduled_at: nextCheckin.toISOString(),
        evidence_result: null,
      })
      .eq("id", params.id);
    setState("summary");
    setIntended(intentionText);
    setHappened("Not yet — shrinking the action.");
    setNextStep(`Smaller next step: ${newAction}`);
  }

  async function handleReclassify() {
    await supabase.from("loops").update({ diagnosis: "B1" }).eq("id", params.id);
    setIntended(intentionText);
    setHappened("Not completed after two shrink attempts.");
    setNextStep("Reclassified — the blocker may be clarity, not execution.");
    setState("summary");
  }

  async function handleStartFresh() {
    setIntended(intentionText);
    setHappened("Not completed after two shrink attempts.");
    setNextStep("Starting fresh — go back to Stryde to begin a new loop.");
    setState("summary");
  }

  async function saveSummary() {
    await supabase
      .from("loops")
      .update({
        closing_summary: { intended, happened, next_step: nextStep },
      })
      .eq("id", params.id);
    setSaved(true);
  }

  if (loading) return <p className="p-6">Loading...</p>;

  if (state === "ceiling")
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6 text-center max-w-sm mx-auto">
        <h1 className="text-2xl font-semibold">Two shrinks, still no evidence</h1>
        <p className="text-zinc-600">
          This might not be a task-size problem. What fits better?
        </p>
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={handleReclassify}
            className="rounded-full border border-zinc-300 px-6 py-2 font-medium"
          >
            This isn&apos;t a task-size problem
          </button>
          <button
            onClick={handleStartFresh}
            className="rounded-full bg-foreground text-background px-6 py-2 font-medium"
          >
            Start fresh
          </button>
        </div>
      </div>
    );

  if (state === "summary")
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 max-w-md mx-auto">
        <h1 className="text-2xl font-semibold text-center">Loop closed</h1>
        {saved ? (
          <p className="text-center text-zinc-600">Saved.</p>
        ) : (
          <>
            <label className="w-full text-sm text-zinc-500">What you intended to do</label>
            <input
              value={intended}
              onChange={(e) => setIntended(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-4 py-2"
            />
            <label className="w-full text-sm text-zinc-500">What happened</label>
            <input
              value={happened}
              onChange={(e) => setHappened(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-4 py-2"
            />
            <label className="w-full text-sm text-zinc-500">What the next step is</label>
            <input
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-4 py-2"
            />
            <button
              onClick={saveSummary}
              className="rounded-full bg-foreground text-background px-6 py-2 font-medium mt-2"
            >
              Save
            </button>
          </>
        )}
      </div>
    );

  if (state === "shrinking")
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6 text-center">
        <h1 className="text-2xl font-semibold">Let&apos;s shrink it</h1>
        <p className="text-zinc-600">What&apos;s a smaller version of this action?</p>
        <input
          type="text"
          value={newAction}
          onChange={(e) => setNewAction(e.target.value)}
          placeholder="A smaller next step..."
          className="w-full max-w-sm rounded-md border border-zinc-300 px-4 py-2"
        />
        <button
          onClick={submitShrink}
          className="rounded-full bg-foreground text-background px-6 py-2 font-medium"
        >
          Commit smaller action
        </button>
      </div>
    );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold">Did this happen?</h1>
      <p className="text-lg text-zinc-600">{actionText}</p>
      <div className="flex gap-4">
        <button
          onClick={handleYes}
          className="rounded-full bg-green-600 text-white px-6 py-2 font-medium"
        >
          Yes
        </button>
        <button
          onClick={handleNo}
          className="rounded-full bg-red-600 text-white px-6 py-2 font-medium"
        >
          No
        </button>
      </div>
    </div>
  );
}