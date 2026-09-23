import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Toggle from "@cloudscape-design/components/toggle";
import { useMemo, useState } from "react";
import { errorMessage, resultText, type CallToolResult, type FrankClient, type Tool } from "./mcp/client";
import { fieldsFromSchema, initialValues, toArguments, type Field, type FormValues } from "./schemaForm";

type Outcome = { kind: "result"; result: CallToolResult } | { kind: "failed"; message: string };

/** A form generated from the tool's input schema, and its result as JSON. */
export function ToolRunner({ client, tool }: { client: FrankClient; tool: Tool }) {
  const fields = useMemo(() => fieldsFromSchema(tool.inputSchema), [tool]);
  const [values, setValues] = useState<FormValues>(() => initialValues(fields));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>();

  async function run() {
    const { args, errors } = toArguments(fields, values);
    setErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setRunning(true);
    setOutcome(undefined);
    try {
      setOutcome({ kind: "result", result: await client.callTool(tool.name, args) });
    } catch (err) {
      setOutcome({ kind: "failed", message: errorMessage(err) });
    } finally {
      setRunning(false);
    }
  }

  const set = (name: string, value: string | boolean) => setValues((v) => ({ ...v, [name]: value }));

  return (
    <Container header={<Header variant="h2" description={tool.description}>{tool.name}</Header>}>
      <SpaceBetween size="l">
        <form onSubmit={(e) => { e.preventDefault(); void run(); }}>
          <Form actions={<Button variant="primary" loading={running} formAction="submit">Call {tool.name}</Button>}>
            <SpaceBetween size="m">
              {fields.length === 0 && <Box color="text-body-secondary">This tool takes no parameters.</Box>}
              {fields.map((field) => (
                <FieldInput key={field.name} field={field} value={values[field.name]}
                  error={errors[field.name]} onChange={(v) => set(field.name, v)} />
              ))}
            </SpaceBetween>
          </Form>
        </form>
        {outcome?.kind === "failed" && (
          <Alert type="error" header="The call did not reach Frank">{outcome.message}</Alert>
        )}
        {outcome?.kind === "result" && outcome.result.isError && (
          <Alert type="error" header={`${tool.name} returned an error`}>{resultText(outcome.result)}</Alert>
        )}
        {outcome?.kind === "result" && !outcome.result.isError && (
          <SpaceBetween size="xs">
            <Box variant="awsui-key-label">Result</Box>
            <Box variant="pre" data-testid="tool-result">
              {outcome.result.structuredContent
                ? JSON.stringify(outcome.result.structuredContent, null, 2)
                : resultText(outcome.result)}
            </Box>
          </SpaceBetween>
        )}
      </SpaceBetween>
    </Container>
  );
}

function FieldInput(props: {
  field: Field;
  value: string | boolean | undefined;
  error?: string;
  onChange: (value: string | boolean) => void;
}) {
  const { field, value, error, onChange } = props;
  const text = typeof value === "string" ? value : "";
  const label = field.required ? field.label : `${field.label} (optional)`;

  let control;
  switch (field.kind) {
    case "boolean":
      control = <Toggle checked={value === true} onChange={({ detail }) => onChange(detail.checked)}>{field.name}</Toggle>;
      break;
    case "enum":
      control = (
        <Select
          selectedOption={text ? { value: text, label: text } : null}
          onChange={({ detail }) => onChange(detail.selectedOption.value ?? "")}
          options={[
            ...(field.required ? [] : [{ value: "", label: "(none)" }]),
            ...(field.options ?? []).map((o) => ({ value: o, label: o })),
          ]}
          placeholder="Choose a value"
        />
      );
      break;
    case "json":
      control = <Textarea value={text} onChange={({ detail }) => onChange(detail.value)} placeholder="JSON value" />;
      break;
    default:
      control = (
        <Input value={text} type={field.kind === "string" ? "text" : "number"}
          onChange={({ detail }) => onChange(detail.value)} />
      );
  }

  return (
    <FormField label={label} description={field.description} errorText={error}>
      {control}
    </FormField>
  );
}
