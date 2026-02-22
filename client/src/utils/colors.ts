import type { HttpMethod } from '../types/world';

/** HTTP method → building color mapping */
export const METHOD_COLORS: Record<HttpMethod, string> = {
  get: '#4A90D9',
  post: '#50C878',
  put: '#FFA500',
  patch: '#FFD700',
  delete: '#E74C3C',
  options: '#9B59B6',
  head: '#95A5A6',
  trace: '#7F8C8D',
};

/** HTTP method → human-readable label */
export const METHOD_LABELS: Record<HttpMethod, string> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  options: 'OPTIONS',
  head: 'HEAD',
  trace: 'TRACE',
};
