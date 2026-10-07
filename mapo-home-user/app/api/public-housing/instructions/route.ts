import {housingUpdateInstructions} from "@/lib/housing-update-instructions";
export function GET(){return Response.json(housingUpdateInstructions,{headers:{"Cache-Control":"no-store"}});}
