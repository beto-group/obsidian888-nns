
import { Setting } from 'obsidian';

export class ImageControls {
  private sizeDropdown: HTMLSelectElement;
  private nImagesInput: HTMLInputElement;
  private qualityDropdown: HTMLSelectElement;
  private outputFormatDropdown: HTMLSelectElement;

  private modelSizes: Record<string, string[]> = {
    'dall-e-3': ['1024x1024', '1792x1024', '1024x1792'],
    'dall-e-2': ['256x256', '512x512', '1024x1024'],
    'gpt-image-1': ['1024x1024', '1536x1024', '1024x1536'],
    'stable-diffusion': ['512x512', '1024x1024'],
    'grok-image': ['1024x1024'],
  };

  private maxN: Record<string, number> = {
    'dall-e-3': 1,
    'dall-e-2': 10,
    'gpt-image-1': 10,
    'stable-diffusion': 4,
    'grok-image': 1,
  };

  private modelQualities: Record<string, string[]> = {
    'dall-e-3': ['standard', 'hd'],
    'dall-e-2': [],
    'gpt-image-1': ['low', 'medium', 'high', 'auto'],
    'stable-diffusion': [],
    'grok-image': [],
  };

  private outputFormats: string[] = ['png', 'jpeg', 'webp'];

  render(container: HTMLElement) {
    const controlsRow = container.createEl('div', { cls: 'ai-console-controls-row' });

    new Setting(controlsRow)
      .setName('Size')
      .addDropdown(dropdown => {
        this.sizeDropdown = dropdown.selectEl;
      })
      .controlEl.style.flex = '0 0 auto';

    new Setting(controlsRow)
      .setName('N')
      .addText(text => {
        this.nImagesInput = text.inputEl;
        this.nImagesInput.type = 'number';
        this.nImagesInput.min = '1';
        this.nImagesInput.value = '1';
        this.nImagesInput.style.width = '50px';
      })
      .controlEl.style.flex = '0 0 auto';

    new Setting(controlsRow)
      .setName('Quality')
      .addDropdown(dropdown => {
        this.qualityDropdown = dropdown.selectEl;
      })
      .controlEl.style.flex = '0 0 auto';

    new Setting(controlsRow)
      .setName('Output Format')
      .addDropdown(dropdown => {
        this.outputFormatDropdown = dropdown.selectEl;
      })
      .controlEl.style.flex = '0 0 auto';
  }

  updateControls(model: string) {
    // Update size dropdown
    const currentSize = this.sizeDropdown.value || '1024x1024';
    this.sizeDropdown.innerHTML = '';
    const sizes = this.modelSizes[model] || ['1024x1024'];
    sizes.forEach(size => this.sizeDropdown.add(new Option(size, size)));
    this.sizeDropdown.value = sizes.includes(currentSize) ? currentSize : sizes[0];
    console.log('[ImageControls] Updated size dropdown:', this.sizeDropdown.value);

    // Update max N
    const max = this.maxN[model] || 1;
    this.nImagesInput.max = max.toString();
    const currentN = parseInt(this.nImagesInput.value) || 1;
    this.nImagesInput.value = Math.min(currentN, max).toString();
    console.log('[ImageControls] Updated N input: max=', max, 'value=', this.nImagesInput.value);

    // Update quality dropdown
    const qualitySetting = this.qualityDropdown.parentElement?.parentElement as HTMLElement;
    const qualities = this.modelQualities[model] || [];
    if (qualities.length === 0) {
      qualitySetting.style.display = 'none';
    } else {
      qualitySetting.style.display = 'block';
      const currentQuality = this.qualityDropdown.value || qualities[0];
      this.qualityDropdown.innerHTML = '';
      qualities.forEach(q => this.qualityDropdown.add(new Option(q.charAt(0).toUpperCase() + q.slice(1), q)));
      this.qualityDropdown.value = qualities.includes(currentQuality) ? currentQuality : qualities[0];
      console.log('[ImageControls] Updated quality dropdown:', this.qualityDropdown.value);
    }

    // Update output format dropdown
    const outputFormatSetting = this.outputFormatDropdown.parentElement?.parentElement as HTMLElement;
    if (model === 'gpt-image-1') {
      outputFormatSetting.style.display = 'block';
      const currentFormat = this.outputFormatDropdown.value || 'png';
      this.outputFormatDropdown.innerHTML = '';
      this.outputFormats.forEach(f => this.outputFormatDropdown.add(new Option(f.toUpperCase(), f)));
      this.outputFormatDropdown.value = this.outputFormats.includes(currentFormat) ? currentFormat : 'png';
      console.log('[ImageControls] Updated output format dropdown:', this.outputFormatDropdown.value);
    } else {
      outputFormatSetting.style.display = 'none';
    }
  }

  setControls(size: string, n: number, quality: string, outputFormat: string) {
    if (this.sizeDropdown) this.sizeDropdown.value = size;
    if (this.nImagesInput) this.nImagesInput.value = n.toString();
    if (this.qualityDropdown) this.qualityDropdown.value = quality;
    if (this.outputFormatDropdown) this.outputFormatDropdown.value = outputFormat;
  }

  getSize(): string {
    return this.sizeDropdown.value || '1024x1024';
  }

  getN(): number {
    return parseInt(this.nImagesInput.value) || 1;
  }

  getQuality(): string {
    return this.qualityDropdown.value || 'standard';
  }

  getOutputFormat(): string {
    return this.outputFormatDropdown.value || 'png';
  }

  cleanup() {
    // No cleanup needed for dropdowns and inputs
  }
}