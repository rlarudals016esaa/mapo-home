import {baseline} from './baseline';
import {type State,type Listing} from './model';
import type {ReviewProfile,ReviewEvent} from './reviews';
import type {ImportExclusion} from './import-exclusions';
export type Audit={at:string;action:string;detail:string};
export type Pending={rows:Omit<Listing,'active'|'updated'|'history'>[];file:string;date:string;at:string;sourceTotal?:number;exclusions?:ImportExclusion[];warnings?:string[];summary:{total:number;tracked:number;added:number;changed:number;missing:number}};
export type RunDetail={at:string;addedIds:string[];changedIds:string[];missingIds:string[];sourceTotal?:number;exclusions?:ImportExclusion[]};
export type AdminState=State&{pending?:Pending;audit:Audit[];hashes:string[];adminSchema?:2;profiles?:ReviewProfile[];events?:ReviewEvent[];runDetails?:RunDetail[];lastOperation?:string};
export function adminInitial():AdminState{return {...baseline(),audit:[],hashes:[]}}
