import requests
import time
import os
from dotenv import load_dotenv

def transcribe_audio(file_path):
    api_key = os.getenv('API_KEY')
    base_url = "https://api.assemblyai.com/v2"
    headers = {"authorization": api_key}

    # 1. Upload the local file to AssemblyAI
    print("Uploading file...")
    with open(file_path, "rb") as f:
        upload_response = requests.post(f"{base_url}/upload", headers=headers, data=f)
    
    audio_url = upload_response.json()["upload_url"]

    # 2. Request the transcription
    data = {
        "audio_url": audio_url,
        "speech_model": "best" # 'best' or 'nano' are common choices
    }
    transcript_response = requests.post(f"{base_url}/transcript", json=data, headers=headers)
    transcript_id = transcript_response.json()['id']
    polling_endpoint = f"{base_url}/transcript/{transcript_id}"

    # 3. Poll for the result
    print("Transcribing...")
    while True:
        result = requests.get(polling_endpoint, headers=headers).json()

        if result['status'] == 'completed':
            return result['text']
        elif result['status'] == 'error':
            raise RuntimeError(f"Transcription failed: {result['error']}")

        time.sleep(3) # Wait 3 seconds before checking again

  #  print("Final Transcript:", text)
  #  return text