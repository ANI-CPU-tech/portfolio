/**
 * AboutModal.ts
 * Manages the About Me modal UI and interactions
 */

export function setupAboutModal() {
  // ── Inject Stylized CSS for 3D Label ───────────────────────────────────────
  const style = document.createElement('style');
  style.innerHTML = `
    .bruno-label-container {
      /* Three.js controls this wrapper's transform. Do NOT put scales/rotations here. */
      pointer-events: none;
    }
    .bruno-label-inner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #1a1a1a;
      color: #ffffff;
      padding: 8px 16px;
      border-radius: 4px;
      font-family: 'Impact', 'Arial Black', sans-serif;
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: 2px;
      border: 3px solid #ffffff;
      box-shadow: 4px 4px 0px rgba(0,0,0,0.5);
      transform: scale(0) translateY(20px);
      opacity: 0;
      transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s;
    }
    .bruno-label-container.visible .bruno-label-inner {
      transform: scale(1) translateY(0px);
      opacity: 1;
    }
    .key-indicator {
      background: #ffffff;
      color: #1a1a1a;
      padding: 2px 8px;
      border-radius: 2px;
      font-weight: bold;
      transform: rotate(5deg);
    }
    .about-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: transparent;
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 2000;
      pointer-events: auto;
    }
  `;
  document.head.appendChild(style);

  // ── Create About Me Modal ──────────────────────────────────────────────────
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'about-overlay';
  modalOverlay.id = 'about-modal-overlay';
  
  // Create the modal element with new vertical portrait layout
  const aboutModal = document.createElement('div');
  aboutModal.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90vw; max-width: 480px; min-height: 70vh; background: transparent url("/improved-bg.png") no-repeat center center !important; background-size: 100% 100% !important; filter: drop-shadow(8px 12px 20px rgba(0, 0, 0, 0.7)); padding: 60px 40px 50px 40px; display: flex; flex-direction: column; align-items: center; z-index: 4000; border: none !important; border-radius: 0 !important; box-shadow: none !important; animation: unfurlScroll 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; perspective: 1000px; pointer-events: auto !important;';
  aboutModal.id = 'about-modal';
  
  aboutModal.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
      
      @keyframes unfurlScroll {
        0% {
          clip-path: inset(50% 0 50% 0);
          transform: translate(-50%, -50%) scale(0.8) rotateX(15deg);
          opacity: 0;
        }
        100% {
          clip-path: inset(0 0 0 0);
          transform: translate(-50%, -50%) scale(1) rotateX(0deg);
          opacity: 1;
        }
      }
    </style>
    
    <button id="close-about-btn" style="position: absolute; top: 25px; right: 25px; width: 45px; height: 45px; background-color: #2c1b18; color: #ebd8b7; border: 2px solid #5d4037; border-radius: 50%; font-size: 14px; font-weight: bold; cursor: pointer !important; pointer-events: auto !important; z-index: 10001 !important; box-shadow: 2px 4px 10px rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; font-family: 'Press Start 2P', monospace; transition: transform 0.2s ease; image-rendering: pixelated; -webkit-font-smoothing: none;">X</button>
    
    <div style="width: 160px; height: 160px; border-radius: 50%; overflow: hidden; border: 3px solid #2c1b18; box-shadow: 4px 4px 0px rgba(44, 27, 24, 0.2); margin-bottom: 25px;">
      <img src="/models/profile.jpg" alt="Anirudh Rao B" style="width: 100%; height: 100%; object-fit: cover; object-position: center;" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmNWYxZTgiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iIzJjMWIxOCIgZm9udC1zaXplPSIxOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPjE2MHgxNjA8L3RleHQ+PC9zdmc+'">
    </div>
    
    <h1 style="font-family: 'Press Start 2P', monospace !important; font-size: 18px; font-weight: 900; color: #2c1b18; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 2px; text-align: center; line-height: 1.4; image-rendering: pixelated; -webkit-font-smoothing: none;">Anirudh Rao B</h1>
    
    <h2 style="font-family: 'Press Start 2P', monospace !important; font-size: 9px; font-weight: 700; color: #5d4037; margin: 0 0 30px 0; letter-spacing: 1px; text-transform: uppercase; text-align: center; border-bottom: 1px solid rgba(44, 27, 24, 0.2); padding-bottom: 15px; width: 80%; line-height: 1.6; image-rendering: pixelated; -webkit-font-smoothing: none;">Code, Systems, and a bit of Controlled Chaos.</h2>
    
    <div style="font-family: 'Press Start 2P', monospace !important; font-size: 10px; color: #2c1b18; line-height: 1.8; text-align: justify; padding: 0 10px; image-rendering: pixelated; -webkit-font-smoothing: none;">
      <p style="margin: 0 0 15px 0;">As an engineering student, I thrive on building scalable full-stack applications and architecting robust backend systems.</p>
      <p style="margin: 0;">Whether I'm designing complex data flows for hackathons, containerizing environments, or crafting interactive 3D web experiences, I love turning abstract logic into highly structured, high-performance software.</p>
    </div>
  `;
  
  modalOverlay.appendChild(aboutModal);
  document.body.appendChild(modalOverlay);
  
  // ── Modal State and Controls ───────────────────────────────────────────────
  let isOpen = false;

  const open = () => {
    if (modalOverlay) {
      modalOverlay.style.display = 'flex';
      // Retrigger animation by removing and re-adding it
      aboutModal.style.animation = 'none';
      setTimeout(() => {
        aboutModal.style.animation = 'unfurlScroll 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
      }, 10);
    }
    isOpen = true;
  };

  const close = () => {
    if (modalOverlay) modalOverlay.style.display = 'none';
    isOpen = false;
  };
  
  // Setup close button interactions AFTER modal is added to DOM
  const closeBtn = aboutModal.querySelector('#close-about-btn') as HTMLButtonElement;
  if (closeBtn) {
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.transform = 'scale(1.15) rotate(90deg)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.transform = 'scale(1) rotate(0deg)';
    });
    closeBtn.addEventListener('click', () => {
      close();
    });
  }

  // ── Global Event Delegation for Close Button (Foolproof) ──────────────────
  // This ensures clicks are always caught, even if innerHTML is updated
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    // Check if the clicked element or its parent is the close button
    if (target && (target.id === 'close-about-btn' || target.closest('#close-about-btn'))) {
      console.log('❌ Close button clicked!');
      close();
      e.stopPropagation();
    }
  });

  return {
    open,
    close,
    toggle: () => (isOpen ? close() : open()),
    get isOpen() {
      return isOpen;
    },
  };
}
