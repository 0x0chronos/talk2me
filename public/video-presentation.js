/* Presentation-only cover for the red lesson header. Source media stays intact. */
function decorateLessonVideo(video, wrapper) {
  const cover = document.createElement('span');
  cover.className = 'video-header-cover';
  cover.hidden = true;
  cover.setAttribute('aria-hidden', 'true');
  wrapper.append(cover);
  const canvas = document.createElement('canvas');
  canvas.width = 960; canvas.height = 540;
  const context = canvas.getContext('2d', {willReadFrequently:true});
  let last = -1, callback;
  function inspect() {
    if (!video.isConnected) return;
    if (video.readyState < 2 || Math.abs(video.videoWidth / video.videoHeight - 16 / 9) > 0.02) {
      cover.hidden = true; return;
    }
    try {
      context.drawImage(video, 0, 0, 960, 540);
      const pixel = (x,y) => context.getImageData(x,y,1,1).data;
      const red = p => p[0] > 145 && p[1] < 80 && p[2] < 80;
      const dark = p => Math.max(p[0],p[1],p[2]) < 65;
      const white = p => Math.min(p[0],p[1],p[2]) > 210;
      // Require both header borders, its red fill, and the white logo panel.
      const visible = red(pixel(400,80)) && red(pixel(460,98)) &&
        dark(pixel(400,64)) && dark(pixel(400,108)) && white(pixel(590,85));
      cover.hidden = !visible;
      if (!visible) return;
      const color = pixel(450,85);
      cover.style.backgroundColor = `rgb(${color[0]},${color[1]},${color[2]})`;
      const scale = Math.min(video.clientWidth / 960, video.clientHeight / 540);
      const left = video.offsetLeft + (video.clientWidth - 960 * scale) / 2;
      const top = video.offsetTop + (video.clientHeight - 540 * scale) / 2;
      Object.assign(cover.style, {left:`${left+480*scale}px`,top:`${top+68*scale}px`,width:`${114*scale}px`,height:`${36*scale}px`});
    } catch (_) { cover.hidden = true; }
  }
  function frame(now) {
    if (!video.isConnected) return;
    if (now-last > 120) {inspect();last=now;}
    if ('requestVideoFrameCallback' in video) callback=video.requestVideoFrameCallback(frame);
  }
  ['loadeddata','seeked','pause','timeupdate','play'].forEach(name=>video.addEventListener(name,inspect));
  video.addEventListener('seeking',()=>{cover.hidden=true;});
  const observer = new ResizeObserver(inspect);
  observer.observe(video);
  if ('requestVideoFrameCallback' in video) callback=video.requestVideoFrameCallback(frame);
  // Use wrapper fullscreen so the visual cover stays with the video.
  video.setAttribute('controlsList','nofullscreen nodownload');
  video.disablePictureInPicture = true;
  const fullscreen = document.createElement('button');
  fullscreen.type='button';fullscreen.className='abtn video-expand';fullscreen.textContent='Ampliar vídeo';
  fullscreen.onclick=async()=>{
    try { if(document.fullscreenElement===wrapper) await document.exitFullscreen(); else await wrapper.requestFullscreen(); }
    catch(_){fullscreen.textContent='Tela cheia indisponível neste navegador';}
  };
  if (wrapper.requestFullscreen) wrapper.after(fullscreen);
  const cleanup = new MutationObserver(()=>{
    if(!video.isConnected){observer.disconnect();cleanup.disconnect();if(callback&&video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(callback);}
  });
  cleanup.observe(document.querySelector('#pbody'),{childList:true,subtree:true});
}
