/**
 * Per-platform copywriting rules, carried over verbatim from the medsoc
 * `StudioCaptionService`.
 *
 * A note on provenance: the original author labelled these "2026 best
 * practices". They are that author's judgement, not anything verified here —
 * treated as house style rather than fact. Edit freely as the platforms change.
 *
 * Client-safe on purpose (no imports): the Studio UI needs the platform list and
 * labels, while the generator that consumes the rules is server-only.
 */

export const CAPTION_PLATFORMS = [
  "instagram",
  "facebook",
  "tiktok",
  "threads",
] as const;

export type CaptionPlatform = (typeof CAPTION_PLATFORMS)[number];

export function isCaptionPlatform(value: unknown): value is CaptionPlatform {
  return CAPTION_PLATFORMS.includes(value as CaptionPlatform);
}

export const PLATFORM_META: Record<
  CaptionPlatform,
  { label: string; icon: string; hint: string }
> = {
  instagram: { label: "Instagram", icon: "📸", hint: "Feed post, hook first" },
  facebook: { label: "Facebook", icon: "👍", hint: "Short, community tone" },
  tiktok: { label: "TikTok", icon: "🎵", hint: "Ultra short, POV hook" },
  threads: { label: "Threads", icon: "🧵", hint: "Casual hot take" },
};

export const PLATFORM_RULES: Record<CaptionPlatform, string> = {
  instagram: `Platform: Instagram
RULES:
- Hook must be in the FIRST 80 characters (before the "Read More" cutoff) — start with a question, a bold claim, or a POV
- Total caption: 138-150 characters for feed posts
- Tone: conversational, authentic, storytelling — "you" language
- Hashtags: EXACTLY 3-5 highly specific niche hashtags (not generic ones), at the end
- Emojis: 1-2, placed before the benefit or the CTA
- End with a soft CTA: "Save this", "Share with someone who needs this", or a question
- Weave keywords naturally into the caption text
- Line breaks between sentences for readability`,

  facebook: `Platform: Facebook
RULES:
- VERY SHORT: 40-80 characters is the sweet spot
- Open with the most compelling benefit or question IMMEDIATELY
- Tone: community-focused, friendly, conversational — NOT corporate
- Pose a specific, answerable question to drive comments
- Hashtags: 1-2 MAXIMUM, or none — keywords matter more
- Emojis: 1-2 only; 👉 before a key figure or CTA, ✓ for benefits
- CTA: ask a specific question, or "Comment below"
- Encourage dialogue and personal sharing`,

  tiktok: `Platform: TikTok
RULES:
- ULTRA SHORT: 5-30 words (150 characters max before "more")
- Hook in the first 3 words — about a second to stop the scroll
- Tone: raw, authentic, trendy, entertainment-first, unpolished
- Use POV: / "This changed everything" / "Wait for it" / "No one talks about..." style hooks
- Hashtags: 3-5 mixing broad reach tags with niche-specific ones
- Emojis: 1-3, relevant or trending
- End with comment-bait: "Which would you choose? 👇" or "Tell us in the comments 💬"
- Sound like a friend, NOT like a brand`,

  threads: `Platform: Threads
RULES:
- Optimal: UNDER 200 characters (hard limit 500)
- Tone: casual, raw, unpolished, witty, personality-driven
- Sound like a friend sharing a hot take, not a brand marketing
- Lead with an opinion, a question, or a provocative statement
- Topic tags: 2-3 searchable ones (#productname #niche #relevant)
- Emojis: 1-2, used naturally
- CTA: "What do you think?", "Reply with your take"
- Authenticity over polish — imperfect, conversational tone preferred
- Short punchy sentences work best`,
};
