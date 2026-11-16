/* B5i-A ONLY – offline fakeFetch. NEVER invokes a browser/network fetch.
   This is not Turnstile verification, not a deployed backend and not an AI call.
   The fixed sentinel is an inert test value, NOT a credential or authorization. */
(function(){
"use strict";
const FAKE_ENDPOINT="https://b5i.invalid/api/interpret";
const FAKE_TOKEN="B5I_OFFLINE_FAKE_TOKEN_NOT_A_CREDENTIAL";
const respond=(data,status)=>new Response(JSON.stringify(data),{
 status,headers:{"content-type":"application/json","cache-control":"no-store"}
});
const isRecord=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const exact=(x,names)=>isRecord(x)&&Object.keys(x).length===names.length&&
 names.every(name=>Object.prototype.hasOwnProperty.call(x,name));

async function fakeFetch(url,options){
 // No global/window fetch here: the whole exchange stays in JavaScript memory.
 if(url!==FAKE_ENDPOINT)return respond({error:"NOT_FOUND"},404);
 if(options?.method!=="POST")return respond({error:"METHOD_NOT_ALLOWED"},405);
 if(options.headers?.["content-type"]!=="application/json")
  return respond({error:"UNSUPPORTED_MEDIA_TYPE"},415);
 if(typeof options.body!=="string"||
    new TextEncoder().encode(options.body).length>4096)
  return respond({error:"INVALID_REQUEST"},400);
 let payload;
 try{payload=JSON.parse(options.body);}
 catch{return respond({error:"INVALID_JSON"},400);}
 // This fake requires the FIELD that the real B3 security gate expects.
 // It merely compares to a constant; it DOES NOT validate Cloudflare Turnstile.
 if(!exact(payload,["text","turnstileToken"])||
    typeof payload.text!=="string")return respond({error:"INVALID_REQUEST"},400);
 if(payload.turnstileToken!==FAKE_TOKEN)
  return respond({error:"OFFLINE_TOKEN_REJECTED"},403);
 const request=new Request("https://b5h.invalid/api/interpret",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({text:payload.text})
 });
 return window.HR_B5H_API.localTransport(request);
}
const adapter=window.HR_B5I_FETCH.createClient({
 endpoint:FAKE_ENDPOINT,
 fetchImpl:fakeFetch,
 getTurnstileToken:()=>FAKE_TOKEN
});
window.HR_B5I_API=Object.freeze({
 cases:window.HR_B5H_API.cases,
 interpret:adapter.interpret
});
// For offline tests only: exposes a fixed fake token and fake function, not a key.
window.HR_B5I_OFFLINE=Object.freeze({fakeFetch,FAKE_ENDPOINT,FAKE_TOKEN});
})();