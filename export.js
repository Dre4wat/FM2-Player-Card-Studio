/** Draw the card without SVG foreignObject or a third-party CSS parser. */
export async function exportPlayerCard(card) {
  const bounds = card.getBoundingClientRect();
  if (!bounds.width) throw new Error("The card is not visible.");
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not create an image canvas.");
  const scale = 1080 / bounds.width;
  const style = getComputedStyle(card);
  const team = style.getPropertyValue("--team").trim() || "#870027";
  const dark = style.getPropertyValue("--team-dark").trim() || "#34000f";
  const accent = style.getPropertyValue("--team-accent").trim() || team;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x:(r.left-bounds.left)*scale, y:(r.top-bounds.top)*scale, w:r.width*scale, h:r.height*scale };
  };
  const background = ctx.createLinearGradient(0,0,1080,1350);
  background.addColorStop(0,dark); background.addColorStop(.55,"#090a0d"); background.addColorStop(1,dark);
  ctx.fillStyle=background; ctx.fillRect(0,0,1080,1350);
  ctx.strokeStyle="rgba(255,255,255,0.035)"; ctx.lineWidth=2;
  for(let x=-1350;x<1500;x+=65){ctx.beginPath();ctx.moveTo(x,1350);ctx.lineTo(x+1080,0);ctx.stroke();}
  const images = Array.from(card.querySelectorAll("img"));
  for (const image of images) {
    try { await image.decode(); } catch {
      if(image.classList.contains("player-portrait")) throw new Error("The headshot could not be decoded for export. Refresh the player and try again.");
    }
  }
  function drawImage(selector, opacity=1){
    for(const image of card.querySelectorAll(selector)){
      if(!image.naturalWidth)continue;
      const r=box(image); const fit=Math.min(r.w/image.naturalWidth,r.h/image.naturalHeight);
      const w=image.naturalWidth*fit,h=image.naturalHeight*fit;
      ctx.save();ctx.globalAlpha=opacity;
      ctx.drawImage(image,r.x+(r.w-w)/2,r.y+(image.classList.contains("player-portrait")?r.h-h:(r.h-h)/2),w,h);
      ctx.restore();
    }
  }
  drawImage(".team-watermark",.14);
  for(const panel of card.querySelectorAll(".portrait-panel,.rating-dev,.metal-box")){
    const r=box(panel),cut=Math.min(18,r.w*.04);
    ctx.beginPath();ctx.moveTo(r.x+cut,r.y);ctx.lineTo(r.x+r.w-cut,r.y);ctx.lineTo(r.x+r.w,r.y+cut);
    ctx.lineTo(r.x+r.w,r.y+r.h-cut);ctx.lineTo(r.x+r.w-cut,r.y+r.h);ctx.lineTo(r.x+cut,r.y+r.h);ctx.lineTo(r.x,r.y+r.h-cut);ctx.lineTo(r.x,r.y+cut);ctx.closePath();
    const gradient=ctx.createLinearGradient(r.x,r.y,r.x+r.w,r.y+r.h);
    gradient.addColorStop(0,panel.classList.contains("portrait-panel")?team:"#191b1f");
    gradient.addColorStop(1,panel.classList.contains("portrait-panel")?dark:"#08090b");
    ctx.fillStyle=gradient;ctx.fill();ctx.strokeStyle="#b8bbc1";ctx.lineWidth=1.5;ctx.stroke();
  }
  const portraitPanel=card.querySelector(".portrait-panel");
  if(portraitPanel){const r=box(portraitPanel);ctx.save();ctx.beginPath();ctx.rect(r.x+3,r.y+3,r.w-6,r.h-6);ctx.clip();drawImage(".portrait-team-logo",.26);drawImage(".player-portrait");ctx.restore();}
  for(const title of card.querySelectorAll(".section-title")){
    const r=box(title);const g=ctx.createLinearGradient(r.x,r.y,r.x+r.w,r.y);g.addColorStop(0,team);g.addColorStop(1,dark);ctx.fillStyle=g;ctx.fillRect(r.x,r.y,r.w,r.h);
  }
  for(const row of card.querySelectorAll(".data-row:not(:last-child)")){
    const r=box(row);ctx.strokeStyle="rgba(255,255,255,.22)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(r.x,r.y+r.h);ctx.lineTo(r.x+r.w,r.y+r.h);ctx.stroke();
  }
  drawImage(".dev-icon,.brand-logo");
  const footer=card.querySelector(".card-footer");if(footer){const r=box(footer);ctx.fillStyle="#08090b";ctx.fillRect(r.x,r.y,r.w,r.h);}
  const selectors=".team-kicker,.player-name .first,.player-name .last,.position-line>span,.ovr-number,.ovr-label,.dev-text,.section-title,.data-row dt,.data-row dd,.brand-city,.brand-team,.brand-league,.footer-brand>span,.footer-meta>strong,.footer-meta>span:not(.footer-slash)";
  for(const el of card.querySelectorAll(selectors)){
    const r=box(el),s=getComputedStyle(el);let value=el.textContent?.trim()||"";
    if(s.textTransform==="uppercase")value=value.toUpperCase();
    const size=parseFloat(s.fontSize)*scale;
    ctx.font=`${s.fontStyle} ${s.fontWeight} ${size}px ${s.fontFamily}`;
    ctx.fillStyle=el.matches(".last,.brand-team")?accent:s.color;
    ctx.textBaseline="middle";
    const centered=s.textAlign==="center";ctx.textAlign=centered?"center":"left";
    const px=parseFloat(s.paddingLeft)*scale,pr=parseFloat(s.paddingRight)*scale;
    ctx.fillText(value,centered?r.x+r.w/2:r.x+px,r.y+r.h/2,Math.max(1,r.w-px-pr));
  }
  ctx.strokeStyle="#555";ctx.lineWidth=2;ctx.strokeRect(1,1,1078,1348);
  return new Promise((resolve,reject)=>{try{canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("PNG encoding failed.")),"image/png");}catch{reject(new Error("The browser blocked an image from export. Refresh the player and try again."));}});
}
