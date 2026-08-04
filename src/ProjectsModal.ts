/**
 * ProjectsModal.ts
 * Manages the My Projects modal UI and interactions
 */

export function setupProjectsModal() {
  // ── Inject Modal CSS ───────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.innerHTML = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
    
    .projects-overlay {
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

  // ── Create My Projects Modal ──────────────────────────────────────────────────
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'projects-overlay';
  modalOverlay.id = 'projects-modal-overlay';
  
  // Create the modal element with vertical portrait layout
  const projectsModal = document.createElement('div');
  projectsModal.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90vw; max-width: 480px; min-height: 70vh; background: transparent url("/improved-bg.png") no-repeat center center !important; background-size: 100% 100% !important; filter: drop-shadow(8px 12px 20px rgba(0, 0, 0, 0.7)); padding: 60px 40px 50px 40px; display: flex; flex-direction: column; align-items: center; z-index: 4000; border: none !important; border-radius: 0 !important; box-shadow: none !important; animation: unfurlScroll 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; perspective: 1000px; pointer-events: auto !important;';
  projectsModal.id = 'projects-modal';
  
  projectsModal.innerHTML = `
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
    
    <button id="close-projects-btn" style="position: absolute; top: 25px; right: 25px; width: 45px; height: 45px; background-color: #2c1b18; color: #ebd8b7; border: 2px solid #5d4037; border-radius: 50%; font-size: 14px; font-weight: bold; cursor: pointer !important; pointer-events: auto !important; z-index: 10001 !important; box-shadow: 2px 4px 10px rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; font-family: 'Press Start 2P', monospace; transition: transform 0.2s ease; image-rendering: pixelated; -webkit-font-smoothing: none;">X</button>
    
    <h1 style="font-family: 'Press Start 2P', monospace !important; font-size: 18px; color: #2c1b18; text-align: center; margin-top: 50px; image-rendering: pixelated; -webkit-font-smoothing: none;">My Projects</h1>
  `;
  
  modalOverlay.appendChild(projectsModal);
  document.body.appendChild(modalOverlay);
  
  // ── Modal State and Controls ───────────────────────────────────────────────
  let isOpen = false;

  const open = () => {
    if (modalOverlay) {
      modalOverlay.style.display = 'flex';
      // Retrigger animation by removing and re-adding it
      projectsModal.style.animation = 'none';
      setTimeout(() => {
        projectsModal.style.animation = 'unfurlScroll 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
      }, 10);
    }
    isOpen = true;
  };

  const close = () => {
    if (modalOverlay) modalOverlay.style.display = 'none';
    isOpen = false;
  };
  
  // Setup close button interactions AFTER modal is added to DOM
  const closeBtn = projectsModal.querySelector('#close-projects-btn') as HTMLButtonElement;
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
    if (target && (target.id === 'close-projects-btn' || target.closest('#close-projects-btn'))) {
      console.log('❌ Projects modal close button clicked!');
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
