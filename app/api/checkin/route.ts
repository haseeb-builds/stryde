import { Resend } from "resend";
import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET() {
  const now = new Date().toISOString();

  const { data: loops, error } = await supabase
    .from("loops")
    .select("*")
    .eq("loop_status", "open")
    .lte("checkin_scheduled_at", now);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const loop of loops) {
    await resend.emails.send({
      from: "Stryde <onboarding@resend.dev>",
      to: "abdhaseeb.tech@gmail.com",
      subject: "Did this happen?",
      html: `<p>Your action: <strong>${loop.action_text}</strong></p><p>Did this happen?</p>`,
    });
  }

  return NextResponse.json({ sent: loops.length });
}
