import type { App } from 'obsidian';
import type { SecretsManager } from '../utils/secrets';
import type { MyPluginSettings } from '../settings/types';

import { TextGateway } from '../gateways/TextGateway';
//import { ImageGateway } from '../gateways/ImageGateway';
//import { SpeechGateway } from '../gateways/SpeechGateway';
//import { VideoGateway } from '../gateways/VideoGateway';
//import { VisionGateway } from '../gateways/VisionGateway';

/* ---------------------------------- *
 * Interfaces for Each AI Modality   *
 * ---------------------------------- */
export interface TextAPI {
  generate(
    prompt: string,
    opts?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string>;
}

export interface ImageAPI {
  generate(
    prompt: string,
    opts?: {
      model?: string;
      width?: number;
      height?: number;
    }
  ): Promise<string>;
}

export interface SpeechAPI {
  synthesize(
    text: string,
    opts?: {
      voice?: string;
      format?: string;
    }
  ): Promise<string>;

  recognize(
    audioData: ArrayBuffer,
    opts?: {
      model?: string;
    }
  ): Promise<string>;
}

export interface VideoAPI {
  generate(
    prompt: string,
    opts?: {
      model?: string;
      durationSeconds?: number;
    }
  ): Promise<string>;

  caption(
    videoData: ArrayBuffer,
    opts?: {
      model?: string;
    }
  ): Promise<string>;
}

export interface VisionAPI {
  caption(
    imageData: ArrayBuffer,
    opts?: {
      model?: string;
    }
  ): Promise<string>;
}

/* ---------------------------------- *
 * Global Window Interface Extension *
 * ---------------------------------- */
declare global {
  interface Window {
    aiNNS?: {
      text: TextAPI;
      //image: ImageAPI;
      //speech: SpeechAPI;
     // video: VideoAPI;
      //vision: VisionAPI;
    };
  }
}

/* ---------------------------------- *
 * Register aiNNS on Global Scope    *
 * ---------------------------------- */
export async function registerAiNNS(
  app: App,
  secrets: SecretsManager,
  settings: MyPluginSettings
) {
  const textGw = await TextGateway.create(secrets, settings);
  //const imageGw = new ImageGateway(secrets, settings);
  //const speechGw = new SpeechGateway(secrets, settings);
  //const videoGw = new VideoGateway(secrets, settings);
  //const visionGw = new VisionGateway(secrets, settings);

  window.aiNNS = {
    text: {
      generate: (prompt, opts) =>
        textGw.generate({ prompt, ...opts }),
    },/*
    image: {
      generate: (prompt, opts) =>
        imageGw.generate({ prompt, ...opts }),
    },
    speech: {
      synthesize: (text, opts) =>
        speechGw.synthesize({ text, ...opts }),
      recognize: (audioData, opts) =>
        speechGw.recognize({ audioData, ...opts }),
    },
    video: {
      generate: (prompt, opts) =>
        videoGw.generate({ prompt, ...opts }),
      caption: (videoData, opts) =>
        videoGw.caption({ videoData, ...opts }),
    },
    vision: {
      caption: (imageData, opts) =>
        visionGw.caption({ imageData, ...opts }),
    },*/
  };
}

/* ---------------------------------- *
 * Cleanup aiNNS on Plugin Unload    *
 * ---------------------------------- */
export function unregisterAiNNS() {
  delete window.aiNNS;
}
