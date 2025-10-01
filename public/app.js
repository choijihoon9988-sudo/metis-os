// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyDSpMk7hbDUnE1GHIbdit28lHBTGU4XMx0", 
  authDomain: "metis-os-app.firebaseapp.com",
  projectId: "metis-os-app",
  storageBucket: "metis-os-app.appspot.com",
  messagingSenderId: "635861438047",
  appId: "1:635861438047:web:15f4f9d955c4a55d9f55ea"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const gemsCollection = db.collection('gems');
const promptsCollection = db.collection('prompts');

// --- Global State ---
let isSynthesisMode = false;
let selectedGems = [];
let currentGemIdToForge = null;

// --- DOM Element Selection ---
const gemExtractorForm = document.getElementById('gem-extractor-form');
const gemsList = document.getElementById('gems-list');
const reviewList = document.getElementById('review-list');

// Modals
const promptVaultModal = document.getElementById('prompt-vault-modal');
const forgeOptionsModal = document.getElementById('forge-options-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const closeForgeModalBtn = document.getElementById('close-forge-modal-btn');
const vaultLink = document.getElementById('vault-link');

// Prompt Vault
const promptForm = document.getElementById('prompt-form');
const promptList = document.getElementById('prompt-list');
const promptIdInput = document.getElementById('prompt-id');
const promptNameInput = document.getElementById('prompt-name');
const promptContentInput = document.getElementById('prompt-content');

// Synthesis
const synthesisModeBtn = document.getElementById('synthesis-mode-btn');
const synthesisActionBar = document.getElementById('synthesis-action-bar');
const executeSynthesisBtn = document.getElementById('execute-synthesis-btn');
const cancelSynthesisBtn = document.getElementById('cancel-synthesis-btn');


// --- Spaced Repetition Logic ---
const reviewIntervals = { // in days
  0: 1,
  1: 3,
  2: 7,
  3: 14,
  4: 30,
};

const getNextReviewDate = (currentLevel) => {
  const level = currentLevel || 0;
  const interval = reviewIntervals[level] || reviewIntervals[0];
  const date = new Date();
  date.setDate(date.getDate() + interval);
  return firebase.firestore.Timestamp.fromDate(date);
};


// --- Rendering Engine ---
const renderGems = (gems) => {
  gemsList.innerHTML = "";
  if (gems.length === 0) {
    gemsList.innerHTML = '<li><p>추출된 보석이 없습니다. 첫 아이디어를 제련해보세요!</p></li>';
    return;
  }
  
  gems.forEach(gem => {
    const li = document.createElement('li');
    li.className = 'gem-item';
    li.dataset.id = gem.id;

    if (isSynthesisMode) li.classList.add('synthesis-mode');
    if (selectedGems.includes(gem.id)) li.classList.add('selected');

    const tagsHTML = gem.tags && gem.tags.length > 0
      ? `<div class="gem-item_tags">${gem.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>`
      : '';

    const forgedContentHTML = gem.forgedContent ? `
      <div class="forged-result">
        <p>${gem.forgedContent.replace(/\n/g, '<br>')}</p>
        <div class="forged-result_actions">
          <button class="btn btn-secondary" data-action="copy" data-gem-id="${gem.id}">
            ${gem.copied ? '복사 완료!' : '클립보드로 복사'}
          </button>
        </div>
      </div>
    ` : '';
    
    const actionButtonHTML = () => {
      if (gem.status === 'forging') {
        return '<div class="spinner"></div> <span>제련 중...</span>';
      }
      return `<button class="btn btn-primary" data-action="open-forge-options" data-gem-id="${gem.id}">제련하기 (Forge)</button>`;
    };

    li.innerHTML = `
      <header>
        <div><h3 class="gem-item_title">${gem.title}</h3></div>
        <span class="gem-item_type">${gem.type}</span>
      </header>
      <p class="gem-item_content">${gem.content}</p>
      ${tagsHTML}
      ${gem.forgedContent ? '' : `<div class="gem-item_actions">${actionButtonHTML()}</div>`}
      ${forgedContentHTML}
    `;
    gemsList.appendChild(li);
  });
};

const renderReviewItems = (gems) => {
    reviewList.innerHTML = "";
    if (gems.length === 0) {
        reviewList.innerHTML = '<li><p>오늘 리뷰할 아이디어가 없습니다.</p></li>';
        return;
    }

    gems.forEach(gem => {
        const li = document.createElement('li');
        li.className = 'gem-item';
        li.dataset.id = gem.id;
        li.innerHTML = `
            <header>
                <div><h3 class="gem-item_title">${gem.title}</h3></div>
                <span class="gem-item_type">${gem.type}</span>
            </header>
            <p class="gem-item_content">${gem.content}</p>
            <div class="gem-item_actions">
                <button class="btn btn-success" data-action="mark-reviewed" data-gem-id="${gem.id}">✅ 리뷰 완료</button>
            </div>
        `;
        reviewList.appendChild(li);
    });
};

const renderPrompts = (prompts) => {
    promptList.innerHTML = "";
    prompts.forEach(prompt => {
        const li = document.createElement('li');
        li.className = 'prompt-list-item';
        li.dataset.id = prompt.id;
        li.innerHTML = `
            <p>${prompt.name}</p>
            <div class="prompt-actions">
                <button class="btn btn-secondary" data-action="edit-prompt">수정</button>
                <button class="btn btn-danger" data-action="delete-prompt">삭제</button>
            </div>
        `;
        promptList.appendChild(li);
    });
};


// --- API Call with Google Gemini ---
const callGeminiApi = (prompt) => {
  // ** 중요 **: 이 키는 Firebase용 키가 아니라, Google AI Studio에서 발급받은 너의 Gemini API 키여야 해.
  const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"; //  <-- 이 부분을 너의 실제 Gemini 키로 바꿔줘.
  
  // [수정] 네가 알려준 'gemini-2.5-pro' 모델로 URL을 수정했어.
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;

  return fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  })
  .then(response => {
    if (!response.ok) {
        return response.json().then(errorData => {
            console.error('API Error Details:', errorData);
            throw new Error(`API request failed: ${errorData.error.message}`);
        });
    }
    return response.json();
  })
  .then(data => data.candidates[0].content.parts[0].text.trim());
};


// --- Event Handlers ---

const handleExtractGem = (event) => {
  event.preventDefault();
  const formData = new FormData(gemExtractorForm);
  const tags = formData.get('gemTags').split(',').map(tag => tag.trim()).filter(Boolean);

  const newGem = {
    title: formData.get('bookTitle'),
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

  gemsCollection.add(newGem).then(() => {
    gemExtractorForm.reset();
  }).catch(error => console.error("Error adding gem: ", error));
};

const handleListClick = async (event) => {
  const targetButton = event.target.closest('button[data-action]');
  if (targetButton) {
    const action = targetButton.dataset.action;
    const gemId = targetButton.dataset.gemId;
    handleButtonAction(action, gemId);
    return;
  }
  
  if (isSynthesisMode) {
      const targetItem = event.target.closest('.gem-item');
      if (targetItem) {
          const gemId = targetItem.dataset.id;
          toggleGemSelection(gemId);
      }
  }
};

const handleButtonAction = async (action, gemId) => {
    const gemRef = gemsCollection.doc(gemId);

    if (action === 'open-forge-options') {
        currentGemIdToForge = gemId;
        const prompts = await promptsCollection.orderBy('createdAt').get();
        const forgePromptList = document.getElementById('forge-prompt-list');
        forgePromptList.innerHTML = '';
        
        const defaultOption = document.createElement('button');
        defaultOption.className = 'btn btn-secondary forge-option-btn';
        defaultOption.textContent = '기본 프롬프트 (액션 아이템 3가지)';
        defaultOption.onclick = () => handleForge(gemId, null);
        forgePromptList.appendChild(defaultOption);

        prompts.docs.forEach(doc => {
            const prompt = { id: doc.id, ...doc.data() };
            const option = document.createElement('button');
            option.className = 'btn btn-secondary forge-option-btn';
            option.textContent = prompt.name;
            option.onclick = () => handleForge(gemId, prompt.content);
            forgePromptList.appendChild(option);
        });
        forgeOptionsModal.style.display = 'block';
    }

    if (action === 'copy') {
        const gemDoc = await gemRef.get();
        if (!gemDoc.exists) return;
        const gem = gemDoc.data();
        navigator.clipboard.writeText(gem.forgedContent).then(() => {
            gemRef.update({ copied: true });
            setTimeout(() => gemRef.update({ copied: false }), 2000);
        }).catch(err => console.error('Failed to copy text:', err));
    }
};

const handleForge = async (gemId, promptTemplate) => {
    forgeOptionsModal.style.display = 'none';
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
        console.error("Forging failed:", error);
        alert(`제련에 실패했습니다: ${error.message}`);
        await gemRef.update({ status: 'idle' });
    }
};

const handleReviewListClick = async (event) => {
    const target = event.target.closest('button[data-action="mark-reviewed"]');
    if (!target) return;

    const gemId = target.dataset.gemId;
    const gemRef = gemsCollection.doc(gemId);
    const gemDoc = await gemRef.get();
    if (!gemDoc.exists) return;

    const currentLevel = gemDoc.data().reviewLevel || 0;
    const nextLevel = currentLevel + 1;
    const nextReviewDate = getNextReviewDate(nextLevel);
    
    await gemRef.update({ reviewLevel: nextLevel, reviewAt: nextReviewDate });
};

const handlePromptFormSubmit = (event) => {
    event.preventDefault();
    const id = promptIdInput.value;
    const promptData = {
        name: promptNameInput.value,
        content: promptContentInput.value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (id) {
        promptsCollection.doc(id).update(promptData).then(() => promptForm.reset());
    } else {
        promptsCollection.add(promptData).then(() => promptForm.reset());
    }
    promptIdInput.value = '';
    promptNameInput.value = '';
    promptContentInput.value = '';
};


const handlePromptListClick = (event) => {
    const target = event.target;
    const action = target.dataset.action;
    const promptItem = target.closest('.prompt-list-item');
    if (!action || !promptItem) return;

    const id = promptItem.dataset.id;
    if (action === 'delete-prompt') {
        if (confirm('정말 이 프롬프트를 삭제하시겠습니까?')) {
            promptsCollection.doc(id).delete();
        }
    }
    if (action === 'edit-prompt') {
        const promptDoc = promptsCollection.doc(id).get().then(doc => {
            if (doc.exists) {
                const prompt = doc.data();
                promptIdInput.value = doc.id;
                promptNameInput.value = prompt.name;
                promptContentInput.value = prompt.content;
            }
        });
    }
};

const toggleSynthesisMode = () => {
    isSynthesisMode = !isSynthesisMode;
    selectedGems = [];
    synthesisActionBar.style.display = isSynthesisMode ? 'flex' : 'none';
    synthesisModeBtn.textContent = isSynthesisMode ? '취소' : '지식 연결 모드';
    gemsList.querySelectorAll('.gem-item').forEach(item => {
        item.classList.toggle('synthesis-mode', isSynthesisMode);
        item.classList.remove('selected');
    });
};

const toggleGemSelection = (gemId) => {
    const gemIndex = selectedGems.indexOf(gemId);
    if (gemIndex > -1) {
        selectedGems.splice(gemIndex, 1);
    } else {
        if (selectedGems.length < 2) {
            selectedGems.push(gemId);
        }
    }
    
    gemsList.querySelectorAll('.gem-item').forEach(item => {
        item.classList.toggle('selected', selectedGems.includes(item.dataset.id));
    });

    executeSynthesisBtn.disabled = selectedGems.length !== 2;
    executeSynthesisBtn.textContent = `선택한 Gem ${selectedGems.length}/2개로 지식 연결하기`;
};

const executeSynthesis = async () => {
    if (selectedGems.length !== 2) return;
    
    executeSynthesisBtn.innerHTML = `<div class="spinner"></div> <span>연결 중...</span>`;
    executeSynthesisBtn.disabled = true;

    try {
        const [doc1, doc2] = await Promise.all([
            gemsCollection.doc(selectedGems[0]).get(),
            gemsCollection.doc(selectedGems[1]).get()
        ]);
        
        const gem1 = doc1.data();
        const gem2 = doc2.data();

        const synthesisPrompt = `
            두 가지 핵심 아이디어가 있습니다.
            1. "${gem1.title}": ${gem1.content}
            2. "${gem2.title}": ${gem2.content}

            이 두 아이디어의 공통 원리를 찾아내고, 이들을 통합하여 하나의 새로운 통찰 또는 실행 가능한 프레임워크를 생성해주세요.
            결과는 제목과 내용으로 구분하고, 제목은 [융합]이라는 말머리를 붙여줘.
        `;

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
        alert(`지식 연결에 실패했습니다: ${error.message}`);
    } finally {
        toggleSynthesisMode();
    }
};

const init = () => {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');

  gemExtractorForm.addEventListener('submit', handleExtractGem);
  gemsList.addEventListener('click', handleListClick);
  reviewList.addEventListener('click', handleReviewListClick);

  vaultLink.addEventListener('click', () => promptVaultModal.style.display = 'block');
  closeModalBtn.addEventListener('click', () => promptVaultModal.style.display = 'none');
  closeForgeModalBtn.addEventListener('click', () => forgeOptionsModal.style.display = 'none');
  window.addEventListener('click', (event) => {
    if (event.target == promptVaultModal) promptVaultModal.style.display = 'none';
    if (event.target == forgeOptionsModal) forgeOptionsModal.style.display = 'none';
  });

  promptForm.addEventListener('submit', handlePromptFormSubmit);
  promptList.addEventListener('click', handlePromptListClick);

  synthesisModeBtn.addEventListener('click', toggleSynthesisMode);
  cancelSynthesisBtn.addEventListener('click', toggleSynthesisMode);
  executeSynthesisBtn.addEventListener('click', executeSynthesis);

  gemsCollection.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    const allGems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const now = new Date();
    const reviewGems = allGems.filter(gem => gem.reviewAt && gem.reviewAt.toDate() <= now);
    
    renderGems(allGems);
    renderReviewItems(reviewGems);
  }, error => {
      console.error("Firestore 'gems' listener error: ", error);
  });

  promptsCollection.orderBy('createdAt').onSnapshot(snapshot => {
    const prompts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderPrompts(prompts);
  }, error => {
      console.error("Firestore 'prompts' listener error: ", error);
  });
};

document.addEventListener('DOMContentLoaded', init);