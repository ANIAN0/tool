/**
 * 消息服务
 */

export * from "./types";
export * from "./service";

import { createMessageService } from "./service";

export const messageServices = {
  createMessageService,
};

export default messageServices;