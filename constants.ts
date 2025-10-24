export const LANGUAGES: { [key: string]: { name: string; flag: string } } = {
  gu: { name: 'ગુજરાતી', flag: '🇮🇳' },
  hi: { name: 'हिन्दी', flag: '🇮🇳' },
};

export const UI_TEXT = {
  gu: {
    title: 'બાળ વાર્તા નિર્માતા',
    promptPlaceholder: 'દા.ત. એક બહાદુર ઉંદર અને ડરપોક સિંહની વાર્તા...',
    generateButton: 'વાર્તા બનાવો',
    generating: 'બનાવી રહ્યું છે...',
    errorTitle: 'ભૂલ',
    errorMessage: 'માફ કરશો, કંઈક ખોટું થયું. કૃપા કરીને ફરી પ્રયાસ કરો.',
    tryAgain: 'ફરી પ્રયાસ કરો',
    playAgain: 'ફરીથી ચલાવો',
    backToHome: 'હોમ પર પાછા જાઓ',
    downloadVideo: 'વીડિયો ડાઉનલોડ કરો',
    renderingVideo: 'વીડિયો બની રહ્યો છે...',
    characterLabel: 'તમારા મુખ્ય પાત્રનું વર્ણન કરો (વૈકલ્પિક)',
    characterPlaceholder: 'દા.ત. લાલ ટોપીવાળો એક બહાદુર ઉંદર',
  },
  hi: {
    title: 'बाल कहानी निर्माता',
    promptPlaceholder: 'उदा. एक बहादुर चूहे और डरपोक शेर की कहानी...',
    generateButton: 'कहानी बनाएं',
    generating: 'बना रहा है...',
    errorTitle: 'त्रुटि',
    errorMessage: 'क्षमा करें, कुछ गलत हो गया। कृपया पुन: प्रयास करें।',
    tryAgain: 'पुनः प्रयास करें',
    playAgain: 'फिर से चलाएं',
    backToHome: 'होम पर वापस जाएं',
    downloadVideo: 'वीडियो डाउनलोड करें',
    renderingVideo: 'वीडियो बन रहा है...',
    characterLabel: 'अपने मुख्य पात्र का वर्णन करें (वैकल्पिक)',
    characterPlaceholder: 'उदा. लाल टोपी वाला एक बहादुर चूहा',
  }
};

export const LOADING_MESSAGES = {
    gu: [
        "તમારી વાર્તા લખાઈ રહી છે...",
        "સુંદર ચિત્રો દોરવામાં આવી રહ્યા છે...",
        "પાત્રોને અવાજ આપવામાં આવી રહ્યો છે...",
        "જાદુઈ દુનિયા તૈયાર થઈ રહી છે...",
        "બસ થોડીવાર રાહ જુઓ...",
    ],
    hi: [
        "आपकी कहानी लिखी जा रही है...",
        "सुंदर चित्र बनाए जा रहे हैं...",
        "पात्रों को आवाज़ दी जा रही है...",
        "जादुई दुनिया तैयार हो रही है...",
        "बस कुछ क्षण प्रतीक्षा करें...",
    ]
}

export const STORY_GENERATION_MODEL = 'gemini-2.5-pro';
export const IMAGE_GENERATION_MODEL = 'imagen-4.0-generate-001';
export const SPEECH_GENERATION_MODEL = 'gemini-2.5-flash-preview-tts';