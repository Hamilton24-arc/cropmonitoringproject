import { useEffect, useRef, useState } from "react";
import { FaCamera, FaArrowLeft } from "react-icons/fa"; // React Icons
import { BsArrowRepeat } from "react-icons/bs"; // React Icons

const WebcamCapture = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [imageURL, setImageURL] = useState(null);
  const [isPhotoMode, setIsPhotoMode] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [currentStream, setCurrentStream] = useState(null);

  useEffect(() => {
    async function getDevices() {
      try {
        // Enumerate devices and filter for video input devices
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceList.filter(device => device.kind === "videoinput");
        
        setDevices(videoDevices);

        // If there are devices, select the first one
        if (videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Error accessing devices:', err);
      }
    }

    getDevices();
  }, []);

  useEffect(() => {
    // If a device is selected, start the webcam stream
    if (selectedDeviceId) {
      startWebcam(selectedDeviceId);
    }

    // Cleanup the previous stream when the component is unmounted or device is changed
    return () => {
      stopStream();
    };
  }, [selectedDeviceId]);

  const startWebcam = async (deviceId) => {
    try {
      // Stop any active webcam stream if one is already running
      stopStream();

      // Get the media stream for the selected device
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });

      // Assign the stream to the video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCurrentStream(stream);
    } catch (err) {
      console.error('Error starting webcam:', err);
    }
  };

  const stopStream = () => {
    if (currentStream) {
      const tracks = currentStream.getTracks();
      tracks.forEach((track) => track.stop());
    }
  };

  const takePicture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas) {
      const context = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataURL = canvas.toDataURL("image/png");
      setImageURL(dataURL);
      setIsPhotoMode(true); // Switch to photo mode after taking the picture
    }
  };

  const resetPhoto = () => {
    setImageURL(null);
    setIsPhotoMode(false); // Switch back to webcam mode
  };

  return (
    <div className="flex justify-center items-center flex-col min-h-screen bg-gray-100">
      <div className="w-full max-w-3xl p-4 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Webcam Capture</h1>
        </div>
        <div className="mb-4">
          {/* Show video feed from the webcam */}
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto rounded-lg border border-gray-300"
            />
          </div>
        </div>
        {/* Select a webcam device */}
        <div className="mb-4">
          <label htmlFor="deviceSelect" className="block text-gray-600">Select Webcam</label>
          <select
            id="deviceSelect"
            className="mt-2 p-2 border rounded-lg w-full"
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            value={selectedDeviceId || ""}
          >
            {devices.length > 0 ? (
              devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId}`}
                </option>
              ))
            ) : (
              <option>No devices found</option>
            )}
          </select>
        </div>
        <div className="flex justify-between items-center">
          {!isPhotoMode ? (
            <button
              onClick={takePicture}
              className="p-4 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition duration-200"
            >
              <FaCamera size={24} />
            </button>
          ) : (
            <button
              onClick={resetPhoto}
              className="p-4 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition duration-200"
            >
              <BsArrowRepeat size={24} />
            </button>
          )}
        </div>
        {/* Show the captured photo */}
        {isPhotoMode && imageURL && (
          <div className="mt-4 text-center">
            <img
              src={imageURL}
              alt="Captured"
              className="max-w-full max-h-64 rounded-lg"
            />
            <div className="mt-2">
              <button
                onClick={() => setIsPhotoMode(false)}
                className="bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition duration-200"
              >
                <FaArrowLeft className="inline-block mr-2" />
                Back to Webcam
              </button>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden"></canvas>
      </div>
    </div>
  );
};

export default WebcamCapture;
