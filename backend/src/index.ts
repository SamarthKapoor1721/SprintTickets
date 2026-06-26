import { app } from "./app";
import { env } from "./env";
import { prisma } from "./lib/prisma";

async function main() {
  await prisma.$connect();

  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://127.0.0.1:${env.PORT}`);
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
