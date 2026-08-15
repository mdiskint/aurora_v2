export class AIJsonParseError extends Error {
  constructor(message: string, readonly rawText: string) {
    super(message);
    this.name = 'AIJsonParseError';
  }
}

type Schema<T> = {
  name: string;
  validate: (value: unknown) => boolean;
  readonly __type?: T;
};

function stripCodeFence(text: string) {
  let cleaned = text.trim();

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

function sanitizeJsonStringLiterals(text: string) {
  return text.replace(/"((?:[^"\\]|\\.)*)"/g, (match) =>
    match
      .replace(/\r\n/g, '\\n')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\n')
      .replace(/\t/g, '\\t')
  );
}

function removeTrailingCommas(text: string) {
  return text.replace(/,(\s*[}\]])/g, '$1');
}

function extractFirstJsonObject(text: string) {
  const stripped = stripCodeFence(text);
  const start = stripped.indexOf('{');

  if (start === -1) {
    return stripped;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < stripped.length; i++) {
    const char = stripped[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        return stripped.slice(start, i + 1);
      }
    }
  }

  return stripped.slice(start);
}

export function parseAIJson<T = unknown>(rawText: string, schema?: Schema<T>): T {
  const extracted = extractFirstJsonObject(rawText);
  const sanitized = sanitizeJsonStringLiterals(extracted);
  const candidates = [
    rawText,
    stripCodeFence(rawText),
    extracted,
    sanitized,
    removeTrailingCommas(sanitized),
  ];

  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);

      if (schema && !schema.validate(parsed)) {
        throw new AIJsonParseError(`AI JSON did not match schema: ${schema.name}`, rawText);
      }

      return parsed as T;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof AIJsonParseError) {
    throw lastError;
  }

  throw new AIJsonParseError(
    `Failed to parse AI JSON: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    rawText
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasString(value: Record<string, unknown>, key: string) {
  return typeof value[key] === 'string' && (value[key] as string).trim().length > 0;
}

export function hasArray(value: Record<string, unknown>, key: string) {
  return Array.isArray(value[key]);
}

export function makeObjectSchema<T>(
  name: string,
  validate: (value: Record<string, unknown>) => boolean
): Schema<T> {
  return {
    name,
    validate: (value: unknown) => isRecord(value) && validate(value),
  };
}
