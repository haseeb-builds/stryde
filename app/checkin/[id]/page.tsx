"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CheckinPage() {
  const params = useParams<{ id: string }>();
  const [actionText, setActionText] = useState("");
  const [shrinkCount, setShrinkCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<"asking" | "shrinking" | "done" | "closed">("asking");
  const [newAction, setNewAction] = useState("");

  useEffect(() => {
    async function fetchLoop() {
      const { data } = await supabase
        .from("loops")
        .select("action_text, shrink_count")
        .eq("id", params.id)
        .single();
      if (data) {
        setActionText(data.action_text);
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
    setState("done");
  }

  async function handleNo() {
    if (shrinkCount >= 2) {
      await supabase
        .from("loops")
        .update({ evidence_result: "no", loop_status: "closed-ceiling" })
        .eq("id", params.id);
      setState("closed");
    } else {
      setState("shrinking");
    }
  }

  async function submitShrink() {
    const nextCheckin = new Date();
    nextCheckin.setDate(nextCheckin.getDate() + 1);

    await supabase
      .from("loops")
      .update({
        action_text: newAction,
        shrink_count: shrinkCount + 1,
        checkin_scheduled_at: nextCheckin.toISOString(),
        evidence_result: null,
      })
      .eq("id", params.id);
    setState("done");
  }

  if (loading) return <p className="p-6">Loading...</p>;

  if (state === "done")
    return <p className="p-6 text-center">Thanks — logged. New check-in scheduled if needed.</p>;

  if (state === "closed")
    return (
      <p className="p-6 text-center">
        This loop is closed after two shrink attempts. Consider whether the real blocker is
        something deeper than task size — start a new loop anytime.
      </p>
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