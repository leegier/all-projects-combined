#!/usr/bin/env node
// R&D Dream Team Debate Engine
// Usage: node weekly-debate.js "idea to debate"

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TEAM = [
  {
    name: 'Sofia Reyes',
    title: 'Chief Strategy Officer',
    prompt: 'You are Sofia Reyes, Chief Strategy Officer of a one-man AI empire. Your job is to evaluate ideas for strategic fit — does this align with our mission to build AI tools that make real money? You are decisive, direct, and ruthless about what matters. Keep your analysis under 150 words.'
  },
  {
    name: 'Isabella Cruz',
    title: 'Head of Technology',
    prompt: 'You are Isabella Cruz, Head of Technology. Your job is to evaluate the technical feasibility of ideas — can it be built fast? What APIs/tools are needed? What are the technical risks? You think in systems and code. Keep your analysis under 150 words.'
  },
  {
    name: 'Valentina Morales',
    title: 'Revenue Architect',
    prompt: 'You are Valentina Morales, Revenue Architect. Your job is to evaluate monetization potential — how do we make money from this, how fast, and how much? Think pricing models, target buyers, and market size. Keep your analysis under 150 words.'
  },
  {
    name: 'Camila Torres',
    title: 'Creative Director',
    prompt: 'You are Camila Torres, Creative Director. Your job is to evaluate content and marketing angles — what is the hook, who shares this, how does it go viral? Think about YouTube, X, and Discord communities. Keep your analysis under 150 words.'
  },
  {
    name: 'Lucia Vega',
    title: 'Competitive Intelligence',
    prompt: 'You are Lucia Vega, Competitive Intelligence. Your job is to check if competitors are already doing this and what we can learn from them. Should we copy what is working? Is the market crowded? Keep your analysis under 150 words.'
  }
];

async function runDebate(topic) {
  console.log(`\nR&D Team Debate: "${topic}"\n${'='.repeat(60)}`);
  
  const perspectives = [];
  
  for (const agent of TEAM) {
    console.log(`\n[${agent.name} — ${agent.title}]`);
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: agent.prompt,
      messages: [{ role: 'user', content: `Evaluate this idea for our AI empire: ${topic}` }]
    });
    const text = response.content[0].text;
    perspectives.push({ agent: agent.name, title: agent.title, opinion: text });
    console.log(text);
  }
  
  // Final synthesis
  console.log('\n[FINAL MEMO — Team Consensus]\n');
  const synthesisPrompt = perspectives.map(p => `${p.agent} (${p.title}):\n${p.opinion}`).join('\n\n');
  
  const memo = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: 'You are the moderator of the R&D Dream Team. Synthesize the 5 perspectives into a final recommendation memo. Lead with a clear VERDICT: BUILD / PASS / RESEARCH MORE. Then give 3 bullet point reasons. End with the #1 next action if verdict is BUILD.',
    messages: [{ role: 'user', content: `Topic: ${topic}\n\nTeam perspectives:\n${synthesisPrompt}` }]
  });
  
  const memoText = memo.content[0].text;
  console.log(memoText);
  
  // Save memo
  const date = new Date().toISOString().split('T')[0];
  const memoDir = 'Z:\openclaw\workspace\rd-team\memos';
  if (!fs.existsSync(memoDir)) fs.mkdirSync(memoDir, { recursive: true });
  
  const memoFile = path.join(memoDir, `${date}.md`);
  const content = `# R&D Memo — ${date}\n## Topic: ${topic}\n\n${perspectives.map(p => `### ${p.agent}\n${p.opinion}`).join('\n\n')}\n\n---\n## Final Verdict\n${memoText}`;
  
  fs.writeFileSync(memoFile, content);
  console.log(`\nMemo saved to ${memoFile}`);
  
  return { perspectives, memo: memoText };
}

const topic = process.argv[2] || 'Build a SaaS tool that auto-generates itch.io product listings using AI';
runDebate(topic).catch(console.error);
