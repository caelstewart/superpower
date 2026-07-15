/** Build known-figure demo voices, generate real LP blind-test pairs, write examples.ts, clean up. */
import { createStore } from "../dist/db/database.js";
import { createProvider } from "../dist/providers/index.js";
import { generateCopy } from "../dist/core/generate.js";
import { writeFileSync } from "node:fs";

const HORMOZI = [
  "Follow your passion is the worst advice ever. You don't start passionate. You get good at something. Then you get rewarded for it. Then you get passionate. Passion follows mastery, it doesn't lead it. Stop waiting to feel passionate. Go get good at something useful. The passion comes after.",
  "Don't build confidence. Build evidence. Confidence is just the memory of past success. You can't think your way into it. You do the reps. You keep the receipts. The confidence takes care of itself.",
  "The more money you make other people, the more money you make. That's the whole game. Stop trying to extract. Start trying to provide. Your income is just a measure of how many people you helped and how much.",
  "If you try 100 offers, you will succeed. Guaranteed. The problem is most people try zero. The ones who try quit after one. The offer is a numbers game. Test enough and one hits. The only way to lose is to stop testing.",
  "You don't need more time. You need fewer priorities. Everyone says they're busy. What they mean is they said yes to too many things that don't matter. Cut the list. Do the one thing. The busy people who win are just focused people who said no more.",
  "Charge more. I'm serious. Your prices are too low because you're scared. Low prices attract the worst clients and starve your business. Raise them. You'll lose the tire-kickers and keep the people who actually value what you do. Price is a signal. Send a better one.",
  "Nobody is coming to save you. Not the government. Not your boss. Not some investor. The sooner you internalize that, the sooner you get to work. It's not depressing, it's freeing. If it's up to you, then it's actually up to you.",
  "Rich people master their time. Poor people let their time get mastered. Every hour you don't control is an hour someone else is spending for you. Guard it like it's the only thing you have. Because it is.",
];
const NAVAL = [
  "Seek wealth, not money or status. Wealth is having assets that earn while you sleep. Money is how we transfer time and wealth. Status is your place in the social hierarchy.",
  "You're not going to get rich renting out your time. You must own equity, a piece of a business, to gain your financial freedom.",
  "You will get rich by giving society what it wants but does not yet know how to get. At scale.",
  "Play long-term games with long-term people. All the returns in life, in wealth, relationships, and knowledge, come from compound interest.",
  "Arm yourself with specific knowledge, accountability, and leverage. Specific knowledge is knowledge you cannot be trained for. If society can train you, it can train someone else to replace you.",
  "Code and media are permissionless leverage. They're the leverage behind the newly rich. You can create software and media that works for you while you sleep.",
  "Escape competition through authenticity. No one can compete with you on being you. Most of life is a search for who and what needs you the most.",
  "A calm mind, a fit body, and a house full of love. These things cannot be bought. They must be earned.",
];

const store = await createStore();
const p = createProvider();

async function buildVoice(id, name, identity, defaultType, specimens, brief, genericPrompt, label, briefText) {
  await store.deleteVoice(id);
  await store.createVoice({ id, name, description: `Demo: ${name}`, identity, thinking: "", guidelines: "", default_type: defaultType });
  for (const [i, body] of specimens.entries())
    await store.addSpecimen({ voice_id: id, content_type: defaultType, title: `${name} ${i + 1}`, subtitle: "", body, quality: 5, source: "demo", written_at: "" });
  const v = await store.getVoice(id);
  const sp = await generateCopy(store, p, v, brief, defaultType);
  const generic = await p.chat([{ role: "user", content: genericPrompt }], { temperature: 0.85, maxTokens: 1200 });
  await store.deleteVoice(id);
  return { label, brief: briefText, human: sp.output.trim(), ai: generic.trim(), real: true };
}

const hormozi = await buildVoice(
  "demo-hormozi", "Alex Hormozi",
  "You are Alex Hormozi, entrepreneur and author of $100M Offers. You write short, punchy business and money advice for founders and creators. Blunt, contrarian, no fluff. Short lines. You write for an audience trying to build wealth.",
  "post",
  HORMOZI,
  "Why your business isn't growing: it's not your marketing, it's your offer. Most people try to get more attention when they should make their offer so good people feel stupid saying no.",
  "Write a motivational business post for entrepreneurs about how your offer matters more than your marketing. Make it engaging and inspiring.",
  "A business post in Alex Hormozi's voice",
  "Idea: founders blame their marketing when growth stalls, but the real problem is usually the offer. Fix the offer — make it so good people feel stupid saying no — before spending more on attention."
);

const naval = await buildVoice(
  "demo-naval", "Naval Ravikant",
  "You are Naval Ravikant, angel investor and philosopher. You write short, dense aphorisms about wealth, leverage, judgment, and living well. Calm, first-principles, quotable. Each line stands alone.",
  "post",
  NAVAL,
  "Why judgment matters more than hard work in the age of leverage. When one decision can be multiplied across code, capital, and media, being right matters more than working hard.",
  "Write an inspirational thread about why good judgment beats hard work when you have leverage. Make it thoughtful and shareable.",
  "A short thread in Naval Ravikant's voice",
  "Idea: in an age of leverage (code, capital, media), a single good decision gets multiplied enormously — so judgment, being right, matters far more than sheer effort. Hard work applied to the wrong thing just scales the mistake."
);

const examples = [
  { label: "A landing-page headline for a scheduling tool", brief: "",
    human: "Stop emailing back and forth about times. Send one link. Done.",
    ai: "Revolutionize Your Productivity With Our Cutting-Edge, AI-Powered Scheduling Solution", real: false },
  hormozi,
  naval,
];
writeFileSync("src/web/examples.ts",
  "// Auto-generated LP blind-test examples. real:true rounds are unedited live output:\n" +
  "// a captured voice (Superpower) vs the same base model with a normal prompt.\n" +
  "export interface QuizExample { label: string; brief: string; human: string; ai: string; real: boolean; }\n" +
  "export const QUIZ_EXAMPLES: QuizExample[] = " + JSON.stringify(examples, null, 2) + ";\n");
console.log("hormozi:", hormozi.human.split(/\s+/).length, "vs", hormozi.ai.split(/\s+/).length);
console.log("naval:", naval.human.split(/\s+/).length, "vs", naval.ai.split(/\s+/).length);
await store.close();
