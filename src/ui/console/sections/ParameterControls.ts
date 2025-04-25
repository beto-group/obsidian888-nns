// src/ui/console/sections/ParameterControls.ts
import { Setting, SliderComponent, TextComponent, Notice } from 'obsidian';

export class ParameterControls {
  private temperatureSlider?: SliderComponent;
  private maxTokensInput?: TextComponent;

  render(container: HTMLElement) {
    const paramsContainer = container.createEl('div', { cls: 'ai-console-params' });
    paramsContainer.createEl('h4', { text: 'Parameters' });

    try {
      new Setting(paramsContainer)
        .setName('Temperature')
        .setDesc('Controls randomness (0.0 to 1.0).')
        .addSlider(slider => {
          this.temperatureSlider = slider.setLimits(0, 1, 0.1).setValue(0.7).setDynamicTooltip();
        });
    } catch (error) {
      console.error('[ParameterControls] Error creating temperature slider:', error);
      paramsContainer.createEl('p', { text: 'Error loading temperature slider.' });
    }

    try {
      new Setting(paramsContainer)
        .setName('Max Tokens')
        .setDesc('Maximum number of tokens to generate.')
        .addText(text => {
          this.maxTokensInput = text
            .setPlaceholder('1000')
            .setValue('1000')
            .onChange(value => {
              if (isNaN(parseInt(value)) && value !== '') {
                new Notice('Max Tokens must be a number.');
                text.setValue('1000');
              }
            });
        });
    } catch (error) {
      console.error('[ParameterControls] Error creating max tokens input:', error);
      paramsContainer.createEl('p', { text: 'Error loading max tokens input.' });
    }
  }

  getTemperature(): number {
    try {
      return parseFloat(this.temperatureSlider!.getValue().toString()) || 0.7;
    } catch (error) {
      console.error('[ParameterControls] Error getting temperature:', error);
      return 0.7;
    }
  }

  getMaxTokens(): number {
    try {
      return parseInt(this.maxTokensInput!.getValue()) || 1000;
    } catch (error) {
      console.error('[ParameterControls] Error getting max tokens:', error);
      return 1000;
    }
  }

  cleanup() {
    // No cleanup needed for sliders and inputs
  }
}