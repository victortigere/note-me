from flask import Flask, request, jsonify
from flask_cors import CORS
import os
# Import your transcription function here
# from transcription_service import transcribe_audio 
from transcribe import transcribe_audio

app = Flask(__name__)
CORS(app)  # This enables React to make requests to Flask

UPLOAD_FOLDER = 'temp_audio'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    # 1. Check if the file is in the request
    if 'audio' not in request.files:
        return jsonify({"error": "No audio part"}), 400
    
    audio_file = request.files['audio']
    
    if audio_file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # 2. Save the file temporarily
    file_path = os.path.join(UPLOAD_FOLDER, "recorded_speech.webm")
    audio_file.save(file_path)

    try:
        # 3. Call your AssemblyAI function
        # Replace 'YOUR_API_KEY' with your actual key
        transcript_text = transcribe_audio(file_path)
        
        # 4. Return the text to React
        return jsonify({"transcript": transcript_text})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    finally:
        # Clean up: remove the file after processing
        if os.path.exists(file_path):
            os.remove(file_path)

if __name__ == '__main__':
    app.run(debug=True, port=5000)