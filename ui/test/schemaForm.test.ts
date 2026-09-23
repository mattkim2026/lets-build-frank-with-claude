import { describe, expect, it } from "vitest";
import { fieldsFromSchema, initialValues, toArguments } from "../src/schemaForm";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "count"],
  properties: {
    name: { type: "string", description: "Who to look for." },
    count: { type: "integer" },
    ratio: { type: "number" },
    verbose: { type: "boolean" },
    region: { type: "string", enum: ["eastus", "westeurope"] },
    tags: { type: "object" },
  },
};

describe("fieldsFromSchema", () => {
  it("maps each JSON Schema type to a field kind", () => {
    const fields = fieldsFromSchema(schema);
    expect(fields.map((f) => [f.name, f.kind, f.required])).toEqual([
      ["name", "string", true],
      ["count", "integer", true],
      ["ratio", "number", false],
      ["verbose", "boolean", false],
      ["region", "enum", false],
      ["tags", "json", false],
    ]);
    expect(fields[0]?.description).toBe("Who to look for.");
    expect(fields[4]?.options).toEqual(["eastus", "westeurope"]);
  });

  it("returns no fields for a tool without parameters", () => {
    expect(fieldsFromSchema({ type: "object", properties: {} })).toEqual([]);
    expect(fieldsFromSchema(undefined)).toEqual([]);
  });
});

describe("toArguments", () => {
  const fields = fieldsFromSchema(schema);

  it("converts values and omits empty optional fields", () => {
    const values = { ...initialValues(fields), name: " frank ", count: "3", tags: '{"a":1}' };
    expect(toArguments(fields, values)).toEqual({
      args: { name: "frank", count: 3, verbose: false, tags: { a: 1 } },
      errors: {},
    });
  });

  it("reports missing required fields and bad numbers or JSON", () => {
    const values = { ...initialValues(fields), count: "2.5", ratio: "abc", tags: "{nope" };
    expect(toArguments(fields, values).errors).toEqual({
      name: "Required.",
      count: "Enter a whole number.",
      ratio: "Enter a number.",
      tags: "Enter valid JSON.",
    });
  });
});
