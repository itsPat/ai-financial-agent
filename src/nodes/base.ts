import { AgentState } from "../types/agent";
import { ChatOpenAI, ChatOpenAICallOptions } from "@langchain/openai";
class BaseNode {
  llm: ChatOpenAI<ChatOpenAICallOptions>;

  constructor(llm: ChatOpenAI<ChatOpenAICallOptions>) {
    this.llm = llm;
    this.run = this.run.bind(this);
  }

  async run(state: AgentState): Promise<Partial<AgentState>> {
    return state;
  }
}

export default BaseNode;
