type JsonObject = Record<string, unknown>;

export type EventTemplateValidationResult = {
  valid: boolean;
  error: string | null;
  variables: string[];
  unknownVariables: string[];
};

/**
 * Validasi placeholder template terhadap JSON Schema event.
 *
 * Placeholder yang didukung:
 *   {{spkNumber}}
 *   {{tailorName}}
 *
 * Saat ini hanya mendukung property tingkat atas (schema.properties).
 */
export function validateEventTemplate(
  template: string,
  payloadSchema: unknown,
): EventTemplateValidationResult {
  const variables = Array.from(
    new Set(
      Array.from(
        template.matchAll(/{{\s*([^{}]+?)\s*}}/g),
        (match) => match[1].trim(),
      ).filter(Boolean),
    ),
  );

  // Template tanpa variable tidak membutuhkan schema untuk validasi placeholder.
  if (variables.length === 0) {
    return {
      valid: true,
      error: null,
      variables,
      unknownVariables: [],
    };
  }

  if (
    !payloadSchema ||
    typeof payloadSchema !== "object" ||
    Array.isArray(payloadSchema)
  ) {
    return {
      valid: false,
      error:
        "Event belum memiliki Payload Schema. Hubungi Superadmin untuk melengkapi schema event.",
      variables,
      unknownVariables: variables,
    };
  }

  const schema = payloadSchema as JsonObject;
  const rawProperties = schema.properties;

  if (
    !rawProperties ||
    typeof rawProperties !== "object" ||
    Array.isArray(rawProperties)
  ) {
    return {
      valid: false,
      error:
        "Payload Schema event belum memiliki definisi properties yang valid.",
      variables,
      unknownVariables: variables,
    };
  }

  const availableFields = new Set(Object.keys(rawProperties));
  const unknownVariables = variables.filter(
    (variable) =>
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable) ||
      !availableFields.has(variable),
  );

  if (unknownVariables.length > 0) {
    return {
      valid: false,
      error: `Variable template tidak tersedia pada Payload Schema: ${unknownVariables
        .map((variable) => `{{${variable}}}`)
        .join(", ")}`,
      variables,
      unknownVariables,
    };
  }

  return {
    valid: true,
    error: null,
    variables,
    unknownVariables: [],
  };
}
