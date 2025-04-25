// src/ui/console/sections/OutputViewer.ts
export class OutputViewer {
    private outputArea: HTMLElement;
    private codeBlock: HTMLElement;
  
    render(container: HTMLElement) {
      const outputSection = container.createEl('div', { cls: 'ai-console-output-section' });
      outputSection.createEl('h4', { text: 'Output' });
      this.outputArea = outputSection.createEl('div', { cls: 'ai-console-output' });
      this.codeBlock = outputSection.createEl('pre', { cls: 'ai-console-code' });
    }
  
    setOutput(output: string) {
      this.outputArea.setText(output);
    }
  
    setCode(code: string) {
      this.codeBlock.setText(code);
    }
  
    clear() {
      this.outputArea.empty();
      this.codeBlock.empty();
    }
  
    cleanup() {
      // No cleanup needed for output elements
    }
  }