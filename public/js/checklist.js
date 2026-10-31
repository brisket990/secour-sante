// Check-list de prise de poste SMUR Beaujon, reprise de brisket990/checklist-smur.
// On saisit les relevés et les seuls points non conformes ; le bouton ouvre le
// Google Form pré-rempli dans le navigateur du téléphone (voir openExternal dans app.js).
// Pour mettre à jour un formulaire : modifier SECTIONS_UMH / SECTIONS_VL (identifiants entry.*).
(function () {
const OK2=["Pas d'anomalie","Dommages  constatés"], ON=["Oui","Non"], FCD=["Fonctionne correctement","Dysfonctionnement constaté"], FC=["Fonctionnement correct","Dysfonctionnement constaté"];
const g=(q,opts,rows)=>({q,opts,rows}), s=(id,label,opts)=>({q:null,opts,rows:[[id,label]]});
const SECTIONS_UMH=[
 {key:"ext",title:"Extérieur",dysf:594951105,groups:[
  g("Carrosserie, pare-brise, feux, plaques",OK2,[[1256418221,"Carrosserie"],[1210808495,"Pare-brise"],[746229853,"Feux"],[728473262,"Plaques d'immatriculation"]]),
  g("Rétroviseurs",["Fonctionnel","Dommages constatés"],[[234278902,"Droit (coque, miroirs, répétiteur)"],[1758394666,"Gauche (coque, miroirs, répétiteur)"]]),
  g("Pneumatiques",["Pas d'anomalie","Anomalies constatées"],[[1188680941,"Avant"],[1060115745,"Arrière"]]),
  s(152331360,"Trousseau de clés complet",ON),
  s(162416715,"Ouvrants et centralisation",["La commande centralisée fonctionne correctement","Dysfonctionnement constaté"])]},
 {key:"cab",title:"Cabine de conduite",dysf:1666272693,groups:[
  g("Niveaux",["Niveau correct","Autre"],[[754052419,"Huile"],[1100824517,"Liquide de refroidissement"],[774534022,"Liquide de frein"]]),
  s(26226311,"Carte carburant présente",ON),
  s(2075092397,"Ceintures cabine",FCD),
  s(1537642895,"Anomalie au démarrage",["Non","Oui (prévenir le cadre)"]),
  s(1776979519,"Voyant allumé après démarrage",["Non","Oui"]),
  s(1745355450,"Suspensions pneumatiques opérationnelles",["Oui","Non (prévenir le cadre )"]),
  s(976372694,"Frein à main fonctionnel",["Oui","Non (prévenir le cadre )"]),
  s(908590740,"GPS fonctionnel",ON),
  s(1990007051,"Documents de bord",ON),
  s(923992433,"Essai radio ANTARES",["Oui","Non","Pas de radio"]),
  s(545990755,"Gilet + triangle",ON),
  s(1010715509,"Ensemble des feux",ON),
  g("Avertisseurs lumineux",FC,[[1357858210,"Avant"],[235163406,"Arrière"],[852649899,"Latéraux"]]),
  s(752824467,"Avertisseurs sonores",["Fonctionnement correct","Dysfonctionnement constaté","Non réalisé"])]},
 {key:"tech",title:"Vérifications techniques",dysf:226010228,groups:[
  s(1843373358,"Tension batteries ≥ 12 V",ON),
  g("Prise Maréchal",ON,[[1704576891,"En bon état"],[363920779,"Voyant de présence allumé"]]),
  g("Prise DEFA",ON,[[144197717,"En bon état"],[1801467815,"Voyant de présence allumé"]]),
  g("Convertisseur",ON,[[670469855,"Branché : voyant charger"],[2006114969,"Moteur tournant : voyants inverter"]]),
  g("Trappe batteries auxiliaires",["oui","non","Non concerné"],[[1812431726,"Extincteur"],[838003111,"Rallonge DEFA"],[2122562629,"Rallonge Maréchal"],[913830129,"Tablette hoverboard"]]),
  g("Coffre technique",["Conforme","Non conforme","Absent"],[[487386083,"Lampe torche"],[1456331378,"Chargeur et batterie Stryker"],[1339595687,"Poste ANTARES TPH700"]]),
  g("Chaise portoir",ON,[[1670345500,"Chaise présente"],[2099138672,"Sangles présentes"],[1794357991,"Fonctionnement correct"]])]},
 {key:"cel",title:"Cellule sanitaire",dysf:1610253187,groups:[
  s(2012960360,"Éclairage",FC),
  g("Ventilation",FCD,[[1826347904,"Climatisation additionnelle"],[1576730776,"Chauffage additionnel"],[2084919961,"Aérateur"],[804554268,"Extracteur"]]),
  g("Sièges et ceintures",FCD,[[1664608336,"Rotation des sièges"],[1645612026,"Assises"],[1366709664,"Ceintures"]]),
  g("Réfrigérateur",FCD,[[1597973623,"Ouverture / fermeture"],[331375373,"Température (2–8 °C)"]]),
  g("Placards et tiroirs",FCD,[[293629216,"Tiroirs"],[1775711898,"Placards"],[1135315575,"Sangles maintien matériel"]]),
  g("Dispositifs médicaux",FCD,[[1741786643,"Mise en charge"],[314749919,"Fixation"]]),
  g("Immobilisation",ON,[[218827186,"MID"],[1057130220,"Colliers cervicaux"],[1506183739,"Attelles"]])]},
 {key:"bra",title:"Brancardage",dysf:1470284666,groups:[
  g("Table de brancard",["Fonctionne correctement","Dysfonctionnement constaté","Option non disponible"],[[1668485006,"Mode réanimation"],[895987680,"Mode amorti"],[317559945,"Latéralisation"]]),
  g("Power Load",FCD,[[1448732248,"Entrée / sortie"],[737831803,"Alimentation électrique"],[846660755,"Ancrage brancard"]]),
  s(382792176,"Brancard adulte",FCD)]},
 {key:"hyg",title:"Hygiène",dysf:null,groups:[
  s(1599317433,"Cabine de conduite",["Propre","Sale"]),
  g("Cellule sanitaire",["Propre","Sale"],[[1738866349,"Brancard / module"],[1747441855,"Table brancard"],[2003588848,"Parois"],[62840121,"Sol"]]),
  s(779481034,"Propreté de l'ambulance compatible accueil patient",ON)]}
];
const SECTIONS_VL=[
 {key:"ext",title:"Extérieur",dysf:594951105,groups:[
  g("Carrosserie, pare-brise, feux, plaques",OK2,[[1256418221,"Carrosserie"],[1210808495,"Pare-brise"],[746229853,"Feux"],[728473262,"Plaques d'immatriculation"]]),
  g("Rétroviseurs",["fonctionnel","domages constatés"],[[234278902,"Droit (coque, miroirs, répétiteur)"],[1758394666,"Gauche (coque, miroirs, répétiteur)"]]),
  g("Pneumatiques",["Pas d'anomalie","Anomalies constatées"],[[1188680941,"Avant"],[1060115745,"Arrière"]]),
  s(152331360,"Trousseau de clés complet",ON),
  s(162416715,"Ouvrants et centralisation",["La commande centralisée fonctionne correctement","Dysfonctionnement constaté"])]},
 {key:"cab",title:"Cabine de conduite",dysf:1666272693,groups:[
  g("Niveaux",["Niveau correct","Autre"],[[754052419,"Huile"],[1100824517,"Liquide de refroidissement"],[774534022,"Liquide de frein"],[1722641743,"Liquide de direction assistée"]]),
  s(26226311,"Carte carburant présente",ON),
  s(2075092397,"Ceintures cabine",FCD),
  s(1537642895,"Anomalie au démarrage",["Non","Oui (prévenir le cadre)"]),
  s(1776979519,"Voyant allumé après démarrage",["Non","Oui"]),
  s(976372694,"Frein à main fonctionnel",["Oui","Non (prévenir le cadre )"]),
  s(1462788997,"Blocage de différentiel sur AUTO",["Oui","Non (positionner le mode AUTO)"]),
  s(1990007051,"Documents de bord",ON),
  s(923992433,"Essai radio ANTARES",["Oui","Non","Pas de radio"]),
  s(1881478664,"Poste ANTARES TPH700 présent",ON),
  s(545990755,"Gilet + triangle",ON),
  s(1010715509,"Ensemble des feux",ON),
  g("Avertisseurs sonores et lumineux",FC,[[1357858210,"Dispositifs lumineux"],[235163406,"Dispositifs sonores"],[852649899,"Klaxon"]])]},
 {key:"tech",title:"Vérifications techniques",dysf:226010228,groups:[
  s(1843373358,"Tension batterie auxiliaire OK",ON),
  s(77799619,"Convertisseur",ON),
  g("Prise Maréchal",ON,[[1704576891,"En bon état"],[1307391942,"Rallonge présente"]])]},
 {key:"cof",title:"Coffre arrière",dysf:1610253187,groups:[
  s(2012960360,"Éclairage du coffre",FC),
  g("Réfrigérateur",FCD,[[1597973623,"Ouverture / fermeture"],[331375373,"Température"]]),
  g("Dispositifs médicaux",FCD,[[1893231087,"Mise en charge"],[1450204555,"Fixation"]]),
  g("Présence du matériel",["oui","non"],[[1324094993,"Sacs d'intervention"],[1881594965,"Colliers cervicaux"],[1509918754,"Dispositifs médicaux"]])]},
 {key:"hyg",title:"Hygiène et désinfection",dysf:null,groups:[
  g("Fait à la prise de poste",["oui","non"],[[1991747334,"Nettoyage et désinfection de la cabine"],[1094200444,"Lavage extérieur"],[1886546662,"Présence DASRI"]])]}
];

/* Quick fields: type text/num/select/chips; def = default value; req = required for sending */
const FORMS={
  umh:{
    label:"UMH", sub:"Ambulance de réanimation", tag:"SMUR Beaujon · UMH", title:"Check-list ARS",
    url:"https://docs.google.com/forms/d/e/1FAIpQLSeybrWXu5G6ExLghtE4ke0AKARzcojji_mBIo7-BudACzHAKg/viewform?usp=pp_url",
    quick:[
      {k:"aph",id:1909948002,label:"Numéro APH",type:"text",req:1,remember:1,half:1},
      {k:"umh",id:1068065150,label:"N° AP de l'UMH",type:"select",opts:["4048","4026","4011"],req:1,remember:1,half:1},
      {k:"amb",id:930596245,label:"Ambulance",type:"chips",opts:["BJN 02","BJN 03","BJN 04"],req:1,remember:1},
      {k:"km",id:1377107286,label:"Kilométrage",type:"num",req:1,half:1},
      {k:"o2",id:784180295,label:"Oxygène",unit:"L",type:"num",req:1,half:1},
      {k:"n2o",id:3464408,label:"Entonox",unit:"L, facultatif",type:"num"},
      {k:"fuel",id:1430786499,label:"Niveau de carburant",type:"chips",opts:["4/4","3/4","1/2","1/4","Réserve"],req:1},
      {k:"adblue",id:46293276,label:"AdBlue demandé",type:"chips",opts:["non","oui"],def:"non",half:1},
      {k:"dasri",id:2131243393,label:"DASRI",type:"chips",opts:["Vide","Plein"],def:"Vide",half:1}
    ],
    obs:380985160, nc:2139741352,
    sections:SECTIONS_UMH
  },
  vl:{
    label:"VL", sub:"VRIM", tag:"SMUR Beaujon · VL", title:"Check-list VRIM",
    url:"https://docs.google.com/forms/d/e/1FAIpQLSeKzzSveeEjKHS_H49fJ4UvFF7pxT26l1idTVEzxziPkvnLnA/viewform?usp=pp_url",
    quick:[
      {k:"aph",id:1909948002,label:"Numéro APH",type:"text",req:1,remember:1,half:1},
      {k:"umh",id:1068065150,label:"N° AP de l'UMH",type:"select",opts:["2301","2502","3355","3354"],req:1,remember:1,half:1},
      {k:"amb",id:930596245,label:"Affectation",type:"chips",opts:["BJN 01"],def:"BJN 01",req:1},
      {k:"km",id:1377107286,label:"Kilométrage",type:"num",req:1,half:1},
      {k:"o2",id:601129564,label:"Oxygène",unit:"L",type:"num",req:1,half:1},
      {k:"n2o",id:155163788,label:"Entonox",unit:"L",type:"num",req:1},
      {k:"fuel",id:1430786499,label:"Niveau de carburant",type:"chips",opts:["4/4","3/4","1/2","1/4","Réserve"],req:1}
    ],
    obs:380985160, nc:2132470082, ncOpts:["Non","Oui *"],
    sections:SECTIONS_VL
  }
};

const P="cl-";
const $=id=>document.getElementById(P+id);
const store={get(k){try{return localStorage.getItem("cl_"+k)}catch(e){return null}},set(k,v){try{localStorage.setItem("cl_"+k,v)}catch(e){}}};
const esc=v=>String(v).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
const view=document.getElementById("view-checklist");
let F=null, FK=null, profileAph="";

function chips(el,name,opts,def){
  el.innerHTML=opts.map(o=>`<label><input type="radio" name="${name}" value="${esc(o)}"${o===def?" checked":""}><span>${esc(o.replace(/\s+/g," ").trim())}</span></label>`).join("");
}
const val=name=>{const c=view.querySelector(`input[name="${CSS.escape(name)}"]:checked`);return c?c.value:""};
const qv=q=>q.type==="chips"?val("cl_q_"+q.k):($("q_"+q.k).value||"").trim();

/* menu */
$("picks").innerHTML=Object.entries({umh:{label:"UMH",sub:"Ambulance de réanimation (BJN 02, 03, 04)"},vl:{label:"VL",sub:"Véhicule léger (VRIM, BJN 01)"}})
  .map(([k,m])=>`<button class="cl-pick" type="button" data-k="${k}"${FORMS[k]?"":" disabled"}><b>${m.label}</b><span>${FORMS[k]?m.sub:m.sub+" · bientôt disponible"}</span></button>`).join("");
$("picks").addEventListener("click",e=>{const b=e.target.closest(".cl-pick");if(b&&!b.disabled)open(b.dataset.k)});
$("backBtn").addEventListener("click",()=>goBack());
function goBack(){if($("app").hidden)return false;$("app").hidden=true;$("menu").hidden=false;window.scrollTo(0,0);return true}

function open(k){
  F=FORMS[k]; FK=k;
  $("tag").textContent=F.tag; $("title").textContent=F.title;
  // quick fields
  let html="", buf=[];
  const flush=()=>{if(buf.length){html+=buf.length===2?`<div class="cl-row2">${buf.join("")}</div>`:buf.join("");buf=[]}};
  F.quick.forEach(q=>{
    const lab=`${esc(q.label)}${q.unit?` <small>(${esc(q.unit)})</small>`:""}`;
    let inner;
    if(q.type==="chips") inner=`<span class="cl-lbl">${lab}</span><div class="cl-chips" id="${P}q_${q.k}"></div>`;
    else if(q.type==="select") inner=`<label for="${P}q_${q.k}">${lab}</label><select id="${P}q_${q.k}"><option value="">Choisir</option>${q.opts.map(o=>`<option>${esc(o)}</option>`).join("")}</select>`;
    else inner=`<label for="${P}q_${q.k}">${lab}</label><input id="${P}q_${q.k}" type="${q.type==="num"?"number":"text"}" inputmode="numeric" autocomplete="off">`;
    const f=`<div class="cl-field">${inner}</div>`;
    if(q.half){buf.push(f);if(buf.length===2)flush()}else{flush();html+=f}
  });
  flush(); $("quickFields").innerHTML=html;
  F.quick.forEach(q=>{
    // Le numéro APH du profil prime sur la dernière valeur saisie sur ce téléphone
    const saved=(q.k==="aph"&&profileAph)||(q.remember?store.get(k+"_"+q.k):null);
    if(q.type==="chips") chips($("q_"+q.k),"cl_q_"+q.k,q.opts,saved||q.def||"");
    else $("q_"+q.k).value=saved||q.def||"";
  });
  // sections
  const host=$("sections"); host.innerHTML="";
  F.sections.forEach(sec=>{
    const d=document.createElement("details");
    let h=`<summary><h3>${sec.title}</h3><span class="cl-status" id="${P}st-${sec.key}"></span><span class="cl-chev" aria-hidden="true"></span></summary><div class="cl-body">`;
    sec.groups.forEach(gr=>{
      h+=`<div class="cl-group">${gr.q?`<span class="cl-q">${gr.q}</span>`:""}`;
      gr.rows.forEach(([id,label])=>{h+=`<div class="cl-item" id="${P}it-${id}"><span class="cl-lbl">${label}</span><div class="cl-chips" data-id="${id}"></div></div>`});
      h+=`</div>`;
    });
    if(sec.dysf) h+=`<div class="cl-field cl-group"><label for="${P}df-${sec.key}">Nature des dysfonctionnements <small>(0 si aucun)</small></label><input id="${P}df-${sec.key}" type="text" value="0"><div class="cl-hint" id="${P}dh-${sec.key}" hidden>Écart signalé dans cette section : décris-le ici.</div></div>`;
    d.innerHTML=h+`</div>`; host.appendChild(d);
    sec.groups.forEach(gr=>gr.rows.forEach(([id])=>chips(d.querySelector(`[data-id="${id}"]`),"cl_e"+id,gr.opts,gr.opts[0])));
  });
  $("obs").value=""; $("obs-field").hidden=!F.obs;
  chips($("nc"),"cl_nc",F.ncOpts||["Non","Oui"],"Non"); $("nc-item").hidden=!F.nc;
  $("menu").hidden=true; $("app").hidden=false; window.scrollTo(0,0);
  update();
}

function update(){
  if(!F)return;
  const p=[]; const add=(id,v)=>{if(id&&v!==""&&v!=null)p.push("entry."+id+"="+encodeURIComponent(v))};
  const missing=[];
  F.quick.forEach(q=>{const v=qv(q); add(q.id,v); if(q.req&&!v)missing.push(q.label); if(q.remember&&v)store.set(FK+"_"+q.k,v);});
  let total=0, needText=[];
  F.sections.forEach(sec=>{
    let n=0;
    sec.groups.forEach(gr=>gr.rows.forEach(([id])=>{const v=val("cl_e"+id); add(id,v); const bad=v!==gr.opts[0]; $("it-"+id).classList.toggle("cl-flag",bad); if(bad)n++;}));
    if(sec.dysf){const t=$("df-"+sec.key).value.trim()||"0"; add(sec.dysf,t); const m=n>0&&t==="0"; $("dh-"+sec.key).hidden=!m; if(m)needText.push(sec.title);}
    const st=$("st-"+sec.key); st.textContent=n?`${n} écart${n>1?"s":""}`:"Conforme"; st.classList.toggle("bad",n>0); total+=n;
  });
  if(F.obs) add(F.obs,$("obs").value.trim());
  if(F.nc){add(F.nc,val("cl_nc")); const bad=val("cl_nc")!=="Non"; $("nc-item").classList.toggle("cl-flag",bad); $("nc-hint").hidden=!bad;}
  const go=$("go"), msg=$("msg");
  if(missing.length){go.setAttribute("aria-disabled","true"); go.href="#"; msg.className="miss"; msg.textContent="À remplir : "+missing.join(", ");}
  else{go.removeAttribute("aria-disabled"); go.href=F.url+"&"+p.join("&");
    msg.className=needText.length?"miss":"";
    msg.textContent=needText.length?"Décris les écarts : "+needText.join(", "):(total?`${total} écart${total>1?"s":""} signalé${total>1?"s":""}. `:"Tout conforme. ")+"Ensuite : Suivant jusqu'à Envoyer.";}
}
view.addEventListener("input",update); view.addEventListener("change",update);
$("go").addEventListener("click",e=>{
  e.preventDefault();
  if($("go").getAttribute("aria-disabled")==="true")return;
  openExternal($("go").href);
});
$("reset").addEventListener("click",()=>{
  F.sections.forEach(sec=>{sec.groups.forEach(gr=>gr.rows.forEach(([id])=>{const r=view.querySelector(`input[name="cl_e${id}"][value="${CSS.escape(gr.opts[0])}"]`); if(r)r.checked=true})); if(sec.dysf)$("df-"+sec.key).value="0";});
  const n=view.querySelector('input[name="cl_nc"][value="Non"]'); if(n)n.checked=true; update();
});

window.Checklist={
  // Appelé à chaque ouverture de l'onglet avec le numéro APH du profil
  setAph(aph){
    profileAph=aph||"";
    const f=F&&document.getElementById(P+"q_aph");
    if(f&&profileAph&&!f.value){f.value=profileAph;update();}
  },
  back:goBack,
};
})();
