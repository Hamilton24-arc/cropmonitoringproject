import { useRef, useState, useEffect } from 'react';

export default function WebcamPage() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [imageURL, setImageURL] = useState(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing webcam:', err);
      }
    }

    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const takePicture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas) {
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataURL = canvas.toDataURL('image/png');
      setImageURL(dataURL);
    }
  };

  const downloadImage = () => {
    if (!imageURL) return;
    const link = document.createElement('a');
    link.href = imageURL;
    link.download = 'snapshot.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">📸 Webcam Snapshot</h1>
        
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full rounded-lg border border-gray-300 shadow-sm"
        />

        <div className="flex justify-center mt-6 space-x-4">
          <button
            onClick={takePicture}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
          >
            Take Picture
          </button>
          {imageURL && (
            <button
              onClick={downloadImage}
              className="px-6 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition"
            >
              Download PNG
            </button>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {imageURL && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Snapshot Preview:</h3>
            <img
              src={imageURL}
              alt="Snapshot"
              className="w-full rounded-lg border border-gray-200 shadow-md"
            />
          </div>
        )}
      </div>
    </div>
  );
}
