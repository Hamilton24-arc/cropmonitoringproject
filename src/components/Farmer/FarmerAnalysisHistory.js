import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaSearch, 
  FaFilter, 
  FaSync, 
  FaEye, 
  FaPrint, 
  FaEllipsisV, 
  FaPlus, 
  FaTimes,
  FaCamera,
  FaUpload,
  FaSeedling,
  FaLeaf,
  FaBug,
  FaCheckCircle,
  FaExclamationTriangle,
  FaClock,
  FaHistory,
  FaChartLine,
  FaDownload,
  FaArrowLeft,
  FaSave,
  FaCheck,
  FaRedo,
  FaTrash,
  FaLayerGroup
} from 'react-icons/fa';
import { MdAgriculture, MdCameraswitch } from 'react-icons/md';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  updateDoc, 
  doc,
  addDoc,
  serverTimestamp,
  getDoc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase.config';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI('AIzaSyB_weYflQBelNRHmDX_eAcUtmyImPQh8vk');

export default function FarmerAnalysisHistory() {
  const router = useRouter();
  const { id } = router.query;
  
  const [analyses, setAnalyses] = useState([]);
  const [filteredAnalyses, setFilteredAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userDetails, setUserDetails] = useState(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReanalyzeModal, setShowReanalyzeModal] = useState(false);
  const [showThreadModal, setShowThreadModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [reanalyzeImage, setReanalyzeImage] = useState(null);
  const [reanalyzeLoading, setReanalyzeLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [threadAnalyses, setThreadAnalyses] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  
  // Webcam states for reanalysis
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [currentStream, setCurrentStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Fetch farmer data and analyses
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        // Fetch farmer/user details
        const userDocRef = doc(db, "farmers", id);
        const userDocSnapshot = await getDoc(userDocRef);

        if (userDocSnapshot.exists()) {
          setUserDetails(userDocSnapshot.data());
        }

        // Fetch all plant analysis documents for this farmer
        const q = query(
          collection(db, 'plantAnalysis'),
          where('farmerId', '==', id)
        );

        const querySnapshot = await getDocs(q);
        const analysesData = [];

        querySnapshot.forEach((docSnap) => {
          analysesData.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Sort the data client-side by createdAt in descending order
        analysesData.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
          return dateB - dateA;
        });

        // Set states
        setAnalyses(analysesData);
        setFilteredAnalyses(analysesData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Get available camera devices for reanalysis
  useEffect(() => {
    async function getDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceList.filter(device => device.kind === "videoinput");
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Error accessing devices:', err);
      }
    }

    if (showReanalyzeModal) {
      getDevices();
    }
  }, [showReanalyzeModal]);

  // Start webcam when device is selected
  useEffect(() => {
    if (selectedDeviceId && showReanalyzeModal) {
      startWebcam(selectedDeviceId);
    }

    return () => {
      stopStream();
    };
  }, [selectedDeviceId, showReanalyzeModal]);

  const startWebcam = async (deviceId) => {
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });

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
      currentStream.getTracks().forEach(track => track.stop());
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
      setReanalyzeImage(dataURL);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setReanalyzeImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetReanalyzeImage = () => {
    setReanalyzeImage(null);
    setCapturedImage(null);
  };

  // Filter and sort analyses
  useEffect(() => {
    let result = [...analyses];
    
    // Apply search filter
    if (searchTerm) {
      result = result.filter(analysis => 
        analysis.plantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (analysis.diseases && analysis.diseases.some(d => 
          d.name.toLowerCase().includes(searchTerm.toLowerCase())
        ))
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(analysis => analysis.status === statusFilter);
    }
    
    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === 'date') {
        return sortOrder === 'asc' 
          ? new Date(a.createdAt) - new Date(b.createdAt)
          : new Date(b.createdAt) - new Date(a.createdAt);
      } else if (sortBy === 'confidence') {
        return sortOrder === 'asc' 
          ? (a.confidence || 0) - (b.confidence || 0)
          : (b.confidence || 0) - (a.confidence || 0);
      } else if (sortBy === 'name') {
        return sortOrder === 'asc' 
          ? a.plantName.localeCompare(b.plantName)
          : b.plantName.localeCompare(a.plantName);
      }
      return 0;
    });
    
    setFilteredAnalyses(result);
  }, [analyses, searchTerm, statusFilter, sortBy, sortOrder]);

  const updateAnalysisStatus = async (analysisId, newStatus) => {
    setUpdateLoading(true);
    try {
      const analysisRef = doc(db, 'plantAnalysis', analysisId);
      await updateDoc(analysisRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setAnalyses(prev => prev.map(a => 
        a.id === analysisId ? { ...a, status: newStatus } : a
      ));
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdateLoading(false);
    }
  };

  const uploadToCloudinary = async (imageData) => {
    try {
      const formData = new FormData();
      formData.append('file', imageData);
      formData.append('upload_preset', 'extrackio-photo');
      
      const response = await fetch('https://api.cloudinary.com/v1_1/diyioiyqu/image/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw error;
    }
  };

  const analyzeImage = async (imageData) => {
    try {
      // First try Plant.id
      let plantData = null;
      try {
        const plantResponse = await fetch('/api/plant-id', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: imageData.split(',')[1] }),
        });
        
        if (!plantResponse.ok) {
          throw new Error('Plant.id API request failed');
        }
        
        plantData = await plantResponse.json();
      } catch (plantError) {
        console.error('Plant.id analysis failed:', plantError);
        // Fall back to Gemini if Plant.id fails
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
        plantData = {
          suggestions: [{
            plant_name: response.text(),
            probability: 0.9
          }]
        };
      }

      // Get detailed analysis from Gemini
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
      
      return {
        plantData,
        analysis: response.text()
      };
    } catch (error) {
      console.error('Analysis failed:', error);
      throw error;
    }
  };

  const handleReanalyze = async () => {
    if (!reanalyzeImage) return;

    setReanalyzeLoading(true);

    try {
      // Upload image to Cloudinary
      const imageUrl = await uploadToCloudinary(reanalyzeImage);

      // Analyze the image
      const analysisResult = await analyzeImage(reanalyzeImage);

      // Create a new Firestore document reference with a generated ID
      const newDocRef = doc(collection(db, 'plantAnalysis'));
      const plantId = newDocRef.id;

      // Prepare reanalysis data
      const reanalysisData = {
        plantId: plantId,
        farmerId: id,
        farmerName: `${userDetails?.firstName} ${userDetails?.lastName}`,
        farmerLocation: userDetails?.farmLocation,
        plantName: analysisResult.plantData.suggestions?.[0]?.plant_name || selectedAnalysis.plantName,
        confidence: analysisResult.plantData.suggestions?.[0]?.probability || 0,
        diseases: analysisResult.plantData.suggestions?.[0]?.diseases || [],
        analysis: analysisResult.analysis,
        imageUrl: imageUrl,
        parentAnalysisId: selectedAnalysis.id,
        createdAt: serverTimestamp(),
        status: 'monitoring'
      };

      // Save the document with the ID
      await setDoc(newDocRef, reanalysisData);

      // Fetch all analyses for this farmer
      const q = query(
        collection(db, 'plantAnalysis'),
        where('farmerId', '==', id)
      );

      const querySnapshot = await getDocs(q);
      const analysesData = [];

      querySnapshot.forEach((doc) => {
        analysesData.push({ id: doc.id, ...doc.data() });
      });

      // Client-side sort (most recent first)
      analysesData.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return dateB - dateA;
      });

      // Update state with new list
      setAnalyses(analysesData);
      setShowReanalyzeModal(false);
      setReanalyzeImage(null);
      setCapturedImage(null);

      alert('Re-analysis completed successfully!');
    } catch (error) {
      console.error('Error during reanalysis:', error);
      alert('Failed to complete re-analysis. Please try again.');
    } finally {
      setReanalyzeLoading(false);
    }
  };

  const viewThread = async (analysis) => {
    setSelectedAnalysis(analysis);
    
    // Find all analyses that have this analysis as parent or are part of the same thread
    const threadAnalyses = analyses.filter(a => 
      a.parentAnalysisId === analysis.id || 
      a.id === analysis.parentAnalysisId ||
      (a.parentAnalysisId && analysis.parentAnalysisId && a.parentAnalysisId === analysis.parentAnalysisId)
    );
    
    // Add the main analysis to the thread if it's not already included
    if (!threadAnalyses.some(a => a.id === analysis.id)) {
      threadAnalyses.push(analysis);
    }
    
    // Sort by date
    threadAnalyses.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
      return dateB - dateA;
    });
    
    setThreadAnalyses(threadAnalyses);
    setShowThreadModal(true);
  };

  const deleteAnalysis = async (analysisId) => {
    if (!window.confirm('Are you sure you want to delete this analysis? This action cannot be undone.')) {
      return;
    }
    
    setDeletingId(analysisId);
    try {
      // Delete from Firebase
      await deleteDoc(doc(db, 'plantAnalysis', analysisId));
      
      // Update local state
      setAnalyses(prev => prev.filter(a => a.id !== analysisId));
      
      // If we're in thread view, update that too
      if (showThreadModal) {
        setThreadAnalyses(prev => prev.filter(a => a.id !== analysisId));
      }
      
      alert('Analysis deleted successfully!');
    } catch (error) {
      console.error('Error deleting analysis:', error);
      alert('Failed to delete analysis. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return <FaCheckCircle className="text-green-500" />;
      case 'recovering': return <FaChartLine className="text-blue-500" />;
      case 'diseased': return <FaBug className="text-red-500" />;
      case 'monitoring': return <FaClock className="text-yellow-500" />;
      default: return <FaLeaf className="text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'recovering': return 'bg-blue-100 text-blue-800';
      case 'diseased': return 'bg-red-100 text-red-800';
      case 'monitoring': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAnalysisText = (text) => {
    if (!text) return { __html: '' };
    
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

  // Check if an analysis is a parent (has children)
  const isParentAnalysis = (analysis) => {
    return analyses.some(a => a.parentAnalysisId === analysis.id);
  };

  // Check if an analysis has a parent
  const hasParentAnalysis = (analysis) => {
    return analysis.parentAnalysisId && analyses.some(a => a.id === analysis.parentAnalysisId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your plant analyses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => router.push(`/farmer/${id}/dashboard`)}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100 hidden md:block"
              >
                <FaArrowLeft className="h-5 w-5" />
              </button>
              <MdAgriculture className="h-8 w-8 text-green-600 mr-2" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Plant Analysis History</h1>
                <p className="text-sm text-gray-600">Track and manage your plant health analyses</p>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <span className="text-sm text-gray-600">
                Welcome, {userDetails?.firstName}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaSearch className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search by plant name or disease..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <select
                  className="appearance-none block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="healthy">Healthy</option>
                  <option value="recovering">Recovering</option>
                  <option value="diseased">Diseased</option>
                  <option value="monitoring">Monitoring</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <FaFilter className="h-4 w-4" />
                </div>
              </div>
              
              <div className="relative">
                <select
                  className="appearance-none block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="date">Sort by Date</option>
                  <option value="name">Sort by Name</option>
                  <option value="confidence">Sort by Confidence</option>
                </select>
                <button
                  className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-700"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Analysis Grid */}
        {filteredAnalyses.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <FaSeedling className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No analyses found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {analyses.length === 0 
                ? "You haven't analyzed any plants yet. Get started by analyzing your first plant!"
                : "Try adjusting your search or filter to find what you're looking for."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAnalyses.map((analysis) => {
              const isParent = isParentAnalysis(analysis);
              const hasParent = hasParentAnalysis(analysis);
              
              return (
                <motion.div
                  key={analysis.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow ${
                    isParent ? 'ring-2 ring-green-400' : hasParent ? 'ring-1 ring-gray-300' : ''
                  }`}
                >
                  <div className="relative h-48 bg-gray-200">
                    {analysis.imageUrl ? (
                      <img
                        src={analysis.imageUrl}
                        alt={analysis.plantName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FaLeaf className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}>
                        {getStatusIcon(analysis.status)} {analysis.status}
                      </span>
                    </div>
                    {isParent && (
                      <div className="absolute top-3 right-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          <FaLayerGroup className="mr-1" /> Parent
                        </span>
                      </div>
                    )}
                    {hasParent && (
                      <div className="absolute top-3 right-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <FaSync className="mr-1" /> Follow-up
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <h3 className="text-lg font-medium text-gray-900 truncate">{analysis.plantName}</h3>
                    <p className="text-sm text-gray-500 mt-1">{formatDate(analysis.createdAt)}</p>
                    
                    {analysis.confidence && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Confidence</span>
                          <span>{(analysis.confidence * 100).toFixed(1)}%</span>
                        </div>
                        <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${analysis.confidence * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    
                    {analysis.diseases && analysis.diseases.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-gray-700">Detected Issues:</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {analysis.diseases.slice(0, 3).map((disease, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"
                            >
                              <FaBug className="mr-1" /> {disease.name}
                            </span>
                          ))}
                          {analysis.diseases.length > 3 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              +{analysis.diseases.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-4 flex justify-between items-center">
                      <select
                        className="text-xs border border-gray-300 rounded-md py-1 px-2 focus:outline-none focus:ring-1 focus:ring-green-500"
                        value={analysis.status}
                        onChange={(e) => updateAnalysisStatus(analysis.id, e.target.value)}
                        disabled={updateLoading}
                      >
                        <option value="healthy">Healthy</option>
                        <option value="recovering">Recovering</option>
                        <option value="diseased">Diseased</option>
                        <option value="monitoring">Monitoring</option>
                      </select>
                      
                      <div className="flex space-x-2">
                        {isParent && (
                          <button
                            onClick={() => viewThread(analysis)}
                            className="text-gray-400 hover:text-purple-600"
                            title="View thread"
                          >
                            <FaLayerGroup />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedAnalysis(analysis);
                            setShowDetailModal(true);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                          title="View details"
                        >
                          <FaEye />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAnalysis(analysis);
                            setShowReanalyzeModal(true);
                          }}
                          className="text-gray-400 hover:text-green-600"
                          title="Reanalyze"
                        >
                          <FaSync />
                        </button>
                        <button 
                          onClick={() => deleteAnalysis(analysis.id)}
                          className="text-gray-400 hover:text-red-600"
                          title="Delete analysis"
                          disabled={deletingId === analysis.id}
                        >
                          {deletingId === analysis.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-600"></div>
                          ) : (
                            <FaTrash />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Analysis Detail Modal */}
      <AnimatePresence>
        {showDetailModal && selectedAnalysis && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6 pb-4 border-b">
                  <h2 className="text-2xl font-bold text-gray-900">Analysis Details</h2>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <div className="rounded-lg overflow-hidden bg-gray-200">
                      <img
                        src={selectedAnalysis.imageUrl}
                        alt={selectedAnalysis.plantName}
                        className="w-full h-64 object-cover"
                      />
                    </div>
                    
                    <div className="mt-4">
                      <h3 className="text-lg font-medium text-gray-900">Plant Information</h3>
                      <dl className="mt-2 grid grid-cols-1 gap-2">
                        <div className="flex justify-between">
                          <dt className="text-sm font-medium text-gray-500">Plant Name</dt>
                          <dd className="text-sm text-gray-900">{selectedAnalysis.plantName}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm font-medium text-gray-500">Analysis Date</dt>
                          <dd className="text-sm text-gray-900">{formatDate(selectedAnalysis.createdAt)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm font-medium text-gray-500">Confidence</dt>
                          <dd className="text-sm text-gray-900">
                            {selectedAnalysis.confidence ? `${(selectedAnalysis.confidence * 100).toFixed(1)}%` : 'N/A'}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm font-medium text-gray-500">Status</dt>
                          <dd className="text-sm">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedAnalysis.status)}`}>
                              {getStatusIcon(selectedAnalysis.status)} {selectedAnalysis.status}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </div>
                    
                    {selectedAnalysis.diseases && selectedAnalysis.diseases.length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-lg font-medium text-gray-900">Detected Issues</h3>
                        <ul className="mt-2 space-y-2">
                          {selectedAnalysis.diseases.map((disease, index) => (
                            <li key={index} className="flex items-start">
                              <FaBug className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{disease.name}</p>
                                <p className="text-sm text-gray-500">
                                  Confidence: {(disease.probability * 100).toFixed(1)}%
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Analysis Report</h3>
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg prose max-w-none">
                      {selectedAnalysis.analysis ? (
                        <div dangerouslySetInnerHTML={formatAnalysisText(selectedAnalysis.analysis)} />
                      ) : (
                        <p className="text-gray-500">No analysis details available.</p>
                      )}
                    </div>
                    
                    <div className="mt-6">
                      <h3 className="text-lg font-medium text-gray-900">Update Status</h3>
                      <div className="mt-2 flex space-x-2">
                        <select
                          className="flex-1 border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-1 focus:ring-green-500"
                          value={selectedAnalysis.status}
                          onChange={(e) => {
                            updateAnalysisStatus(selectedAnalysis.id, e.target.value);
                            setSelectedAnalysis({ ...selectedAnalysis, status: e.target.value });
                          }}
                          disabled={updateLoading}
                        >
                          <option value="healthy">Healthy</option>
                          <option value="recovering">Recovering</option>
                          <option value="diseased">Diseased</option>
                          <option value="monitoring">Monitoring</option>
                        </select>
                        <button
                          onClick={() => {
                            setShowDetailModal(false);
                            setShowReanalyzeModal(true);
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center"
                        >
                          <FaSync className="mr-2" />
                          Reanalyze
                        </button>
                      </div>
                    </div>
                    
                    {/* Re-analysis history */}
                    {analyses.filter(a => a.parentAnalysisId === selectedAnalysis.id).length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-lg font-medium text-gray-900">Re-analysis History</h3>
                        <div className="mt-2 space-y-3">
                          {analyses
                            .filter(a => a.parentAnalysisId === selectedAnalysis.id)
                            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                            .map((reanalysis) => (
                              <div key={reanalysis.id} className="p-3 bg-gray-50 rounded-lg">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium">{formatDate(reanalysis.createdAt)}</span>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(reanalysis.status)}`}>
                                    {reanalysis.status}
                                  </span>
                                </div>
                                {reanalysis.confidence && (
                                  <div className="mt-1 text-xs text-gray-500">
                                    Confidence: {(reanalysis.confidence * 100).toFixed(1)}%
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Thread View Modal */}
      <AnimatePresence>
        {showThreadModal && selectedAnalysis && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6 pb-4 border-b">
                  <h2 className="text-2xl font-bold text-gray-900">Analysis Thread</h2>
                  <button
                    onClick={() => setShowThreadModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Plant: {selectedAnalysis.plantName}</h3>
                  <p className="text-sm text-gray-600">Viewing all related analyses in chronological order</p>
                </div>
                
                <div className="space-y-4">
                  {threadAnalyses.map((analysis, index) => (
                    <div key={analysis.id} className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        setSelectedAnalysis(analysis);
                        setShowThreadModal(false);
                        setShowDetailModal(true);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center mb-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(analysis.status)} mr-2`}>
                              {getStatusIcon(analysis.status)} {analysis.status}
                            </span>
                            <span className="text-sm text-gray-500">{formatDate(analysis.createdAt)}</span>
                          </div>
                          
                          <div className="flex items-center mb-2">
                            {analysis.imageUrl && (
                              <img
                                src={analysis.imageUrl}
                                alt={analysis.plantName}
                                className="w-16 h-16 object-cover rounded-md mr-3"
                              />
                            )}
                            <div>
                              <h4 className="font-medium text-gray-900">{analysis.plantName}</h4>
                              {analysis.confidence && (
                                <p className="text-sm text-gray-500">
                                  Confidence: {(analysis.confidence * 100).toFixed(1)}%
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {analysis.diseases && analysis.diseases.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-gray-700">Detected Issues:</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {analysis.diseases.slice(0, 3).map((disease, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"
                                  >
                                    <FaBug className="mr-1" /> {disease.name}
                                  </span>
                                ))}
                                {analysis.diseases.length > 3 && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    +{analysis.diseases.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col items-end space-y-2">
                          {analysis.parentAnalysisId && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Follow-up
                            </span>
                          )}
                          {isParentAnalysis(analysis) && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              <FaLayerGroup className="mr-1" /> Parent
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {threadAnalyses.length === 0 && (
                  <div className="text-center py-8">
                    <FaLayerGroup className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No thread history</h3>
                    <p className="mt-1 text-sm text-gray-500">This analysis doesn't have any related analyses yet.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reanalyze Modal */}
      <AnimatePresence>
        {showReanalyzeModal && selectedAnalysis && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Reanalyze Plant</h2>
                  <button
                    onClick={() => {
                      setShowReanalyzeModal(false);
                      setReanalyzeImage(null);
                      setCapturedImage(null);
                      stopStream();
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <FaExclamationTriangle className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">Reference Analysis</h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <p>You're reanalyzing: <strong>{selectedAnalysis.plantName}</strong></p>
                        <p>Previous status: <span className="capitalize">{selectedAnalysis.status}</span></p>
                        <p>Last analyzed: {formatDate(selectedAnalysis.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {!reanalyzeImage ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Camera Capture */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-gray-800 mb-3 flex items-center">
                        <FaCamera className="mr-2 text-green-600" />
                        Capture with Camera
                      </h3>
                      
                      <div className="relative rounded-lg overflow-hidden bg-gray-900 mb-3">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-40 object-cover"
                        />
                      </div>
                      
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Select Camera
                        </label>
                        <select
                          value={selectedDeviceId || ""}
                          onChange={(e) => setSelectedDeviceId(e.target.value)}
                          className="block w-full pl-3 pr-10 py-1 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
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
                        className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        <FaCamera className="mr-2" />
                        Capture Image
                      </button>
                    </div>
                    
                    {/* File Upload */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <FaUpload className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">Upload an existing photo</p>
                      <label className="mt-4 inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer">
                        <span>Upload Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4">
                      <img
                        src={reanalyzeImage}
                        alt="Plant to reanalyze"
                        className="w-full h-64 object-contain rounded-lg border"
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={resetReanalyzeImage}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center"
                      >
                        <FaRedo className="mr-2" />
                        Retake
                      </button>
                      <button
                        onClick={handleReanalyze}
                        disabled={reanalyzeLoading}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                      >
                        {reanalyzeLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <FaSave className="mr-2" />
                            Save & Analyze
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
                
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}