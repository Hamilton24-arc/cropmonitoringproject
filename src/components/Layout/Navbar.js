import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled ? 'backdrop-blur bg-white/80 shadow-sm' : 'bg-green-50'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/">
              <span className="text-xl font-bold text-green-600 tracking-tight">
                🌿 Growfy
              </span>
            </Link>
          </div>

          {/* Sign In Button */}
          <div className="flex items-center space-x-4">
            <Link href="/auth/signin">
              <span className="px-5 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition">
                Sign In
              </span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
