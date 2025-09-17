import React, { useState } from 'react';
import { UploadPage } from './components/UploadPage';
import { ProcessingState } from './components/ProcessingState';
import { ResultsPage } from './components/ResultsPage';
import { AppState, UploadedFile, DealMemo } from './types';
import { uploadMaterials, generateDealMemo } from './lib/api';

function App() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [dealMemo, setDealMemo] = useState<DealMemo | null>(null);
  const [shouldCompleteProcessing, setShouldCompleteProcessing] = useState(false);

  const handleGenerateMemo = async (
    files: UploadedFile[], 
    includePublicData: boolean, 
    analystFocus: string
  ) => {
    setShouldCompleteProcessing(false);
    setAppState('processing');

    try {
      // Build multipart form data for upload
      const form = new FormData();
      for (const f of files) {
        form.append('files', f.file, f.name);
      }
      form.append('includePublicData', String(includePublicData));
      form.append('analystFocus', analystFocus);

      const uploadResp = await uploadMaterials(form);

      // Call AI generation (default: OpenAI)
      const aiResp = await generateDealMemo({
        parsedText: uploadResp.parsedText,
        analystFocus: uploadResp.analystFocus,
        publicData: uploadResp.publicData,
        // TODO: Switch to 'gemini' to use Google Gemini
        provider: 'openai',
      });

      // Backend returns { "aegisDealMemo": { ... } }
      const memo = aiResp?.aegisDealMemo;
      if (!memo) throw new Error('Invalid AI response');

      setDealMemo(memo);
      setShouldCompleteProcessing(true);
    } catch (e) {
      console.error(e);
      // TODO: Surface toast/error UI
      setShouldCompleteProcessing(true);
    }
  };

  const handleProcessingComplete = () => {
    if (dealMemo) {
      setAppState('results');
    } else {
      // On error, return to upload
      setAppState('upload');
    }
  };

  const handleStartOver = () => {
    setAppState('upload');
    setDealMemo(null);
    setShouldCompleteProcessing(false);
  };

  return (
    <div className="App">
      {appState === 'upload' && (
        <UploadPage onGenerateMemo={handleGenerateMemo} />
      )}
      
      {appState === 'processing' && (
        <ProcessingState onComplete={handleProcessingComplete} complete={shouldCompleteProcessing} />
      )}
      
      {appState === 'results' && dealMemo && (
        <ResultsPage 
          dealMemo={dealMemo} 
          onStartOver={handleStartOver}
        />
      )}
    </div>
  );
}

export default App;