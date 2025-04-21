import { AgentState } from "../types/agent";
import BaseNode from "./base";

export class Responder extends BaseNode {
  async run(state: AgentState): Promise<Partial<AgentState>> {
    await super.run(state);

    // TODO: - Ask the responder to describe its methodology
    // Describe the steps you took to get to the answer.

    return {
      response: {
        data:
          state.plan?.at(-1)?.result ??
          (state.response as any).error ??
          "Failed to get result",
      },
    };
  }
}
