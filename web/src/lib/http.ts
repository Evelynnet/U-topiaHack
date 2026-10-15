import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Error with an HTTP status and a machine-readable code the UI translates. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** Wraps a route handler so thrown errors become consistent JSON responses. */
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.code }, { status: err.status });
      }
      if (err instanceof ZodError) {
        return NextResponse.json({ error: "invalid_input", issues: err.issues }, { status: 400 });
      }
      console.error(err);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "invalid_input");
  }
}
