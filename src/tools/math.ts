import { tool } from "@langchain/core/tools";
import * as math from "mathjs";
import { z } from "zod";

export default {
  evaluate: tool(
    async ({ expression }) => {
      try {
        const result = math.evaluate(expression);
        return result.toString();
      } catch (err) {
        throw new Error(
          `Failed to evaluate expression: ${expression}, error: ${
            (err as any).message
          }`
        );
      }
    },
    {
      name: "math_evaluate_expression",
      description: "Evaluates a mathematical expression using math.js",
      schema: z.object({
        expression: z
          .string()
          .describe(
            "Mathematical expression to evaluate as a string (e.g., '2 + 2', 'sin(pi/2)', 'sqrt(16)')"
          ),
      }),
    }
  ),
  solve: tool(
    async ({ equation, variable = "x" }) => {
      try {
        const result = math.evaluate(`solve(${equation}, ${variable})`);
        return JSON.stringify(result);
      } catch (err) {
        throw new Error(
          `Failed to solve equation: ${equation}, error: ${
            (err as any).message
          }`
        );
      }
    },
    {
      name: "math_solve_equation",
      description:
        "Solves a mathematical equation for a specified variable using math.js",
      schema: z.object({
        equation: z
          .string()
          .describe("Equation to solve (e.g., 'x + 2 = 5', 'x^2 - 4 = 0')"),
        variable: z
          .string()
          .optional()
          .describe("Variable to solve for (default: 'x')"),
      }),
    }
  ),
};
