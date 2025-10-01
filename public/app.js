// --- Firebase Initialization ---
const firebaseConfig = {
  // *** 여기에 너의 새 API 키를 적용했어 ***
  apiKey: "AIzaSyDSpMk7hbDUnE1GHIbdit28lHBTGU4XMx0", 
  authDomain: "metis-os-app.firebaseapp.com",
  projectId: "metis-os-app",
  storageBucket: "metis-os-app.appspot.com",
  messagingSenderId: "635861438047",
  appId: "1:635861438047:web:15f4f9d955c4a55d9f55ea"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const gemsCollection = db.collection('gems');


// --- DOM Element Selection ---
const gemExtractorForm = document.getElementById('gem-extractor-form');
const gemsList = document.getElementById('gems-list');

// --- Rendering Engine ---
const render = (gems) => {
  // Clear the current list
  gemsList.innerHTML = "";

  // Re-render the list from the Firestore data
  if (gems.length === 0) {
    gemsList.innerHTML = '<li><p>추출된 보석이 없습니다. 첫 아이디어를 제련해보세요!</p></li>';
  } else {
    gems.forEach(gem => {
      const li = document.createElement('li');
      li.className = 'gem-item';
      li.dataset.id = gem.id;

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
        return `<button class="btn btn-primary" data-action="forge" data-gem-id="${gem.id}">제련하기 (Forge)</button>`;
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


// --- API Call with Google Gemini ---
const callGeminiApi = (gemContent) => {
  // *** 여기에도 너의 새 API 키를 적용했어 ***
  const GEMINI_API_KEY = "AIzaSyDSpMk7hbDUnE1GHIbdit28lHBTGU4XMx0"; 
  const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `다음 내용을 비즈니스에 바로 적용할 3가지 구체적인 액션 아이템으로 바꿔줘 (각 항목은 번호로 구분하고, 두 줄씩 띄워서 작성해줘): "${gemContent}"`;

  return fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('API request failed');
    }
    return response.json();
  })
  .then(data => {
    return data.candidates[0].content.parts[0].text.trim();
  });
};


//--- Event Handlers ---
const handleExtractGem = (event) => {
  event.preventDefault();
  const formData = new FormData(gemExtractorForm);

  const newGem = {
    title: formData.get('bookTitle'),
    content: formData.get('gemContent'),
    type: formData.get('gemType'),
    forgedContent: null,
    status: 'idle', // idle | forging
    copied: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  gemsCollection.add(newGem)
    .then(() => {
      console.log("Gem successfully added to Firestore!");
      gemExtractorForm.reset();
    })
    .catch((error) => {
      console.error("Error adding gem: ", error);
    });
};

const handleListClick = async (event) => {
  const target = event.target.closest('button[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const gemId = target.dataset.gemId;
  const gemRef = gemsCollection.doc(gemId);

  if (action === 'forge') {
    const gemDoc = await gemRef.get();
    const gem = gemDoc.data();
    if (!gemDoc.exists || gem.status === 'forging') return;
    
    await gemRef.update({ status: 'forging' });

    try {
      const forgedContent = await callGeminiApi(gem.content);
      await gemRef.update({ forgedContent, status: 'idle' });
    } catch (error) {
      console.error("Forging failed:", error);
      await gemRef.update({ status: 'idle' });
    }
  }

  if (action === 'copy') {
    const gemDoc = await gemRef.get();
    const gem = gemDoc.data();
    if (!gemDoc.exists || !gem.forgedContent) return;

    try {
      await navigator.clipboard.writeText(gem.forgedContent);
      await gemRef.update({ copied: true });

      setTimeout(() => {
        gemRef.update({ copied: false });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      alert('클립보드 복사에 실패했습니다.');
    }
  }
};

//--- Initialization ---
const init = () => {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');

  gemExtractorForm.addEventListener('submit', handleExtractGem);
  gemsList.addEventListener('click', handleListClick);

  gemsCollection.orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    const gems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    render(gems);
  });
};

document.addEventListener('DOMContentLoaded', init);