/* B5h – In-memory HTTP-style backend. NO external fetch, secrets, AI calls or deployment.
   The Request and Response API imitates POST /api/interpret for UI integration tests.
   The 7 fixtures below are copied unchanged from the accepted simulated AI UI. */
(function(){
"use strict";
const CASES=[
 {key:"multi",label:"Tre forskellige varer",input:"Jeg mangler mælk, rugbrød og æg",
  result:{matches:[{type:"product",id:"P014",source_text:"mælk",quantity:1},{type:"product",id:"P021",source_text:"rugbrød",quantity:1},{type:"product",id:"P015",source_text:"æg",quantity:1}],unresolved:[]}},
 {key:"quantity",label:"To pakker hakket oksekød",input:"Jeg vil købe 2 pakker hakket oksekød",
  result:{matches:[{type:"product",id:"P010",source_text:"hakket oksekød",quantity:2}],unresolved:[]}},
 {key:"mixed",label:"Rugbrød og uafklaret ost",input:"Jeg mangler rugbrød, men ved ikke hvilken ost",
  result:{matches:[{type:"product",id:"P021",source_text:"rugbrød",quantity:1}],unresolved:[{source_text:"ost",question:"Hvilken ost ønsker du?"}]}},
 {key:"repeatmilk",label:"Mælk nævnt to gange",input:"Jeg mangler mælk, rugbrød og mælk",
  result:{matches:[{type:"product",id:"P021",source_text:"rugbrød",quantity:1}],unresolved:[{source_text:"mælk",question:"Du har nævnt mælk flere gange. Hvor mange enheder ønsker du?"}]}},
 {key:"repeatbread",label:"Rugbrød nævnt to gange",input:"Jeg mangler rugbrød, æg og rugbrød",
  result:{matches:[{type:"product",id:"P015",source_text:"æg",quantity:1}],unresolved:[{source_text:"rugbrød",question:"Du har nævnt rugbrød flere gange. Hvor mange enheder ønsker du?"}]}},
 {key:"recipe",label:"Tacos og mælk",input:"Jeg skal lave tacos og købe mælk",
  result:{matches:[{type:"recipe",id:"R02",source_text:"tacos",quantity:1},{type:"product",id:"P014",source_text:"mælk",quantity:1}],unresolved:[]}},
 {key:"spaghetti",label:"Spaghetti – vare eller ret?",input:"Vi skal have spaghetti i aften",
  result:{matches:[],unresolved:[{source_text:"spaghetti",question:"Mener du varen spaghetti eller en bestemt ret med spaghetti?"}]}}
];
const BASE="https://b5h.invalid";
const BODY_LIMIT=2048;
const RESPONSE_LIMIT=16384;
const norm=s=>String(s).normalize("NFC").toLocaleLowerCase("da-DK").trim().replace(/\s+/g," ");
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const isRecord=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
function validText(x){return typeof x==="string"&&x.trim().length>0&&x.length<=360&&!/[\u0000-\u001f\u007f]/.test(x);}
async function localTransport(request){
  // This function uses ONLY in-memory Request/Response objects; it NEVER fetches.
  if(!(request instanceof Request))return json({error:"INVALID_REQUEST"},400);
  let url;try{url=new URL(request.url);}catch{return json({error:"INVALID_URL"},400);}
  if(url.origin!==BASE||url.pathname!=="/api/interpret"||url.search)return json({error:"NOT_FOUND"},404);
  if(request.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405);
  if(request.headers.get("content-type")!=="application/json")return json({error:"UNSUPPORTED_MEDIA_TYPE"},415);
  const len=Number(request.headers.get("content-length"));
  if(Number.isFinite(len)&&len>BODY_LIMIT)return json({error:"BODY_TOO_LARGE"},413);
  let raw;try{raw=await request.text();}catch{return json({error:"INVALID_JSON"},400);}
  if(new TextEncoder().encode(raw).byteLength>BODY_LIMIT)return json({error:"BODY_TOO_LARGE"},413);
  let body;try{body=JSON.parse(raw);}catch{return json({error:"INVALID_JSON"},400);}
  if(!isRecord(body)||Object.keys(body).length!==1||!Object.hasOwn(body,"text")||
     !validText(body.text))return json({error:"INVALID_REQUEST"},400);
  const scenario=CASES.find(c=>norm(c.input)===norm(body.text));
  if(!scenario)return json({error:"OFFLINE_SCENARIO_UNKNOWN"},422);
  return json(JSON.parse(JSON.stringify(scenario.result)));
}
async function interpret(text,{transport=localTransport}={}){
  if(!validText(text))throw new Error("INVALID_INPUT");
  if(typeof transport!=="function")throw new Error("INVALID_TRANSPORT");
  const request=new Request(BASE+"/api/interpret",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({text})
  });
  let response;
  try{response=await transport(request);}
  catch{throw new Error("BACKEND_UNAVAILABLE");}
  if(!(response instanceof Response))throw new Error("BACKEND_INVALID_RESPONSE");
  if(response.status===422)throw new Error("OFFLINE_SCENARIO_UNKNOWN");
  if(response.status!==200)throw new Error("BACKEND_HTTP_ERROR");
  let raw;try{raw=await response.text();}catch{throw new Error("BACKEND_INVALID_RESPONSE");}
  if(raw.length>RESPONSE_LIMIT)throw new Error("BACKEND_INVALID_RESPONSE");
  try{return JSON.parse(raw);}catch{throw new Error("BACKEND_INVALID_RESPONSE");}
}
window.HR_B5H_API=Object.freeze({
  cases:CASES,
  interpret,
  localTransport
});
})();