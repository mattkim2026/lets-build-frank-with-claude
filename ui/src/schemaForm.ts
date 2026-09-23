// Turns a tool's JSON Schema input into form fields and back into arguments.
// This is what lets a new tool appear in the console with no UI work (ADR-003).
// Anything the form cannot represent falls back to a raw JSON field.

export type FieldKind = "string" | "number" | "integer" | "boolean" | "enum" | "json";

export interface Field {
  name: string;
  label: string;
  description?: string;
  required: boolean;
  kind: FieldKind;
  options?: string[];
}

interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: unknown[];
  description?: string;
  title?: string;
}

function kindOf(schema: JsonSchema): Pick<Field, "kind" | "options"> {
  if (Array.isArray(schema.enum) && schema.enum.every((v) => typeof v === "string")) {
    return { kind: "enum", options: schema.enum as string[] };
  }
  switch (schema.type) {
    case "string":
    case "number":
    case "integer":
    case "boolean":
      return { kind: schema.type };
    default:
      return { kind: "json" };
  }
}

export function fieldsFromSchema(inputSchema: unknown): Field[] {
  const schema = (inputSchema ?? {}) as JsonSchema;
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([name, prop]) => ({
    name,
    label: prop.title ?? name,
    description: prop.description,
    required: required.has(name),
    ...kindOf(prop),
  }));
}

/** Form state: text for most fields, a boolean for toggles. */
export type FormValues = Record<string, string | boolean>;

export function initialValues(fields: Field[]): FormValues {
  return Object.fromEntries(fields.map((f) => [f.name, f.kind === "boolean" ? false : ""]));
}

export interface ArgsResult {
  args: Record<string, unknown>;
  errors: Record<string, string>;
}

/** Converts form values into tool arguments. Empty optional fields are omitted. */
export function toArguments(fields: Field[], values: FormValues): ArgsResult {
  const args: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const raw = values[field.name];
    if (field.kind === "boolean") {
      args[field.name] = raw === true;
      continue;
    }
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text === "") {
      if (field.required) errors[field.name] = "Required.";
      continue;
    }
    switch (field.kind) {
      case "number":
      case "integer": {
        const n = Number(text);
        if (!Number.isFinite(n) || (field.kind === "integer" && !Number.isInteger(n))) {
          errors[field.name] = field.kind === "integer" ? "Enter a whole number." : "Enter a number.";
        } else {
          args[field.name] = n;
        }
        break;
      }
      case "json":
        try {
          args[field.name] = JSON.parse(text);
        } catch {
          errors[field.name] = "Enter valid JSON.";
        }
        break;
      default:
        args[field.name] = text;
    }
  }
  return { args, errors };
}
