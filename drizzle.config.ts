import { defineConfig } from "drizzle-kit";
import fs from "fs";

function getConnectionString(): string {
  try {
    const rawData = fs.readFileSync(".gatorconfig.json", "utf-8");
    const config = JSON.parse(rawData);
    return config.dbUrl;
  } catch (error) {
    return "postgres://postgres:postgres@localhost:5432/gator?sslmode=disable";
  }
}

export default defineConfig({
  schema: "src/schema.ts",
  out: "src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: getConnectionString(),
  },
});
