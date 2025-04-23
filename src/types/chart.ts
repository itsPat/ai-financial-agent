import { z } from "zod";

const chartTypeSchema = z
  .union([
    z.literal("line"),
    z.literal("area"),
    z.literal("bar"),
    z.literal("pie"),
    z.literal("radar"),
  ])
  .describe(
    "The type of chart to render (line, area, bar, pie, radar). Choose based on data visualization needs."
  );

const baseAxisSchema = z.object({
  label: z
    .string()
    .optional()
    .describe(
      "Descriptive label for the axis. Example: 'Months' or 'Revenue ($)'."
    ),

  type: z
    .union([z.literal("category"), z.literal("number"), z.literal("time")])
    .optional()
    .describe(
      "How to interpret the data on this axis: 'category' for discrete labels, 'number' for continuous data, 'time' for dates."
    ),
});

const xAxisSchema = baseAxisSchema
  .extend({
    dataKey: z
      .string()
      .describe(
        "The key in the data objects that provides values for the x-axis. Example: 'date' for time series or 'category' for categories."
      ),
  })
  .describe(
    "The horizontal axis configuration, typically categories, time periods, or the independent variable."
  );

const yAxisSchema = baseAxisSchema.describe(
  "The vertical axis configuration, typically showing the values from the series dataKeys."
);

const chartSeriesSchema = z
  .object({
    dataKey: z
      .string()
      .describe(
        "The key in the data objects that provides values for this series. Example: 'expenses'."
      ),

    name: z
      .string()
      .describe(
        "Display name for this series in legends and tooltips. Example: 'Travel Expenses'."
      ),

    type: z
      .union([
        z.literal("monotone"),
        z.literal("linear"),
        z.literal("step"),
        z.literal("stepBefore"),
        z.literal("stepAfter"),
      ])
      .optional()
      .describe(
        "How to interpolate between points (for line/area charts): 'monotone' for smooth curves, 'linear' for straight lines, various 'step' options for discrete changes."
      ),

    connectNulls: z
      .boolean()
      .optional()
      .describe(
        "Whether to continue the line across missing data points. Useful for projections (true) or showing data gaps (false)."
      ),
  })
  .array()
  .describe(
    "Array of data series to plot. Each series defines one set of related data (one line, set of bars, etc.) with its own visual representation."
  );

const chartDataSchema = z
  .array(
    z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()])
    )
  )
  .describe(
    "Array of data points to visualize. Each object represents one data point with properties that match the dataKey values in axes and series."
  );

export const chartSchema = z.object({
  chartType: chartTypeSchema,
  data: chartDataSchema,
  axes: z.object({
    x: xAxisSchema,
    y: yAxisSchema,
  }),
  series: chartSeriesSchema,
});

export type ChartSchema = z.infer<typeof chartSchema>;
