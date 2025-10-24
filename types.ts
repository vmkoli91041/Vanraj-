
export interface Scene {
  scene: number;
  description_for_image: string;
  narration: string;
}

export interface StoryAsset {
  imageUrl: string;
  audioBuffer: AudioBuffer;
}

export interface EnrichedScene extends Scene, StoryAsset {}

export type Story = EnrichedScene[];

export type Language = 'gu' | 'hi';

export type AppState = 'idle' | 'loading' | 'playing' | 'error';
