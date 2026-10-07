import type {Metadata,Viewport} from "next";
import {PwaRegistration} from "@/components/pwa-panel";
import "./globals.css";
export const metadata:Metadata={title:"마포홈 · 나에게 맞는 자취방",description:"마포구 원룸·오피스텔 전세·월세. 내 예산에 맞는 방을 찾고 관심 매물을 저장하세요.",icons:{icon:"/favicon.svg",apple:"/icons/icon-192.png"},appleWebApp:{capable:true,title:"마포홈",statusBarStyle:"default"}};
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:"#176e62"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><head><link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials"/></head><body><PwaRegistration/>{children}</body></html>}
