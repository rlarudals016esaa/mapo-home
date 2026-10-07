import sourceImages from '@/data/listing-images.json';
import type {Listing} from './model';
import {isListingImageUrl} from './image-url';

type SourceImage={id:string;name:string;sourceUrl:string;imageUrl:string};
const images=sourceImages as Record<string,SourceImage>;
// Backfill presentation metadata only when the exact source row and identity match.
// No catalog, price history, favorite, notification or stored state is changed.
export function withListingImage<T extends Listing>(listing:T):T {
 if(listing.imageUrl!==undefined||!listing.sourceFile||!listing.sourceRow)return listing;
 const key=listing.sourceFile.replace(/^MAPO_/i,'SINGLE_')+':'+listing.sourceRow;
 const source=images[key];
 if(!source||source.id!==listing.id||source.name!==listing.name||source.sourceUrl!==(listing.sourceUrl??'')||!isListingImageUrl(source.imageUrl))return listing;
 return {...listing,imageUrl:source.imageUrl};
}
