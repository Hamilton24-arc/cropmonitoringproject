import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaUser,
  FaSeedling,
  FaChartLine,
  FaChartPie,
  FaChartBar,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaPhone,
  FaEnvelope,
  FaEdit,
  FaSave,
  FaTimes,
  FaCamera,
  FaPlus,
  FaTrash,
  FaLeaf,
  FaBug,
  FaCheckCircle,
  FaExclamationTriangle,
  FaHistory
} from 'react-icons/fa';
import { MdAgriculture, MdDashboard } from 'react-icons/md';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase.config';

export default function FarmerDashboard() {
  const router = useRouter();
  const { id } = router.query;
  
  const [userDetails, setUserDetails] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({});
  const [newCrop, setNewCrop] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTimeframe, setSelectedTimeframe] = useState('month');

  // Fetch farmer data and analyses
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        // Fetch farmer/user details
        const userDocRef = doc(db, "farmers", id);
        const userDocSnapshot = await getDoc(userDocRef);

        if (userDocSnapshot.exists()) {
          const userData = userDocSnapshot.data();
          setUserDetails(userData);
          setProfileForm({
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            displayName: userData.displayName || '',
            phone: userData.phone || '',
            email: userData.email || '',
            farmLocation: userData.farmLocation || '',
            farmSize: userData.farmSize || '',
            crops: userData.crops || [],
            photoURL: userData.photoURL || ''
          });
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

        setAnalyses(analysesData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Calculate analytics data
  const getAnalyticsData = () => {
    const totalAnalyses = analyses.length;
    const healthyCount = analyses.filter(a => a.status === 'healthy').length;
    const diseasedCount = analyses.filter(a => a.status === 'diseased').length;
    const recoveringCount = analyses.filter(a => a.status === 'recovering').length;
    const monitoringCount = analyses.filter(a => a.status === 'monitoring').length;
    
    const statusDistribution = {
      healthy: totalAnalyses > 0 ? (healthyCount / totalAnalyses) * 100 : 0,
      diseased: totalAnalyses > 0 ? (diseasedCount / totalAnalyses) * 100 : 0,
      recovering: totalAnalyses > 0 ? (recoveringCount / totalAnalyses) * 100 : 0,
      monitoring: totalAnalyses > 0 ? (monitoringCount / totalAnalyses) * 100 : 0
    };

    // Get recent analyses (last 5)
    const recentAnalyses = analyses.slice(0, 5);

    // Get plant distribution
    const plantDistribution = {};
    analyses.forEach(analysis => {
      if (analysis.plantName) {
        plantDistribution[analysis.plantName] = (plantDistribution[analysis.plantName] || 0) + 1;
      }
    });

    // Get disease distribution
    const diseaseDistribution = {};
    analyses.forEach(analysis => {
      if (analysis.diseases && analysis.diseases.length > 0) {
        analysis.diseases.forEach(disease => {
          diseaseDistribution[disease.name] = (diseaseDistribution[disease.name] || 0) + 1;
        });
      }
    });

    return {
      totalAnalyses,
      statusDistribution,
      recentAnalyses,
      plantDistribution,
      diseaseDistribution,
      healthyCount,
      diseasedCount,
      recoveringCount,
      monitoringCount
    };
  };

  const analytics = getAnalyticsData();

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    
    try {
      const userDocRef = doc(db, "farmers", id);
      await updateDoc(userDocRef, {
        ...profileForm,
        updatedAt: serverTimestamp()
      });
      
      setUserDetails({ ...userDetails, ...profileForm });
      setEditingProfile(false);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddCrop = () => {
    if (newCrop.trim() && !profileForm.crops.includes(newCrop.trim())) {
      setProfileForm({
        ...profileForm,
        crops: [...profileForm.crops, newCrop.trim()]
      });
      setNewCrop('');
    }
  };

  const handleRemoveCrop = (cropToRemove) => {
    setProfileForm({
      ...profileForm,
      crops: profileForm.crops.filter(crop => crop !== cropToRemove)
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileForm({
      ...profileForm,
      [name]: value
    });
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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy': return <FaCheckCircle className="text-green-500" />;
      case 'recovering': return <FaChartLine className="text-blue-500" />;
      case 'diseased': return <FaBug className="text-red-500" />;
      case 'monitoring': return <FaExclamationTriangle className="text-yellow-500" />;
      default: return <FaLeaf className="text-gray-500" />;
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
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
              <MdDashboard className="h-8 w-8 text-green-600 mr-2" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Farmer Dashboard</h1>
                <p className="text-sm text-gray-600">Welcome back, {userDetails?.firstName}</p>
              </div>
            </div>
            <div className="hidden flex items-center space-x-4">
              <button
                onClick={() => router.push(`/farmer/${id}/plants/analysis`)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center"
              >
                <FaHistory className="mr-2" />
                View Analysis History
              </button>
              <button
                onClick={() => router.push(`/farmer/${id}/analyze`)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center"
              >
                <FaPlus className="mr-2" />
                New Analysis
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
          
          {/* Right Column - Analytics */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center justify-center flex-1 ${
                      activeTab === 'overview'
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <FaChartBar className="mr-2" />
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('plants')}
                    className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center justify-center flex-1 ${
                      activeTab === 'plants'
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <FaSeedling className="mr-2" />
                    Plants
                  </button>
                  <button
                    onClick={() => setActiveTab('diseases')}
                    className={`py-4 px-6 text-center border-b-2 font-medium text-sm flex items-center justify-center flex-1 ${
                      activeTab === 'diseases'
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <FaBug className="mr-2" />
                    Diseases
                  </button>
                </nav>
              </div>
            </div>

            {/* Timeframe Selector */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <div className="flex items-center justify-between">
                <h3 className="hidden md:block text-lg font-medium text-gray-900">Analytics Period</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedTimeframe('week')}
                    className={`px-3 py-1 rounded-md text-sm ${
                      selectedTimeframe === 'week'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setSelectedTimeframe('month')}
                    className={`px-3 py-1 rounded-md text-sm ${
                      selectedTimeframe === 'month'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setSelectedTimeframe('year')}
                    className={`px-3 py-1 rounded-md text-sm ${
                      selectedTimeframe === 'year'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    Year
                  </button>
                  <button
                    onClick={() => setSelectedTimeframe('all')}
                    className={`px-3 py-1 rounded-md text-sm ${
                      selectedTimeframe === 'all'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    All Time
                  </button>
                </div>
              </div>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-lg shadow p-6"
                  >
                    <div className="flex items-center">
                      <div className="p-3 rounded-lg bg-green-100 text-green-600">
                        <FaLeaf className="h-6 w-6" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Total Analyses</p>
                        <p className="text-2xl font-semibold text-gray-900">{analytics.totalAnalyses}</p>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-lg shadow p-6"
                  >
                    <div className="flex items-center">
                      <div className="p-3 rounded-lg bg-green-100 text-green-600">
                        <FaCheckCircle className="h-6 w-6" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Healthy Plants</p>
                        <p className="text-2xl font-semibold text-gray-900">{analytics.healthyCount}</p>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-lg shadow p-6"
                  >
                    <div className="flex items-center">
                      <div className="p-3 rounded-lg bg-red-100 text-red-600">
                        <FaBug className="h-6 w-6" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Diseased Plants</p>
                        <p className="text-2xl font-semibold text-gray-900">{analytics.diseasedCount}</p>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white rounded-lg shadow p-6"
                  >
                    <div className="flex items-center">
                      <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
                        <FaChartLine className="h-6 w-6" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-600">Recovering Plants</p>
                        <p className="text-2xl font-semibold text-gray-900">{analytics.recoveringCount}</p>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Status Distribution Chart */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Plant Health Distribution</h3>
                  <div className="space-y-4">
                    {[
                      { status: 'healthy', count: analytics.healthyCount, percentage: analytics.statusDistribution.healthy, color: 'bg-green-500' },
                      { status: 'diseased', count: analytics.diseasedCount, percentage: analytics.statusDistribution.diseased, color: 'bg-red-500' },
                      { status: 'recovering', count: analytics.recoveringCount, percentage: analytics.statusDistribution.recovering, color: 'bg-blue-500' },
                      { status: 'monitoring', count: analytics.monitoringCount, percentage: analytics.statusDistribution.monitoring, color: 'bg-yellow-500' }
                    ].map((item, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-700 capitalize">{item.status}</span>
                          <span className="text-gray-500">{item.count} ({item.percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${item.color}`}
                            style={{ width: `${item.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Analyses */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Analyses</h3>
                  <div className="space-y-4">
                    {analytics.recentAnalyses.length > 0 ? (
                      analytics.recentAnalyses.map((analysis, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center">
                            {analysis.imageUrl && (
                              <img
                                src={analysis.imageUrl}
                                alt={analysis.plantName}
                                className="h-10 w-10 rounded-md object-cover mr-3"
                              />
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900">{analysis.plantName}</p>
                              <p className="text-xs text-gray-500">{formatDate(analysis.createdAt)}</p>
                            </div>
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(analysis.status)}`}>
                            {getStatusIcon(analysis.status)} {analysis.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">No analyses yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Left Column - Profile */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-medium text-gray-900">Farmer Profile</h2>
                  <button
                    onClick={() => setEditingProfile(!editingProfile)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {editingProfile ? <FaTimes /> : <FaEdit />}
                  </button>
                </div>

                {editingProfile ? (
                  <form onSubmit={handleProfileUpdate}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-center mb-4">
                        <div className="relative">
                          <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center">
                            {profileForm.photoURL ? (
                              <img
                                src={profileForm.photoURL}
                                alt="Profile"
                                className="h-24 w-24 rounded-full object-cover"
                              />
                            ) : (
                              <FaUser className="h-12 w-12 text-gray-400" />
                            )}
                          </div>
                          <button
                            type="button"
                            className="absolute bottom-0 right-0 bg-green-600 rounded-full p-2 text-white shadow-md"
                          >
                            <FaCamera className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            First Name
                          </label>
                          <input
                            type="text"
                            name="firstName"
                            value={profileForm.firstName}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Last Name
                          </label>
                          <input
                            type="text"
                            name="lastName"
                            value={profileForm.lastName}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Display Name
                        </label>
                        <input
                          type="text"
                          name="displayName"
                          value={profileForm.displayName}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={profileForm.email}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                          disabled
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={profileForm.phone}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Farm Location
                        </label>
                        <input
                          type="text"
                          name="farmLocation"
                          value={profileForm.farmLocation}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Farm Size (acres)
                        </label>
                        <input
                          type="number"
                          name="farmSize"
                          value={profileForm.farmSize}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Crops
                        </label>
                        <div className="flex mb-2">
                          <input
                            type="text"
                            value={newCrop}
                            onChange={(e) => setNewCrop(e.target.value)}
                            placeholder="Add a crop"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                          <button
                            type="button"
                            onClick={handleAddCrop}
                            className="bg-green-600 text-white px-4 py-2 rounded-r-md hover:bg-green-700"
                          >
                            <FaPlus />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {profileForm.crops.map((crop, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                            >
                              {crop}
                              <button
                                type="button"
                                onClick={() => handleRemoveCrop(crop)}
                                className="ml-2 text-green-600 hover:text-green-800"
                              >
                                <FaTrash className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end space-x-3 pt-4">
                        <button
                          type="button"
                          onClick={() => setEditingProfile(false)}
                          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingProfile}
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                        >
                          {savingProfile ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <FaSave className="mr-2" />
                              Save Changes
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center mb-4">
                      <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center">
                        {userDetails?.photoURL ? (
                          <img
                            src={userDetails.photoURL}
                            alt="Profile"
                            className="h-24 w-24 rounded-full object-cover"
                          />
                        ) : (
                          <FaUser className="h-12 w-12 text-gray-400" />
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {userDetails?.firstName} {userDetails?.lastName}
                      </h3>
                      {userDetails?.displayName && (
                        <p className="text-sm text-gray-500">@{userDetails.displayName}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center">
                        <FaEnvelope className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-600">{userDetails?.email}</span>
                      </div>
                      <div className="flex items-center">
                        <FaPhone className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-600">{userDetails?.phone || 'Not provided'}</span>
                      </div>
                      <div className="flex items-center">
                        <FaMapMarkerAlt className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-600">{userDetails?.farmLocation || 'Not provided'}</span>
                      </div>
                      {userDetails?.farmSize && (
                        <div className="flex items-center">
                          <MdAgriculture className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-600">{userDetails.farmSize} acres</span>
                        </div>
                      )}
                    </div>

                    {userDetails?.crops && userDetails.crops.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Crops Grown</h4>
                        <div className="flex flex-wrap gap-2">
                          {userDetails.crops.map((crop, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                            >
                              {crop}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>


            {/* Plants Tab */}
            {activeTab === 'plants' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Plant Distribution</h3>
                  {Object.keys(analytics.plantDistribution).length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(analytics.plantDistribution)
                        .sort((a, b) => b[1] - a[1])
                        .map(([plant, count], index) => {
                          const percentage = (count / analytics.totalAnalyses) * 100;
                          return (
                            <div key={index} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="font-medium text-gray-700">{plant}</span>
                                <span className="text-gray-500">{count} ({percentage.toFixed(1)}%)</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full bg-green-500"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No plant data available</p>
                  )}
                </div>
              </div>
            )}

            {/* Diseases Tab */}
            {activeTab === 'diseases' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Disease Distribution</h3>
                  {Object.keys(analytics.diseaseDistribution).length > 0 ? (
                    <div className="space-y-4">
                      {Object.entries(analytics.diseaseDistribution)
                        .sort((a, b) => b[1] - a[1])
                        .map(([disease, count], index) => (
                          <div key={index} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium text-gray-700">{disease}</span>
                              <span className="text-gray-500">{count} detected</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-red-500"
                                style={{ width: `${(count / analytics.totalAnalyses) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">No disease data available</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}