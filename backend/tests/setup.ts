import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.join(dirname, "..", ".env.test") });
