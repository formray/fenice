import type { BuilderJob, BuilderPlanFile, TaskType, IntegrationMode } from '../types/builder';

interface SubmitResponse {
  jobId: string;
}

export async function submitBuilderPrompt(
  token: string,
  prompt: string,
  dryRun: boolean,
  taskType?: TaskType,
  integrationMode?: IntegrationMode
): Promise<SubmitResponse> {
  const options: Record<string, unknown> = { dryRun };
  if (taskType) {
    options['taskType'] = taskType;
  }
  if (integrationMode) {
    options['integrationMode'] = integrationMode;
  }

  const res = await fetch('/api/v1/builder/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt, options }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Builder request failed (${res.status})`);
  }

  return (await res.json()) as SubmitResponse;
}

export async function fetchBuilderJob(token: string, jobId: string): Promise<BuilderJob> {
  const res = await fetch(`/api/v1/builder/jobs/${encodeURIComponent(jobId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Failed to fetch job (${res.status})`);
  }

  return (await res.json()) as BuilderJob;
}

export async function approveBuilderJob(
  token: string,
  jobId: string,
  plan: { files: BuilderPlanFile[]; summary: string }
): Promise<void> {
  const res = await fetch(`/api/v1/builder/jobs/${encodeURIComponent(jobId)}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Approve failed (${res.status})`);
  }
}

export async function rejectBuilderJob(token: string, jobId: string): Promise<void> {
  const res = await fetch(`/api/v1/builder/jobs/${encodeURIComponent(jobId)}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Reject failed (${res.status})`);
  }
}

export async function rollbackBuilderJob(token: string, jobId: string): Promise<void> {
  const res = await fetch(`/api/v1/builder/jobs/${encodeURIComponent(jobId)}/rollback`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Rollback failed (${res.status})`);
  }
}
