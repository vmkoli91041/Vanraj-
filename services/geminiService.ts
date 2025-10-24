import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { Scene, Story, Language, EnrichedScene } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// Audio decoding utilities
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


async function generateStory(prompt: string, language: Language): Promise<Scene[]> {
  const langName = language === 'gu' ? 'Gujarati' : 'Hindi';
  const systemInstruction = `You are a creative storyteller for children. Your stories are simple, engaging, and carry a positive moral.`;

  const userPrompt = `Create a very short and simple story for children under 7 years old in ${langName} language, based on the following idea: '${prompt}'. The story should be easy to understand. Structure the output as a JSON array of objects. Each object represents a scene and must have these exact keys: 'scene' (a number starting from 1), 'description_for_image' (a detailed visual description in English for an image generation AI, including setting and actions, in a children's storybook illustration style with vibrant colors), and 'narration' (the narration text for that scene in ${langName} language). The story must have exactly 4 scenes. Do NOT include character descriptions in the 'description_for_image' field, only setting and actions.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: userPrompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            scene: { type: Type.INTEGER },
            description_for_image: { type: Type.STRING },
            narration: { type: Type.STRING },
          },
          required: ["scene", "description_for_image", "narration"],
        },
      },
    },
  });

  const text = response.text.trim();
  return JSON.parse(text);
}


async function generateImage(prompt: string): Promise<string> {
  const response = await ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt: `Children's storybook illustration, vibrant colors, friendly cartoon style. ${prompt}`,
    config: {
      numberOfImages: 1,
      aspectRatio: '16:9',
      outputMimeType: 'image/jpeg',
    }
  });

  const base64ImageBytes = response.generatedImages[0].image.imageBytes;
  return `data:image/jpeg;base64,${base64ImageBytes}`;
}

async function generateSpeech(text: string, audioContext: AudioContext): Promise<AudioBuffer> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Audio data not found in response");
  }

  const decodedBytes = decodeBase64(base64Audio);
  return decodeAudioData(decodedBytes, audioContext, 24000, 1);
}

export async function generateStoryAndAssets(
  prompt: string,
  characterDescription: string,
  language: Language,
  audioContext: AudioContext,
  setLoadingMessage: (message: string) => void
): Promise<Story> {
  try {
    const langMessages = language === 'gu' ? 
      ["તમારી વાર્તા લખાઈ રહી છે...", "સુંદર ચિત્રો દોરવામાં આવી રહ્યા છે...", "વાર્તામાં જીવંતતા આવી રહી છે..."] :
      ["आपकी कहानी लिखी जा रही है...", "सुंदर चित्र बनाए जा रहे हैं...", "कहानी में जान डाली जा रही है..."];

    setLoadingMessage(langMessages[0]);
    const scenes = await generateStory(prompt, language);
    if (!scenes || scenes.length === 0) {
      throw new Error("Failed to generate story scenes.");
    }

    setLoadingMessage(langMessages[1]);
    
    const assetPromises = scenes.map(async (scene) => {
      const imagePrompt = characterDescription.trim()
        ? `The main character is a ${characterDescription}. ${scene.description_for_image}`
        : scene.description_for_image;

      const [imageUrl, audioBuffer] = await Promise.all([
        generateImage(imagePrompt),
        generateSpeech(scene.narration, audioContext)
      ]);
      return { ...scene, imageUrl, audioBuffer };
    });

    setLoadingMessage(langMessages[2]);

    const enrichedScenes: EnrichedScene[] = await Promise.all(assetPromises);
    enrichedScenes.sort((a, b) => a.scene - b.scene);

    return enrichedScenes;

  } catch (error) {
    console.error("Error generating story and assets:", error);
    throw error;
  }
}