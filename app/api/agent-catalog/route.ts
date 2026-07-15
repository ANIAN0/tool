import { AGENT_IDS, getPublicModelsForAgent } from "@/agent-core/model-catalog";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    agents: AGENT_IDS.map((id) => ({
      id,
      label: id === "assistant" ? "通用助手" : "联网研究",
      models: getPublicModelsForAgent(id),
    })),
  });
}
