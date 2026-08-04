/**
 * ControlsModal.ts
 * Manages the Controls modal UI and interactions
 */

export function setupControlsModal() {
  // ── Inject Stylized CSS for 3D Label ───────────────────────────────────────
  const style = document.createElement('style');
  style.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
    
    .bruno-label-container {
      /* Three.js controls this wrapper's transform. Do NOT put scales/rotations here. */
      pointer-events: none;
    }
    .interact-indicator {
      width: 24px;
      height: 24px;
      border: 3px solid white;
      background-color: #1a1a1a;
      border-radius: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-shadow: 0px 4px 10px rgba(0,0,0,0.4);
      pointer-events: none;
      margin-top: -20px;
      opacity: 0;
    }
    .interact-indicator.active {
      width: 140px;
      padding: 0 15px;
    }
    .interact-text {
      color: white;
      font-family: 'Press Start 2P', monospace;
      font-size: 9px;
      white-space: nowrap;
      opacity: 0;
      transform: scale(0.5);
      transition: all 0.2s ease;
      letter-spacing: 1px;
    }
    .interact-indicator.active .interact-text {
      opacity: 1;
      transform: scale(1);
      transition-delay: 0.1s;
    }
    .controls-overlay {
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

  // ── Create Controls Modal ──────────────────────────────────────────────────
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'controls-overlay';
  modalOverlay.id = 'controls-modal-overlay';
  
  // Create the modal element with vertical portrait layout and unroll animation
  const controlsModal = document.createElement('div');
  controlsModal.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90vw; max-width: 480px; min-height: 70vh; background: transparent url("/improved-bg.png") no-repeat center center !important; background-size: 100% 100% !important; filter: drop-shadow(8px 12px 20px rgba(0, 0, 0, 0.7)); padding: 70px 50px; display: flex; flex-direction: column; align-items: center; z-index: 4000; border: none !important; border-radius: 0 !important; box-shadow: none !important; animation: unfurlScroll 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; perspective: 1000px; pointer-events: auto !important;';
  controlsModal.id = 'controls-modal';
  
  controlsModal.innerHTML = `
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
      .ctrl-row {
        display: flex; 
        align-items: center; 
        justify-content: space-between; 
        width: 100%; 
        margin-bottom: 18px; 
        border-bottom: 1px dashed rgba(44, 27, 24, 0.2); 
        padding-bottom: 12px;
      }
      .ctrl-keys {
        display: flex; 
        gap: 8px;
      }
      .keycap {
        background-color: #2c1b18; 
        color: #ebd8b7; 
        padding: 8px 10px; 
        border: 2px solid #5d4037; 
        border-radius: 6px; 
        font-family: 'Press Start 2P', monospace !important; 
        font-weight: bold; 
        font-size: 10px; 
        box-shadow: 2px 3px 0px rgba(0,0,0,0.3); 
        text-align: center; 
        min-width: 36px;
        image-rendering: pixelated;
        -webkit-font-smoothing: none;
      }
      .ctrl-desc {
        font-family: 'Press Start 2P', monospace !important; 
        font-size: 10px; 
        font-weight: 600; 
        color: #2c1b18; 
        text-transform: uppercase; 
        letter-spacing: 1px;
        image-rendering: pixelated;
        -webkit-font-smoothing: none;
      }
    </style>
    
    <button id="close-controls-btn" style="position: absolute; top: 25px; right: 25px; width: 45px; height: 45px; background-color: #2c1b18; color: #ebd8b7; border: 2px solid #5d4037; border-radius: 50%; font-size: 14px; font-weight: bold; cursor: pointer !important; pointer-events: auto !important; z-index: 10001 !important; box-shadow: 2px 4px 10px rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; font-family: 'Press Start 2P', monospace; transition: transform 0.2s ease; image-rendering: pixelated; -webkit-font-smoothing: none;">X</button>
    
    <h1 style="font-family: 'Press Start 2P', monospace !important; font-size: 20px; font-weight: 900; color: #2c1b18; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 3px; text-align: center; image-rendering: pixelated; -webkit-font-smoothing: none;">Controls</h1>
    
    <h2 style="font-family: 'Press Start 2P', monospace !important; font-size: 9px; font-weight: 700; color: #5d4037; margin: 0 0 40px 0; letter-spacing: 2px; text-transform: uppercase; text-align: center; image-rendering: pixelated; -webkit-font-smoothing: none;">How to navigate</h2>
    
    <div style="width: 100%; padding: 0 10px;">
      <div class="ctrl-row">
        <div class="ctrl-keys">
          <span class="keycap">W</span>
          <span class="keycap">A</span>
          <span class="keycap">S</span>
          <span class="keycap">D</span>
        </div>
        <span class="ctrl-desc">Movement</span>
      </div>
      
      <div class="ctrl-row">
        <div class="ctrl-keys">
          <span class="keycap" style="font-size: 8px; min-width: 80px;">ARROWS</span>
        </div>
        <span class="ctrl-desc">Alt Movement</span>
      </div>
      
      <div class="ctrl-row">
        <div class="ctrl-keys">
          <span class="keycap" style="font-size: 8px; min-width: 80px;">MOUSE</span>
        </div>
        <span class="ctrl-desc">Look Around</span>
      </div>
      
      <div class="ctrl-row" style="border-bottom: none;">
        <div class="ctrl-keys">
          <span class="keycap">E</span>
        </div>
        <span class="ctrl-desc">Interact</span>
      </div>
    </div>
  `;
  
  modalOverlay.appendChild(controlsModal);
  document.body.appendChild(modalOverlay);
  
  // ── Modal State and Controls ───────────────────────────────────────────────
  let isOpen = false;

  const open = () => {
    if (modalOverlay) {
      modalOverlay.style.display = 'flex';
      // Retrigger animation by removing and re-adding it
      controlsModal.style.animation = 'none';
      setTimeout(() => {
        controlsModal.style.animation = 'unfurlScroll 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
      }, 10);
    }
    isOpen = true;
  };

  const close = () => {
    if (modalOverlay) modalOverlay.style.display = 'none';
    isOpen = false;
  };
  
  // Setup close button interactions AFTER modal is added to DOM
  const closeBtn = controlsModal.querySelector('#close-controls-btn') as HTMLButtonElement;
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
    if (target && (target.id === 'close-controls-btn' || target.closest('#close-controls-btn'))) {
      console.log('❌ Controls modal close button clicked!');
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
