/**
 * Terminal-styled customer portal. Deliberately single-theme: black CRT with
 * green phosphor text — the design IS the dark theme. Self-contained HTML,
 * no external assets, no build step.
 */
import type { Account } from "../core/types.js";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root {
    --bg: #050807; --panel: #0a0f0c; --green: #33ff66; --dim: #1d8a45;
    --dark: #11351f; --warn: #ffd23f; --err: #ff5f56;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    background: var(--bg); color: var(--green);
    font: 15px/1.65 "SF Mono", ui-monospace, Menlo, Consolas, "DejaVu Sans Mono", monospace;
    padding: 2.5rem 1.25rem 5rem;
    text-shadow: 0 0 6px rgba(51, 255, 102, .28);
  }
  /* CRT scanlines + vignette */
  body::before {
    content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 2;
    background:
      repeating-linear-gradient(0deg, rgba(0,0,0,.16) 0 1px, transparent 1px 3px),
      radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%);
  }
  main { max-width: 860px; margin: 0 auto; position: relative; z-index: 1; }
  a { color: var(--green); }
  ::selection { background: var(--green); color: var(--bg); text-shadow: none; }
  pre.banner { color: var(--green); font-size: clamp(6px, 1.55vw, 13px); line-height: 1.15; margin-bottom: .75rem; }
  .dim { color: var(--dim); }
  .warn { color: var(--warn); }
  .err { color: var(--err); }
  .prompt::before { content: "$ "; color: var(--dim); }
  .out::before { content: "> "; color: var(--dim); }
  .line { margin: .3rem 0; }
  .cursor { display: inline-block; width: .6em; height: 1.1em; background: var(--green);
    vertical-align: text-bottom; animation: blink 1.05s steps(1) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .cursor { animation: none; } }
  section.panel {
    border: 1px solid var(--dark); background: var(--panel);
    padding: 1.25rem 1.4rem; margin: 1.5rem 0; border-radius: 2px;
  }
  section.panel h2 { font-size: 1rem; font-weight: 600; text-transform: lowercase; margin-bottom: .8rem; }
  section.panel h2::before { content: "## "; color: var(--dim); }
  form.term { display: flex; gap: .6rem; flex-wrap: wrap; align-items: center; margin-top: .8rem; }
  form.term label { color: var(--dim); }
  input[type=email], input[type=password], input[type=text] {
    background: var(--bg); border: 1px solid var(--dark); color: var(--green);
    font: inherit; padding: .5rem .7rem; min-width: min(320px, 70vw); border-radius: 2px;
    text-shadow: inherit;
  }
  input:focus { outline: 1px solid var(--green); }
  button {
    background: var(--dark); border: 1px solid var(--green); color: var(--green);
    font: inherit; padding: .5rem 1.1rem; cursor: pointer; border-radius: 2px; text-shadow: inherit;
  }
  button:hover { background: var(--green); color: var(--bg); text-shadow: none; }
  code.block, pre.block {
    display: block; background: var(--bg); border: 1px solid var(--dark);
    padding: .8rem 1rem; margin: .6rem 0; overflow-x: auto; border-radius: 2px;
    white-space: pre; font-size: .88em;
  }
  table { border-collapse: collapse; width: 100%; margin-top: .4rem; }
  td { padding: .35rem .8rem .35rem 0; vertical-align: top; }
  td:first-child { color: var(--dim); white-space: nowrap; }
  .status-active { color: var(--green); } .status-none { color: var(--warn); }
  .status-past_due, .status-canceled { color: var(--err); }
  footer { margin-top: 3rem; color: var(--dim); font-size: .85em; }
  .copybtn { padding: .15rem .6rem; font-size: .8em; margin-left: .5rem; }
</style>
</head>
<body><main>${body}
<footer class="line">superpower · merge labs · © 2026 stewart ventures inc. <span class="dim">· transmission ends</span></footer>
</main>
<script>
  function cp(id, btn) {
    navigator.clipboard.writeText(document.getElementById(id).innerText).then(() => {
      btn.textContent = "copied"; setTimeout(() => (btn.textContent = "copy"), 1200);
    });
  }
</script>
</body></html>`;
}

const BANNER = `
 ███████╗██╗   ██╗██████╗ ███████╗██████╗ ██████╗  ██████╗ ██╗    ██╗███████╗██████╗
 ██╔════╝██║   ██║██╔══██╗██╔════╝██╔══██╗██╔══██╗██╔═══██╗██║    ██║██╔════╝██╔══██╗
 ███████╗██║   ██║██████╔╝█████╗  ██████╔╝██████╔╝██║   ██║██║ █╗ ██║█████╗  ██████╔╝
 ╚════██║██║   ██║██╔═══╝ ██╔══╝  ██╔══██╗██╔═══╝ ██║   ██║██║███╗██║██╔══╝  ██╔══██╗
 ███████║╚██████╔╝██║     ███████╗██║  ██║██║     ╚██████╔╝╚███╔███╔╝███████╗██║  ██║
 ╚══════╝ ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝      ╚═════╝  ╚══╝╚══╝ ╚══════╝╚═╝  ╚═╝`;

export function landingPage(error?: string): string {
  return shell("superpower — the invisible brand-voice engine", `
<pre class="banner">${BANNER}</pre>
<p class="line out">the invisible brand-voice engine for AI coding tools <span class="cursor"></span></p>
<p class="line out dim">your team writes inside claude code / cursor / windsurf. superpower generates every piece of customer-facing copy in your captured voice — triggered automatically, powered by your real work.</p>

<section class="panel">
  <h2>how_it_works</h2>
  <p class="line prompt">capture a voice <span class="dim"># 8-15 of your best pieces, judged with your agent in chat</span></p>
  <p class="line prompt">register one MCP url <span class="dim"># 60 seconds, any repo, any machine</span></p>
  <p class="line prompt">ask for copy like you always do <span class="dim"># generation runs server-side in your voice</span></p>
</section>

<section class="panel">
  <h2>signup_or_login</h2>
  <p class="line dim">// one email, one magic link. new emails get an account; existing ones get logged in (and can recover a lost key).</p>
  ${error ? `<p class="line err">! ${esc(error)}</p>` : ""}
  <form class="term" method="POST" action="/signup">
    <label for="email">email:</label>
    <input type="email" id="email" name="email" required placeholder="you@company.com" autocomplete="email">
    <button type="submit">./authenticate --send-link</button>
  </form>
</section>

<section class="panel">
  <h2>login_with_api_key</h2>
  <p class="line dim">// fallback for API-first users.</p>
  <form class="term" method="POST" action="/dashboard">
    <label for="key">api_key:</label>
    <input type="password" id="key" name="key" required placeholder="sp_live_…" autocomplete="off">
    <button type="submit">./login --key</button>
  </form>
</section>`);
}

export function checkEmailPage(email: string, devLink?: string): string {
  return shell("superpower — check your email", `
<pre class="banner">${BANNER}</pre>
<section class="panel">
  <h2>check_your_email</h2>
  <p class="line out">one-time link sent to <b>${esc(email)}</b> <span class="cursor"></span></p>
  <p class="line dim">// expires in 30 minutes. new emails get an account; existing ones get logged straight in.</p>
  <p class="line dim">// nothing arrives? check spam for superpower@emails.mergelabs.co</p>
  ${devLink ? `<p class="line warn">! dev mode (no email provider) — <a href="${esc(devLink)}">./authenticate</a></p><!-- dev-link: ${esc(devLink)} -->` : ""}
</section>`);
}

export function keyIssuedPage(account: Account, host: string, isNew: boolean): string {
  return shell(isNew ? "superpower — key issued" : "superpower — key rotated", `
<pre class="banner">${BANNER}</pre>
<p class="line out">${isNew ? `account created for <b>${esc(account.email)}</b> — email verified` : `key ROTATED for <b>${esc(account.email)}</b> — the old key is dead; update your tools`}</p>

<section class="panel">
  <h2>your_api_key</h2>
  <p class="line warn">! shown once. store it like a password — it is your login and your MCP credential.</p>
  <code class="block" id="apikey">${esc(account.api_key)}</code>
  <button class="copybtn" onclick="cp('apikey', this)">copy</button>
</section>

<section class="panel">
  <h2>connect_your_tools</h2>
  <p class="line dim">// claude code — one command, works in every repo:</p>
  <code class="block" id="cc">claude mcp add --transport http superpower ${esc(host)}/mcp \\
  --header "Authorization: Bearer ${esc(account.api_key)}"</code>
  <button class="copybtn" onclick="cp('cc', this)">copy</button>
  <p class="line dim">// cursor — add to ~/.cursor/mcp.json:</p>
  <code class="block" id="cu">{ "mcpServers": { "superpower": {
    "url": "${esc(host)}/mcp",
    "headers": { "Authorization": "Bearer ${esc(account.api_key)}" } } } }</code>
  <button class="copybtn" onclick="cp('cu', this)">copy</button>
</section>

<section class="panel">
  <h2>next</h2>
  <p class="line prompt">open a new session and say: "capture my writing voice" <span class="dim"># your agent walks you through it</span></p>
  <p class="line prompt"><a href="/dashboard">./dashboard</a> <span class="dim"># billing + account, login with your key</span></p>
</section>`);
}

export function dashboardLoginPage(error?: string): string {
  return shell("superpower — login", `
<pre class="banner">${BANNER}</pre>
<section class="panel">
  <h2>authenticate</h2>
  ${error ? `<p class="line err">! ${esc(error)}</p>` : ""}
  <form class="term" method="POST" action="/dashboard">
    <label for="key">api_key:</label>
    <input type="password" id="key" name="key" required placeholder="sp_live_…" autocomplete="off">
    <button type="submit">./login</button>
  </form>
  <p class="line dim" style="margin-top:.8rem">// no key? <a href="/">sign up</a></p>
</section>`);
}

export interface BillingLinks {
  stripeEnabled?: boolean;
  paymentLink?: string;
  portalLink?: string;
}

export function dashboardPage(account: Account, host: string, billing: BillingLinks): string {
  const masked = account.api_key.slice(0, 11) + "…" + account.api_key.slice(-4);
  const statusClass = `status-${account.stripe_status}`;
  const keyField = `<input type="hidden" name="key" value="${esc(account.api_key)}">`;
  const billingBody =
    account.stripe_status === "active"
      ? `<p class="line out">subscription <span class="status-active">ACTIVE</span> — plan: ${esc(account.plan)} ($49/mo)</p>
         ${
           billing.stripeEnabled
             ? `<form class="term" method="POST" action="/billing/portal">${keyField}<button type="submit">./manage_billing</button><span class="dim"># invoices, payment method, cancel — via stripe</span></form>`
             : ""
         }`
      : `<p class="line out">status: <span class="${statusClass}">${esc(account.stripe_status.toUpperCase())}</span> — plan: ${esc(account.plan)}</p>
         ${
           billing.stripeEnabled
             ? `<form class="term" method="POST" action="/billing/checkout">${keyField}<button type="submit">./activate_subscription --price 49/mo</button><span class="dim"># secure checkout via stripe</span></form>
                <p class="line dim">// activation is automatic within seconds of checkout completing.</p>`
             : `<p class="line warn">! billing not yet enabled on this deployment — your trial key works without limits for now.</p>`
         }`;
  return shell("superpower — dashboard", `
<pre class="banner">${BANNER}</pre>
<p class="line out">authenticated as <b>${esc(account.email)}</b> <span class="cursor"></span></p>

<section class="panel">
  <h2>account</h2>
  <table>
    <tr><td>email</td><td>${esc(account.email)}</td></tr>
    <tr><td>api_key</td><td>${esc(masked)} <span class="dim"># lost it? ./rotate_api_key below issues a fresh one</span></td></tr>
    <tr><td>plan</td><td>${esc(account.plan)}</td></tr>
    <tr><td>member_since</td><td>${esc(account.created_at.slice(0, 10))}</td></tr>
  </table>
</section>

<section class="panel">
  <h2>billing</h2>
  ${billingBody}
</section>

<section class="panel">
  <h2>connect_your_tools</h2>
  <p class="line dim">// claude code:</p>
  <code class="block" id="cc">claude mcp add --transport http superpower ${esc(host)}/mcp \\
  --header "Authorization: Bearer &lt;your api key&gt;"</code>
  <p class="line dim">// cursor (~/.cursor/mcp.json):</p>
  <code class="block" id="cu">{ "mcpServers": { "superpower": {
    "url": "${esc(host)}/mcp",
    "headers": { "Authorization": "Bearer &lt;your api key&gt;" } } } }</code>
</section>

<section class="panel">
  <h2>account_actions</h2>
  <form class="term" method="POST" action="/account/rotate" onsubmit="return confirm('Rotate key? The current key stops working immediately — every connected tool must be updated.')">
    <button type="submit">./rotate_api_key</button><span class="dim"># invalidates the old key instantly</span>
  </form>
  <form class="term" method="POST" action="/logout">
    <button type="submit">./logout</button>
  </form>
</section>`);
}
