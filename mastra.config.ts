import { createMastraConfig } from "@mastra/core";
import { mastra } from "./src/mastra";

export default createMastraConfig({
  name: "velocityfibre-db-agent",
  mastra,
  port: 4111,
});
