import mongoose, { Schema, type Document } from 'mongoose';
import type { BuilderJob, BuilderJobStatus } from '../schemas/builder.schema.js';
import { BuilderJobStatusEnum, TaskTypeEnum } from '../schemas/builder.schema.js';

export interface BuilderJobDocument extends Omit<BuilderJob, 'id'>, Document {
  status: BuilderJobStatus;
}

const generatedFileSchema = new Schema(
  {
    path: { type: String, required: true },
    content: { type: String, required: true },
    action: { type: String, enum: ['created', 'modified'], required: true },
  },
  { _id: false }
);

const planFileSchema = new Schema(
  {
    path: { type: String, required: true },
    type: { type: String, required: true, enum: ['schema', 'model', 'service', 'route', 'test'] },
    action: { type: String, required: true, enum: ['create', 'modify'] },
    description: { type: String, required: true },
  },
  { _id: false }
);

const planSchema = new Schema(
  {
    files: { type: [planFileSchema], required: true },
    summary: { type: String, required: true },
    taskType: { type: String, enum: TaskTypeEnum.options },
    contextFiles: { type: [String] },
  },
  { _id: false }
);

const diffSchema = new Schema(
  {
    path: { type: String, required: true },
    diff: { type: String, required: true },
  },
  { _id: false }
);

const planCoverageSchema = new Schema(
  {
    planned: { type: [String], required: true },
    generated: { type: [String], required: true },
    missing: { type: [String], required: true },
  },
  { _id: false }
);

const tokenUsageSchema = new Schema(
  {
    input: { type: Number, required: true },
    output: { type: Number, required: true },
  },
  { _id: false }
);

const jobResultSchema = new Schema(
  {
    files: { type: [generatedFileSchema], default: [] },
    prUrl: String,
    prNumber: Number,
    branch: String,
    validationPassed: Boolean,
    validationErrors: { type: [String] },
    tokenUsage: { type: tokenUsageSchema },
    diffs: { type: [diffSchema] },
    planCoverage: { type: planCoverageSchema },
    impactedFiles: { type: [String] },
  },
  { _id: false }
);

const jobErrorSchema = new Schema(
  {
    code: { type: String, required: true },
    message: { type: String, required: true },
    step: { type: String, enum: BuilderJobStatusEnum.options },
  },
  { _id: false }
);

const builderJobSchema = new Schema<BuilderJobDocument>(
  {
    prompt: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: BuilderJobStatusEnum.options,
      default: 'queued',
    },
    options: {
      dryRun: { type: Boolean, default: false },
      targetTag: String,
      includeModel: { type: Boolean, default: true },
      includeTests: { type: Boolean, default: true },
      taskType: { type: String, enum: TaskTypeEnum.options },
    },
    plan: { type: planSchema, default: undefined },
    result: { type: jobResultSchema },
    error: { type: jobErrorSchema },
    userId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc: unknown, ret: Record<string, unknown>): Record<string, unknown> => {
        ret['id'] = String(ret['_id']);
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  }
);

builderJobSchema.index({ userId: 1, createdAt: -1 });
builderJobSchema.index({ status: 1 });

export const BuilderJobModel = mongoose.model<BuilderJobDocument>('BuilderJob', builderJobSchema);
