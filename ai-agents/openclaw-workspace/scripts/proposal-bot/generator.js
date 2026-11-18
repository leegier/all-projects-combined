// generator.js — LLM-powered proposal writer via Anthropic claude-sonnet-4-6
// Produces custom proposals, NOT templates. Scores job relevance first.

import Anthropic from '@anthropic-ai/sdk';
import { CONFIG } from './config.js';

const anthropic = new Anthropic({ apiKey: CONFIG.anthropic.apiKey });

async function callLLM(systemPrompt, userPrompt, maxTokens = 800) {
  const msg = await anthropic.messages.create({
    model: CONFIG.anthropic.model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return msg.content[0].text.trim();
}

// Returns 1-10 relevance score + reason. Returns 0 if clearly irrelevant.
export async function scoreJob(job) {
  const systemPrompt = `You are a relevance scorer for a freelance developer's proposal bot.
The developer's skills: ${CONFIG.profile.skills.join(', ')}.
Rate how well this job matches the developer's skillset.
Respond with JSON only: {"score": <1-10>, "reason": "<one sentence>"}
Score 1-4 = don't apply. Score 5-7 = maybe. Score 8-10 = strong match.`;

  const userPrompt = `Job title: ${job.title}
Description: ${job.description.slice(0, 800)}
Budget: ${job.budget || 'not specified'}
Skills requested: ${(job.skills || []).join(', ')}`;

  try {
    const result = await callLLM(systemPrompt, userPrompt, 150);
    const parsed = JSON.parse(result.match(/\{[\s\S]*\}/)[0]);
    return parsed;
  } catch {
    return { score: 0, reason: 'scoring failed' };
  }
}

// Writes a custom proposal for a specific job
export async function generateProposal(job) {
  const systemPrompt = `You are writing a freelance proposal for ${CONFIG.profile.name}, a ${CONFIG.profile.title}.

RULES:
- Max 150 words. Clients don't read walls of text.
- Open with ONE specific observation about THEIR project — not a greeting.
- Line 2: your directly relevant experience (be specific, not vague).
- Line 3: one concrete question that shows you've read the brief.
- Close with a soft call to action: "Happy to jump on a quick call or start with a small paid test task."
- NO "I am a passionate developer", NO "I have X years of experience", NO emojis.
- Sound like a person who has done this exact thing before, not an applicant.

Profile strengths to draw from:
${CONFIG.profile.strengths.join('\n')}

Skills: ${CONFIG.profile.skills.join(', ')}`;

  const userPrompt = `Write a proposal for this job:

Title: ${job.title}
Description: ${job.description.slice(0, 1000)}
Budget: ${job.budget || 'not specified'}
Client location: ${job.clientLocation || 'unknown'}
Job type: ${job.jobType || 'not specified'}`;

  return await callLLM(systemPrompt, userPrompt, 300);
}

// Generates a follow-up message for a proposal sent 3-5 days ago with no reply
export async function generateFollowUp(job, originalProposal) {
  const systemPrompt = `You are writing a brief follow-up message for a freelance proposal that got no reply.
Max 3 sentences. Add one new piece of value — a quick insight or offer. Don't beg. Sound busy.`;

  const userPrompt = `Original job: ${job.title}
My original proposal: ${originalProposal.slice(0, 300)}
Write a follow-up.`;

  return await callLLM(systemPrompt, userPrompt, 150);
}
