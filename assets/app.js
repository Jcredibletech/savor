(function(){
"use strict";
const GROUPS=["Burgers","Mexican","Coffee/Cafe","Sandwich/Deli","Pizza","Other/Unknown","American","Chicken","Bakery/Dessert","BBQ","Chinese","Japanese/Sushi","Seafood","Steakhouse","Italian","Breakfast/Brunch","Southern/Soul","Thai","Mediterranean/Greek","Vietnamese","Indian","Cajun"];
const LABEL={green:"Green",yellow:"Yellow",red:"Red",unknown:"Unknown",closed:"Closed",none:"Not yet rated"};
const COLOR={green:"#22a45d",yellow:"#f0b400",red:"#e03b36",unknown:"#8d8aa0",closed:"#3b3446",none:"#b9b2c6"};
const ORDER={green:0,yellow:1,red:2,unknown:3,closed:4,none:5};
const DEFAULTS={cuisine:"Mexican",zip:"72734",radius:"30",rating:"all"};
const PAGE=60;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,"")}catch(e){return u}};
function hav(a,b,c,d){const R=3958.8,t=Math.PI/180,x=(c-a)*t,y=(d-b)*t;const h=Math.sin(x/2)**2+Math.cos(a*t)*Math.cos(c*t)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h));}

let DATA=[],RAT={},ZIPS={},META={},applied={...DEFAULTS},list=[],shown=0,markers={};
const map=L.map("map",{zoomControl:true,scrollWheelZoom:true}).setView([34.8,-92.4],7);
L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",{maxZoom:19,subdomains:"abc",
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (ODbL) · tiles style by <a href="https://www.hotosm.org/" target="_blank">Humanitarian OSM Team</a>, hosted by <a href="https://openstreetmap.fr/" target="_blank">OSM France</a>'}).addTo(map);
const cluster=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:45,spiderfyOnMaxZoom:true,disableClusteringAtZoom:15});
map.addLayer(cluster);
let ring=null,center=null;

function town(r){return r.city||(RAT[r.id]&&RAT[r.id].town)||"";}
function ratingOf(r){return RAT[r.id]?RAT[r.id].rating:"none";}
function pill(k){return `<span class="pill ${k}">${LABEL[k]}</span>`;}
function where(r){const t=town(r);return `${t?esc(t):"Town unknown"}${r.zip?" · "+esc(r.zip):""}${r.dist!=null?` · ${r.dist.toFixed(1)} mi`:""}`;}
function links(r,withSources){
  let h="";const rt=RAT[r.id];
  if(withSources&&rt){rt.sources.forEach(u=>{h+=`<a class="chip src" href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`;});}
  if(r.website)h+=`<a class="chip" href="${esc(r.website)}" target="_blank" rel="noopener">Website</a>`;
  h+=`<a class="chip" href="https://www.openstreetmap.org/${esc(r.id)}" target="_blank" rel="noopener">OSM record</a>`;
  return h;
}
function body(r){
  const k=ratingOf(r),rt=RAT[r.id];
  return `<div class="row">${pill(k)}<span class="tag">${esc(r.cuisine)}</span></div>
  <div class="meta">${where(r)}</div>
  ${r.address?`<div class="meta">${esc(r.address)}</div>`:""}
  ${rt?`<p class="reason">${esc(rt.reason)}</p><div class="meta small">Rated ${esc(rt.date)} · run: ${esc(rt.run)}</div>`:`<p class="reason muted">No research run has covered this place yet.</p>`}
  <div class="chips">${links(r,true)}</div>`;
}
function popupHtml(r){return `<div class="pop"><h4>${esc(r.name)}</h4>${body(r)}</div>`;}

function readForm(){return {cuisine:$("fCuisine").value,zip:$("fZip").value.trim(),radius:$("fRadius").value,rating:$("fRating").value};}
function setForm(s){$("fCuisine").value=s.cuisine;$("fZip").value=s.zip;$("fRadius").value=s.radius;$("fRating").value=s.rating;}
function same(a,b){return a.cuisine===b.cuisine&&a.zip===b.zip&&a.radius===b.radius&&a.rating===b.rating;}
function checkPending(){const p=!same(readForm(),applied);$("pending").hidden=!p;$("btnSubmit").classList.toggle("attn",p);}

function apply(s){
  $("zipErr").hidden=true;
  let c=null;
  if(s.zip){
    if(!/^\d{5}$/.test(s.zip)||!ZIPS[s.zip]){$("zipErr").textContent=`ZIP ${s.zip} isn't a known Arkansas ZIP (2020 Census ZCTA). Nothing was changed.`;$("zipErr").hidden=false;return false;}
    c=ZIPS[s.zip];
  }
  applied={...s};
  const rad=+s.radius;
  list=DATA.filter(r=>s.cuisine==="All"||r.cuisine===s.cuisine).map(r=>{const o=Object.assign({},r);o.dist=c?hav(c[0],c[1],r.lat,r.lon):null;return o;})
    .filter(r=>!c||r.dist<=rad)
    .filter(r=>{const k=ratingOf(r);return s.rating==="all"||(s.rating==="rated"?k!=="none":k===s.rating);});
  // map
  cluster.clearLayers();markers={};
  if(ring){map.removeLayer(ring);ring=null;} if(center){map.removeLayer(center);center=null;}
  const ms=list.map(r=>{const k=ratingOf(r);
    const m=L.circleMarker([r.lat,r.lon],{radius:k==="none"?6:8,color:k==="closed"?COLOR.closed:"#fff",weight:k==="closed"?3:2,fillColor:k==="closed"?"#fff":COLOR[k],fillOpacity:1});
    m.bindPopup(()=>popupHtml(r),{maxWidth:320});markers[r.id]=m;return m;});
  cluster.addLayers(ms);
  if(c){ring=L.circle(c,{radius:rad*1609.34,color:"#e4572e",weight:2,dashArray:"6 6",fill:true,fillOpacity:.04}).addTo(map);
    center=L.circleMarker(c,{radius:6,color:"#fff",weight:2,fillColor:"#1f1530",fillOpacity:1}).bindTooltip(`ZIP ${s.zip} center`).addTo(map);
    map.fitBounds(ring.getBounds(),{padding:[20,20]});}
  else if(ms.length){map.fitBounds(L.latLngBounds(list.map(r=>[r.lat,r.lon])),{padding:[20,20],maxZoom:13});}
  else map.setView([34.8,-92.4],7);
  // summary + banner
  const cu=s.cuisine==="All"?"restaurants":`${s.cuisine} places`;
  const scope=c?`within ${rad} mi of ${s.zip}`:"statewide";
  const rated=list.filter(r=>ratingOf(r)!=="none").length;
  $("resTitle").textContent=`${list.length.toLocaleString()} ${cu} ${scope}`;
  $("resSub").textContent=`${rated} rated · ${list.length-rated} not yet rated${s.rating!=="all"?` · rating filter: ${$("fRating").selectedOptions[0].text}`:""}`;
  const b=$("banner");
  if(list.length===0){b.innerHTML=`No ${esc(cu)} found ${esc(scope)} in the OSM dataset${s.rating!=="all"?" with this rating filter":""}. Try a larger radius.`;b.hidden=false;}
  else if(rated===0){b.innerHTML=`<b>No rating run yet for ${esc(s.cuisine==="All"?"these restaurants":s.cuisine)} ${c?"near "+esc(s.zip):"statewide"}</b>. Ask Savor to run one. Every place below comes from OpenStreetMap and is marked <i>Not yet rated</i>.`;b.hidden=false;}
  else if(rated<list.length&&s.rating==="all"){b.innerHTML=`${rated} of ${list.length} here have been rated so far. The rest are marked <i>Not yet rated</i>.`;b.hidden=false;}
  else b.hidden=true;
  render(true);checkPending();
  return true;
}
function sorted(){const k=$("sort").value;const a=list.slice();
  if(k==="name")a.sort((x,y)=>x.name.localeCompare(y.name));
  else if(k==="rating")a.sort((x,y)=>(ORDER[ratingOf(x)]-ORDER[ratingOf(y)])||((x.dist||0)-(y.dist||0))||x.name.localeCompare(y.name));
  else a.sort((x,y)=>x.dist!=null?(x.dist-y.dist):x.name.localeCompare(y.name));
  return a;}
let cur=[];
function render(reset){
  if(reset){cur=sorted();shown=0;$("cards").innerHTML="";}
  const frag=document.createDocumentFragment();
  cur.slice(shown,shown+PAGE).forEach(r=>{const k=ratingOf(r);const d=document.createElement("article");d.className="card "+k;
    d.innerHTML=`<h4>${esc(r.name)}</h4>${body(r)}`;
    d.addEventListener("click",e=>{if(e.target.closest("a"))return;const m=markers[r.id];if(!m)return;
      document.getElementById("map").scrollIntoView({behavior:"smooth",block:"center"});cluster.zoomToShowLayer(m,()=>m.openPopup());});
    frag.appendChild(d);});
  $("cards").appendChild(frag);shown=Math.min(shown+PAGE,cur.length);
  $("btnMore").hidden=shown>=cur.length;$("btnMore").textContent=`Show more (${(cur.length-shown).toLocaleString()} left)`;
}

function initStatic(){
  const total=META.total;const p=META.progress||{};
  const rated=(typeof p.rated==="number"?p.rated:(typeof p.done==="number"?p.done:META.rated));
  const tot=(typeof p.total==="number"?p.total:total);
  $("statTotal").textContent=total.toLocaleString();$("statRated").textContent=rated.toLocaleString();
  $("progBar").style.width=Math.min(100,rated/tot*100).toFixed(1)+"%";
  $("progLabel").textContent=`${rated.toLocaleString()} of ${tot.toLocaleString()} rated so far${p.updated?` · progress updated ${p.updated}`:""}`;
  $("osmTs").textContent=META.osm_timestamp?new Date(META.osm_timestamp).toLocaleString("en-US",{timeZone:"America/Chicago",dateStyle:"medium",timeStyle:"short"})+" CT":"unknown";
  $("buildInfo").textContent=`Data built ${META.built} from ${META.runs.length} rating run file(s).`;
  const by={};DATA.forEach(r=>{by[r.cuisine]=(by[r.cuisine]||0)+1;});const mx=Math.max(...Object.values(by));
  $("cuisineBars").innerHTML=Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="barrow"><span>${esc(k)}</span><div class="b" style="width:${(v/mx*100).toFixed(1)}%"></div><span class="v">${v}</span></div>`).join("");
  $("gaps").innerHTML=(META.osm_gaps||[]).map(g=>`<li><b>${esc(g.name)}</b>, ${esc(g.town)}. <a href="${esc(g.source)}" target="_blank" rel="noopener">source</a></li>`).join("")||"<li>None recorded yet.</li>";
  const sel=$("fCuisine");sel.innerHTML=`<option value="All">All cuisines</option>`+GROUPS.map(g=>`<option value="${esc(g)}">${esc(g)} (${by[g]||0})</option>`).join("");
}

Promise.all(["data/restaurants.json","data/ratings.json","data/zips.json","data/meta.json"].map(u=>fetch(u,{cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error(u+" "+r.status);return r.json();})))
.then(([rs,rt,zp,mt])=>{
  const f=rs.fields;DATA=rs.rows.map(a=>{const o={};f.forEach((k,i)=>o[k]=a[i]);return o;});
  RAT={};Object.entries(rt).forEach(([k,v])=>{if(v.in_dataset)RAT[k]=v;});ZIPS=zp;META=mt;
  initStatic();setForm(DEFAULTS);apply(DEFAULTS);window.SAVOR_READY=true;
}).catch(e=>{$("banner").hidden=false;$("banner").textContent="Could not load data: "+e.message;});

$("btnSubmit").addEventListener("click",()=>apply(readForm()));
$("btnReset").addEventListener("click",()=>{setForm(DEFAULTS);apply(DEFAULTS);});
$("fZip").addEventListener("keydown",e=>{if(e.key==="Enter")apply(readForm());});
["fCuisine","fZip","fRadius","fRating"].forEach(id=>{$(id).addEventListener("input",checkPending);$(id).addEventListener("change",checkPending);});
$("sort").addEventListener("change",()=>render(true));
$("btnMore").addEventListener("click",()=>render(false));
})();
