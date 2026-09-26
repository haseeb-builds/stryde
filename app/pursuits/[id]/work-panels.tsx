"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkingState } from "@/lib/work-controller";
import { supabase } from "@/lib/supabase";

type Source = { id:string; source_kind:"URL"|"PASTED"; uri:string|null; title:string|null; fetch_status:string };
type Adaptation = { id:string; source_id:string; summary:string; methods:Array<{title:string;sequence:number;description:string;expected_change:string}>; fit:{status:string}; gaps:string[]; conflicts:string[]; goal_candidates:Array<{goal:string;why:string;conditions:string[]}> };
type Action = { id:string; intent_summary:string; status:string };

export default function PursuitWorkPanels(props:{
  pursuitId:string; sessionId:string|null; sessionActive:boolean;
  workingState:WorkingState|null; onWorkingStateChange:(state:WorkingState)=>void;
}) {
  const { pursuitId, sessionId, sessionActive, workingState, onWorkingStateChange } = props;
  const [sources,setSources]=useState<Source[]>([]);
  const [adaptations,setAdaptations]=useState<Adaptation[]>([]);
  const [activeAction,setActiveAction]=useState<Action|null>(null);
  const [mode,setMode]=useState<"URL"|"PASTED">("URL");
  const [url,setUrl]=useState(""); const [text,setText]=useState(""); const [title,setTitle]=useState("");
  const [result,setResult]=useState(""); const [note,setNote]=useState(""); const [resultStatus,setResultStatus]=useState<"COMPLETED"|"FAILED">("COMPLETED");
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");

  const auth=async()=>{const {data}=await supabase.auth.getSession();if(!data.session)throw new Error("Session expired. Please sign in again.");return data.session.access_token;};
  const refresh=useCallback(async()=>{
    if(!sessionId)return;
    const access=await auth();
    const [sr,ar]=await Promise.all([
      fetch(`/api/v1/pursuits/${pursuitId}/sources`,{headers:{Authorization:`Bearer ${access}`}}),
      fetch(`/api/v1/pursuits/${pursuitId}/actions?status=IN_PROGRESS`,{headers:{Authorization:`Bearer ${access}`}})
    ]);
    if(!sr.ok||!ar.ok)throw new Error("Unable to refresh work state.");
    const sb=await sr.json() as {sources?:Source[];adaptations?:Adaptation[]}; const ab=await ar.json() as {actions?:Action[]};
    setSources(sb.sources??[]);setAdaptations(sb.adaptations??[]);setActiveAction(ab.actions?.[0]??null);
  },[pursuitId,sessionId]);
  useEffect(()=>{void refresh().catch(e=>setError(e instanceof Error?e.message:"Unable to refresh work state."));},[refresh]);

  const reassess=async(access:string)=>{
    if(!sessionId)return;
    const r=await fetch(`/api/v1/pursuits/${pursuitId}/work`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify({session_id:sessionId})});
    const b=await r.json() as {working_state?:WorkingState;error?:string};
    if(!r.ok||!b.working_state)throw new Error(b.error||"Stryde could not reassess the Pursuit.");
    onWorkingStateChange(b.working_state);
  };

  const addSource=async()=>{
    if(busy||!sessionActive||(mode==="URL"?!url.trim():!text.trim()))return; setBusy(true);setError("");
    try{
      const access=await auth();
      const r=await fetch(`/api/v1/pursuits/${pursuitId}/sources`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify(mode==="URL"?{url:url.trim(),title:title.trim()||undefined}:{content:text.trim(),title:title.trim()||undefined})});
      const b=await r.json() as {source?:Source;adaptation?:Adaptation|null;warning?:string|null;error?:string};
      if(!r.ok||!b.source)throw new Error(b.error||"Unable to add source.");
      setSources(v=>[b.source!,...v.filter(x=>x.id!==b.source!.id)]);if(b.adaptation)setAdaptations(v=>[b.adaptation!,...v.filter(x=>x.source_id!==b.adaptation!.source_id)]);
      setUrl("");setText("");setTitle("");if(b.warning)setError(b.warning);
      if(sessionId)await reassess(access);await refresh();
    }catch(e){setError(e instanceof Error?e.message:"Unable to add source.");}finally{setBusy(false);}
  };

  const adoptGoal=async(sourceId:string,goal:string)=>{
    if(busy||!sessionId||!sessionActive)return;setBusy(true);setError("");
    try{const access=await auth();const r=await fetch(`/api/v1/pursuits/${pursuitId}/objective`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify({content:goal,source_id:sourceId})});const b=await r.json() as {error?:string};if(!r.ok)throw new Error(b.error||"Unable to set the goal.");await reassess(access);}catch(e){setError(e instanceof Error?e.message:"Unable to set the goal.");}finally{setBusy(false);}
  };

  const startAction=async()=>{
    if(busy||!sessionId||!sessionActive||activeAction)return;setBusy(true);setError("");
    try{const access=await auth();const r=await fetch(`/api/v1/pursuits/${pursuitId}/actions/start`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify({session_id:sessionId,approved:true})});const b=await r.json() as {action?:Action;working_state?:WorkingState;error?:string};if(!r.ok||!b.action)throw new Error(b.error||"Unable to start the Action.");setActiveAction(b.action);if(b.working_state)onWorkingStateChange(b.working_state);}catch(e){setError(e instanceof Error?e.message:"Unable to start the Action.");}finally{setBusy(false);}
  };

  const recordResult=async()=>{
    if(busy||!sessionId||!activeAction)return;if(!result.trim()){setError("Record what actually happened before closing the Action.");return;}setBusy(true);setError("");
    try{const access=await auth();const r=await fetch(`/api/v1/pursuits/${pursuitId}/actions/${activeAction.id}/complete`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify({session_id:sessionId,terminal_status:resultStatus,result:{text:result.trim()},note:note.trim()||undefined})});const b=await r.json() as {working_state?:WorkingState;error?:string};if(!r.ok||!b.working_state)throw new Error(b.error||"Unable to record the Action result.");setActiveAction(null);setResult("");setNote("");onWorkingStateChange(b.working_state);}catch(e){setError(e instanceof Error?e.message:"Unable to record the Action result.");}finally{setBusy(false);}
  };

  const move=workingState?.next_move;
  const label=(v:string)=>v.replaceAll("_"," ").toLowerCase();

  return <div className="space-y-4">
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Source material</p>
        <p className="mt-1 text-sm leading-6 text-zinc-600">Add a useful course, roadmap, video, article, or paste. Stryde extracts the method and checks it against your situation instead of copying it blindly.</p>
        <div className="mt-4 flex w-fit rounded-lg border border-zinc-200 p-0.5 text-xs"><button onClick={()=>setMode("URL")} className={`rounded-md px-2.5 py-1.5 ${mode==="URL"?"bg-zinc-100 text-zinc-900":"text-zinc-500"}`}>Link</button><button onClick={()=>setMode("PASTED")} className={`rounded-md px-2.5 py-1.5 ${mode==="PASTED"?"bg-zinc-100 text-zinc-900":"text-zinc-500"}`}>Paste</button></div>
        <div className="mt-3 space-y-2">
          <input value={title} onChange={e=>setTitle(e.target.value)} disabled={!sessionActive||busy} placeholder="Optional title" className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none"/>
          {mode==="URL"?<input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void addSource();}}} disabled={!sessionActive||busy} placeholder="YouTube, course, roadmap, article, or other public link" className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none"/>:<textarea value={text} onChange={e=>setText(e.target.value)} disabled={!sessionActive||busy} rows={5} placeholder="Paste the material, excerpt, transcript, or roadmap" className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm leading-6 outline-none"/>}
          <div className="flex justify-end"><button onClick={()=>void addSource()} disabled={!sessionActive||busy||(mode==="URL"?!url.trim():!text.trim())} className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white disabled:opacity-30">{busy?"Working…":"Add source"}</button></div>
        </div>
      </div>
      {sources.length>0&&<div className="border-t border-zinc-100">{sources.map(s=>{const a=adaptations.find(x=>x.source_id===s.id);return <details key={s.id} className="border-b border-zinc-100 last:border-0"><summary className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3.5"><div className="min-w-0"><p className="truncate text-sm font-medium">{s.title||s.uri||"Pasted source"}</p><p className="truncate text-xs text-zinc-400">{s.uri||"pasted material"} · {label(s.fetch_status)}</p></div>{a&&<span className="text-[11px] text-zinc-400">fit {label(a.fit.status)}</span>}</summary><div className="space-y-4 bg-zinc-50/60 px-5 pb-5 pt-1">{!a?<p className="text-sm leading-6 text-zinc-600">Stryde has the source reference but no usable extraction yet; it will not treat the source as established truth.</p>:<><div><p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">What Stryde extracted</p><p className="mt-1.5 text-sm leading-6">{a.summary}</p></div>{a.methods.length>0&&<div><p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">Method</p>{a.methods.map(m=><div key={`${m.sequence}-${m.title}`} className="mt-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-3"><p className="text-sm font-medium">{m.title}</p><p className="mt-1 text-sm leading-6 text-zinc-600">{m.description}</p><p className="mt-1 text-xs text-zinc-400">Expected change: {m.expected_change}</p></div>)}</div>}{(a.gaps.length>0||a.conflicts.length>0)&&<div className="grid gap-4 sm:grid-cols-2">{a.gaps.length>0&&<div><p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">Gaps</p>{a.gaps.map(x=><p key={x} className="mt-1 text-sm leading-6">• {x}</p>)}</div>}{a.conflicts.length>0&&<div><p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">Conflicts</p>{a.conflicts.map(x=><p key={x} className="mt-1 text-sm leading-6">• {x}</p>)}</div>}</div>}{a.goal_candidates.length>0&&<div><p className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">Possible goals</p>{a.goal_candidates.map(g=><div key={g.goal} className="mt-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-3"><p className="text-sm font-medium">{g.goal}</p><p className="mt-1 text-sm leading-6 text-zinc-600">{g.why}</p><button onClick={()=>void adoptGoal(s.id,g.goal)} disabled={busy||!sessionActive||!sessionId} className="mt-2 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-700 disabled:opacity-30">Use as current goal</button></div>)}</div>}</>}</div></details>})}</div>}
    </section>
    {(activeAction||move?.mode==="CREATE_ACTION")&&<section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"><div className="px-5 py-4"><div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Execution</p>{activeAction&&<span className="text-[11px] text-zinc-400">human action · {label(activeAction.status)}</span>}</div>{activeAction?<><h3 className="mt-2 text-[17px] font-medium tracking-tight">{activeAction.intent_summary}</h3><p className="mt-1 text-sm leading-6 text-zinc-600">Do it in the real world, then record what actually happened. That result becomes an Observation for the next move.</p><textarea value={result} onChange={e=>setResult(e.target.value)} disabled={busy} rows={4} placeholder="What happened? Give the concrete result, response, obstacle, or evidence." className="mt-4 w-full resize-y rounded-xl border border-zinc-200 px-3 py-3 text-sm leading-6 outline-none"/><input value={note} onChange={e=>setNote(e.target.value)} disabled={busy} placeholder="Optional note" className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none"/><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><div className="flex rounded-lg border border-zinc-200 p-0.5 text-xs"><button onClick={()=>setResultStatus("COMPLETED")} className={`rounded-md px-2.5 py-1.5 ${resultStatus==="COMPLETED"?"bg-zinc-100 text-zinc-900":"text-zinc-500"}`}>Completed</button><button onClick={()=>setResultStatus("FAILED")} className={`rounded-md px-2.5 py-1.5 ${resultStatus==="FAILED"?"bg-zinc-100 text-zinc-900":"text-zinc-500"}`}>Did not work</button></div><button onClick={()=>void recordResult()} disabled={busy||!result.trim()} className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white disabled:opacity-30">{busy?"Recording…":"Record result"}</button></div></>:<><h3 className="mt-2 text-[17px] font-medium tracking-tight">{move?.title}</h3><p className="mt-2 text-sm leading-6 text-zinc-600">{move?.user_needs_to_do}</p><div className="mt-4 flex justify-end"><button onClick={()=>void startAction()} disabled={busy||!sessionActive||!sessionId} className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-medium text-white disabled:opacity-30">{busy?"Starting…":"Start this action"}</button></div></>}</div></section>}
    {error&&<div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
  </div>;
}
