import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { FaCamera, FaUpload, FaRedo, FaPrint, FaTimes, FaSave, FaCheck, FaArrowLeft } from 'react-icons/fa';
import { MdCameraswitch, MdAgriculture } from 'react-icons/md';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, addDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase.config';

export default function FarmerAnalyze() {
  const router = useRouter();
  const { id } = router.query;
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Webcam and image states
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [currentStream, setCurrentStream] = useState(null);
  
  // Analysis states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize Google Generative AI
  const genAI = new GoogleGenerativeAI('AIzaSyB_weYflQBelNRHmDX_eAcUtmyImPQh8vk');

  // Fetch farmer data
  useEffect(() => {
    const fetchUserData = async () => {
      if (id) {
        try {
          const userDocRef = doc(db, "farmers", id);
          const userDocSnapshot = await getDoc(userDocRef);

          if (userDocSnapshot.exists()) {
            const userData = userDocSnapshot.data();
            setUserDetails(userData);
          } else {
            router.push("/");
          }
        } catch (error) {
          console.error("Error fetching user data", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchUserData();
  }, [id, router]);

  // Get available camera devices
  useEffect(() => {
    async function getDevices() {
      try {
        // Request permission to access media devices (ask user for webcam access)
        await navigator.mediaDevices.getUserMedia({ video: true });

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
        alert('Please grant permission to access your camera.');
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
      console.error('Error starting webcam for device:', deviceId, err);

      // If the selected device fails, attempt to start the first available device
      const nextDevice = devices.find(device => device.deviceId !== deviceId);
      if (nextDevice) {
        console.log('Trying next available device:', nextDevice.deviceId);
        setSelectedDeviceId(nextDevice.deviceId); // Automatically try another device
      } else {
        alert('All webcams have failed to start.');
      }
    }
  };

  const stopStream = () => {
    if (currentStream) {
      const tracks = currentStream.getTracks();
      tracks.forEach((track) => track.stop());
    }
  };

  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas) {
      const context = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataURL = canvas.toDataURL("image/png");
      setCapturedImage(dataURL);

    //  setIsPhotoMode(true); // Switch to photo mode after taking the picture
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetImage = (type) => {
    if (type === 'camera') {
      setCapturedImage(null);
    } else {
      setUploadedImage(null);
    }
  };

  const analyzeImage = async (imageData, type) => {
    setIsAnalyzing(true);
    setShowResultModal(true);
    
    try {
      // First try Plant.id
      let plantData = null;
      try {
        plantData = await analyzeWithPlantId(imageData);
      } catch (plantError) {
        console.error('Plant.id analysis failed:', plantError);
        // Fall back to Gemini if Plant.id fails
        plantData = await analyzeWithGemini(imageData);
      }

      // Get detailed analysis from Gemini
      const geminiAnalysis = await getGeminiAnalysis(imageData, plantData);
      
      setAnalysisResult({
        plantData,
        geminiAnalysis,
        image: imageData,
        imageType: type
      });
    } catch (error) {
      console.error('Analysis failed:', error);
      setAnalysisResult({
        error: 'Failed to analyze the image. Please try again.'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeWithPlantId = async (imageData) => {
    const response = await fetch('/api/plant-id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageData.split(',')[1] }),
    });
    
    if (!response.ok) {
      throw new Error('Plant.id API request failed');
    }
    
    return await response.json();
  };

  const analyzeWithGemini = async (imageData) => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = "Identify this plant and any visible diseases or deficiencies.";
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageData.split(',')[1],
          mimeType: 'image/jpeg',
        },
      },
    ]);
    
    const response = await result.response;
    return {
      suggestions: [{
        plant_name: response.text(),
        probability: 0.9
      }]
    };
  };

  const getGeminiAnalysis = async (imageData, plantData) => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      You are an experienced plant health expert helping a farmer understand the condition of their plant.

      Below is real-world data collected from the plant analyzer tool:
      ${JSON.stringify(plantData)}

      Analyze this data thoroughly and provide a clear, easy-to-understand report that includes:

      1. **Plant Identification**
         - Common name and scientific name (if available)
         - Key visual characteristics that confirm the ID

      2. **Health Assessment**
         - Is the plant *healthy, stressed, or diseased*?
         - Mention symptoms such as *leaf discoloration, wilting, spotting, slow growth*, etc.
         - Use accessible language to explain what these symptoms typically indicate

      3. **Visible Diseases or Deficiencies**
         - List any detected or suspected **diseases**, **pest infestations**, or **nutrient deficiencies**
         - Include likely causes (e.g. overwatering, poor soil, fungal infection)

      4. **Recommended Remedies**
         - Suggest actionable steps the farmer can take to treat current issues  
         - Include both organic and chemical options where possible
         - Format with bullet points for clarity

      5. **Care Instructions**
         - Provide general *maintenance tips* for keeping this plant healthy going forward
         - Include watering, sunlight, spacing, pruning, and seasonal advice

      Format the response using:
      - it should be very descriptive
      - **Bold** for critical terms or diagnoses (e.g. **Powdery Mildew**, **Nitrogen Deficiency**)
      - *Italics* for emphasis (e.g. *early signs*, *should be monitored*)
      - Bullet points for any list of recommendations or instructions

      Avoid technical jargon; write like you're advising a small-scale farmer or gardener who may not have formal agricultural training.
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  };

  const uploadToCloudinary = async (imageData) => {
  try {
    const base64Data = imageData.split(',')[1]; // strip "data:image/jpeg;base64," etc.
    
    const response = await fetch('https://api.cloudinary.com/v1_1/diyioiyqu/image/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        file: `data:image/jpeg;base64,${base64Data}`, // base64 must be prefixed back with mime
        upload_preset: 'extrackio-photo'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Cloudinary upload failed');
    }

    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};


  const saveAnalysis = async () => {
    if (!analysisResult || !userDetails) return;
    
    setIsSaving(true);
    
    try {
      // Upload image to Cloudinary
      const imageUrl = await uploadToCloudinary(analysisResult.image);
      
      // Generate a new document reference with a unique ID
    const newDocRef = doc(collection(db, 'plantAnalysis'));
    const plantId = newDocRef.id;

    // Prepare analysis data with plantId
    const analysisData = {
    plantId: plantId, // include doc ID as field
    farmerId: id,
    farmerName: `${userDetails.firstName} ${userDetails.lastName}`,
    farmerLocation: userDetails.farmLocation,
    plantName: analysisResult.plantData.suggestions?.[0]?.plant_name || 'Unknown',
    confidence: analysisResult.plantData.suggestions?.[0]?.probability || 0,
    diseases: analysisResult.plantData.suggestions?.[0]?.diseases || [],
    analysis: analysisResult.geminiAnalysis,
    imageUrl: imageUrl,
    createdAt: new Date().toISOString(),
    status: 'pending',
    parentAnalysisId: null, // optional if it's the first analysis
    notes: ''               // optional notes field
    };

    // Save to Firestore with setDoc
    await setDoc(newDocRef, analysisData);
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving analysis:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatAnalysisText = (text) => {
    if (!text) return '';
    
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^#\s(.*$)/gm, '<h3>$1</h3>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>')
      .replace(/\n/g, '<br>');

    formatted = formatted.replace(/<\/ul><br><ul>/g, '');
    
    return { __html: formatted };
  };

  const printResults = () => {
    setShowPrintModal(true);
  };

  const handlePrint = () => {
    const printContent = document.getElementById('printable-analysis');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Growfy Plant Analysis Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .print-header { text-align: center; margin-bottom: 20px; }
            .print-image { max-width: 100%; height: auto; margin-bottom: 20px; border-radius: 8px; }
            .print-section { margin-bottom: 15px; }
            .print-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #065f46; }
            .print-content { margin-left: 10px; }
            .print-divider { border-top: 1px solid #eee; margin: 20px 0; }
            .health-status { padding: 10px; border-radius: 6px; margin-bottom: 15px; }
            .issues { background-color: #fef2f2; border-left: 4px solid #dc2626; }
            .healthy { background-color: #f0fdf4; border-left: 4px solid #10b981; }
            ul { margin-top: 5px; padding-left: 20px; }
            li { margin-bottom: 5px; }
            strong { font-weight: bold; }
            em { font-style: italic; }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>Growfy Plant Analysis Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p>Farmer: ${userDetails?.firstName} ${userDetails?.lastName} | Location: ${userDetails?.farmLocation}</p>
          </div>
          ${printContent.innerHTML}
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 200);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => router.push(`/farmer/${id}/dashboard`)}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100"
              >
                <FaArrowLeft className="h-5 w-5" />
              </button>
              <MdAgriculture className="h-8 w-8 text-green-600 mr-2" />
              <h1 className="text-xl font-semibold text-gray-900">Plant Analysis</h1>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-600 mr-4">
                Welcome, {userDetails?.firstName}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Image Capture/Upload Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Webcam Capture Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <FaCamera className="mr-2 text-green-600" />
              Capture with Camera
            </h2>
            
            {!capturedImage ? (
              <>
                <div className="relative rounded-lg overflow-hidden bg-gray-900 mb-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-64 object-cover"
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Camera
                  </label>
                  <select
                    value={selectedDeviceId || ""}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
                  >
                    <option value=''>Select Webcam</option>
                    {devices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${device.deviceId.substring(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>
                
                <button
                  onClick={captureImage}
                  className="w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <FaCamera className="mr-2" />
                  Capture Image
                </button>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <img 
                    src={capturedImage} 
                    alt="Captured plant" 
                    className="w-full h-64 object-contain rounded-lg"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => resetImage('camera')}
                    className="flex items-center justify-center px-4 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    <FaRedo className="mr-2" />
                    Retake
                  </button>
                  <button
                    onClick={() => analyzeImage(capturedImage, 'camera')}
                    className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    Analyze Image
                  </button>
                </div>
              </>
            )}
          </motion.div>

          {/* File Upload Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white rounded-xl shadow-lg p-6 border border-gray-200"
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <FaUpload className="mr-2 text-green-600" />
              Upload Image
            </h2>
            
            {!uploadedImage ? (
              <>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
                  <FaUpload className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm text-gray-600">
                    Upload a plant image for analysis
                  </p>
                  <label className="mt-4 inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer">
                    <span>Select Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <img 
                    src={uploadedImage} 
                    alt="Uploaded plant" 
                    className="w-full h-64 object-contain rounded-lg"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => resetImage('upload')}
                    className="flex items-center justify-center px-4 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    <FaRedo className="mr-2" />
                    Change
                  </button>
                  <button
                    onClick={() => analyzeImage(uploadedImage, 'upload')}
                    className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    Analyze Image
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </main>

      {/* Analysis Result Modal */}
      {showResultModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div 
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900">
                  Analysis Results
                </h3>
                <div className="flex space-x-3">
                  {!isAnalyzing && analysisResult && (
                    <>
                      <button
                        onClick={printResults}
                        className="p-2 text-gray-600 hover:text-green-600 transition-colors"
                        title="Print results"
                      >
                        <FaPrint className="h-5 w-5" />
                      </button>
                      <button
                        onClick={saveAnalysis}
                        disabled={isSaving || saveSuccess}
                        className="p-2 text-gray-600 hover:text-green-600 transition-colors"
                        title="Save analysis"
                      >
                        {isSaving ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-green-600"></div>
                        ) : saveSuccess ? (
                          <FaCheck className="h-5 w-5 text-green-600" />
                        ) : (
                          <FaSave className="h-5 w-5" />
                        )}
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => setShowResultModal(false)}
                    className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    <FaTimes className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {isAnalyzing ? (
                <div className="py-12 flex flex-col items-center justify-center">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-green-500"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-8 w-8 bg-green-500 rounded-full animate-ping"></div>
                    </div>
                  </div>
                  <p className="text-lg text-gray-700 mt-4">Analyzing your plant image...</p>
                  <p className="text-sm text-gray-500">This may take a few moments</p>
                </div>
              ) : analysisResult ? (
                <div id="printable-analysis">
                  {analysisResult.error ? (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-red-700">{analysisResult.error}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Image Preview */}
                      <div className="mb-8">
                        <img 
                          src={analysisResult.image} 
                          alt="Analyzed plant" 
                          className="w-full h-64 object-cover rounded-lg shadow-md"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {/* Plant Identification */}
                        <div className="bg-gradient-to-br from-green-50 to-white p-5 rounded-xl border border-green-100 shadow-sm">
                          <h4 className="font-semibold text-lg text-gray-800 mb-3">
                            Plant Identification
                          </h4>
                          <div>
                            <p className="text-xl font-medium text-gray-900">
                              {analysisResult.plantData.suggestions?.[0]?.plant_name || 'Unknown plant'}
                            </p>
                            {analysisResult.plantData.suggestions?.[0]?.probability && (
                              <div className="mt-2">
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                  <div 
                                    className="bg-green-600 h-2.5 rounded-full" 
                                    style={{ width: `${analysisResult.plantData.suggestions[0].probability * 100}%` }}
                                  ></div>
                                </div>
                                <p className="text-sm text-gray-500 mt-1">
                                  Confidence: {(analysisResult.plantData.suggestions[0].probability * 100).toFixed(1)}%
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Health Status */}
                        <div className="bg-gradient-to-br from-blue-50 to-white p-5 rounded-xl border border-blue-100 shadow-sm">
                          <h4 className="font-semibold text-lg text-gray-800 mb-3">
                            Health Status
                          </h4>
                          <div>
                            {analysisResult.plantData.suggestions?.[0]?.diseases?.length > 0 ? (
                              <>
                                <p className="text-red-600 font-medium">Potential issues detected</p>
                                <ul className="mt-2 space-y-2">
                                  {analysisResult.plantData.suggestions[0].diseases.map((disease, index) => (
                                    <li key={index} className="flex items-start">
                                      <span className="flex-shrink-0 text-red-500 mt-1 mr-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                      </span>
                                      <span>
                                        {disease.name} <span className="text-xs text-gray-500">({(disease.probability * 100).toFixed(1)}% confidence)</span>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            ) : (
                              <div className="flex items-center text-green-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <p className="font-medium">No major issues detected</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* AI Recommendations */}
                      <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-xl border border-emerald-100 shadow-sm mb-6">
                        <h4 className="font-semibold text-lg text-gray-800 mb-4">
                          Detailed Analysis & Recommendations
                        </h4>
                        <div 
                          className="prose max-w-none"
                          dangerouslySetInnerHTML={formatAnalysisText(analysisResult.geminiAnalysis)}
                        />
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Print Analysis Report</h3>
              <button onClick={() => setShowPrintModal(false)}>
                <FaTimes className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4">Click the button below to print your analysis report.</p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-green-600 text-white rounded-md"
              >
                Print Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}