import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent, defineDynamic } from "eve";
import {
  getDefaultModel,
  getModelForAgent,
  modelIdFromMessages,
  type AgentId,
} from "./model-catalog";

const longcat = createOpenAICompatible({
  name: "longcat",
  baseURL: process.env.OPENAI_BASE_URL!,
  apiKey: process.env.OPENAI_API_KEY!,
});

export function createLongcatAgent(agentId: AgentId) {
  const fallback = getDefaultModel();

  return defineAgent({
    model: defineDynamic({
      fallback: longcat(fallback.providerModelId),
      events: {
        // Step scope is intentional for direct AI SDK models: Eve only permits
        // live LanguageModel objects at this scope. The selected model is fixed
        // by the first request's server-validated context, and the UI remounts
        // the chat when users choose another model.
        "step.started": (_event, ctx) => {
          const modelId = modelIdFromMessages(ctx.messages);
          const selected = getModelForAgent(agentId, modelId) ?? fallback;

          return {
            model: longcat(selected.providerModelId),
            modelContextWindowTokens: selected.contextWindowTokens,
          };
        },
      },
    }),
    modelContextWindowTokens: fallback.contextWindowTokens,
  });
}
