import { eveChannel } from "eve/channels/eve";
import { type AuthFn, UnauthenticatedError } from "eve/channels/auth";

// Service-to-service auth for the local frontend → Vercel agent.
// Frontend sends `X-API-Key: <secret>` on every request.
// Walk semantics: no header → return null → walk ends → 401.
const apiKeyAuth: AuthFn<Request> = async (req) => {
  const provided = req.headers.get("x-api-key");
  if (!provided) return null;

  if (provided !== process.env.AGENT_API_KEY) {
    throw new UnauthenticatedError({
      code: "invalid_api_key",
      message: "Bad X-API-Key.",
    });
  }

  return {
    authenticator: "api-key",
    principalId: "local-app",
    principalType: "app",
    attributes: { source: "local-frontend" },
  };
};

export default eveChannel({
  auth: [apiKeyAuth],
});