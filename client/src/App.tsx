import { useState, useRef, useEffect } from 'react';
import { Mic, Upload, Loader2, Volume2 } from 'lucide-react';
import { supabase } from './lib/supabase';

interface Transcription {
  id: string;
  transcribed_text: string;
  created_at: string;
  status: string;
}

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [history, setHistory] = useState<Transcription[]>([]);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const { data, error } = await supabase
      .from('transcriptions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error loading history:', error);
    } else if (data) {
      setHistory(data);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
    } catch (err) {
      setError('Failed to access microphone. Please grant permission.');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await transcribeAudio(file);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    setError('');
    setTranscription('');

    try {
      const formData = new FormData();
      // 'audio' matches the key Flask will look for in request.files
      formData.append('audio', audioBlob, 'input_audio.webm');

      // Point this to your Flask server (usually port 5000)
      const apiUrl = 'https://note-me-server-mtri.onrender.com/upload-audio';

      const response = await fetch(apiUrl, {
        method: 'POST',
        // Note: Do NOT set 'Content-Type' header manually when sending FormData.
        // The browser will automatically set it to multipart/form-data with the correct boundary.
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transcription failed');
      }

      // data.transcript matches the key returned by the Flask function below
      setTranscription(data.transcript);

      // Optional: Keep your Supabase DB logging if needed
      const { error: dbError } = await supabase
        .from('transcriptions')
        .insert({
          transcribed_text: data.transcript,
          status: 'completed',
        });

      if (dbError) console.error('Error saving to database:', dbError);
      else loadHistory();

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to transcribe audio';
      setError(errorMsg);
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Volume2 className="w-12 h-12 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">NoteMe</h1>
          <p className="text-slate-600">Record or upload audio to get instant transcription</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${isRecording
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Mic className="w-5 h-5" />
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isTranscribing}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-5 h-5" />
              Upload Audio File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {isRecording && (
            <div className="flex items-center justify-center gap-3 mb-6 text-red-600">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
              <span className="font-medium">Recording in progress...</span>
            </div>
          )}

          {isTranscribing && (
            <div className="flex items-center justify-center gap-3 mb-6 text-blue-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="font-medium">Transcribing audio...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {transcription && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-3">Transcription Result</h2>
              <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{transcription}</p>
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Recent Transcriptions</h2>
            <div className="space-y-4">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <p className="text-slate-800 mb-2">{item.transcribed_text}</p>
                  <p className="text-sm text-slate-500">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
