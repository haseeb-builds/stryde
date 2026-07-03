"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CheckinPage() {
  const params = useParams<{ id: string }>();
  const [actionText, setActionText] = useState("");
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function fetchLoop() {
      const { data } = await supabase
        .from("loops")
        .select("action_text")
        .eq("id", params.id)
        .single();
      if (data) setActionText(data.action_text);
      setLoading(false);
    }
    fetchLoop();
  }, [params.id]);

  async function handleAnswer(evidence: "yes" | "no") {
    await supabase
      .from("loops")
      .update({
        evidence_result: evidence,
        loop_status: evidence === "yes" ? "closed-evidence" : "open",
      })
      .eq("id", params.id);
    setDone(true);
  }

  if (loading) return <p className="p-6">Loading...</p>;
  if (done) return <p className="p-6">Thanks — logged.</p>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold">Did this happen?</h1>
      <p className="text-lg text-zinc-600">{actionText}</p>
      <div className="flex gap-4">
        <button
          onClick={() => handleAnswer("yes")}
          className="rounded-full bg-green-600 text-white px-6 py-2 font-medium"
        >
          Yes
        </button>
        <button
          onClick={() => handleAnswer("no")}
          className="rounded-full bg-red-600 text-white px-6 py-2 font-medium"
        >
          No
        </button>
      </div>
    </div>
  );
}