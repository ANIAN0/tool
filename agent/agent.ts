import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

const longcat = createOpenAICompatible({
  name: "longcat",
  baseURL: process.env.OPENAI_BASE_URL!,
  apiKey: process.env.OPENAI_API_KEY!,
});

export default defineAgent({
  model: longcat(process.env.EVE_MODEL!),
  // LongCat 2.0 is not in the AI Gateway model catalog, so we declare its
  // context window manually to let eve compile the agent.
  modelContextWindowTokens: 128000,
});