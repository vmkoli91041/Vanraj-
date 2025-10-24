import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateStoryAndAssets } from './services/geminiService';
import { LANGUAGES, UI_TEXT, LOADING_MESSAGES } from './constants';
import type { Story, Language, AppState, EnrichedScene } from './types';

// --- Video Generation Service Logic ---
const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const FPS = 30;

// Helper for linear interpolation
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

async function createAnimationVideo(
  story: Story,
  language: Language,
  onProgress: (message: string) => void
): Promise<Blob> {
  const progressMessages = {
      gu: {
          audio: "ઑડિયો ટ્રેકને જોડી રહ્યું છે...",
          recorder: "વીડિયો રેકોર્ડર સેટ કરી રહ્યું છે...",
          scenes: "દ્રશ્યો બનાવી રહ્યું છે...",
          scene: (i: number, t: number) => `દ્રશ્ય ${i}/${t} બનાવી રહ્યું છે...`,
          finalize: "ફાઇનલ ટચ આપી રહ્યું છે...",
      },
      hi: {
          audio: "ऑडियो ट्रैक को संयोजित किया जा रहा है...",
          recorder: "वीडियो रिकॉर्डर स्थापित किया जा रहा है...",
          scenes: "दृश्य प्रस्तुत किए जा रहे हैं...",
          scene: (i: number, t: number) => `दृश्य ${i}/${t} प्रस्तुत किया जा रहा है...`,
          finalize: "अंतिम रूप दिया जा रहा है...",
      }
  };
  const messages = progressMessages[language];

  return new Promise(async (resolve, reject) => {
    try {
      onProgress(messages.audio);
      const totalDuration = story.reduce((sum, scene) => sum + scene.audioBuffer.duration, 0);
      const offlineAudioContext = new OfflineAudioContext(1, Math.ceil(totalDuration * 44100), 44100);
      
      let currentTime = 0;
      story.forEach(scene => {
        const source = offlineAudioContext.createBufferSource();
        source.buffer = scene.audioBuffer;
        source.connect(offlineAudioContext.destination);
        source.start(currentTime);
        currentTime += scene.audioBuffer.duration;
      });

      const combinedAudioBuffer = await offlineAudioContext.startRendering();
      const tempAudioContext = new AudioContext();
      const audioDestination = tempAudioContext.createMediaStreamDestination();
      const audioSource = tempAudioContext.createBufferSource();
      audioSource.buffer = combinedAudioBuffer;
      audioSource.connect(audioDestination);
      audioSource.start();
      const audioStream = audioDestination.stream;

      onProgress(messages.recorder);
      const canvas = document.createElement('canvas');
      canvas.width = VIDEO_WIDTH;
      canvas.height = VIDEO_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error("Could not get canvas context"));

      const videoStream = canvas.captureStream(FPS);
      const combinedStream = new MediaStream([videoStream.getVideoTracks()[0], audioStream.getAudioTracks()[0]]);
      const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => event.data.size > 0 && chunks.push(event.data);
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
      recorder.onerror = (err) => reject(err);
      
      recorder.start();
      
      onProgress(messages.scenes);
      for (let i = 0; i < story.length; i++) {
        const scene = story[i];
        onProgress(messages.scene(i + 1, story.length));
        
        const img = await loadImage(scene.imageUrl);
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
        
        const canvasAspect = VIDEO_WIDTH / VIDEO_HEIGHT;
        const imgAspect = img.width / img.height;

        let sWidth, sHeight, sx, sy;
        if (imgAspect > canvasAspect) {
            sHeight = img.height;
            sWidth = sHeight * canvasAspect;
            sx = (img.width - sWidth) / 2;
            sy = 0;
        } else {
            sWidth = img.width;
            sHeight = sWidth / canvasAspect;
            sx = 0;
            sy = (img.height - sHeight) / 2;
        }

        const zoom = 1.15; // Zoom factor
        const end_sWidth = sWidth / zoom;
        const end_sHeight = sHeight / zoom;
        const animationType = Math.random();
        let startParams = { sx, sy, sWidth, sHeight };
        let endParams = { sx: (img.width - end_sWidth) / 2, sy: (img.height - end_sHeight) / 2, sWidth: end_sWidth, sHeight: end_sHeight };

        if (animationType < 0.25) { // Zoom in, pan right
             endParams.sx += end_sWidth * 0.1;
        } else if (animationType < 0.5) { // Zoom in, pan left
            endParams.sx -= end_sWidth * 0.1;
        } else if (animationType < 0.75) { // Zoom out
            [startParams, endParams] = [endParams, startParams]; // Swap start and end for zoom out
        }
        // else: Zoom in center (default)

        const duration = scene.audioBuffer.duration * 1000;
        const frameCount = Math.round(scene.audioBuffer.duration * FPS);

        for (let frame = 0; frame < frameCount; frame++) {
            const progress = frame / frameCount;
            const current_sWidth = lerp(startParams.sWidth, endParams.sWidth, progress);
            const current_sHeight = lerp(startParams.sHeight, endParams.sHeight, progress);
            const current_sx = lerp(startParams.sx, endParams.sx, progress);
            const current_sy = lerp(startParams.sy, endParams.sy, progress);
            
            ctx.drawImage(img, current_sx, current_sy, current_sWidth, current_sHeight, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
            await new Promise(res => setTimeout(res, 1000 / FPS));
        }
      }

      onProgress(messages.finalize);
      recorder.stop();
      tempAudioContext.close();

    } catch (error) {
      reject(error);
    }
  });
}

// --- SVG Icons ---
const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path d="M8 5v14l11-7z" /></svg>
);
const PauseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
);
const ReplayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></svg>
);
const HomeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg>
);
const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path d="M5 20h14v-2H5v2zm14-9h-4V3H9v8H5l7 7 7-7z" /></svg>
);
const SpinnerIcon = () => (
  <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);


// --- Loader Component ---
const Loader: React.FC<{ language: Language }> = ({ language }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const messages = LOADING_MESSAGES[language];

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prevIndex) => (prevIndex + 1) % messages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [messages]);

  return (
    <div className="flex flex-col items-center justify-center text-center text-rose-800">
      <div className="w-24 h-24 border-8 border-rose-200 border-t-rose-500 rounded-full animate-spin mb-6"></div>
      <p className="text-2xl font-bold animate-pulse">{messages[messageIndex]}</p>
    </div>
  );
};

// --- StoryPlayer Component ---
interface StoryPlayerProps {
  story: Story;
  language: Language;
  onFinish: () => void;
  audioContext: AudioContext;
}
const StoryPlayer: React.FC<StoryPlayerProps> = ({ story, language, onFinish, audioContext }) => {
    const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isRendering, setIsRendering] = useState(false);
    const [renderMessage, setRenderMessage] = useState('');
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
    const playCurrentSceneAudio = useCallback(() => {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }
      if (currentSceneIndex >= story.length) {
          setIsPlaying(false);
          return;
      }
  
      const scene = story[currentSceneIndex];
      const source = audioContext.createBufferSource();
      source.buffer = scene.audioBuffer;
      source.connect(audioContext.destination);
      source.start();
  
      source.onended = () => {
        if (currentSceneIndex < story.length - 1) {
          setCurrentSceneIndex(prev => prev + 1);
        } else {
          setIsPlaying(false);
        }
      };
      audioSourceRef.current = source;
    }, [currentSceneIndex, story, audioContext]);

    useEffect(() => {
        if (isPlaying) {
          if (audioContext.state === 'suspended') audioContext.resume();
          playCurrentSceneAudio();
        } else if (audioSourceRef.current) {
          audioSourceRef.current.stop();
          audioSourceRef.current = null;
        }
        return () => {
          if (audioSourceRef.current) {
              audioSourceRef.current.stop();
          }
        };
    }, [isPlaying, currentSceneIndex, playCurrentSceneAudio, audioContext]);
  
    const handlePlayPause = () => setIsPlaying(prev => !prev);
    const handleReplay = () => {
        setCurrentSceneIndex(0);
        setIsPlaying(true);
    };

    const handleDownload = async () => {
      setIsRendering(true);
      setRenderMessage('');
      try {
          const videoBlob = await createAnimationVideo(story, language, setRenderMessage);
          const url = URL.createObjectURL(videoBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `story-${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      } catch (err) {
          console.error("Failed to render video:", err);
          alert("Sorry, there was an error creating the video.");
      } finally {
          setIsRendering(false);
      }
    };

    const currentScene = story[currentSceneIndex];

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in relative">
            {isRendering && (
                <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center text-white z-20 rounded-3xl">
                    <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-xl font-bold">{renderMessage || UI_TEXT[language].renderingVideo}</p>
                </div>
            )}
            <div className="relative w-full aspect-video bg-gray-200">
                <img key={currentScene.scene} src={currentScene.imageUrl} alt={`Scene ${currentScene.scene}`} className="w-full h-full object-cover animate-fade-in-slow"/>
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4">
                    <p className="text-white text-lg md:text-xl text-center font-semibold">{currentScene.narration}</p>
                </div>
            </div>
            <div className="p-4 bg-rose-100 flex items-center justify-center space-x-4">
                <button onClick={onFinish} title={UI_TEXT[language].backToHome} className="p-3 rounded-full bg-rose-500 text-white hover:bg-rose-600 transition-transform transform hover:scale-110">
                    <HomeIcon />
                </button>
                <button onClick={handlePlayPause} title={isPlaying ? 'Pause' : 'Play'} className="p-3 rounded-full bg-rose-500 text-white hover:bg-rose-600 transition-transform transform hover:scale-110">
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button onClick={handleReplay} title={UI_TEXT[language].playAgain} className="p-3 rounded-full bg-rose-500 text-white hover:bg-rose-600 transition-transform transform hover:scale-110">
                    <ReplayIcon />
                </button>
                <button onClick={handleDownload} title={UI_TEXT[language].downloadVideo} disabled={isRendering} className="p-3 rounded-full bg-rose-500 text-white hover:bg-rose-600 transition-transform transform hover:scale-110 disabled:bg-gray-400 disabled:cursor-not-allowed">
                    {isRendering ? <SpinnerIcon /> : <DownloadIcon />}
                </button>
            </div>
        </div>
    );
};

// --- Main App Component ---
function App() {
  const [language, setLanguage] = useState<Language>('gu');
  const [prompt, setPrompt] = useState('');
  const [character, setCharacter] = useState('');
  const [story, setStory] = useState<Story | null>(null);
  const [appState, setAppState] = useState<AppState>('idle');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    setAppState('loading');
    setError(null);
    setStory(null);
    
    try {
      const generatedStory = await generateStoryAndAssets(prompt, character, language, audioContextRef.current, setLoadingMessage);
      setStory(generatedStory);
      setAppState('playing');
    } catch (err) {
      setError(UI_TEXT[language].errorMessage);
      setAppState('error');
    }
  };

  const resetApp = () => {
    setAppState('idle');
    setStory(null);
    setError(null);
    setPrompt('');
    setCharacter('');
  }

  const renderContent = () => {
    switch (appState) {
      case 'loading':
        return <Loader language={language} />;
      case 'playing':
        return story && audioContextRef.current && <StoryPlayer story={story} language={language} onFinish={resetApp} audioContext={audioContextRef.current} />;
      case 'error':
        return (
          <div className="text-center p-8 bg-white rounded-2xl shadow-lg text-red-600">
            <h2 className="text-3xl font-bold mb-4">{UI_TEXT[language].errorTitle}</h2>
            <p className="text-xl mb-6">{error}</p>
            <button onClick={resetApp} className="px-6 py-3 bg-red-500 text-white rounded-full text-lg font-bold hover:bg-red-600 transition">
              {UI_TEXT[language].tryAgain}
            </button>
          </div>
        );
      case 'idle':
      default:
        return (
          <div className="w-full max-w-2xl mx-auto p-8 bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl text-center animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-bold text-rose-800 mb-6">{UI_TEXT[language].title}</h1>
            
            <div className="space-y-4 mb-6 text-left">
              <label className="text-lg font-semibold text-rose-800">{UI_TEXT[language].characterLabel}</label>
              <input
                type="text"
                value={character}
                onChange={(e) => setCharacter(e.target.value)}
                placeholder={UI_TEXT[language].characterPlaceholder}
                className="w-full p-3 text-lg border-2 border-rose-200 rounded-xl focus:ring-4 focus:ring-rose-300 focus:border-rose-500 outline-none transition"
              />
              <label className="text-lg font-semibold text-rose-800">હવે વાર્તા વિશે કહો...</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={UI_TEXT[language].promptPlaceholder}
                className="w-full h-28 p-3 text-lg border-2 border-rose-200 rounded-xl focus:ring-4 focus:ring-rose-300 focus:border-rose-500 outline-none transition resize-none"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              className="px-10 py-4 bg-rose-500 text-white rounded-full text-2xl font-bold hover:bg-rose-600 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100"
            >
              {UI_TEXT[language].generateButton}
            </button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-amber-100 bg-cover bg-center flex flex-col items-center justify-center p-4 relative" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")'}}>
        <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-md flex space-x-2">
            {(Object.keys(LANGUAGES) as Language[]).map(lang => (
                <button key={lang} onClick={() => setLanguage(lang)} className={`px-4 py-2 rounded-full text-lg font-bold transition ${language === lang ? 'bg-rose-500 text-white' : 'bg-transparent text-rose-800'}`}>
                    {LANGUAGES[lang].name}
                </button>
            ))}
        </div>
        
        {renderContent()}
    </div>
  );
}

export default App;