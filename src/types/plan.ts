import { z } from "zod";

export const planStepSchema = z.object({
  action: z
    .string()
    .describe(
      "An action to perform to accomplish the intent. e.g. 'Fetch all transactions within the category of travel within the last week'"
    ),
  status: z
    .union([
      z.literal("pending"),
      z.literal("in_progress"),
      z.literal("completed"),
      z.literal("failed"),
    ])
    .default("pending"),
  result: z.optional(z.any()).default(undefined),
});

export const planSchema = z.array(planStepSchema);

export type PlanStep = z.infer<typeof planStepSchema>;
export type Plan = z.infer<typeof planSchema>;
