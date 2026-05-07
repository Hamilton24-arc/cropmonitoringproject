import Navbar from './Navbar';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-white text-gray-800">
      <Navbar />
      <main className="pt-20">{children}</main> {/* Prevent overlap with fixed navbar */}
    </div>
  );
}
