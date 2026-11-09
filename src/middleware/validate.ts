import { ApiError } from './errorHandler';
import type { CreateTaskInput, UpdateTaskInput } from '../types/task';

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readTrimmedString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ApiError(400, `"${field}" must be a string`);
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new ApiError(400, `"${field}" must be at most ${maxLength} characters long`);
  }

  return trimmed;
}

function readBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new ApiError(400, `"${field}" must be a boolean`);
  }

  return value;
}

export function parseCreateTaskBody(body: unknown): CreateTaskInput {
  if (!isPlainObject(body)) {
    throw new ApiError(400, 'Request body must be a JSON object');
  }

  const title = readTrimmedString(body.title, 'title', MAX_TITLE_LENGTH);

  if (title === undefined || title.length === 0) {
    throw new ApiError(400, '"title" is required and must be a non-empty string');
  }

  const description = readTrimmedString(body.description, 'description', MAX_DESCRIPTION_LENGTH);
  const completed = readBoolean(body.completed, 'completed');

  return {
    title,
    description: description ?? '',
    completed: completed ?? false,
  };
}

export function parseUpdateTaskBody(body: unknown): UpdateTaskInput {
  if (!isPlainObject(body)) {
    throw new ApiError(400, 'Request body must be a JSON object');
  }

  const update: UpdateTaskInput = {};

  const title = readTrimmedString(body.title, 'title', MAX_TITLE_LENGTH);
  if (title !== undefined) {
    if (title.length === 0) {
      throw new ApiError(400, '"title" must be a non-empty string');
    }
    update.title = title;
  }

  const description = readTrimmedString(body.description, 'description', MAX_DESCRIPTION_LENGTH);
  if (description !== undefined) {
    update.description = description;
  }

  const completed = readBoolean(body.completed, 'completed');
  if (completed !== undefined) {
    update.completed = completed;
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, 'Provide at least one of "title", "description", "completed"');
  }

  return update;
}
