/* ---
File: app.js
Author: 15년 경력 UI/UX 아키텍트
Description: Metis OS v2.0의 핵심 로직을 담당하는 리팩토링된 자바스크립트.
             모듈화된 구조, 명확한 책임 분리, 향상된 상태 관리에 중점을 둠.
--- */

// --- [SECTION 1] 애플리케이션 초기화 및 전역 설정 ---

// Firebase 설정: 보안을 위해 실제 환경에서는 환경 변수 사용을 권장합니다.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY", // 실제 API 키로 교체해야 합니다.
  authDomain: "metis-os-app.firebaseapp.com",
  projectId: "metis-os-app",
  storageBucket: "metis-os-app.appspot.com",
  messagingSenderId: "635861438047",
  appId: "1:635861438047:web:15f4f9d955c4a55d9f55ea"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const gemsCollection = db.collection('gems');
const promptsCollection = db.collection('prompts');

// --- [SECTION 2] 애플리케이션 상태 관리 (Global State) ---

const state = {
  isSynthesisMode: false,
  selectedGems: [],
  currentGemIdToForge: null,
  allGems: [],
  reviewGems: [],
  prompts: [],
};

// --- [SECTION 3] DOM 요소 캐싱 ---

const dom = {
  // Forms
  gemExtractorForm: document.getElementById('gem-extractor-form'),
  promptForm: document.getElementById('prompt-form'),

  // Lists
  gemsList: document.getElementById('gems-list'),
  reviewList: document.getElementById('review-list'),
  promptList: document.getElementById('prompt-list'),

  // Modals
  promptVaultModal: document.getElementById('prompt-vault-modal'),
  forgeOptionsModal: document.getElementById('forge-options-modal'),
  forgePromptList: document.getElementById('forge-prompt-list'),
  
  // Prompt Form Inputs
  promptIdInput: document.getElementById('prompt-id'),
  promptNameInput: document.getElementById('prompt-name'),
  promptContentInput: document.getElementById('prompt-content'),

  // Synthesis UI
  synthesisModeBtn: document.getElementById('synthesis-mode-btn'),
  synthesisActionBar: document.getElementById('synthesis-action-bar'),
  synthesisStatus: document.getElementById('synthesis-status'),
  executeSynthesisBtn: document.getElementById('execute-synthesis-btn'),
  cancelSynthesisBtn: document.getElementById('cancel-synthesis-btn'),
  
  // Tabs & Indicators
  tabs: document.querySelector('.tabs'),
  reviewIndicator: document.getElementById('review-indicator'),
  
  // General UI
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
};

// --- [SECTION 4] 렌더링 엔진 (UI Update Functions) ---

/**
 * Gem 목록을 화면에 렌더링합니다.
 * @param {HTMLElement} listElement - Gem을 렌더링할 UL 요소
 * @param {Array} gemsToRender - 렌더링할 Gem 데이터 배열
 * @param {string} emptyMessage - 목록이 비어있을 때 표시할 메시지
 */
const renderGemList = (listElement, gemsToRender, emptyMessage) => {
  listElement.innerHTML = "";
  if (gemsToRender.length === 0) {
    listElement.innerHTML = `<li class="empty-message">${emptyMessage}</li>`;
    return;
  }

  gemsToRender.forEach(gem => {
    const li = document.createElement('li');
    li.className = `gem-item ${state.isSynthesisMode ? 'synthesis-mode' : ''} ${state.selectedGems.includes(gem.id) ? 'selected' : ''}`;
    li.dataset.id = gem.id;

    const tagsHTML = gem.tags && gem.tags.length > 0
      ? `<div class="gem-item-tags">${gem.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}</div>`
      : '';

    const forgedContentHTML = gem.forgedContent
      ? `<article class="forged-result">
           <p>${gem.forgedContent.replace(/\n/g, '<br>')}</p>
           <div class="forged-result-actions">
             <button class="btn btn-secondary" data-action="copy" data-gem-id="${gem.id}">
               <i class="ri-clipboard-line"></i> ${gem.copied ? '복사 완료!' : '복사'}
             </button>
           </div>
         </article>`
      : '';
    
    const actionButtonHTML = () => {
      if (gem.status === 'forging') {
        return '<div class="spinner"></div> <span>제련 중...</span>';
      }
      // 리뷰 목록의 아이템인 경우 '리뷰 완료' 버튼을 표시
      if (listElement.id === 'review-list') {
        return `<button class="btn btn-success" data-action="mark-reviewed" data-gem-id="${gem.id}"><i class="ri-check-double-line"></i> 리뷰 완료</button>`;
      }
      return `<button class="btn btn-primary" data-action="open-forge-options" data-gem-id="${gem.id}"><i class="ri-fire-line"></i> 제련하기</button>`;
    };

    li.innerHTML = `
      <header class="gem-item-header">
        <h3 class="gem-item-source">${gem.title}</h3>
        <span class="gem-item-type">${gem.type}</span>
      </header>
      <p class="gem-item-content">${gem.content}</p>
      ${tagsHTML}
      <footer class="gem-item-actions">
        ${forgedContentHTML ? '' : actionButtonHTML()}
      </footer>
      ${forgedContentHTML}
    `;
    listElement.appendChild(li);
  });
};

/**
 * 프롬프트 목록을 모달에 렌더링합니다.
 * @param {Array} prompts - 렌더링할 프롬프트 데이터 배열
 */
const renderPrompts = (prompts) => {
  dom.promptList.innerHTML = "";
  if (prompts.length === 0) {
    dom.promptList.innerHTML = `<li class="empty-message">저장된 프롬프트가 없습니다.</li>`;
    return;
  }
  prompts.forEach(prompt => {
    const li = document.createElement('li');
    li.className = 'prompt-list-item';
    li.dataset.id = prompt.id;
    li.innerHTML = `
      <span>${prompt.name}</span>
      <div class="prompt-actions">
        <button class="btn btn-icon" data-action="edit-prompt" aria-label="수정"><i class="ri-pencil-line"></i></button>
        <button class="btn btn-icon" data-action="delete-prompt" aria-label="삭제"><i class="ri-delete-bin-line"></i></button>
      </div>
    `;
    dom.promptList.appendChild(li);
  });
};

/**
 * 리뷰할 Gem의 갯수를 UI에 업데이트합니다.
 */
const updateReviewIndicator = () => {
    dom.reviewIndicator.innerHTML = `<span>리뷰할 항목 <strong>${state.reviewGems.length}</strong>개</span>`;
};


// --- [SECTION 5] 핵심 로직 (Spaced Repetition, API Calls) ---

const reviewIntervals = { 0: 1, 1: 3, 2: 7, 3: 14, 4: 30 }; // 복습 간격 (일)

/**
 * 다음 복습 날짜를 계산합니다.
 * @param {number} currentLevel - 현재 복습 레벨
 * @returns {firebase.firestore.Timestamp} 다음 복습 날짜 Timestamp
 */
const getNextReviewDate = (currentLevel) => {
  const level = currentLevel || 0;
  const interval = reviewIntervals[level] || reviewIntervals[0];
  const date = new Date();
  date.setDate(date.getDate() + interval);
  return firebase.firestore.Timestamp.fromDate(date);
};

/**
 * Gemini API를 호출하여 콘텐츠를 생성합니다.
 * @param {string} prompt - API에 전송할 프롬프트
 * @returns {Promise<string>} API 응답 텍스트
 */
const callGeminiApi = async (prompt) => {
  const GEMINI_API_KEY = "YOUR_API_KEY"; // 실제 API 키로 교체해야 합니다.
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GEMINI_API_KEY}`;
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error.message || 'API 요청 실패');
    }
    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
  } catch (error) {
    console.error("Gemini API Error:", error);
    alert(`API 호출에 실패했습니다: ${error.message}`);
    throw error; // 에러를 상위로 전파하여 후속 처리를 위함
  }
};


// --- [SECTION 6] 이벤트 핸들러 (User Actions) ---

const handlers = {
  /** Gem 추출 폼 제출 처리 */
  handleExtractGem: (e) => {
    e.preventDefault();
    const formData = new FormData(dom.gemExtractorForm);
    const tags = formData.get('gemTags').split(',').map(tag => tag.trim()).filter(Boolean);

    const newGem = {
      title: formData.get('gemSource'),
      content: formData.get('gemContent'),
      type: formData.get('gemType'),
      tags: tags,
      forgedContent: null,
      status: 'idle',
      copied: false,
      reviewLevel: 0,
      reviewAt: getNextReviewDate(0),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    gemsCollection.add(newGem)
      .then(() => dom.gemExtractorForm.reset())
      .catch(error => console.error("Error adding gem: ", error));
  },

  /** Gem 목록 및 리뷰 목록의 클릭 이벤트 위임 처리 */
  handleListClick: (e) => {
    const targetButton = e.target.closest('button[data-action]');
    if (targetButton) {
      const { action, gemId } = targetButton.dataset;
      handlers.handleGemAction(action, gemId);
      return;
    }
    
    if (state.isSynthesisMode) {
        const targetItem = e.target.closest('.gem-item');
        if (targetItem) {
            ui.toggleGemSelection(targetItem.dataset.id);
        }
    }
  },

  /** Gem 아이템 내의 버튼 액션 처리 */
  handleGemAction: async (action, gemId) => {
    const gemRef = gemsCollection.doc(gemId);
    
    switch (action) {
      case 'open-forge-options':
        state.currentGemIdToForge = gemId;
        ui.openForgeModal();
        break;
      case 'copy':
        const gemDoc = await gemRef.get();
        if (gemDoc.exists) {
          navigator.clipboard.writeText(gemDoc.data().forgedContent)
            .then(() => {
              gemRef.update({ copied: true });
              setTimeout(() => gemRef.update({ copied: false }), 2000);
            });
        }
        break;
      case 'mark-reviewed':
        const doc = await gemRef.get();
        if (doc.exists) {
            const currentLevel = doc.data().reviewLevel || 0;
            const nextLevel = currentLevel + 1;
            await gemRef.update({ reviewLevel: nextLevel, reviewAt: getNextReviewDate(nextLevel) });
        }
        break;
    }
  },

  /** 제련 실행 */
  handleForge: async (promptTemplate) => {
    ui.closeForgeModal();
    const gemId = state.currentGemIdToForge;
    if (!gemId) return;

    const gemRef = gemsCollection.doc(gemId);
    const gemDoc = await gemRef.get();
    if (!gemDoc.exists || gemDoc.data().status === 'forging') return;

    await gemRef.update({ status: 'forging' });
    
    try {
      const gemContent = gemDoc.data().content;
      const finalPrompt = promptTemplate 
        ? promptTemplate.replace('{{GEM_CONTENT}}', gemContent)
        : `다음 내용을 비즈니스에 바로 적용할 3가지 구체적인 액션 아이템으로 바꿔줘 (각 항목은 번호로 구분하고, 두 줄씩 띄워서 작성해줘): "${gemContent}"`;

      const forgedContent = await callGeminiApi(finalPrompt);
      await gemRef.update({ forgedContent, status: 'idle' });
    } catch (error) {
      await gemRef.update({ status: 'idle' });
    }
  },

  /** 프롬프트 폼 제출 (저장/수정) */
  handlePromptFormSubmit: (e) => {
    e.preventDefault();
    const id = dom.promptIdInput.value;
    const promptData = {
      name: dom.promptNameInput.value,
      content: dom.promptContentInput.value,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const promise = id 
      ? promptsCollection.doc(id).update(promptData)
      : promptsCollection.add(promptData);
    
    promise.then(() => {
      dom.promptForm.reset();
      dom.promptIdInput.value = '';
    });
  },
  
  /** 프롬프트 목록 클릭 이벤트 (수정/삭제) */
  handlePromptListClick: (e) => {
    const targetButton = e.target.closest('button[data-action]');
    if (!targetButton) return;
    
    const { action } = targetButton.dataset;
    const promptItem = targetButton.closest('.prompt-list-item');
    const id = promptItem.dataset.id;

    if (action === 'delete-prompt' && confirm('정말 이 프롬프트를 삭제하시겠습니까?')) {
      promptsCollection.doc(id).delete();
    }
    
    if (action === 'edit-prompt') {
      const prompt = state.prompts.find(p => p.id === id);
      if (prompt) {
        dom.promptIdInput.value = prompt.id;
        dom.promptNameInput.value = prompt.name;
        dom.promptContentInput.value = prompt.content;
      }
    }
  },

  /** 지식 연결(Synthesis) 실행 */
  executeSynthesis: async () => {
    if (state.selectedGems.length !== 2) return;
    
    dom.executeSynthesisBtn.innerHTML = `<div class="spinner"></div>`;
    dom.executeSynthesisBtn.disabled = true;

    try {
      const [doc1, doc2] = await Promise.all([
        gemsCollection.doc(state.selectedGems[0]).get(),
        gemsCollection.doc(state.selectedGems[1]).get()
      ]);
      
      const gem1 = doc1.data();
      const gem2 = doc2.data();
      const synthesisPrompt = `두 가지 핵심 아이디어가 있습니다. 1. "${gem1.title}": ${gem1.content} 2. "${gem2.title}": ${gem2.content}. 이 두 아이디어의 공통 원리를 찾아내고, 이들을 통합하여 하나의 새로운 통찰 또는 실행 가능한 프레임워크를 생성해주세요. 결과는 제목과 내용으로 구분하고, 제목은 [융합]이라는 말머리를 붙여줘.`;
      const synthesizedContent = await callGeminiApi(synthesisPrompt);
      
      const newGem = {
        title: `[융합] ${gem1.title} & ${gem2.title}`,
        content: synthesizedContent,
        type: '프레임워크',
        tags: [...new Set([...(gem1.tags || []), ...(gem2.tags || [])])],
        forgedContent: null,
        status: 'idle',
        copied: false,
        reviewLevel: 0,
        reviewAt: getNextReviewDate(0),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await gemsCollection.add(newGem);
    } catch (error) {
      console.error("Synthesis failed:", error);
    } finally {
      ui.toggleSynthesisMode();
    }
  },
};


// --- [SECTION 7] UI 조작 및 인터랙션 ---

const ui = {
  /** 지식 연결 모드 활성화/비활성화 */
  toggleSynthesisMode: () => {
    state.isSynthesisMode = !state.isSynthesisMode;
    state.selectedGems = [];
    
    dom.synthesisActionBar.style.display = state.isSynthesisMode ? 'flex' : 'none';
    dom.synthesisModeBtn.innerHTML = state.isSynthesisMode ? '<i class="ri-close-line"></i> 연결 취소' : '<i class="ri-flow-chart"></i> 지식 연결';
    
    renderGemList(dom.gemsList, state.allGems, '추출된 Gem이 없습니다.');
    ui.updateSynthesisUI();
  },
  
  /** 지식 연결 모드에서 Gem 선택/해제 */
  toggleGemSelection: (gemId) => {
    const index = state.selectedGems.indexOf(gemId);
    if (index > -1) {
      state.selectedGems.splice(index, 1);
    } else if (state.selectedGems.length < 2) {
      state.selectedGems.push(gemId);
    }
    
    document.querySelector(`.gem-item[data-id="${gemId}"]`).classList.toggle('selected', state.selectedGems.includes(gemId));
    ui.updateSynthesisUI();
  },
  
  /** 지식 연결 UI 상태 업데이트 */
  updateSynthesisUI: () => {
    const count = state.selectedGems.length;
    dom.synthesisStatus.textContent = `선택된 Gem ${count}/2`;
    dom.executeSynthesisBtn.disabled = count !== 2;
    dom.executeSynthesisBtn.innerHTML = `연결 실행`;
  },
  
  /** 탭 전환 처리 */
  handleTabClick: (e) => {
    e.preventDefault();
    const targetTab = e.target.closest('.tab');
    if (!targetTab) return;

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    targetTab.classList.add('active');
    document.getElementById(targetTab.getAttribute('href').substring(1)).classList.add('active');
  },
  
  /** 테마 전환 (Light/Dark) */
  toggleTheme: () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    dom.themeToggleBtn.innerHTML = newTheme === 'dark' ? '<i class="ri-moon-fill"></i>' : '<i class="ri-sun-line"></i>';
  },

  /** 제련 옵션 모달 열기 */
  openForgeModal: async () => {
    dom.forgePromptList.innerHTML = '<div class="spinner"></div>';
    dom.forgeOptionsModal.style.display = 'block';
    
    let optionsHTML = `<button class="btn btn-secondary forge-option-btn" data-prompt-template="default">기본 프롬프트 (액션 아이템 3가지)</button>`;
    state.prompts.forEach(prompt => {
      optionsHTML += `<button class="btn btn-secondary forge-option-btn" data-prompt-id="${prompt.id}">${prompt.name}</button>`;
    });
    dom.forgePromptList.innerHTML = optionsHTML;
  },

  /** 모달 닫기 */
  closeForgeModal: () => dom.forgeOptionsModal.style.display = 'none',
  closePromptModal: () => dom.promptVaultModal.style.display = 'none',
};


// --- [SECTION 8] 이벤트 리스너 바인딩 ---

const bindEventListeners = () => {
  dom.gemExtractorForm.addEventListener('submit', handlers.handleExtractGem);
  dom.gemsList.addEventListener('click', handlers.handleListClick);
  dom.reviewList.addEventListener('click', handlers.handleListClick);

  // Modals
  document.getElementById('vault-link').addEventListener('click', () => dom.promptVaultModal.style.display = 'block');
  document.getElementById('close-modal-btn').addEventListener('click', ui.closePromptModal);
  document.getElementById('close-forge-modal-btn').addEventListener('click', ui.closeForgeModal);
  window.addEventListener('click', (e) => {
    if (e.target === dom.promptVaultModal) ui.closePromptModal();
    if (e.target === dom.forgeOptionsModal) ui.closeForgeModal();
  });

  // Prompt Vault
  dom.promptForm.addEventListener('submit', handlers.handlePromptFormSubmit);
  dom.promptList.addEventListener('click', handlers.handlePromptListClick);
  
  // Forge Options
  dom.forgePromptList.addEventListener('click', (e) => {
    const target = e.target.closest('.forge-option-btn');
    if (target) {
        if (target.dataset.promptTemplate === 'default') {
            handlers.handleForge(null);
        } else {
            const prompt = state.prompts.find(p => p.id === target.dataset.promptId);
            handlers.handleForge(prompt.content);
        }
    }
  });

  // Synthesis
  dom.synthesisModeBtn.addEventListener('click', ui.toggleSynthesisMode);
  dom.cancelSynthesisBtn.addEventListener('click', ui.toggleSynthesisMode);
  dom.executeSynthesisBtn.addEventListener('click', handlers.executeSynthesis);

  // UI
  dom.tabs.addEventListener('click', ui.handleTabClick);
  dom.themeToggleBtn.addEventListener('click', ui.toggleTheme);
};

// --- [SECTION 9] 애플리케이션 진입점 (Entry Point) ---

const init = () => {
  // 1. 사용자 테마 설정 적용
  const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', savedTheme);
  dom.themeToggleBtn.innerHTML = savedTheme === 'dark' ? '<i class="ri-moon-fill"></i>' : '<i class="ri-sun-line"></i>';
  
  // 2. 이벤트 리스너 바인딩
  bindEventListeners();

  // 3. Firestore 데이터 리스너 설정
  gemsCollection.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    const allGems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    state.allGems = allGems;
    
    const now = new Date();
    state.reviewGems = allGems.filter(gem => gem.reviewAt && gem.reviewAt.toDate() <= now);
    
    renderGemList(dom.gemsList, state.allGems, '추출된 Gem이 없습니다. 첫 아이디어를 제련해보세요!');
    renderGemList(dom.reviewList, state.reviewGems, '오늘 리뷰할 아이디어가 없습니다. 🎉');
    updateReviewIndicator();
  }, error => console.error("Firestore 'gems' listener error: ", error));

  promptsCollection.orderBy('createdAt').onSnapshot(snapshot => {
    state.prompts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderPrompts(state.prompts);
  }, error => console.error("Firestore 'prompts' listener error: ", error));
};

// DOM이 로드되면 애플리케이션을 시작합니다.
document.addEventListener('DOMContentLoaded', init);