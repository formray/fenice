/**
 * Converts an OpenAPI 3.1 spec object into a clean, LLM-readable markdown document.
 * Useful for AI agents and coding assistants that consume API references.
 */
export function generateLlmDocs(spec: Record<string, unknown>): string {
  const info = spec['info'] as
    | { title?: string; version?: string; description?: string }
    | undefined;
  const title = info?.title ?? 'API';
  const version = info?.version ?? '0.0.0';
  const description = info?.description ?? '';

  const lines: string[] = [];
  lines.push(`# ${title} v${version}`);
  if (description) {
    lines.push('');
    lines.push(description);
  }

  // Security schemes
  const components = spec['components'] as
    | { securitySchemes?: Record<string, Record<string, unknown>> }
    | undefined;
  const securitySchemes = components?.securitySchemes;
  if (securitySchemes && Object.keys(securitySchemes).length > 0) {
    lines.push('');
    lines.push('## Authentication');
    for (const [name, scheme] of Object.entries(securitySchemes)) {
      const type = scheme['type'] as string | undefined;
      const schemeName = scheme['scheme'] as string | undefined;
      const bearerFormat = scheme['bearerFormat'] as string | undefined;
      const parts = [`- **${name}**:`, type];
      if (schemeName) parts.push(schemeName);
      if (bearerFormat) parts.push(`(${bearerFormat})`);
      lines.push(parts.join(' '));
    }
  }

  // Endpoints
  const paths = spec['paths'] as
    | Record<string, Record<string, Record<string, unknown>>>
    | undefined;

  if (paths && Object.keys(paths).length > 0) {
    lines.push('');
    lines.push('## Endpoints');

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        const upperMethod = method.toUpperCase();
        const summary = (operation['summary'] as string | undefined) ?? '';
        const tags = operation['tags'] as string[] | undefined;

        lines.push('');
        lines.push(`### ${upperMethod} ${path}`);
        if (summary) {
          lines.push(summary);
        }
        if (tags && tags.length > 0) {
          lines.push(`Tags: ${tags.join(', ')}`);
        }

        // Request body
        const requestBody = operation['requestBody'] as
          | { content?: Record<string, { schema?: Record<string, unknown> }> }
          | undefined;
        if (requestBody?.content) {
          const jsonContent = requestBody.content['application/json'];
          if (jsonContent?.schema) {
            const bodyDesc = formatSchemaCompact(jsonContent.schema);
            if (bodyDesc) {
              lines.push(`- Body: ${bodyDesc}`);
            }
          }
        }

        // Parameters
        const parameters = operation['parameters'] as
          | Array<{
              name?: string;
              in?: string;
              required?: boolean;
              schema?: Record<string, unknown>;
            }>
          | undefined;
        if (parameters && parameters.length > 0) {
          for (const param of parameters) {
            const name = param.name ?? 'unknown';
            const location = param.in ?? 'query';
            const required = param.required ? 'required' : 'optional';
            lines.push(`- Param \`${name}\` (${location}, ${required})`);
          }
        }

        // Responses
        const responses = operation['responses'] as
          | Record<string, { description?: string; content?: Record<string, { schema?: Record<string, unknown> }> }>
          | undefined;
        if (responses) {
          for (const [statusCode, response] of Object.entries(responses)) {
            const desc = response.description ?? '';
            const jsonResp = response.content?.['application/json'];
            const respSchema = jsonResp?.schema
              ? formatSchemaCompact(jsonResp.schema)
              : '';
            const parts = [`- Response ${statusCode}`];
            if (desc) parts.push(desc);
            if (respSchema) parts.push(`-> ${respSchema}`);
            lines.push(parts.join(': '));
          }
        }
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Produces a compact, one-line representation of a JSON schema object.
 * For example: `{ email, username, fullName, password }` or `{ user, tokens }`
 */
function formatSchemaCompact(schema: Record<string, unknown>): string {
  // Handle $ref
  const ref = schema['$ref'] as string | undefined;
  if (ref) {
    const parts = ref.split('/');
    return parts[parts.length - 1] ?? ref;
  }

  // Handle allOf / oneOf / anyOf
  for (const combiner of ['allOf', 'oneOf', 'anyOf'] as const) {
    const items = schema[combiner] as Record<string, unknown>[] | undefined;
    if (items && items.length > 0) {
      return items.map((s) => formatSchemaCompact(s)).join(' | ');
    }
  }

  const type = schema['type'] as string | undefined;

  if (type === 'object') {
    const properties = schema['properties'] as
      | Record<string, unknown>
      | undefined;
    if (properties) {
      const keys = Object.keys(properties);
      return `{ ${keys.join(', ')} }`;
    }
    return '{}';
  }

  if (type === 'array') {
    const items = schema['items'] as Record<string, unknown> | undefined;
    if (items) {
      return `${formatSchemaCompact(items)}[]`;
    }
    return 'array';
  }

  if (type) {
    return type;
  }

  return '';
}
