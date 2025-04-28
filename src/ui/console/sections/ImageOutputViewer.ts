export class ImageOutputViewer {
  private outputArea: HTMLElement;
  private images: string[] = [];
  private format: string = 'png';

  // Utility to validate or normalize image URLs
  private isValidImageUrl(url: string): boolean {
    return (url.startsWith('data:image/') && url.includes(';base64,')) || url.startsWith('http');
  }

  private normalizeImageUrl(url: string, format: string): string {
    if (url.startsWith('data:image/')) {
      return url; // Already a data URL, use as-is
    }
    // Assume raw base64 and construct data URL
    const mimeType = `image/${format}`;
    return `data:${mimeType};base64,${url}`;
  }

  render(container: HTMLElement) {
    const outputSection = container.createEl('div', { cls: 'ai-console-output-section' });
    outputSection.createEl('h4', { text: 'Generated Images' });
    this.outputArea = outputSection.createEl('div', { cls: 'ai-console-image-grid' });
    this.renderImages();
  }

  setImages(images: string[], format: string) {
    this.images = images;
    this.format = format;
    this.renderImages();
  }

  private renderImages() {
    this.outputArea.empty();
    if (this.images.length === 0) {
      this.outputArea.setText('No images to display.');
      return;
    }

    this.images.forEach((url, index) => {
      try {
        const normalizedUrl = this.normalizeImageUrl(url, this.format);
        if (this.isValidImageUrl(normalizedUrl)) {
          const img = this.outputArea.createEl('img', {
            attr: { src: normalizedUrl, style: 'max-width: 100%; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);' },
          });
          img.onerror = () => {
            img.remove();
            this.outputArea.createEl('p', { text: `Failed to load image ${index + 1}.` });
          };
        } else {
          console.warn('[ImageOutputViewer] Skipping invalid image URL:', url);
          this.outputArea.createEl('p', { text: `Invalid image URL ${index + 1}.` });
        }
      } catch (e) {
        console.error('[ImageOutputViewer] Failed to render image:', e);
        this.outputArea.createEl('p', { text: `Failed to render image ${index + 1}.` });
      }
    });
  }

  setLoading() {
    this.outputArea.empty();
    this.outputArea.setText('Generating...');
  }

  setError(message: string) {
    this.outputArea.empty();
    this.outputArea.setText(`Error: ${message}`);
  }

  cleanup() {
    this.images = [];
    this.format = 'png';
  }
}