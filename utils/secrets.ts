import { App } from "obsidian";
import * as fs from "fs";
import * as path from "path";

const SECRETS_FOLDER_PATH = path.join(".secrets", "nns");

export class SecretsManager {
  private vaultPath: string;
  private secretsPath: string;

  constructor(private app: App) {
    this.vaultPath = (this.app.vault.adapter as any).basePath;
    this.secretsPath = path.join(this.vaultPath, SECRETS_FOLDER_PATH);

    if (!fs.existsSync(this.secretsPath)) {
      fs.mkdirSync(this.secretsPath, { recursive: true });
    }

    this.ensureGitignore();
  }

  private getSecretFilePath(key: string): string {
    return path.join(this.secretsPath, `${key}.json`);
  }

  getSecret(key: string): any | null {
    const file = this.getSecretFilePath(key);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (err) {
      console.error(`Error reading secret "${key}"`, err);
      return null;
    }
  }

  /**
   * Set or update a secret.
   * If `merge` is true, it will merge into existing secret file instead of replacing it entirely.
   */
  setSecret(key: string, value: any, merge = true): void {
    const file = this.getSecretFilePath(key);
    let existing = {};
    if (merge && fs.existsSync(file)) {
      try {
        existing = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch (e) {
        console.error(`Error reading secret "${key}"`, e);
      }
    }
    const merged = Object.assign({}, existing, value);
    fs.writeFileSync(file, JSON.stringify(merged, null, 2), "utf8");
  }

  deleteSecret(key: string): void {
    const file = this.getSecretFilePath(key);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }

  listSecrets(): string[] {
    if (!fs.existsSync(this.secretsPath)) return [];
    return fs
      .readdirSync(this.secretsPath)
      .filter(file => file.endsWith(".json"))
      .map(file => file.replace(/\.json$/, ""));
  }

  hasValidSecret(key: string): boolean {
    const secret = this.getSecret(key);
    return secret?.validated === true;
  }

  markSecretAsValidated(key: string): void {
    this.setSecret(key, {
      validated: true,
      lastValidated: new Date().toISOString()
    });
  }

  private ensureGitignore(): void {
    const gitignorePath = path.join(this.vaultPath, ".gitignore");
    try {
      let content = "";
      if (fs.existsSync(gitignorePath)) {
        content = fs.readFileSync(gitignorePath, "utf8");
      }

      const relativeIgnorePath = `/${SECRETS_FOLDER_PATH}/`;
      if (!content.includes(relativeIgnorePath)) {
        content += `\n${relativeIgnorePath}\n`;
        fs.writeFileSync(gitignorePath, content.trim() + "\n", "utf8");
      }
    } catch (err) {
      console.warn("Could not update .gitignore:", err);
    }
  }
}
