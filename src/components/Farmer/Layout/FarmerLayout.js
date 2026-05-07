import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaTachometerAlt,
  FaCamera,
  FaHistory,
  FaSignOutAlt,
  FaTimes,
  FaBell,
  FaChevronLeft,
  FaBars
} from 'react-icons/fa';
import { MdAgriculture } from 'react-icons/md';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase.config';

export default function FarmerLayout({ children }) {
  const router = useRouter();
  const { id } = router.query;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [pendingAnalyses, setPendingAnalyses] = useState(0);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) setSidebarOpen(false);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Fetch user details and pending analyses
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        // Fetch farmer details
        const userDocRef = doc(db, "farmers", id);
        const userDocSnapshot = await getDoc(userDocRef);

        if (userDocSnapshot.exists()) {
          setUserDetails(userDocSnapshot.data());
        }

        // Fetch pending analyses
        const q = query(
          collection(db, 'plantAnalysis'),
          where('farmerId', '==', id),
          where('status', '==', 'pending')
        );

        const querySnapshot = await getDocs(q);
        setPendingAnalyses(querySnapshot.size);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [id]);

  const handleLogout = () => {
    // Implement logout logic here
    console.log('Logging out...');
    setShowLogoutModal(false);
    router.push('/');
  };

  const navigationItems = [
    {
      name: 'Dashboard',
      href: `/farmer/${id}/dashboard`,
      icon: FaTachometerAlt,
      active: router.pathname === '/farmer/[id]/dashboard'
    },
    {
      name: 'Analyze Plant',
      href: `/farmer/${id}/plants/analyze`,
      icon: FaCamera,
      active: router.pathname === '/farmer/[id]/plants/analyze'
    },
    {
      name: 'Past Analysis',
      href: `/farmer/${id}/plants/analysis`,
      icon: FaHistory,
      active: router.pathname === '/farmer/[id]/plants/analysis',
      notification: pendingAnalyses
    }
  ];

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar for desktop */}
      <div className={`hidden md:flex flex-col ${sidebarOpen ? 'w-64' : 'w-20'} bg-green-800 text-white transition-all duration-300 ease-in-out`}>
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-green-700">
          {sidebarOpen ? (
            <div className="flex items-center">
              <MdAgriculture className="h-8 w-8 mr-2" />
              <span className="text-xl font-semibold">Growfy</span>
            </div>
          ) : (
            <MdAgriculture className="h-8 w-8 mx-auto" />
          )}
          <button
            onClick={toggleSidebar}
            className="p-1 rounded-md hover:bg-green-700 transition-colors"
          >
            <FaChevronLeft className={`h-4 w-4 ${!sidebarOpen && 'rotate-180'}`} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navigationItems.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className={`flex items-center p-3 rounded-lg transition-colors ${
                item.active
                  ? 'bg-green-700 text-white'
                  : 'text-green-100 hover:bg-green-700 hover:text-white'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {sidebarOpen && (
                <span className="ml-3 flex-1">{item.name}</span>
              )}
              {item.notification > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {item.notification}
                </span>
              )}
            </a>
          ))}
        </nav>

        {/* User profile */}
        <div className="p-4 border-t border-green-700">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center w-full p-2 rounded-lg text-green-100 hover:bg-green-700 transition-colors"
          >
            <div className="flex-shrink-0">
              {userDetails?.photoURL ? (
                <img
                  src={userDetails.photoURL}
                  alt="Profile"
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-green-700 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {userDetails?.firstName?.[0]}{userDetails?.lastName?.[0]}
                  </span>
                </div>
              )}
            </div>
            {sidebarOpen && (
              <div className="ml-3 text-left flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">
                  {userDetails?.firstName} {userDetails?.lastName}
                </p>
                <p className="text-xs text-green-200 truncate">
                  @{userDetails?.displayName || 'farmer'}
                </p>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900 bg-opacity-50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 left-0 w-64 bg-green-800 text-white z-50 md:hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-green-700">
              <div className="flex items-center">
                <MdAgriculture className="h-8 w-8 mr-2" />
                <span className="text-xl font-semibold">Growfy</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded-md hover:bg-green-700 transition-colors"
              >
                <FaTimes className="h-5 w-5" />
              </button>
            </div>

            <nav className="p-4 space-y-2">
              {navigationItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className={`flex items-center p-3 rounded-lg transition-colors ${
                    item.active
                      ? 'bg-green-700 text-white'
                      : 'text-green-100 hover:bg-green-700 hover:text-white'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="ml-3 flex-1">{item.name}</span>
                  {item.notification > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {item.notification}
                    </span>
                  )}
                </a>
              ))}
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-green-700">
              <button
                onClick={() => setShowLogoutModal(true)}
                className="flex items-center w-full p-2 rounded-lg text-green-100 hover:bg-green-700 transition-colors"
              >
                <div className="flex-shrink-0">
                  {userDetails?.photoURL ? (
                    <img
                      src={userDetails.photoURL}
                      alt="Profile"
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-green-700 flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {userDetails?.firstName?.[0]}{userDetails?.lastName?.[0]}
                      </span>
                    </div>
                  )}
                </div>
                <div className="ml-3 text-left flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate">
                    {userDetails?.firstName} {userDetails?.lastName}
                  </p>
                  <p className="text-xs text-green-200 truncate">
                    @{userDetails?.displayName || 'farmer'}
                  </p>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white shadow-sm z-10">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center">
              <button
                onClick={toggleSidebar}
                className="mr-4 text-gray-600 hover:text-gray-900 focus:outline-none md:hidden"
              >
                <FaBars className="h-6 w-6" />
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                {navigationItems.find(item => item.active)?.name || 'Dashboard'}
              </h1>
            </div>
            <div className="flex items-center">
              {/* Notification bell for mobile */}
              {pendingAnalyses > 0 && (
                <div className="relative mr-4 md:hidden">
                  <FaBell className="h-5 w-5 text-gray-600" />
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {pendingAnalyses}
                  </span>
                </div>
              )}
              {/* Desktop profile button */}
              <button
                onClick={() => setShowLogoutModal(true)}
                className="hidden md:flex items-center text-sm rounded-full focus:outline-none"
              >
                <span className="mr-2 text-gray-700">
                  {userDetails?.firstName} {userDetails?.lastName}
                </span>
                {userDetails?.photoURL ? (
                  <img
                    src={userDetails.photoURL}
                    alt="Profile"
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-green-700 flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {userDetails?.firstName?.[0]}{userDetails?.lastName?.[0]}
                    </span>
                  </div>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Mobile bottom navigation */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 md:hidden">
            <div className="flex justify-around">
              {navigationItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className={`flex flex-col items-center py-2 px-3 text-xs ${
                    item.active ? 'text-green-600' : 'text-gray-600'
                  }`}
                >
                  <div className="relative">
                    <item.icon className="h-5 w-5" />
                    {item.notification > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                        {item.notification}
                      </span>
                    )}
                  </div>
                  <span className="mt-1">{item.name}</span>
                </a>
              ))}
              <button
                onClick={() => setShowLogoutModal(true)}
                className="flex flex-col items-center py-2 px-3 text-xs text-gray-600"
              >
                {userDetails?.photoURL ? (
                  <img
                    src={userDetails.photoURL}
                    alt="Profile"
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-green-700 flex items-center justify-center">
                    <span className="text-xs text-white">
                      {userDetails?.firstName?.[0]}
                    </span>
                  </div>
                )}
                <span className="mt-1">Profile</span>
              </button>
            </div>
          </nav>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Logout Modal */}
      <AnimatePresence>
        {showLogoutModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Confirm Logout</h3>
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <FaTimes className="h-5 w-5" />
                </button>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-600">Are you sure you want to logout from your account?</p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowLogoutModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center"
                >
                  <FaSignOutAlt className="mr-2" />
                  Logout
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}