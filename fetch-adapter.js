/* Indkøbspiloten B5i-A – browser HTTP adapter, offline-testable by dependency injection.
   No default fetch, URL, token or AI access: the caller must inject all three.
   Current B5i demo injects fakeFetch ONLY. Never log or persist Turnstile tokens. */
(function(){
"use strict";

const MAX_TEXT_CHARS=360;
const MAX_TOKEN_CHARS=2048;
const MAX_RESPONSE_BYTES=20000;
const ALLOWED_HTTP_ERRORS=new Set([400,401,403,404,408,413,415,422,429,500,502,503,504]);

class ClientError extends Error {
 constructor(code){super(code);this.name="B5iClientError";this.code=code;}
}
function validEndpoint(value){
 if(typeof value!=="string")return false;
 try{
  const url=new URL(value);
  return url.protocol==="https:"&&url.hostname.length>0&&
    url.pathname==="/api/interpret"&&!url.search&&!url.hash&&
    !url.username&&!url.password&&url.href===value;
 }catch{return false;}
}
function validText(value){
 return typeof value==="string"&&value.trim().length>0&&
   value.length<=MAX_TEXT_CHARS&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}
function validToken(value){
 return typeof value==="string"&&value.trim().length>0&&value.length<=MAX_TOKEN_CHARS;
}
function validJSONContentType(response){
 const value=response.headers.get("content-type")||"";
 return /^application\/json(?:\s*;|\s*$)/i.test(value);
}
/* This method is deliberately separate from window.fetch. No network occurs unless
   a future, separately authorized integration explicitly injects real fetch. */
function createClient({endpoint,fetchImpl,getTurnstileToken}={}){
 if(!validEndpoint(endpoint))throw new ClientError("INVALID_ENDPOINT");
 if(typeof fetchImpl!=="function")throw new ClientError("FETCH_NOT_INJECTED");
 if(typeof getTurnstileToken!=="function")throw new ClientError("TOKEN_PROVIDER_MISSING");
 return Object.freeze({
  async interpret(text){
   if(!validText(text))throw new ClientError("INVALID_INPUT");
   let token;
   try{token=await getTurnstileToken();}
   catch{throw new ClientError("TOKEN_UNAVAILABLE");}
   if(!validToken(token))throw new ClientError("TOKEN_UNAVAILABLE");
   const options={
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({text,turnstileToken:token})
   };
   let response;
   try{response=await fetchImpl(endpoint,options);}
   catch{throw new ClientError("NETWORK_UNAVAILABLE");}
   if(!(response instanceof Response))throw new ClientError("INVALID_RESPONSE");
   if(!response.ok){
    const code=ALLOWED_HTTP_ERRORS.has(response.status)?"HTTP_"+response.status:"HTTP_OTHER";
    throw new ClientError(code);
   }
   if(!validJSONContentType(response))throw new ClientError("INVALID_CONTENT_TYPE");
   const declared=response.headers.get("content-length");
   if(declared!==null&&Number.isFinite(Number(declared))&&
     Number(declared)>MAX_RESPONSE_BYTES)throw new ClientError("RESPONSE_TOO_LARGE");
   let raw;
   try{raw=await response.text();}
   catch{throw new ClientError("INVALID_RESPONSE");}
   if(new TextEncoder().encode(raw).length>MAX_RESPONSE_BYTES)
    throw new ClientError("RESPONSE_TOO_LARGE");
   let parsed;
   try{parsed=JSON.parse(raw);}
   catch{throw new ClientError("INVALID_JSON");}
   // The existing UI validates fields, IDs, quantities and source_text next.
   if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)||
     Object.keys(parsed).sort().join()!=="matches,unresolved"||
     !Array.isArray(parsed.matches)||!Array.isArray(parsed.unresolved))
     throw new ClientError("INVALID_MODEL_RESULT");
   return parsed;
  }
 });
}
window.HR_B5I_FETCH=Object.freeze({createClient,ClientError});
})();