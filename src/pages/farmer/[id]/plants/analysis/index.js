import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import FarmerAnalysisHistory from "@/components/Farmer/FarmerAnalysisHistory";
import FarmerLayout from "@/components/Farmer/Layout/FarmerLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function MyHome() {
  return (
    <FarmerLayout
      className={`${geistSans.className} ${geistMono.className} font-sans `}
    >
      <main className="">
        <FarmerAnalysisHistory/>
      </main>
    </FarmerLayout>
  );
}
