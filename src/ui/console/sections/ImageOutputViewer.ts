export class ImageOutputViewer {
    private outputArea: HTMLElement;
    private images: string[] = [];
    private format: string = 'png';
  
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
  
      this.images.forEach((base64, index) => {
        try {
          const mimeType = `image/${this.format}`;
          const dataUrl = `data:${mimeType};base64,${base64}`;
          const img = this.outputArea.createEl('img', {
            attr: { src: dataUrl, style: 'max-width: 100%; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);' },
          });
          img.onerror = () => {
            img.remove();
            this.outputArea.createEl('p', { text: `Failed to load image ${index + 1}.` });
          };
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