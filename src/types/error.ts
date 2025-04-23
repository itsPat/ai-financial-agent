import { z } from "zod";

const baseError = z.object({
  message: z.string(),
});

export const missingInfoErrorSchema = baseError.extend({
  type: z.literal("MissingInformation"),
  message: z.string().describe("Description of what information is missing"),
});

export const missingToolErrorSchema = baseError.extend({
  type: z.literal("MissingTool"),
  message: z.string().describe("Description of what tool(s) are missing"),
});

export const agentErrorSchema = z.union([
  baseError,
  missingInfoErrorSchema,
  missingToolErrorSchema,
]);
