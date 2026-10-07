"use client";
import {useEffect,useState} from "react";
import {Download,Smartphone} from "lucide-react";
type InstallEvent=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export function PwaRegistration(){useEffect(()=>{if("serviceWorker" in navigator&&window.isSecureContext)navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"}).catch(()=>{});},[]);return null}
export function PwaPanel(){
  const [prompt,setPrompt]=useState<InstallEvent|null>(null),[installed,setInstalled]=useState(false),[installing,setInstalling]=useState(false),[help,setHelp]=useState(false),[offline,setOffline]=useState(false),[installError,setInstallError]=useState("");
  useEffect(()=>{
    setInstalled(matchMedia("(display-mode: standalone)").matches||!!(navigator as Navigator&{standalone?:boolean}).standalone);
    setOffline(!navigator.onLine);
    const onPrompt=(e:Event)=>{e.preventDefault();setPrompt(e as InstallEvent)};
    const done=()=>{setInstalled(true);setPrompt(null)};
    const net=()=>setOffline(!navigator.onLine);
    window.addEventListener("beforeinstallprompt",onPrompt);window.addEventListener("appinstalled",done);window.addEventListener("online",net);window.addEventListener("offline",net);
    return()=>{window.removeEventListener("beforeinstallprompt",onPrompt);window.removeEventListener("appinstalled",done);window.removeEventListener("online",net);window.removeEventListener("offline",net)};
  },[]);
  return <section className="section-panel pwa-panel"><h3><Smartphone size={20}/>홈 화면에서 바로 열기</h3><p className="muted">마포홈을 홈 화면에 추가해 더 빠르게 방문하세요.</p>
    {installed?<p className="status-pill">홈 화면 앱으로 이용 중이에요</p>:<button className="secondary full" disabled={installing} onClick={async()=>{if(!prompt){setHelp(v=>!v);return}setInstalling(true);setInstallError("");try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==="accepted")setInstalled(true);setPrompt(null)}catch{setInstallError("브라우저 메뉴에서 홈 화면에 추가를 선택해 주세요.")}finally{setInstalling(false)}}}><Download size={16}/>{prompt?"마포홈 설치":"홈 화면 추가 방법"}</button>}
    {help&&<p className="install-help">iPhone은 Safari의 공유 메뉴에서 ‘홈 화면에 추가’를 선택하세요. 다른 기기는 브라우저 메뉴의 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 확인해 주세요.</p>}
    {installError&&<p role="alert" className="error-box">{installError}</p>}
    {offline&&<p role="status" className="error-box">현재 오프라인이에요. 저장하려면 인터넷에 연결해 주세요.</p>}
  </section>;
}
