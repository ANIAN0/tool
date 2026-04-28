/**
 * 会话服务
 */

export * from "./types";
export * from "./service";
export * from "./chat-service";
export * from "./workflow-service";

import { createSessionService } from "./service";
import { createChatSessionService } from "./chat-service";
import { createWorkflowSessionService } from "./workflow-service";

export const sessionServices = {
  createSessionService,
  createChatSessionService,
  createWorkflowSessionService,
};

export default sessionServices;