'use client';
import {useState} from 'react';
import {ImageOff,X,Expand} from 'lucide-react';
import {isListingImageUrl,originalListingImageUrl} from '@/lib/image-url';
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogTrigger,DialogClose} from '@/components/ui/dialog';

export function ListingPhoto({url,name,detail=false}:{url?:string;name:string;detail?:boolean}){
 const [failedSources,setFailedSources]=useState<string[]>([]),[open,setOpen]=useState(false);
 const valid=!!url&&isListingImageUrl(url),original=valid?originalListingImageUrl(url):'';
 const limited=valid&&original!==url&&failedSources.includes(original),src=limited?url!:original;
 const failed=valid&&failedSources.includes(src);
 const fail=()=>setFailedSources(old=>old.includes(src)?old:[...old,src]);
 const content=valid&&!failed?<img key={src} src={src} alt={`${name} 매물 사진`} loading={detail?'eager':'lazy'} decoding="async" referrerPolicy="no-referrer" onError={fail}/>:<span className="photo-placeholder"><ImageOff size={24}/>{failed?'사진을 불러오지 못했어요':'등록된 사진이 없어요'}</span>;
 return <Dialog open={open} onOpenChange={setOpen}><div className={detail?'listing-photo detail-photo':'listing-photo'}>
  {valid&&!failed?<DialogTrigger asChild><button className={limited?'photo-frame photo-limited':'photo-frame'} aria-label={`${name} 사진 전체 보기`}>{content}<span className="photo-expand"><Expand size={15}/>사진 전체 보기</span></button></DialogTrigger>:<div className="photo-frame">{content}</div>}
  {limited&&!failed&&<p className="photo-quality-note">원본 사진을 불러오지 못해 작은 미리보기를 표시합니다.</p>}
  {detail&&<p>{valid&&!failed?'사진을 누르면 잘리지 않은 전체 이미지를 볼 수 있어요.':failed?'아래 네이버 원문에서 사진을 확인해 주세요.':'수집 파일에 사진 링크가 없습니다.'}</p>}
 </div><DialogContent className="photo-viewer" showCloseButton={false}>
  <div className="photo-viewer-heading"><DialogTitle>{name} 사진</DialogTitle><DialogClose asChild><button className="photo-viewer-close" aria-label="사진 닫기"><X size={22}/></button></DialogClose></div>
  <div className="photo-viewer-image">{valid&&!failed?<img key={src} src={src} alt={`${name} 전체 매물 사진`} decoding="async" referrerPolicy="no-referrer" onError={fail}/>:<span className="photo-placeholder"><ImageOff size={24}/>사진을 불러오지 못했어요</span>}</div>
  <DialogDescription>{failed?'사진을 불러오지 못했어요.':limited?'원본 사진을 불러오지 못해 작은 미리보기를 표시합니다.':'전체 사진을 원래 비율로 보여드려요.'}</DialogDescription>
 </DialogContent></Dialog>
}
