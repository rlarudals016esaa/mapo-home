import {z} from 'zod';
import {ruleSchema,initial,importSnapshot,type Rule,type Favorite,type Notice,type Listing} from './review-policy';
import type {AdminState} from './admin';
import {qualityWarnings} from './quality';
export const profileInput=z.object({alias:z.string().trim().min(1).max(60),nickname:z.string().trim().max(24).default(''),rule:ruleSchema});
export type ReviewProfile={id:string;alias:string;nickname:string;rule:Rule;favorites:Favorite[]};
export type ReviewEvent=Notice&{profileId:string;alias:string;batchId:string;delivery:'internal_only'};
export function evaluateProfiles(s:AdminState,rows:Listing[],file:string,at:string,date:string,batchId:string){
 const events:ReviewEvent[]=[];
 for(const p of s.profiles??[]){
  const input={...initial(),listings:s.listings,rules:[p.rule],favorites:p.favorites,nickname:p.nickname};
  const next=importSnapshot(input,rows,file,at,date);
  for(const n of next.notices)events.push({...n,id:[batchId,p.id,n.kind,n.kind==='신규 매물'?'batch':n.listingId].join(':'),profileId:p.id,alias:p.alias,batchId,delivery:'internal_only'});
 }
 return events;
}
export function normalizeAdmin(s:AdminState):AdminState{return {...s,adminSchema:2,profiles:s.profiles??[],events:s.events??[],runDetails:s.runDetails??[],...(s.pending?{pending:{...s.pending,warnings:qualityWarnings(s.listings,s.pending.rows)}}:{})}}
