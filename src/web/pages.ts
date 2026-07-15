/**
* Blueprint-styled customer portal (off-white grid paper, navy ink). Landing
 * page includes an interactive blind-test quiz. Self-contained HTML, no
 * external assets, no build step.
 */
import type { Account } from "../core/types.js";
import { QUIZ_EXAMPLES } from "./examples.js";

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
  :root{
    --paper:#e8e3d6; --panel:#f4f0e6; --card:#f8f5ec; --ink:#26241f; --ink-soft:#6f6a5e;
    --blue:#2a5d94; --blue-soft:#e7ecdf; --rule:#d8d2c2; --good:#3a7a4e;
    --warn:#8a6a1a; --err:#b04a34; --grid:rgba(90,80,55,.05);
    --shadow:0 1px 2px rgba(60,52,34,.06), 0 12px 30px -16px rgba(60,52,34,.16);
    --sans:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Segoe UI",system-ui,Helvetica,Arial,sans-serif;
    --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{min-height:100%}
  body{
    background-color:var(--paper);
    background-image:linear-gradient(var(--grid) 1px,transparent 1px),
      linear-gradient(90deg,var(--grid) 1px,transparent 1px);
    background-size:44px 44px;
    color:var(--ink);
    font:16px/1.55 var(--sans);
    -webkit-font-smoothing:antialiased;
    letter-spacing:-.006em;
    padding:2.75rem 1.25rem 5rem;
  }
  main{max-width:920px;margin:0 auto}
  a{color:var(--blue)}
  b{font-weight:600}
  ::selection{background:var(--blue);color:#fff}
  .cursor{display:none}

  .banner{border:1px solid var(--rule);background:var(--panel);border-radius:16px;box-shadow:var(--shadow);
    display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;
    padding:1.3rem 1.5rem;margin-bottom:1.75rem}
  .wordmark{font-weight:700;font-size:1.65rem;letter-spacing:-.02em;line-height:1}
  .wordmark small{display:block;font-weight:500;font-size:.78rem;letter-spacing:0;
    color:var(--ink-soft);margin-top:.4rem}
  .specblock{font-family:var(--mono);font-size:.66rem;line-height:1.7;color:var(--ink-soft);text-align:right}
  .specblock b{color:var(--ink);font-weight:600}

  .lede{font-size:1.15rem;line-height:1.5;max-width:64ch;margin:0 0 .7rem;letter-spacing:-.01em}
  .lede.sub{color:var(--ink-soft);font-size:1rem;letter-spacing:-.006em}

  section.panel{border:1px solid var(--rule);background:var(--panel);border-radius:16px;box-shadow:var(--shadow);
    padding:1.75rem 1.9rem 1.9rem;margin:1.5rem 0}
  section.panel h2{font-size:.76rem;letter-spacing:.04em;color:var(--blue);
    font-weight:600;margin-bottom:1.1rem;display:flex;align-items:center;gap:.65rem}
  section.panel h2::before{content:attr(data-fig);color:var(--ink-soft);white-space:nowrap;font-family:var(--mono);font-size:.68rem}
  section.panel h2::after{content:"";flex:1;height:1px;background:var(--rule)}

  .line{margin:.4rem 0}
  .dim{color:var(--ink-soft)}
  .warn{color:var(--warn)} .err{color:var(--err)}
  .out::before{content:"";}
  .prompt{font-size:1rem;margin:.6rem 0;font-weight:450}
  .prompt::before{content:"›";color:var(--blue);font-weight:700;margin-right:.5rem}

  form.term{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin-top:1.1rem}
  form.term label{color:var(--ink-soft);font-size:.92rem}
  input[type=email],input[type=password],input[type=text]{
    background:#fbf9f2;border:1px solid #d9d4c8;color:var(--ink);font:inherit;
    padding:.65rem .85rem;min-width:min(320px,70vw);border-radius:10px}
  input:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-soft)}
  button{background:var(--blue);border:1px solid var(--blue);color:#fff;font:inherit;
    font-weight:600;padding:.65rem 1.3rem;cursor:pointer;border-radius:10px;letter-spacing:-.01em;
    transition:transform .08s,background .12s}
  button:hover{background:#1a4c82}
  button:active{transform:scale(.98)}

  code.block,pre.block{display:block;background:#efeadd;border:1px solid var(--rule);
    padding:.9rem 1.05rem;margin:.6rem 0;overflow-x:auto;border-radius:10px;
    font-family:var(--mono);font-size:.82em;white-space:pre;color:var(--ink)}
  table{border-collapse:collapse;width:100%;margin-top:.4rem}
  td{padding:.45rem .9rem .45rem 0;vertical-align:top}
  td:first-child{color:var(--ink-soft);white-space:nowrap;font-size:.9rem}
  .status-active{color:var(--good)} .status-none{color:var(--warn)}
  .status-past_due,.status-canceled{color:var(--err)}
  .copybtn{background:transparent;color:var(--blue);border:1px solid var(--rule);
    padding:.25rem .75rem;font-size:.8em;margin-left:.5rem;font-weight:500;border-radius:8px}
  footer{margin-top:3rem;padding-top:1.2rem;border-top:1px solid var(--rule);
    color:var(--ink-soft);font-size:.78rem;letter-spacing:.01em}

  /* blind-test quiz */
  .quiz-intro{margin-bottom:1.4rem;font-size:1rem;line-height:1.55}
  .quiz-round{margin:1.75rem 0}
  .quiz-q{font-weight:600;font-size:1.05rem;margin-bottom:.2rem;letter-spacing:-.01em}
  .quiz-tag{font-size:.72rem;letter-spacing:.02em;color:var(--ink-soft);margin-bottom:.85rem}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:1.1rem}
  @media(max-width:720px){.cards{grid-template-columns:1fr}}
  .card{border:1px solid var(--rule);background:var(--card);padding:1.1rem 1.2rem;cursor:pointer;
    border-radius:12px;transition:border-color .12s,box-shadow .14s,opacity .12s,transform .1s;
    font-size:.98rem;line-height:1.55}
  .card:hover{border-color:var(--blue);box-shadow:var(--shadow);transform:translateY(-1px)}
  .card .post{white-space:pre-wrap;max-height:21rem;overflow-y:auto;font-size:.92rem;line-height:1.6}
  .brief-box{background:var(--blue-soft);padding:.85rem 1.05rem;border-radius:12px;
    margin:.5rem 0 1.1rem;font-size:.92rem;line-height:1.5}
  .brief-label{display:block;font-size:.66rem;letter-spacing:.06em;
    color:var(--blue);font-weight:600;margin-bottom:.35rem}
  .real-tag{font-size:.62rem;letter-spacing:.04em;color:var(--good);
    background:#e3ecd7;padding:.12rem .5rem;border-radius:20px;font-weight:600;
    vertical-align:middle;margin-left:.5rem}
  .card .pick{font-size:.7rem;letter-spacing:.02em;color:var(--blue);
    margin-top:.85rem;display:block;font-weight:600}
  .card.chosen{border-color:var(--blue);box-shadow:0 0 0 2px var(--blue)}
  .card.reveal-good{border-color:var(--good);background:#e9f0e0}
  .card.reveal-bad{opacity:.5}
  .verdict{font-size:.72rem;letter-spacing:.03em;margin-top:.8rem;font-weight:600}
  .verdict.good{color:var(--good)} .verdict.bad{color:var(--ink-soft)}
  .quiz-result{border:1px solid var(--rule);background:linear-gradient(180deg,#f6f2e9,#f1ecdf);border-radius:16px;
    box-shadow:var(--shadow);padding:1.9rem;margin-top:1.9rem;display:none}
  .quiz-result h3{font-size:1.5rem;margin-bottom:.8rem;text-wrap:balance;letter-spacing:-.02em;font-weight:700}
  .quiz-result .score{color:var(--blue);font-weight:800}
</style>
</head>
<body><main>${body}
<footer>Superpower · Merge Labs · © 2026 Stewart Ventures Inc.</footer>
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

const BANNER = `<div class="banner">
  <div class="wordmark">Superpower<small>The Invisible Brand-Voice Engine</small></div>
  <div class="specblock">
    Unit: <b>MCP-Core</b><br>
    Built by: <b>Merge Labs</b><br>
    Status: <b>Operational</b><br>
    Clients: Claude Code · Cursor · Windsurf
  </div>
</div>`;

export function landingPage(error?: string): string {
  const rounds = QUIZ_EXAMPLES.map((ex, i) => {
    const humanLeft = i % 2 === 1; // alternate side so position isn't a tell
    const humanCard = `<div class="card" data-good="1"><div class="post">${esc(ex.human)}</div><span class="pick">Tap to choose</span></div>`;
    const aiCard = `<div class="card" data-good="0"><div class="post">${esc(ex.ai)}</div><span class="pick">Tap to choose</span></div>`;
    const briefBox = ex.brief
      ? `<div class="brief-box"><span class="brief-label">The brief</span>${esc(ex.brief)}</div>`
      : "";
    return `
  <div class="quiz-round" data-round="${i + 1}">
    <p class="quiz-q">${esc(ex.label)}${ex.real ? ` <span class="real-tag">real · generated live</span>` : ""}</p>
    <p class="quiz-tag">Round ${i + 1} of ${QUIZ_EXAMPLES.length}</p>
    ${briefBox}
    <div class="cards">${humanLeft ? humanCard + aiCard : aiCard + humanCard}</div>
  </div>`;
  }).join("\n");

  return shell("Superpower — The Invisible Brand-Voice Engine", `
${BANNER}
<p class="lede">Your team writes inside Claude Code, Cursor, and Windsurf. Superpower generates every piece of customer-facing copy in your captured voice — triggered automatically, powered by your real work.</p>
<p class="lede sub">Before the pitch, run the test. Two versions of each piece — pick the one that sounds right. For the named voices, the one that actually sounds like them.</p>

<section class="panel">
  <h2 data-fig="FIG. 01">The Blind Test</h2>
  <p class="quiz-intro dim">Each pair: one written the Superpower way — the same base model, but writing from a voice captured from real work — and one from that model with a normal prompt. The named rounds are <b>real, unedited output generated live</b>. For those, tap the one that actually sounds like them.</p>
${rounds}

  <div class="quiz-result" id="quiz-result">
    <h3>You matched the voice <span class="score" id="qscore">0 / 3</span> times.</h3>
    <p class="lede">The version that actually sounded like them — tighter, no filler, unmistakably their voice — was Superpower every time: the same base model, but writing from a voice captured from real work. The other was that model with a normal prompt.</p>
    <p class="lede sub">That gap is the whole product. On your own copy it's the difference between something people read and something they scroll past. Superpower captures a voice from your best work and writes every piece in it — right inside the tools your team already uses.</p>
    <p class="line" style="margin-top:1.2rem"><a href="#get-started"><button type="button">Capture your voice →</button></a></p>
  </div>
</section>

<section class="panel">
  <h2 data-fig="FIG. 02">How It Works</h2>
  <p class="line prompt">Capture a voice <span class="dim">— 8–15 of your best pieces, judged with your agent in chat</span></p>
  <p class="line prompt">Register one MCP URL <span class="dim">— 60 seconds, any repo, any machine</span></p>
  <p class="line prompt">Ask for copy like you always do <span class="dim">— generation runs server-side, in your voice</span></p>
</section>

<section class="panel" id="get-started">
  <h2 data-fig="FIG. 03">Get Started</h2>
  <p class="line dim">One email, one magic link. New addresses get an account; existing ones get logged in and can recover a lost key.</p>
  ${error ? `<p class="line err">! ${esc(error)}</p>` : ""}
  <form class="term" method="POST" action="/signup">
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required placeholder="you@company.com" autocomplete="email">
    <button type="submit">Send login link</button>
  </form>
</section>

<script>
(function(){
  var rounds=[].slice.call(document.querySelectorAll('.quiz-round'));
  var answered=0, correct=0;
  rounds.forEach(function(round){
    var cards=[].slice.call(round.querySelectorAll('.card'));
    cards.forEach(function(card){
      card.addEventListener('click',function(){
        if(round.dataset.done) return;
        round.dataset.done='1'; answered++;
        if(card.dataset.good==='1') correct++;
        cards.forEach(function(c){
          var good=c.dataset.good==='1';
          c.classList.add(good?'reveal-good':'reveal-bad');
          var p=c.querySelector('.pick'); if(p) p.remove();
          var v=document.createElement('div');
          v.className='verdict '+(good?'good':'bad');
          v.textContent=good?'\\u2713 Superpower — captured voice':'\\u2717 Generic AI — normal prompt';
          c.appendChild(v);
        });
        card.classList.add('chosen');
        if(answered===rounds.length){
          document.getElementById('qscore').textContent=correct+' / '+rounds.length;
          var box=document.getElementById('quiz-result');
          box.style.display='block';
          box.scrollIntoView({behavior:'smooth',block:'nearest'});
        }
      });
    });
  });
})();
</script>`);
}

export function checkEmailPage(email: string, devLink?: string): string {
  return shell("superpower — check your email", `
${BANNER}
<section class="panel">
  <h2>check_your_email</h2>
  <p class="line out">one-time link sent to <b>${esc(email)}</b> <span class="cursor"></span></p>
  <p class="line dim">// expires in 30 minutes. new emails get an account; existing ones get logged straight in.</p>
  <p class="line dim">// nothing after a minute? check SPAM and the promotions tab for superpower@emails.mergelabs.co — or resend:</p>
  <form class="term" method="POST" action="/signup">
    <input type="hidden" name="email" value="${esc(email)}">
    <button type="submit">Resend link</button>
  </form>
  ${devLink ? `<p class="line warn">! dev mode (no email provider) — <a href="${esc(devLink)}">Log in</a></p><!-- dev-link: ${esc(devLink)} -->` : ""}
</section>`);
}

export function keyIssuedPage(account: Account, host: string, isNew: boolean): string {
  return shell(isNew ? "superpower — key issued" : "superpower — key rotated", `
${BANNER}
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
  <p class="line prompt"><a href="/dashboard">Go to dashboard</a> <span class="dim"># billing + account, login with your key</span></p>
</section>`);
}

export function dashboardLoginPage(error?: string): string {
  return shell("superpower — login", `
${BANNER}
<section class="panel">
  <h2>log_in</h2>
  <p class="line dim">// enter your email and we'll send a one-time login link.</p>
  ${error ? `<p class="line err">! ${esc(error)}</p>` : ""}
  <form class="term" method="POST" action="/login">
    <label for="email">email:</label>
    <input type="email" id="email" name="email" required placeholder="you@company.com" autocomplete="email">
    <button type="submit">Send login link</button>
  </form>
</section>`);
}

export interface BillingLinks {
  stripeEnabled?: boolean;
  paymentLink?: string;
  portalLink?: string;
}

export function dashboardPage(account: Account, host: string, billing: BillingLinks, rotated = false): string {
  const key = account.api_key;
  const statusClass = `status-${account.stripe_status}`;
  const billingBody =
    account.stripe_status === "active"
      ? `<p class="line out">subscription <span class="status-active">ACTIVE</span> — plan: ${esc(account.plan)} ($20/mo)</p>
         ${
           billing.stripeEnabled
             ? `<form class="term" method="POST" action="/billing/portal"><button type="submit">Manage billing</button><span class="dim"># invoices, payment method, cancel — via stripe</span></form>`
             : ""
         }`
      : `<p class="line out">status: <span class="${statusClass}">${esc(account.stripe_status.toUpperCase())}</span> — plan: ${esc(account.plan)}</p>
         ${
           billing.stripeEnabled
             ? `<form class="term" method="POST" action="/billing/checkout"><button type="submit">Subscribe — $20/mo</button><span class="dim"># secure checkout via stripe</span></form>
                <p class="line dim">// activation is automatic within seconds of checkout completing.</p>`
             : `<p class="line warn">! billing not yet enabled on this deployment — your trial key works without limits for now.</p>`
         }`;
  return shell("superpower — dashboard", `
${BANNER}
<p class="line out">authenticated as <b>${esc(account.email)}</b> <span class="cursor"></span></p>
${rotated ? `<p class="line warn">! key rotated — the previous key is now dead. update your tools with the new key below.</p>` : ""}

<section class="panel">
  <h2>account</h2>
  <table>
    <tr><td>email</td><td>${esc(account.email)}</td></tr>
    <tr><td>plan</td><td>${esc(account.plan)}</td></tr>
    <tr><td>member_since</td><td>${esc(account.created_at.slice(0, 10))}</td></tr>
  </table>
</section>

<section class="panel">
  <h2>api_key</h2>
  <p class="line dim">// your full key — visible only on your authenticated dashboard. treat it like a password.</p>
  <code class="block" id="apikey">${esc(key)}</code>
  <button class="copybtn" onclick="cp('apikey', this)">copy</button>
</section>

<section class="panel">
  <h2>billing</h2>
  ${billingBody}
</section>

<section class="panel">
  <h2>connect_your_tools</h2>
  <p class="line dim">// claude code — paste this whole line (your real key is already in it):</p>
  <code class="block" id="cc">claude mcp add --transport http superpower ${esc(host)}/mcp \\
  --header "Authorization: Bearer ${esc(key)}"</code>
  <button class="copybtn" onclick="cp('cc', this)">copy</button>
  <p class="line dim">// cursor (~/.cursor/mcp.json):</p>
  <code class="block" id="cu">{ "mcpServers": { "superpower": {
    "url": "${esc(host)}/mcp",
    "headers": { "Authorization": "Bearer ${esc(key)}" } } } }</code>
  <button class="copybtn" onclick="cp('cu', this)">copy</button>
</section>

<section class="panel">
  <h2>account_actions</h2>
  <form class="term" method="POST" action="/account/rotate" onsubmit="return confirm('Rotate key? The current key stops working immediately — every connected tool must be updated.')">
    <button type="submit">Rotate API key</button><span class="dim"># invalidates the old key instantly, then shows the new one here</span>
  </form>
  <form class="term" method="POST" action="/logout">
    <button type="submit">Log out</button>
  </form>
</section>`);
}
