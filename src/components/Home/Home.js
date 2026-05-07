import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TypeAnimation } from 'react-type-animation';
import { Splide, SplideSlide } from '@splidejs/react-splide';
import '@splidejs/react-splide/css';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { FaCamera, FaUpload, FaRedo, FaDownload, FaPrint, FaTimes } from 'react-icons/fa';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // Initialize Google Generative AI
  const genAI = new GoogleGenerativeAI('AIzaSyB_weYflQBelNRHmDX_eAcUtmyImPQh8vk');

  // Start camera on component mount
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } // Prefer rear camera
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing webcam:', err);
      }
    }

    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Capture image from webcam
  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = canvas.toDataURL('image/jpeg');
      setCapturedImage(imageData);
      analyzeImage(imageData);
    }
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target.result);
        analyzeImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Download captured image
  const downloadImage = () => {
    if (!capturedImage) return;
    const link = document.createElement('a');
    link.href = capturedImage;
    link.download = 'growfy-analysis.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print analysis results
  const printResults = () => {
    const printContent = document.getElementById('printable-analysis');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Growfy Analysis Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .print-header { text-align: center; margin-bottom: 20px; }
            .print-image { max-width: 100%; height: auto; margin-bottom: 20px; border-radius: 8px; }
            .print-section { margin-bottom: 15px; }
            .print-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #065f46; }
            .print-content { margin-left: 10px; }
            .print-icon { display: 'none' }
            .print-divider { border-top: 1px solid #eee; margin: 20px 0; }
            .health-status { padding: 10px; border-radius: 6px; margin-bottom: 15px; }
            .issues { background-color: #fef2f2; border-left: 4px solid #dc2626; }
            .healthy { background-color: #f0fdf4; border-left: 4px solid #10b981; }
            ul { margin-top: 5px; padding-left: 20px; }
            li { margin-bottom: 5px; }
          </style>
        </head>
        <body>
          <div class="print-header">
            <h1>Growfy Plant Analysis Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
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

  // Format Gemini response text
  const formatAnalysisText = (text) => {
    if (!text) return '';
    
    // Replace markdown-like formatting
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/^#\s(.*$)/gm, '<h3>$1</h3>') // Headers
      .replace(/^- (.*$)/gm, '<li>$1</li>') // List items
      .replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>') // Wrap lists
      .replace(/\n/g, '<br>'); // Line breaks

    // Ensure proper list formatting
    formatted = formatted.replace(/<\/ul><br><ul>/g, '');
    
    return { __html: formatted };
  };

  // Analyze image using Plant.id and Gemini
  const analyzeImage = async (imageData) => {
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
        image: imageData
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

  // Analyze with Plant.id API
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

  // Analyze with Gemini
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

  // Get detailed analysis from Gemini
  const getGeminiAnalysis = async (imageData, plantData) => {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      Based on the following plant data: ${JSON.stringify(plantData)}
      Provide detailed analysis including:
      1. Plant identification
      2. Health assessment
      3. Any visible diseases or deficiencies
      4. Recommended remedies
      5. Care instructions
      
      Use farmer-friendly language, be concise, and format with:
      - **bold** for important terms
      - *italics* for emphasis
      - Bullet points for recommendations
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  };

  // Testimonials data
  const testimonials = [
    {
      id: 1,
      name: 'John Farmer',
      location: 'Ibadan, Nigeria',
      quote: 'Growfy helped me identify a nitrogen deficiency in my maize crop before it was too late. Increased my yield by 30%!',
      image: '/images/farmer1.jpg'
    },
    {
      id: 2,
      name: 'Amina Okafor',
      location: 'Enugu, Nigeria',
      quote: 'The quick analysis saved my tomato farm from a fungal infection. The remedies worked perfectly!',
      image: '/images/farmer2.jpg'
    },
    {
      id: 3,
      name: 'Musa Bello',
      location: 'Kano, Nigeria',
      quote: 'Never knew my soil needed lime until Growfy analyzed it. Now my crops are thriving!',
      image: '/images/farmer3.webp'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Section 1: Hero with Testimonials */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background effects */}
        <motion.div 
          className="absolute inset-0 -z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <div className="absolute top-0 left-0 w-64 h-64 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        </motion.div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <motion.h1 
              className="text-5xl font-bold text-gray-900 leading-tight"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
            >
              AI-Powered <span className="bg-gradient-to-r from-green-600 to-emerald-400 bg-clip-text text-transparent">Plant Health</span> Analysis
            </motion.h1>

            <motion.div
              className="text-xl text-gray-600"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              <TypeAnimation
                sequence={[
                  'Detect plant diseases',
                  1000,
                  'Identify nutrient deficiencies',
                  1000,
                  'Get instant remedies',
                  1000,
                  'Boost your crop yield',
                  1000
                ]}
                wrapper="span"
                speed={50}
                repeat={Infinity}
                className="font-medium bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent"
              />
              <p className="mt-4">Growfy uses advanced AI to help farmers diagnose plant health issues in seconds. Just snap a photo and get expert-level analysis.</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="pt-8"
            >
              <h3 className="text-lg font-medium text-gray-900 mb-4">Trusted by farmers across Africa</h3>
              
              <div className="testimonial-slider">
                <Splide
                  options={{
                    type: 'loop',
                    perPage: 1,
                    autoplay: true,
                    interval: 5000,
                    arrows: false,
                    pagination: false,
                  }}
                >
                  {testimonials.map((testimonial) => (
                    <SplideSlide key={testimonial.id}>
                      <div className="bg-white p-6 rounded-xl shadow-lg">
                        <div className="flex items-center space-x-4 mb-4">
                          <img 
                            src={testimonial.image} 
                            alt={testimonial.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                          <div>
                            <h4 className="font-medium text-gray-900">{testimonial.name}</h4>
                            <p className="text-sm text-gray-500">{testimonial.location}</p>
                          </div>
                        </div>
                        <p className="text-gray-700 italic">"{testimonial.quote}"</p>
                      </div>
                    </SplideSlide>
                  ))}
                </Splide>
              </div>
            </motion.div>
          </div>

          {/* Section 2: Camera Section */}
          <div className="relative h-[500px] rounded-2xl overflow-hidden shadow-xl border border-gray-200 bg-gray-900">
            {!capturedImage ? (
              <div className="w-full h-full flex flex-col">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
                  <label className="p-3 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors cursor-pointer" title="Upload image">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileUpload}
                    />
                    <FaUpload className="h-8 w-8 text-gray-800" />
                  </label>
                  <button
                    onClick={captureImage}
                    className="p-4 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                    title="Take picture"
                  >
                    <FaCamera className="h-6 w-6 text-gray-800" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col bg-black">
                <img 
                  src={capturedImage} 
                  alt="Captured plant" 
                  className="w-full h-full object-contain"
                />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
                  <button
                   // onClick={() => setCapturedImage(null)}
                    onClick={() => router.reload()}
                    className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-800 rounded-md flex items-center"
                  >
                    <FaRedo className="mr-2" /> Retake
                  </button>
                  <button
                    onClick={downloadImage}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center"
                  >
                    <FaDownload className="mr-2" /> Download
                  </button>
                </div>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>
      </section>

      {/* Analysis Result Modal */}
      {showResultModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div 
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                <h3 className="text-2xl font-bold text-gray-900 flex items-center">
                  <span className="bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                    Analysis Results
                  </span>
                </h3>
                <div className="flex space-x-3">
                  {!isAnalyzing && analysisResult && (
                    <button
                      onClick={printResults}
                      className="p-2 text-gray-600 hover:text-green-600 transition-colors"
                      title="Print results"
                    >
                      <FaPrint className="h-5 w-5" />
                    </button>
                  )}
                  <button 
                    onClick={() => setShowResultModal(false)}
                    className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
                    title="Close"
                  >
                    <FaTimes className="h-5 w-5 print-icon" />
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
                  <p className="text-sm text-gray-500">Processing with our AI systems</p>
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
                        <div className="print-icon bg-gradient-to-br from-green-50 to-white p-5 rounded-xl border border-green-100 shadow-sm">
                          <h4 className="font-semibold text-lg text-gray-800 mb-3 flex items-center">
                            <span className="bg-green-100 text-green-800 p-2 rounded-full mr-3">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </span>
                            Plant Identification
                          </h4>
                          <div className="pl-11">
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
                          <h4 className="font-semibold text-lg text-gray-800 mb-3 flex items-center">
                            <span className="bg-blue-100 text-blue-800 p-2 rounded-full mr-3">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                              </svg>
                            </span>
                            Health Status
                          </h4>
                          <div className="pl-11">
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
                                <p className="font-medium">Stated below</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* AI Recommendations */}
                      <div className="bg-gradient-to-br from-emerald-50 to-white p-6 rounded-xl border border-emerald-100 shadow-sm mb-6">
                        <h4 className="font-semibold text-lg text-gray-800 mb-4 flex items-center">
                          <span className="bg-emerald-100 text-emerald-800 p-2 rounded-full mr-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          </span>
                          AI Recommendations
                        </h4>
                        <div 
                          className="prose max-w-none pl-11"
                          dangerouslySetInnerHTML={formatAnalysisText(analysisResult.geminiAnalysis)}
                        />
                      </div>

                      <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => setShowResultModal(false)}
                          className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors flex items-center"
                        >
                          Close Analysis
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}