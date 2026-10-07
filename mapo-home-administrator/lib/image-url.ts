export function isListingImageUrl(value:string):boolean {
 try {const url=new URL(value);return value.length<=2000&&url.protocol==='https:'&&url.hostname==='landthumb-phinf.pstatic.net'&&!url.username&&!url.password&&!url.port;}catch{return false}
}
