import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt, FaLock, FaEye, FaEyeSlash, FaCheck, FaTimes } from 'react-icons/fa';
import { MdAgriculture } from 'react-icons/md';
import { db, auth } from '@/lib/firebase.config'; 


const backgroundImages = [
  '/images/farm1.jpg',
  '/images/farm2.jpg',
  '/images/farm3.jpg',
  '/images/farmer2.jpg',
];

export default function FarmerSignup() {
  const router = useRouter();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    farmLocation: '',
    farmSize: '',
    crops: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    specialChar: false,
  });
  const [passwordStrength, setPasswordStrength] = useState(0);
  const intervalRef = useRef(null);

  // Background image slider
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCurrentImageIndex((prevIndex) => 
        prevIndex === backgroundImages.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000);

    return () => clearInterval(intervalRef.current);
  }, []);

  // Check password requirements
  useEffect(() => {
    const { password } = formData;
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      specialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    setPasswordRequirements(requirements);

    // Calculate password strength (0-100)
    const fulfilledCount = Object.values(requirements).filter(Boolean).length;
    setPasswordStrength((fulfilledCount / 5) * 100);
  }, [formData.password]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Clear error when user types
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const { 
      firstName, 
      lastName, 
      email, 
      phone, 
      farmLocation, 
      password, 
      confirmPassword 
    } = formData;

    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^[0-9]{10,15}$/.test(phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!farmLocation.trim()) newErrors.farmLocation = 'Farm location is required';
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    if (isLoading) return;

    setIsLoading(true);

    try {
      // Create user in Firebase Auth
      const { user } = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );

      // Prepare farmer data
      const farmerData = {
        uid: user.uid,
        firstName: formData.firstName,
        lastName: formData.lastName,
        displayName: (formData.firstName + ' ' + formData.lastName),
        email: formData.email,
        phone: formData.phone,
        farmLocation: formData.farmLocation,
        farmSize: formData.farmSize,
        crops: formData.crops.split(',').map(crop => crop.trim()),
        createdAt: new Date().toISOString(),
        role: 'farmer',
        userType: 'farmer',
        status: 'active',
      };

      // Save to users collection
      await setDoc(doc(db, 'users', user.uid), {
        ...farmerData,
        createdAt: new Date().toISOString(),
      });

      // Save to farmers collection
      await setDoc(doc(db, 'farmers', user.uid), farmerData);

      // Redirect to dashboard
      router.push(`/farmer/${user.uid}/dashboard`);
    } catch (error) {
      console.error('Signup error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setErrors({ ...errors, email: 'This email is already registered' });
      } else {
        setErrors({ ...errors, general: 'Signup failed. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getStrengthColor = () => {
    if (passwordStrength < 30) return 'bg-red-500';
    if (passwordStrength < 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background Image Slider with Glass Effect */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {backgroundImages.map((img, index) => (
          <div
            key={img}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'}`}
            style={{ backgroundImage: `url(${img})` }}
          />
        ))}
        <div className="absolute inset-0 bg-black bg-opacity-40 backdrop-blur-sm" />
      </div>

      {/* Signup Form Container */}
      <div className="w-full max-w-3xl bg-white bg-opacity-90 backdrop-blur-lg rounded-xl shadow-2xl overflow-hidden">
        <div className="md:flex">
          {/* Left Side - Branding */}
          <div className="hidden md:block md:w-1/3 bg-gradient-to-b from-green-600 to-emerald-700 p-8 text-white">
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center mb-6">
                  <MdAgriculture className="h-8 w-8 mr-2" />
                  <span className="text-2xl font-bold">Growfy</span>
                </div>
                <h2 className="text-xl font-semibold mb-2">Join Our Farming Community</h2>
                <p className="text-sm opacity-80">
                  Get access to AI-powered plant analysis, expert advice, and connect with other farmers.
                </p>
              </div>
              
              <div className="mt-auto">
                <div className="flex items-center">
                  <div className="h-px bg-white bg-opacity-30 flex-1"></div>
                  <span className="px-3 text-sm opacity-70">Already a member?</span>
                  <div className="h-px bg-white bg-opacity-30 flex-1"></div>
                </div>
                <button
                  onClick={() => router.push('/login')}
                  className="w-full mt-4 px-4 py-2 border border-white rounded-md text-sm font-medium hover:bg-white hover:bg-opacity-10 transition"
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>

          {/* Right Side - Form */}
          <div className="md:w-2/3 p-8">
            <div className="md:hidden mb-6 flex items-center justify-center">
              <MdAgriculture className="h-8 w-8 mr-2 text-green-600" />
              <span className="text-2xl font-bold text-gray-800">Growfy</span>
            </div>

            <h1 className="text-2xl font-bold text-gray-800 mb-6">Create Farmer Account</h1>
            
            {errors.general && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {errors.general}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* First Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <div className={`relative rounded-md shadow-sm ${errors.firstName ? 'border-red-300' : 'border-gray-300'}`}>
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaUser className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className={`block w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.firstName ? 'border-red-300' : 'border-gray-300'}`}
                      placeholder="John"
                    />
                  </div>
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <div className={`relative rounded-md shadow-sm ${errors.lastName ? 'border-red-300' : 'border-gray-300'}`}>
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaUser className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className={`block w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.lastName ? 'border-red-300' : 'border-gray-300'}`}
                      placeholder="Doe"
                    />
                  </div>
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className={`relative rounded-md shadow-sm ${errors.email ? 'border-red-300' : 'border-gray-300'}`}>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaEnvelope className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.email ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="your@email.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              {/* Phone */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <div className={`relative rounded-md shadow-sm ${errors.phone ? 'border-red-300' : 'border-gray-300'}`}>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaPhone className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.phone ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="08012345678"
                  />
                </div>
                {errors.phone && (
                  <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                )}
              </div>

              {/* Farm Location */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Farm Location <span className="text-red-500">*</span>
                </label>
                <div className={`relative rounded-md shadow-sm ${errors.farmLocation ? 'border-red-300' : 'border-gray-300'}`}>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaMapMarkerAlt className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="farmLocation"
                    value={formData.farmLocation}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.farmLocation ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="City, State"
                  />
                </div>
                {errors.farmLocation && (
                  <p className="mt-1 text-sm text-red-600">{errors.farmLocation}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Farm Size */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Farm Size (Acres)
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <input
                      type="text"
                      name="farmSize"
                      value={formData.farmSize}
                      onChange={handleChange}
                      className="block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="5"
                    />
                  </div>
                </div>

                {/* Crops */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Main Crops (comma separated)
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <input
                      type="text"
                      name="crops"
                      value={formData.crops}
                      onChange={handleChange}
                      className="block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Maize, Cassava, Tomato"
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className={`relative rounded-md shadow-sm ${errors.password ? 'border-red-300' : 'border-gray-300'}`}>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaLock className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.password ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="••••••••"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                      {showPassword ? (
                        <FaEyeSlash className="h-4 w-4" />
                      ) : (
                        <FaEye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}

                {/* Password Strength Meter */}
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${getStrengthColor()}`}
                      style={{ width: `${passwordStrength}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Password strength: {passwordStrength < 30 ? 'Weak' : passwordStrength < 70 ? 'Medium' : 'Strong'}
                  </p>
                </div>

                {/* Password Requirements */}
                <div className="mt-2 text-xs text-gray-600">
                  <p className="font-medium mb-1">Password must contain:</p>
                  <ul className="space-y-1">
                    <li className={`flex items-center ${passwordRequirements.length ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordRequirements.length ? (
                        <FaCheck className="h-3 w-3 mr-1" />
                      ) : (
                        <FaTimes className="h-3 w-3 mr-1" />
                      )}
                      At least 8 characters
                    </li>
                    <li className={`flex items-center ${passwordRequirements.uppercase ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordRequirements.uppercase ? (
                        <FaCheck className="h-3 w-3 mr-1" />
                      ) : (
                        <FaTimes className="h-3 w-3 mr-1" />
                      )}
                      At least one uppercase letter
                    </li>
                    <li className={`flex items-center ${passwordRequirements.lowercase ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordRequirements.lowercase ? (
                        <FaCheck className="h-3 w-3 mr-1" />
                      ) : (
                        <FaTimes className="h-3 w-3 mr-1" />
                      )}
                      At least one lowercase letter
                    </li>
                    <li className={`flex items-center ${passwordRequirements.number ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordRequirements.number ? (
                        <FaCheck className="h-3 w-3 mr-1" />
                      ) : (
                        <FaTimes className="h-3 w-3 mr-1" />
                      )}
                      At least one number
                    </li>
                    <li className={`flex items-center ${passwordRequirements.specialChar ? 'text-green-600' : 'text-gray-500'}`}>
                      {passwordRequirements.specialChar ? (
                        <FaCheck className="h-3 w-3 mr-1" />
                      ) : (
                        <FaTimes className="h-3 w-3 mr-1" />
                      )}
                      At least one special character
                    </li>
                  </ul>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className={`relative rounded-md shadow-sm ${errors.confirmPassword ? 'border-red-300' : 'border-gray-300'}`}>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaLock className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`block w-full pl-10 pr-10 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.confirmPassword ? 'border-red-300' : 'border-gray-300'}`}
                    placeholder="••••••••"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                      {showConfirmPassword ? (
                        <FaEyeSlash className="h-4 w-4" />
                      ) : (
                        <FaEye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>

              <div className="mt-4 text-center text-sm text-gray-600">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="font-medium text-green-600 hover:text-green-500"
                >
                  Sign in
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}