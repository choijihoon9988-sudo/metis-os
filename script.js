// --- DOM Element Selection
const gemExtractorForm = document.getElementById('gem-extractor-form');
const gemsList = document.getElementById('gems-list');

// --- State Management
const store = {
  state: {
    gems: [],
    theme: 'light', // Initial state for theme (will be overridden in init)
  },
  //--- State Mutation Methods ---
  addGem(gem) {
    this.state.gems.push(gem);
  },
  updateGem(gemid, updates) {
    const gemIndex = this.state.gems.findIndex(g => g.id === gemid);
    if (gemIndex > -1) {
      this.state.gems[gemIndex] = { ...this.state.gems[gemIndex], ...updates };
    }
  },
  // --- State Accessors (if needed)
  getGemById(gemid) {
    return this.state.gems.find(g => g.id === gemid);
  }
};

// --- Rendering Engine ---
const render = () => {
  // Set theme attribute on <html> for CSS
  document.documentElement.setAttribute('data-theme', store.state.theme);
  
  // Clear the current list
  gemsList.innerHTML = "";
  
  // Re-render the list from the state
  if (store.state.gems.length === 0) {
    gemsList.innerHTML = '<li><p>추출된 보석이 없습니다. 첫 아이디어를 제련해보세요!</p></li>';
  } else {
    store.state.gems.forEach(gem => {
      const li = document.createElement('li');
      li.className = 'gem-item';
      li.dataset.id = gem.id;
      
      const forgedContentHTML = gem.forgedContent ? `
        <div class="forged-result">
          <p>${gem.forgedContent}</p>
          <div class="forged-result_actions">
            <button class="btn btn-secondary" data-action="copy"
              data-gem-id="${gem.id}">
              ${gem.copied ? '복사 완료!' : '클립보드로 복사'}
            </button>
          </div>
        </div>
      ` : '';
      
      const actionButtonHTML = () => {
        if (gem.status === 'forging') {
          return '<div class="spinner"></div> <span>제련 중...</span>';
        }
        return `<button class="btn btn-primary" data-action="forge"
          data-gem-id="${gem.id}">제련하기 (Forge)</button>`;
      };
      
      li.innerHTML = `
        <header>
          <div>
            <h3 class="gem-item_title">${gem.title}</h3>
          </div>
          <span class="gem-item_type">${gem.type}</span>
        </header>
        <p class="gem-item_content">${gem.content}</p>
        ${gem.forgedContent ? '' : `<div class="gem-item_actions">${actionButtonHTML()}</div>`}
        ${forgedContentHTML}
      `;

      gemsList.appendChild(li);
    });
  }
};

// --- Reactive Proxy Setup
const stateHandler = {
  set(target, property, value) {
    target[property] = value;
    // On any state change, re-render the entire UI
    render();
    return true;
  }
};
const stateProxy = new Proxy(store.state, stateHandler);
store.state = stateProxy;

// --- API Simulation
const simulateApiCall = (gemContent) => {
  return new Promise(resolve => {
    setTimeout(() => {
      const prompt = `0 내용을 내 비즈니스에 적용할 3가지 구체적인 액션 아이템으로 바꿔줘: "${gemContent}"`;
      console.log("Simulating API call with prompt:", prompt);
      const sampleResponse = `1. (고객 세분화) "${gemContent}" 아이디어를 기반으로, 타겟 고객을 2-3개의 구체적인 페르소나로 나누고 각 그룹에 맞는 마케팅 메시지를 A/B 테스트합니다.\n\n2. (제품 기능 개선) 현재 제품의 핵심 기능에 이 아이디어를 접목하여, 사용자 경험을 개선할 수 있는 프로토타입을 1주일 내로 개발하고 내부 팀의 피드백을 받습니다.\n\n3. (콘텐츠 전략) 이 아이디어를 주제로 한 블로그 포스트, 카드뉴스, 짧은 영상 콘텐츠를 제작하여 잠재 고객의 참여를 유도하고 전문성을 확보합니다.`;
      resolve(sampleResponse);
    }, 1500);
  });
};

//--- Event Handlers
const handleExtractGem = (event) => {
  event.preventDefault();
  const formData = new FormData(gemExtractorForm);
  
  const newGem = {
    id: Date.now(),
    title: formData.get('bookTitle'),
    content: formData.get('gemContent'),
    type: formData.get('gemType'),
    forgedContent: null,
    status: 'idle', // idle | forging
    copied: false,
  };
  
  store.addGem(newGem);
  gemExtractorForm.reset();
};

const handleListClick = async (event) => {
  const target = event.target.closest('button[data-action]');
  if (!target) return;
  
  const action = target.dataset.action;
  const gemid = parseInt(target.dataset.gemId, 10);
  
  if (action === 'forge') {
    const gem = store.getGemById(gemid);
    if (!gem || gem.status === 'forging') return;
    
    store.updateGem(gemid, { status: 'forging' });
    
    try {
      const forgedContent = await simulateApiCall(gem.content);
      store.updateGem(gemid, { forgedContent, status: 'idle' });
    } catch (error) {
      console.error("Forging failed:", error);
      store.updateGem(gemid, { status: 'idle' }); // Reset status on error
    }
  }
  
  if (action === 'copy') {
    const gem = store.getGemById(gemid);
    if (!gem || !gem.forgedContent) return;
    
    try {
      await navigator.clipboard.writeText(gem.forgedContent);
      store.updateGem(gemid, { copied: true });
      
      // Reset copied state after a short delay for UX feedback
      setTimeout(() => {
        store.updateGem(gemid, { copied: false });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      alert('클립보드 복사에 실패했습니다.');
    }
  }
};

//--- Initialization
const init = () => {
  // Set initial theme based on user's OS preference
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  store.state.theme = prefersDark ? 'dark' : 'light';
  
  // Attach event listeners
  gemExtractorForm.addEventListener('submit', handleExtractGem);
  gemsList.addEventListener('click', handleListClick);
  
  // Initial render
  render();
};

document.addEventListener('DOMContentLoaded', init);