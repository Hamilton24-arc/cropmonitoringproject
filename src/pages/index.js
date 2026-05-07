import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import Home from "@/components/Home/Home";
import Layout from "@/components/Layout/Layout";

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
    <Layout
      className={`${geistSans.className} ${geistMono.className} font-sans `}
    >
      <main className="">
        <Home/>
      </main>
    </Layout>
  );
}
