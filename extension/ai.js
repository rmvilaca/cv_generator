/**
 * ai.js — OpenAI integration for job posting analysis.
 *
 * Exports a single function `analyzeJobPosting(text, apiKey)` that calls
 * the Chat Completions API and returns structured JSON with skills,
 * job topics, and technologies tailored to the posting.
 */

const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT = `You are an expert career coach. The user will provide a job posting.
Analyze it and return a JSON object with EXACTLY this structure:

{
  "skills": [
    { "<skill title>": ["detail 1", "detail 2", "..."] }
  ],
  "job": [
    { "<topic title>": ["detail 1", "detail 2", "..."] }
  ],
  "tech": [
    { "<technology title>": ["detail 1", "detail 2", "..."] }
  ]
}

Important: do NOT use placeholder key names like "skillTitle", "topicName", or "title".
The object key itself must be the real title (example: { "Test Automation": ["...", "..."] }).

Rules:
- "skills" — the 5 most important skills to highlight on a CV to get hired for this role. Each skill has a short title and 2-4 concrete details explaining how to demonstrate it.
- "job" — 5 topics with job history details and responsibilities a candidate should emphasize. Each topic has a short name and 2-4 bullet points describing relevant past experience or responsibilities.
- "tech" — 5 tools and technologies that would most improve the candidate's chances. Each has a title and 2-4 details on how proficiency should be demonstrated.
- Each array MUST have exactly 5 items.
- Each item is an object with exactly one key (the real title) mapped to an array of detail strings.
- Respond in the same language as the job posting.
- Return ONLY valid JSON. No markdown, no commentary.`;

/**
 * Call OpenAI to analyze a job posting.
 *
 * @param {string} text  — The extracted job posting text.
 * @param {string} apiKey — The user's OpenAI API key.
 * @returns {Promise<{skills: Array, job: Array, tech: Array}>}
 * @throws {Error} with a user-friendly message on failure.
 */
async function analyzeJobPosting(text, apiKey) {
  if (!apiKey) {
    throw new Error("No API key configured. Open Settings and save your OpenAI key.");
  }
  if (!text || !text.trim()) {
    throw new Error("No job posting text to analyze. Extract a posting first.");
  }

  const body = {
    model: OPENAI_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    temperature: 0.4,
  };

  let res;
  try {
    res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error("Network error — could not reach the OpenAI API. Check your connection.");
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Invalid API key. Check your key in Settings.");
    }
    if (res.status === 429) {
      throw new Error("Rate limited by OpenAI. Wait a moment and try again.");
    }
    if (res.status >= 500) {
      throw new Error("OpenAI is experiencing issues. Try again later.");
    }
    const errorBody = await res.text().catch(() => "");
    throw new Error(`OpenAI request failed (${res.status}). ${errorBody}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Unexpected response from OpenAI — no content returned.");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI returned invalid JSON. Try again.");
  }

  if (!parsed.skills || !parsed.job || !parsed.tech) {
    throw new Error("Response is missing required sections (skills, job, tech). Try again.");
  }

  return parsed;
}
