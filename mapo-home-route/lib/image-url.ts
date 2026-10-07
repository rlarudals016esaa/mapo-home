export function isListingImageUrl(value:string):boolean {
 try {const url=new URL(value);return value.length<=2000&&url.protocol==='https:'&&url.hostname==='landthumb-phinf.pstatic.net'&&!url.username&&!url.password&&!url.port;}catch{return false}
}

// The collected Naver URL requests a cropped thumbnail (e.g. CW86_H86).
// This same-host URL without that transform returns the original image.
// Keep the collected URL unchanged in the workbook and stored listing.
export function originalListingImageUrl(value:string):string {
 if(!isListingImageUrl(value))return '';
 const url=new URL(value);
 if(/^CW\d+_H\d+$/i.test(url.searchParams.get('type')??''))url.searchParams.delete('type');
 return url.href;
}
