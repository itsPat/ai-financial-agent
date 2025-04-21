import { z } from "zod";

export const messageSchema = z.object({
  role: z.union([z.literal("user"), z.literal("assistant")]),
  content: z.string(),
  date: z.string(),
});

export type Message = z.infer<typeof messageSchema>;
