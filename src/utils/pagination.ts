interface CursorData {
  id: string;
  sortValue: string;
}

export function encodeCursor(data: CursorData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

export function decodeCursor(cursor: string | undefined | null): CursorData | null {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf-8');
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'id' in parsed &&
      'sortValue' in parsed &&
      typeof (parsed as CursorData).id === 'string' &&
      typeof (parsed as CursorData).sortValue === 'string'
    ) {
      return { id: (parsed as CursorData).id, sortValue: (parsed as CursorData).sortValue };
    }
    return null;
  } catch {
    return null;
  }
}
