import { buildApp } from "./app.ts";

const port = Number(process.env.PORT ?? 3000);
// "localhost" binds both IPv4 and IPv6, so the Vite proxy connects whichever it resolves to.
const host = process.env.HOST ?? "localhost";

const app = buildApp();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, "shutting down");
    void app.close();
  });
}

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error, "failed to start server");
  process.exit(1);
}
