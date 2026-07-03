import fs from "fs";
import os from "os";
import path from "path";

export type Config = {
  dbUrl: string;
  currentUserName?: string;
};

function getConfigFilePath(): string {
  return path.join(os.homedir(), ".gatorconfig.json");
}

export function writeConfig(cfg: Config): void {
  const filePath = getConfigFilePath();
  const jsonStr = JSON.stringify({
    db_url: cfg.dbUrl,
    current_user_name: cfg.currentUserName
  }, null, 2);
  fs.writeFileSync(filePath, jsonStr, "utf-8");
}

function validateConfig(rawConfig: any): Config {
  if (!rawConfig || typeof rawConfig.db_url !== "string") {
    throw new Error("Invalid config file structure: db_url is required");
  }
  return {
    dbUrl: rawConfig.db_url,
    currentUserName: rawConfig.current_user_name
  };
}

export function readConfig(): Config {
  const filePath = getConfigFilePath();
  if (!fs.existsSync(filePath)) {
    throw new Error(`Config file not found at ${filePath}`);
  }
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const rawJson = JSON.parse(fileContent);
  return validateConfig(rawJson);
}

export function setUser(username: string): void {
  const currentConfig = readConfig();
  currentConfig.currentUserName = username;
  writeConfig(currentConfig);
}
