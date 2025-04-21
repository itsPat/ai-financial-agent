import DB from "./db";
import Math from "./math";

export const ALL_TOOLS = [DB.query.transactions, Math.evaluate];
export const TOOLS_BY_NAME: Record<string, (typeof ALL_TOOLS)[0]> =
  ALL_TOOLS.reduce((prev, tool) => ({ ...prev, [tool.name]: tool }), {});
