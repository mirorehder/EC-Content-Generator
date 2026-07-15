import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js convention: local secrets live in .env.local, not .env.
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
