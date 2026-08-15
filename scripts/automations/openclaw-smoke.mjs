import { callOpenClawComplete } from "./lib/openclaw-client.mjs";

const result = await callOpenClawComplete({
  task: "automation_smoke_test",
  style: "health_check",
  input: {
    instruction: "Return a short health-check response.",
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["status"],
    properties: {
      status: { type: "string" },
    },
  },
});

console.log(JSON.stringify({ ok: true, output: result.output }));
