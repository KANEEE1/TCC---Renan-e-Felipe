import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3333);

const app = createApp();

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
