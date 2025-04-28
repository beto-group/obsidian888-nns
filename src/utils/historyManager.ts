import type { App } from 'obsidian';
import type { SecretsManager } from './secrets';
import { Notice } from 'obsidian';

// Generic type for history entries
export interface BaseHistoryEntry {
  provider: string;
  model: string;
  prompt: string;
  timestamp: string;
}

// Specific history entry types
export interface PromptHistoryEntry extends BaseHistoryEntry {
  output: string;
}

export interface ImageHistoryEntry extends BaseHistoryEntry {
  imageUrls: string[];
  size?: string;
  quality?: string;
  output_format?: string;
}

// Add more history entry types as needed (e.g., VideoHistoryEntry, AudioHistoryEntry)
export type HistoryEntry = PromptHistoryEntry | ImageHistoryEntry;

// Supported history types
export type HistoryType = 'text' | 'image' | 'video' | 'audio' | 'ocr' | '3d';

export class HistoryManager {
  private app: App;
  private secrets: SecretsManager;
  private basePath = '.obsidian/plugins/obsidian888-nns/history'; // Store history in plugin folder
  private maxEntriesDefault = 10;

  constructor(app: App, secrets: SecretsManager) {
    this.app = app;
    this.secrets = secrets;
  }

  /**
   * Ensures the history directory exists, creating it if necessary.
   */
  private async ensureHistoryDirectory(): Promise<void> {
    try {
      const exists = await this.app.vault.adapter.exists(this.basePath);
      if (!exists) {
        await this.app.vault.adapter.mkdir(this.basePath);
        console.log(`[HistoryManager] Created history directory: ${this.basePath}`);
      }
    } catch (error) {
      console.error(`[HistoryManager] Error creating history directory:`, error);
      throw new Error('Failed to create history directory.');
    }
  }

  /**
   * Loads history entries for the specified type from persistent storage.
   */
  async loadHistory<T extends BaseHistoryEntry>(type: HistoryType): Promise<T[]> {
    console.log(`[HistoryManager] Loading history for type: ${type}`);
    const filePath = `${this.basePath}/${type}-history.json`;
    try {
      const exists = await this.app.vault.adapter.exists(filePath);
      if (!exists) {
        console.log(`[HistoryManager] No history file found for ${type}, returning empty array`);
        return [];
      }
      const data = await this.app.vault.adapter.read(filePath);
      const entries: T[] = JSON.parse(data) || [];
      console.log(`[HistoryManager] Loaded ${entries.length} entries for ${type}`);
      return entries;
    } catch (error) {
      console.error(`[HistoryManager] Error loading history for ${type}:`, error);
      new Notice(`Failed to load ${type} history.`);
      return [];
    }
  }

  /**
   * Saves history entries for the specified type to persistent storage.
   */
  async saveHistory<T extends BaseHistoryEntry>(type: HistoryType, entries: T[]): Promise<void> {
    console.log(`[HistoryManager] Saving ${entries.length} entries for type: ${type}`);
    const filePath = `${this.basePath}/${type}-history.json`;
    try {
      await this.ensureHistoryDirectory();
      await this.app.vault.adapter.write(filePath, JSON.stringify(entries, null, 2));
      console.log(`[HistoryManager] History saved for ${type}`);
    } catch (error) {
      console.error(`[HistoryManager] Error saving history for ${type}:`, error);
      new Notice(`Failed to save ${type} history.`);
    }
  }

  /**
   * Clears all history entries for the specified type.
   */
  async clearHistory(type: HistoryType): Promise<void> {
    console.log(`[HistoryManager] Clearing history for type: ${type}`);
    const filePath = `${this.basePath}/${type}-history.json`;
    try {
      const exists = await this.app.vault.adapter.exists(filePath);
      if (exists) {
        await this.app.vault.adapter.remove(filePath);
        console.log(`[HistoryManager] History cleared for ${type}`);
      }
    } catch (error) {
      console.error(`[HistoryManager] Error clearing history for ${type}:`, error);
      new Notice(`Failed to clear ${type} history.`);
    }
  }

  /**
   * Adds a new entry to the history for the specified type, respecting maxEntries.
   */
  async addEntry<T extends BaseHistoryEntry>(
    type: HistoryType,
    entry: T,
    maxEntries: number = this.maxEntriesDefault
  ): Promise<void> {
    console.log(`[HistoryManager] Adding entry to ${type} history`);
    try {
      const history = await this.loadHistory<T>(type);
      history.unshift(entry);
      if (history.length > maxEntries) {
        history.splice(maxEntries);
      }
      await this.saveHistory(type, history);
      console.log(`[HistoryManager] Entry added to ${type} history, total: ${history.length}`);
    } catch (error) {
      console.error(`[HistoryManager] Error adding entry to ${type} history:`, error);
      new Notice(`Failed to add entry to ${type} history.`);
    }
  }
}