"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [stuck, setStuck] = useState("");
  const [started, setStarted] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [actionText, setActionText] = useState("");
  const [checkinTime, setCheckinTime] = useState("18:00");

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black min-h-screen">
      <main className="flex flex-col items-center gap-6 max-w-md w-full px-6">
        {committed ? (
          <>
            <h1 className="text-2xl font-semibold text-black dark:text-zinc-50 text-center">
              Loop started
            </h1>
            <p className="text-center text-zinc-600 dark:text-zinc-400">
              You&apos;ll get an email around your check-in time asking if it happened.
            </p>
          </>
        ) : !started ? (
          <>
            <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
              What are you stuck on?
            </h1>
            <input
              type="text"
              value={stuck}
              onChange={(e) => setStuck(e.target.value)}
              placeholder="I keep putting off..."
              className="w-full rounded-md border border-zinc-300 px-4 py-2 text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
            <button
              onClick={() => {
                setActionText(stuck);
                setStarted(true);
              }}
              className="rounded-full bg-foreground px-6 py-2 text-background font-medium"
            >
              Start
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
              Your next action
            </h1>
            <input
              type="text"
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-4 py-2 text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
            <input
              type="time"
              value={checkinTime}
              onChange={(e) => setCheckinTime(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-4 py-2 text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
            <button
              onClick={async () => {
                const today = new Date();
                const [hours, minutes] = checkinTime.split(":").map(Number);
                today.setHours(hours, minutes, 0, 0);

                const { error } = await supabase.from("loops").insert({
                  intention_text: stuck,
                  action_text: actionText,
                  checkin_scheduled_at: today.toISOString(),
                });
                if (error) {
                  console.error(error);
                } else {
                  setCommitted(true);
                }
              }}
              className="rounded-full bg-foreground px-6 py-2 text-background font-medium"
            >
              Commit
            </button>
          </>
        )}
      </main>
    </div>
  );
}
onClick={async () => {
  console.log("Commit clicked");
  const today = new Date();