import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentState } from "../types/agent";
import { Planner } from "../nodes/planner";
import { Executor } from "../nodes/executor";
import { Responder } from "../nodes/responder";
import { Visualizer } from "../nodes/visualizer";

export default {
  financial: () => {
    const models = {
      // Cheap model for easy tasks.
      default: new ChatOpenAI({
        modelName: "gpt-4o-mini",
        temperature: 0,
      }),
      // Powerful reasoning but expensive
      reasoning: new ChatOpenAI({
        // modelName: "o4-mini",
        modelName: "gpt-4.1",
        temperature: 0,
      }),
      // Intelligent model for complex tasks
      execution: new ChatOpenAI({
        modelName: "gpt-4.1",
        temperature: 0,
      }),
    };

    // Initialize StateGraph
    const graph = new StateGraph<AgentState>({
      channels: {
        messages: null,
        intent: null,
        plan: null,
        error: null,
        textResponse: null,
        chartResponse: null,
      },
    })
      // Create the nodes
      .addNode("Planner", new Planner(models.reasoning).run)
      .addNode("Executor", new Executor(models.execution).run)
      .addNode("Responder", new Responder(models.default).run)
      .addNode("Visualizer", new Visualizer(models.execution).run)
      // Create edges.
      .addEdge(START, "Planner")
      // Hand off plan to executor if no errors.
      .addConditionalEdges("Planner", (state) => {
        if (state.error) return "Responder";
        return "Executor";
      })
      // Continue handing off to executor until plan completed unless error.
      .addConditionalEdges("Executor", (state) => {
        if (state.error) return ["Responder", "Visualizer"];
        if (state.plan?.some((s) => s.status === "pending")) return "Executor";
        // Fan out to both nodes when execution completes successfully
        return ["Responder", "Visualizer"];
      })
      // Fan in for completion.
      .addEdge("Responder", END)
      .addEdge("Visualizer", END);

    // Compile the workflow
    const workflow = graph.compile();
    return workflow;
  },
};
