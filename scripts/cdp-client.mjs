
// Minimal Chrome DevTools Protocol client used to verify the real UI in a real
// browser against a real served build.
//
// API and database tests cannot catch an unhydrated page: a build can compile,
// pass every server test, deploy successfully, and still ship a UI whose React
// never attaches, leaving a sign-in form that silently does nothing. That failure
// mode was real here and was only visible in a browser.
//
// Expects a Chrome started with --remote-debugging-port. Use a throwaway profile
// so no real browser state is read or modified.
const base = "http://127.0.0.1:9222";
const targets = await (await fetch(`${base}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(targets.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const events = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else if (msg.method) events.push(msg);
});
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
function send(method, params = {}) {
  const myId = ++id;
  ws.send(JSON.stringify({ id: myId, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(myId, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    setTimeout(() => reject(new Error(`${method} timed out`)), 60000);
  });
}
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
  return r.result.value;
}
async function goto(url) {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url });
  await new Promise((r) => setTimeout(r, 2500));
}
const waitFor = async (expr, timeoutMs = 30000, label = expr) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await evaluate(expr)) return true; } catch {}
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error(`timeout waiting for: ${label}`);
};
const api = { send, evaluate, goto, waitFor, ws, targetId: targets.id };
globalThis.__cdp = api;
export default api;
