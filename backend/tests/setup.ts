import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { vi } from "vitest";

// A suíte não depende de DNS real; dominioRecebeEmail tem testes próprios em contact-validation.test.ts.
vi.mock("../src/shared/email-domain.js", () => ({ dominioRecebeEmail: vi.fn().mockResolvedValue(true) }));

const dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.join(dirname, "..", ".env.test") });
