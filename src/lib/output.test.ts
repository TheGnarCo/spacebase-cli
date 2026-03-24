import { describe, it, expect, beforeEach, mock } from "bun:test";
import { output } from "./output";

beforeEach(() => {
  output.configure({ json: false });
});

describe("output.configure / output.json", () => {
  it("writes pretty-printed JSON to stdout", () => {
    const writes: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array) => {
      writes.push(chunk.toString());
      return true;
    };
    try {
      output.json({ hello: "world" });
    } finally {
      process.stdout.write = orig;
    }
    expect(writes.join("")).toBe(JSON.stringify({ hello: "world" }, null, 2) + "\n");
  });

  it("writes compact JSON for primitives", () => {
    const writes: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array) => {
      writes.push(chunk.toString());
      return true;
    };
    try {
      output.json([1, 2, 3]);
    } finally {
      process.stdout.write = orig;
    }
    expect(writes.join("")).toBe(JSON.stringify([1, 2, 3], null, 2) + "\n");
  });
});

describe("output.table in table mode (json=false)", () => {
  it("renders headers and row values", () => {
    const writes: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array) => {
      writes.push(chunk.toString());
      return true;
    };
    try {
      output.table(
        [{ name: "Alice", age: 30 }],
        [
          { header: "Name", key: "name" },
          { header: "Age", key: "age" },
        ]
      );
    } finally {
      process.stdout.write = orig;
    }
    const out = writes.join("");
    expect(out).toContain("Name");
    expect(out).toContain("Age");
    expect(out).toContain("Alice");
    expect(out).toContain("30");
  });

  it("renders multiple rows", () => {
    const writes: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array) => {
      writes.push(chunk.toString());
      return true;
    };
    try {
      output.table(
        [
          { id: "1", label: "foo" },
          { id: "2", label: "bar" },
        ],
        [
          { header: "ID", key: "id" },
          { header: "Label", key: "label" },
        ]
      );
    } finally {
      process.stdout.write = orig;
    }
    const out = writes.join("");
    expect(out).toContain("foo");
    expect(out).toContain("bar");
  });
});

describe("output.table fallback in JSON mode (json=true)", () => {
  it("renders JSON instead of a table when json mode is active", () => {
    output.configure({ json: true });
    const writes: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array) => {
      writes.push(chunk.toString());
      return true;
    };
    try {
      output.table(
        [{ name: "Bob" }],
        [{ header: "Name", key: "name" }]
      );
    } finally {
      process.stdout.write = orig;
    }
    const out = writes.join("");
    const parsed = JSON.parse(out);
    expect(parsed).toEqual([{ name: "Bob" }]);
  });
});

describe("output.error", () => {
  it("writes to stderr, not stdout", () => {
    const stdoutWrites: string[] = [];
    const stderrWrites: string[] = [];
    const origOut = process.stdout.write.bind(process.stdout);
    const origErr = process.stderr.write.bind(process.stderr);
    process.stdout.write = (chunk: string | Uint8Array) => {
      stdoutWrites.push(chunk.toString());
      return true;
    };
    process.stderr.write = (chunk: string | Uint8Array) => {
      stderrWrites.push(chunk.toString());
      return true;
    };
    try {
      output.error("something went wrong");
    } finally {
      process.stdout.write = origOut;
      process.stderr.write = origErr;
    }
    expect(stdoutWrites).toHaveLength(0);
    expect(stderrWrites.join("")).toContain("something went wrong");
  });

  it("includes detail when provided", () => {
    const stderrWrites: string[] = [];
    const origErr = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk: string | Uint8Array) => {
      stderrWrites.push(chunk.toString());
      return true;
    };
    try {
      output.error("oops", { code: 42 });
    } finally {
      process.stderr.write = origErr;
    }
    const out = stderrWrites.join("");
    expect(out).toContain("oops");
    expect(out).toContain("42");
  });
});
