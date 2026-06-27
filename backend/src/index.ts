import type { Server } from "http";

import { app } from "./app";
import { env } from "./env";
import { prisma } from "./lib/prisma";

let server: Server | undefined;
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) {
    // A second signal (e.g. mashing Ctrl+C) forces an immediate exit.
    process.exit(0);
  }
  shuttingDown = true;
  // eslint-disable-next-line no-console
  console.log(`\nReceived ${signal}, shutting down…`);

  // Don't let a hung connection keep the process alive forever.
  const force = setTimeout(() => process.exit(0), 3000);
  force.unref();

  server?.close();
  try {
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  process.exit(0);
}

async function main() {
  await prisma.$connect();

  server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://127.0.0.1:${env.PORT}`);
  });

  for (const signal of ["SIGINT", "SIGTERM", "SIGUSR2"] as const) {
    process.on(signal, () => {
      void shutdown(signal);
    });
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
