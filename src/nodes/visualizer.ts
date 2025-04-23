import { AgentState } from "../types/agent";
import BaseNode from "./base";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import zodToJsonSchema from "zod-to-json-schema";
import { z } from "zod";
import { chartSchema } from "../types/chart";

const visualizerResultSchema = z.union([
  z.object({
    status: z.literal("chart_not_helpful"),
  }),
  z.object({
    status: z.literal("chart_helpful"),
    chart: chartSchema,
  }),
]);

export class Visualizer extends BaseNode {
  async run(state: AgentState): Promise<Partial<AgentState>> {
    await super.run(state);

    try {
      if (!state.intent) throw new Error("Unable to proceed without intent");
      if (!state.plan) throw new Error("Unable to proceed without plan");

      const prefill = `{ "status": `;
      const response = await this.llm.invoke([
        new SystemMessage(
          `<role>
          You are the VISUALIZER component in a financial agent system. Your specific responsibility is to determine whether a chart would be helpful, and to prepare the data if it is.
          </role>
          
          <task>
          1. Examine the intent and completed plan steps alongside their results
          2. Decide if a visualization would significantly improve understanding of the data
          3. If visualization would help:
             - Select the most appropriate chart type
             - Format the data correctly for the chosen chart
             - Define appropriate axes and series
          4. Return a JSON object conforming to the provided schema
          </task>
          
          <visualization_guidelines>
          - Visualizations are MOST helpful when:
            - Comparing data across multiple time periods (months, years)
            - Showing trends over time
            - Comparing different categories of spending or income
            - Showing proportions or distributions
            
          - Visualizations are not helpful when:
            - Answering simple financial questions with a single number
            - Providing account balances or simple sums
            - When there are fewer than 3 data points to compare
            - When temporal patterns or comparisons aren't relevant
            
          - Chart type selection guidance:
            - LINE charts: Best for continuous time series and trends
            - AREA charts: Good for cumulative values over time
            - BAR charts: Ideal for category comparisons
            - PIE charts: For part-to-whole relationships (use only when fewer than 7 categories)
            - RADAR charts: For multi-variable comparison across categories
          </visualization_guidelines>
          
          <data_formatting>
          - Ensure all data has consistent types
          - Use American currency format ($X,XXX.XX) for display values but strip currency symbols in the actual data
          - For time series, ensure dates are properly formatted
          - Transform data from the available results into the required format for visualization
          </data_formatting>
          
          <intent>
          ${state.intent ?? ""}
          </intent>
          
          <plan>
          ${JSON.stringify(state.plan ?? [])}
          </plan>
          
          <schema>
          ${zodToJsonSchema(visualizerResultSchema)}
          </schema>
          
          <example_output_no_visualization>
          {"status":"chart_not_helpful"}
          </example_output_no_visualization>
          
          <example_output_with_visualization>
          {"status":"chart_not_helpful","chart":{"chartType":"bar","data":[{"month":"Jan","expenses":1245.33},{"month":"Feb","expenses":980.50},{"month":"Mar","expenses":1350.25}],"axes":{"x":{"dataKey":"month","label":"Month","type":"category"},"y":{"label":"Expenses ($)","type":"number"}},"series":[{"dataKey":"expenses","name":"Monthly Expenses"}]}}
          </example_output_with_visualization>
          `
        ),
        // Guide the response to output JSON
        new AIMessage(prefill),
      ]);

      const responseContent = response.content.toString();

      const fullContent = responseContent
        .replace(/\s+/g, "")
        .startsWith(prefill.replace(/\s+/g, ""))
        ? responseContent
        : prefill + responseContent;

      if (!fullContent)
        throw new Error("Failed to get response from visualizer");

      const json = JSON.parse(fullContent);
      const result = await visualizerResultSchema.parseAsync(json);

      if (result.status === "chart_not_helpful") return {};

      return {
        chartResponse: result.chart,
      };
    } catch (err) {
      return {
        error: {
          message: (err as any).message ?? "Failed to generate chart response.",
        },
      };
    }
  }
}
