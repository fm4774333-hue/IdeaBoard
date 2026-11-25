(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const board = $("board"), viewport = $("boardViewport"), svg = $("connections");
  const state = {
    workspaces: [], activeId: null, zoom: 1, connectMode: false, connectFrom: null,
    roomRef: null, applyingRemote: false, saveTimer: null
  };
  const STORAGE_KEY = "ideaboard-v3";
  const STYLE_NAMES = ["sticky","rounded","minimal","glass","checklist","heading","dark","gradient"];
  const uid = () => "item-" + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
  const current = () => state.workspaces.find(w => w.id === state.activeId);
  const defaultWorkspace = () => ({id:uid(),name:"Mein Arbeitsbereich",items:[],connections:[]});

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && Array.isArray(saved.workspaces) && saved.workspaces.length) {
        state.workspaces = saved.workspaces;
        state.activeId = saved.activeId || saved.workspaces[0].id;
      } else { const w=defaultWorkspace(); state.workspaces=[w]; state.activeId=w.id; }
    } catch (_) { const w=defaultWorkspace(); state.workspaces=[w]; state.activeId=w.id; }
    if (!current()) state.activeId=state.workspaces[0].id;
    renderWorkspaceList(); renderBoard();
  }

  function persist() {
    if (state.applyingRemote) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({workspaces:state.workspaces,activeId:state.activeId}));
      $("statusText").textContent=state.roomRef?"Team-Sync aktiv":"Lokal gespeichert";
    } catch (_) { $("statusText").textContent="Speicher voll – bitte Bilder verkleinern"; }
    if (state.roomRef) {
      clearTimeout(state.saveTimer);
      state.saveTimer=setTimeout(() => {
        const w=current(); if (!w || !state.roomRef) return;
        state.roomRef.set(w).catch(err => $("statusText").textContent="Sync-Fehler: "+err.message);
      },350);
    }
  }

  function renderWorkspaceList() {
    const select=$("workspaceSelect"); select.innerHTML="";
    state.workspaces.forEach(w => {
      const o=document.createElement("option"); o.value=w.id; o.textContent=w.name||"Unbenannt";
      o.selected=w.id===state.activeId; select.appendChild(o);
    });
  }
  function setWorkspace(id) {
    if (!state.workspaces.some(w=>w.id===id)) return;
    state.activeId=id; state.connectMode=false; state.connectFrom=null;
    $("connectBtn").classList.remove("active");
    renderWorkspaceList(); renderBoard(); persist();
  }
  function renderBoard() {
    board.querySelectorAll(".board-item").forEach(el=>el.remove());
    svg.querySelectorAll(".connection-line").forEach(el=>el.remove());
    const w=current(); if (!w) return;
    w.items ||= []; w.connections ||= [];
    $("boardTitle").value=w.name||"";
    $("emptyHint").style.display=w.items.length?"none":"block";
    w.items.forEach(item=>createElement(item,false));
    drawConnections();
  }

  function watchSize(el,item) {
    if (!("ResizeObserver" in window)) return;
    let lastW=0,lastH=0;
    const observer=new ResizeObserver(entries=>{
      const r=entries[0].contentRect;
      const width=Math.round(r.width),height=Math.round(r.height);
      if (Math.abs(width-lastW)>2 || Math.abs(height-lastH)>2) {
        lastW=width;lastH=height;
        item.width=width;item.height=height;
        persist();
      }
    });
    observer.observe(el);
    el._sizeObserver=observer;
  }

  function applyNoteColor(el,item) {
    if (item.style === "gradient") {
      el.style.background = `linear-gradient(135deg, color-mix(in srgb, ${item.color || "#d9d6ff"} 62%, white), ${item.color || "#d9d6ff"})`;
    } else {
      el.style.backgroundColor = item.color || "#fff1a8";
      el.style.backgroundImage = "none";
    }
  }

  function createElement(item,save=true) {
    let el;
    if (item.type==="note") {
      el=$("noteTemplate").content.firstElementChild.cloneNode(true);
      item.style=STYLE_NAMES.includes(item.style)?item.style:"sticky";
      el.classList.add("style-"+item.style);
      el.querySelector(".note-heading").value=item.heading||"";
      el.querySelector(".note-body").value=item.text||"";
      el.querySelector(".style-select").value=item.style;
      el.querySelector(".color-input").value=item.color||"#fff1a8";
      applyNoteColor(el,item);
      el.querySelector(".style-select").addEventListener("change",e=>{
        item.style=e.target.value;
        el.className="board-item note-card style-"+item.style;
        applyNoteColor(el,item);
        persist();
      });
      el.querySelector(".color-input").addEventListener("input",e=>{
        item.color=e.target.value;
        applyNoteColor(el,item);
        persist();
      });
      el.querySelector(".note-heading").addEventListener("input",e=>{item.heading=e.target.value;persist();});
      el.querySelector(".note-body").addEventListener("input",e=>{item.text=e.target.value;persist();});
      el.querySelector(".item-menu").addEventListener("click",()=>{
        const s=el.querySelector(".style-select");s.focus();s.click();
      });
    } else if(item.type==="shape") {
      el=$("shapeTemplate").content.firstElementChild.cloneNode(true);
      el.classList.add("shape-"+item.shape);
      el.querySelector(".shape-text").value=item.text||"";
      el.querySelector(".shape-text").addEventListener("input",e=>{item.text=e.target.value;persist();});
    } else if(item.type==="image") {
      el=$("imageTemplate").content.firstElementChild.cloneNode(true);
      el.querySelector(".board-image").src=item.src;
      el.querySelector(".image-caption").value=item.caption||"";
      el.querySelector(".image-caption").addEventListener("input",e=>{item.caption=e.target.value;persist();});
    } else return;

    el.dataset.id=item.id;
    el.style.left=(item.x||0)+"px";el.style.top=(item.y||0)+"px";
    if(item.width)el.style.width=item.width+"px";
    if(item.height)el.style.height=item.height+"px";

    // Text fields remain fully editable: only the dedicated top bar moves notes/images.
    el.addEventListener("pointerdown",e=>{
      if(state.connectMode){e.stopPropagation();chooseConnection(item.id);return;}
      if(e.target.closest("input,textarea,select,button"))return;
      selectItem(el);
    });
    const handle=el.querySelector(".drag-handle");
    if(handle)handle.addEventListener("pointerdown",e=>{
      if(e.target.closest("input,textarea,select,button"))return;
      startDrag(e,el,item);
    });
    if(item.type==="shape"){
      const shapeSurface=el.querySelector(".shape-inner");
      shapeSurface.addEventListener("pointerdown",e=>{
        if(e.target.closest("input,textarea,select,button"))return;
        startDrag(e,el,item);
      });
    }
    el.querySelectorAll(".delete-item").forEach(btn=>btn.addEventListener("click",()=>deleteItemById(item.id)));
    board.appendChild(el);
    watchSize(el,item);
    if(save){current().items.push(item);updateEmpty();persist();}
    return el;
  }

  function deleteItemById(id) {
    const w=current(); if(!w) return;
    w.items=w.items.filter(x=>x.id!==id);
    w.connections=w.connections.filter(c=>c.from!==id&&c.to!==id);
    const el=board.querySelector(`.board-item[data-id="${id}"]`);
    if(el){if(el._sizeObserver)el._sizeObserver.disconnect();el.remove();}
    board.querySelectorAll(".board-item.selected").forEach(x=>x.classList.remove("selected"));
    drawConnections();updateEmpty();persist();
  }

  function selectItem(el) {
    board.querySelectorAll(".board-item.selected").forEach(x=>x.classList.remove("selected"));
    el.classList.add("selected");
  }
  function startDrag(e,el,item) {
    if(e.button!==0||state.connectMode||e.target.closest("input,textarea,select,button"))return;
    e.preventDefault();e.stopPropagation();selectItem(el);
    const startX=e.clientX,startY=e.clientY,origX=item.x||0,origY=item.y||0;
    const move=ev=>{
      item.x=Math.max(0,origX+(ev.clientX-startX)/state.zoom);
      item.y=Math.max(0,origY+(ev.clientY-startY)/state.zoom);
      el.style.left=item.x+"px";el.style.top=item.y+"px";drawConnections();
    };
    const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);persist();};
    window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);
  }
  function updateEmpty(){ $("emptyHint").style.display=current().items.length?"none":"block"; }
  function boardPosition(x=150,y=130){return {x:viewport.scrollLeft/state.zoom+x,y:viewport.scrollTop/state.zoom+y};}

  function addNote() {
    const p=boardPosition();
    createElement({id:uid(),type:"note",...p,heading:"Neue Idee",text:"",style:"sticky",color:"#fff1a8"},true);
    const el=board.querySelector(".board-item:last-child");
    if(el)el.querySelector(".note-body").focus();
  }
  function addShape(shape) {
    const p=boardPosition(200,180);
    createElement({id:uid(),type:"shape",shape,...p,text:"Dein Text"},true);
  }
  function drawConnections() {
    svg.querySelectorAll(".connection-line").forEach(el=>el.remove());
    const w=current();if(!w)return;
    (w.connections||[]).forEach(c=>{
      const a=w.items.find(i=>i.id===c.from),b=w.items.find(i=>i.id===c.to);if(!a||!b)return;
      const ax=(a.x||0)+(a.width||180)/2,ay=(a.y||0)+(a.height||130)/2;
      const bx=(b.x||0)+(b.width||180)/2,by=(b.y||0)+(b.height||130)/2;
      const path=document.createElementNS("http://www.w3.org/2000/svg","path");
      const mid=(ax+bx)/2;
      path.setAttribute("d",`M ${ax} ${ay} C ${mid} ${ay}, ${mid} ${by}, ${bx} ${by}`);
      path.setAttribute("class","connection-line conn-"+(c.style||"arrow"));
      if(c.style==="arrow"||!c.style)path.setAttribute("marker-end","url(#arrowhead)");
      if(c.style==="double"){path.setAttribute("marker-start","url(#arrowstart)");path.setAttribute("marker-end","url(#arrowhead)");}
      svg.appendChild(path);
    });
  }
  function chooseConnection(id) {
    if(!state.connectFrom){state.connectFrom=id;$("statusText").textContent="Jetzt das Zielelement anklicken";return;}
    if(state.connectFrom!==id){
      current().connections.push({from:state.connectFrom,to:id,style:$("connectionStyle").value});
      drawConnections();persist();
    }
    state.connectFrom=null;state.connectMode=false;$("connectBtn").classList.remove("active");
    $("statusText").textContent=state.roomRef?"Team-Sync aktiv":"Lokal gespeichert";
  }
  function addMindmap() {
    const p=boardPosition(450,320),cx=p.x,cy=p.y,w=current();
    const center={id:uid(),type:"note",x:cx,y:cy,heading:"Zentrales Thema",text:"Worum geht es?",style:"gradient",color:"#d9d6ff"};
    const branches=[
      {x:cx-330,y:cy-170,heading:"Idee 1",text:"Erster Gedanke",style:"rounded"},
      {x:cx+330,y:cy-170,heading:"Idee 2",text:"Zweiter Gedanke",style:"rounded"},
      {x:cx-330,y:cy+190,heading:"Idee 3",text:"Dritter Gedanke",style:"rounded"},
      {x:cx+330,y:cy+190,heading:"Idee 4",text:"Vierter Gedanke",style:"rounded"}
    ].map(p=>({id:uid(),type:"note",...p,color:"#ffffff"}));
    [center,...branches].forEach(i=>createElement(i,true));
    branches.forEach(i=>w.connections.push({from:center.id,to:i.id,style:"arrow"}));
    drawConnections();persist();
  }
  function setZoom(value) {
    state.zoom=Math.max(.35,Math.min(1.8,value));
    board.style.transform=`scale(${state.zoom})`;
    $("zoomLabel").textContent=Math.round(state.zoom*100)+"%";
  }

  function compressImage(file) {
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onerror=reject;
      reader.onload=()=>{
        const img=new Image();img.onerror=reject;
        img.onload=()=>{
          const max=1500,scale=Math.min(1,max/Math.max(img.width,img.height));
          const canvas=document.createElement("canvas");
          canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
          canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
          resolve(canvas.toDataURL("image/jpeg",.78));
        };
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  async function uploadImage(file) {
    if(!file||!file.type.startsWith("image/"))return;
    try{
      const src=await compressImage(file),p=boardPosition(180,150);
      createElement({id:uid(),type:"image",...p,src,caption:file.name||"Eingefügtes Bild"},true);
    }catch(_){alert("Das Bild konnte nicht geladen werden.");}
  }
  function newWorkspace() {
    const name=prompt("Wie soll der neue Arbeitsbereich heißen?","Neuer Arbeitsbereich");
    if(name===null)return;
    const w=defaultWorkspace();w.name=name.trim()||"Neuer Arbeitsbereich";
    state.workspaces.push(w);state.activeId=w.id;renderWorkspaceList();renderBoard();persist();
  }
  function connectTeam() {
    const msg=$("teamMessage");msg.textContent="";
    if(!window.firebase||!firebase.database){msg.textContent="Firebase konnte nicht geladen werden. Prüfe deine Internetverbindung.";return;}
    let config,room=$("teamRoom").value.trim();
    try{config=JSON.parse($("firebaseConfig").value);}catch(_){msg.textContent="Die Firebase-Konfiguration ist kein gültiges JSON.";return;}
    if(!config.databaseURL||!config.apiKey){msg.textContent="Bitte apiKey und databaseURL eintragen.";return;}
    if(!room){msg.textContent="Bitte eine gemeinsame Board-ID eingeben.";return;}
    try{
      if(!firebase.apps.length)firebase.initializeApp(config);
      if(state.roomRef)state.roomRef.off();
      state.roomRef=firebase.database().ref("ideaboard-rooms/"+room);
      state.roomRef.once("value").then(snapshot=>{
        if(snapshot.exists()){
          const remote=snapshot.val();
          if(remote&&Array.isArray(remote.items)){
            state.applyingRemote=true;const idx=state.workspaces.findIndex(w=>w.id===state.activeId);
            remote.id=current().id;remote.name=remote.name||current().name;state.workspaces[idx]=remote;
            renderBoard();state.applyingRemote=false;
          }
        }else state.roomRef.set(current());
        state.roomRef.on("value",snap=>{
          const remote=snap.val();if(!remote||!Array.isArray(remote.items))return;
          if(JSON.stringify(remote)===JSON.stringify(current()))return;
          state.applyingRemote=true;const idx=state.workspaces.findIndex(w=>w.id===state.activeId);
          remote.id=current().id;state.workspaces[idx]=remote;renderBoard();state.applyingRemote=false;
          $("statusText").textContent="Team-Sync aktiv";
        });
        msg.textContent="Verbunden! Nutze dieselbe Board-ID auf den anderen Geräten.";
        $("statusText").textContent="Team-Sync aktiv";
      }).catch(err=>{msg.textContent="Verbindung fehlgeschlagen: "+err.message;state.roomRef=null;});
    }catch(e){msg.textContent="Firebase-Fehler: "+e.message;state.roomRef=null;}
  }
  function disconnectTeam() {
    if(state.roomRef)state.roomRef.off();
    state.roomRef=null;$("teamMessage").textContent="Team-Modus getrennt. Lokale Kopie bleibt erhalten.";
    $("statusText").textContent="Lokal gespeichert";
  }

  $("addNoteBtn").addEventListener("click",addNote);
  $("emptyAddBtn").addEventListener("click",addNote);
  $("addShapeBtn").addEventListener("click",()=>$("shapeDialog").showModal());
  $("shapeDialog").querySelectorAll("[data-shape]").forEach(btn=>btn.addEventListener("click",e=>{
    e.preventDefault();$("shapeDialog").close();addShape(btn.dataset.shape);
  }));
  $("addImageBtn").addEventListener("click",()=>$("imageInput").click());
  $("imageInput").addEventListener("change",e=>{uploadImage(e.target.files[0]);e.target.value="";});
  $("connectBtn").addEventListener("click",()=>{
    state.connectMode=!state.connectMode;state.connectFrom=null;
    $("connectBtn").classList.toggle("active",state.connectMode);
    $("statusText").textContent=state.connectMode?"Erstes Element anklicken":"Verbindungsmodus beendet";
  });
  $("mindmapBtn").addEventListener("click",addMindmap);
  $("zoomInBtn").addEventListener("click",()=>setZoom(state.zoom+.1));
  $("zoomOutBtn").addEventListener("click",()=>setZoom(state.zoom-.1));
  $("resetViewBtn").addEventListener("click",()=>{setZoom(1);viewport.scrollTo({left:0,top:0,behavior:"smooth"});});
  $("newWorkspaceBtn").addEventListener("click",newWorkspace);
  $("workspaceSelect").addEventListener("change",e=>setWorkspace(e.target.value));
  $("boardTitle").addEventListener("input",e=>{current().name=e.target.value;renderWorkspaceList();persist();});
  $("exportBtn").addEventListener("click",()=>window.print());
  $("teamBtn").addEventListener("click",()=>$("teamDialog").showModal());
  $("connectTeamBtn").addEventListener("click",connectTeam);
  $("disconnectTeamBtn").addEventListener("click",disconnectTeam);
  viewport.addEventListener("click",e=>{
    if(e.target===viewport||e.target===board)board.querySelectorAll(".board-item.selected").forEach(x=>x.classList.remove("selected"));
  });

  // Paste an image from the clipboard with Ctrl+V / Cmd+V.
  document.addEventListener("paste",e=>{
    const items=e.clipboardData&&e.clipboardData.items;
    if(!items)return;
    for(const clipboardItem of items){
      if(clipboardItem.type&&clipboardItem.type.startsWith("image/")){
        const file=clipboardItem.getAsFile();
        if(file){e.preventDefault();uploadImage(file);}
        return;
      }
    }
  });

  // Board theme selection is independent from individual note styles.
  const BOARD_THEME_KEY="ideaboard-board-theme";
  function setBoardTheme(theme){
    const allowed=["light","dark","warm","ocean","lavender"];
    if(!allowed.includes(theme))theme="light";
    document.body.dataset.boardTheme=theme;
    try{localStorage.setItem(BOARD_THEME_KEY,theme);}catch(_){}
    document.querySelectorAll("[data-board-theme]").forEach(btn=>btn.classList.toggle("active",btn.dataset.boardTheme===theme));
  }
  $("boardDesignBtn").addEventListener("click",()=>$("boardDesignDialog").showModal());
  document.querySelectorAll("[data-board-theme]").forEach(btn=>btn.addEventListener("click",()=>setBoardTheme(btn.dataset.boardTheme)));
  try{setBoardTheme(localStorage.getItem(BOARD_THEME_KEY)||"light");}catch(_){setBoardTheme("light");}

  // Delete the selected board object with Delete/Backspace, but never while typing.
  document.addEventListener("keydown",e=>{
    if(e.key!=="Delete"&&e.key!=="Backspace")return;
    const target=e.target;
    if(target.closest("input,textarea,select,[contenteditable='true']"))return;
    const selected=board.querySelector(".board-item.selected");
    if(!selected)return;
    e.preventDefault();deleteItemById(selected.dataset.id);
  });

  window.addEventListener("beforeunload",persist);
  load();setZoom(1);
})();