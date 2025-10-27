import "dotenv/config";
import { Mastra } from "@mastra/core";
import { velocityfibreDbAgent, velocityfibreDbAgentGrok } from "./agents/velocityfibre-db.agent";

export const mastra = new Mastra({
  agents: {
    velocityfibreDbAgent,
    velocityfibreDbAgentGrok,
  },
});
