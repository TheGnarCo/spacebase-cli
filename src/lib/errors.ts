import { output } from "./output";

export class MissingProjectIdError extends Error {
  constructor() {
    super("Project ID is required. Use --project, SPACEBASE_PROJECT_ID, or link a project.");
    this.name = "MissingProjectIdError";
  }
}

export function requireProjectId(projectId: string | undefined): asserts projectId is string {
  if (!projectId) {
    throw new MissingProjectIdError();
  }
}

export async function wrapAction(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof MissingProjectIdError) {
      output.error(err.message);
      process.exit(1);
      return;
    }
    throw err;
  }
}
