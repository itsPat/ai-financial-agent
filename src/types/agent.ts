import { Message } from "./message";
import { Plan } from "./plan";

export type AgentState = {
  messages: Message[];
  goal?: string;
  plan?: Plan;
  response?: { data: string } | { error: string };
};
