// src/ui/console/sections/PromptInput.ts
import { Notice } from 'obsidian';

export class PromptInput {
  private promptInput: HTMLTextAreaElement;

  render(container: HTMLElement, onRun: () => void) {
    const promptSection = container.createEl('div', { cls: 'ai-console-prompt-section' });
    this.promptInput = promptSection.createEl('textarea', {
      attr: { placeholder: 'Enter your prompt here...' },
      cls: 'ai-console-prompt'
    }) as HTMLTextAreaElement;

    const runBtn = promptSection.createEl('button', { text: 'Run', cls: 'ai-console-run-btn' });
    runBtn.addEventListener('click', onRun);
  }

  getPrompt(): string {
    return this.promptInput.value;
  }

  setPrompt(prompt: string) {
    this.promptInput.value = prompt;
  }

  cleanup() {
    // No cleanup needed for textarea
  }
}
