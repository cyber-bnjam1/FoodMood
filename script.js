// --- CONFIG FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAi1MFx5KuzPcpKKMtursIxMUV4MqQs7Nc",
  authDomain: "foodmood-5c124.firebaseapp.com",
  databaseURL: "https://foodmood-5c124-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "foodmood-5c124",
  storageBucket: "foodmood-5c124.firebasestorage.app",
  messagingSenderId: "814046730378",
  appId: "1:814046730378:web:d220254af588891593b573"
};

// INITIALISATION
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// VARIABLES GLOBALES
let currentUser = null; 
let allRecipes = []; 
let favorites = [];
let userTags = ["Végétarien", "Sans Gluten", "Épicé", "Création"]; 
let userStats = { total:0, healthy:0, fast:0, comfort:0, patisserie:0, cheap:0, exp:0, starter:0, dessert:0, aperitif:0, night:0, morning:0, weekend:0, imported:0, created:0, seasonal:0 }; 
let fridgeIngredients = []; 
let currentRecipe = null;
let activeCategoryTarget = null;
let editingRecipeId = null;
let currentPortion = 1;
let activeCategoryFilter = 'all';
let activeTagFilter = null;
let wakeLock = null; 
let currentImageBase64 = null; // Variable pour stocker l'image temporaire

// --- INIT APP ---
document.addEventListener('DOMContentLoaded', () => { 
    loadLocalData();
    navigate('home');
    
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        updateAuthUI();
        if(user) {
            initDataListener();
        }
    });
});

// --- NAVIGATION ---
function navigate(viewName) {
    document.querySelectorAll('.view-container').forEach(el => { 
        el.classList.remove('active-view'); 
        el.classList.add('hidden-view'); 
    });
    const target = document.getElementById(`view-${viewName}`);
    if(target) { target.classList.remove('hidden-view'); target.classList.add('active-view'); }
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(viewName === 'home') document.getElementById('nav-home').classList.add('active');
    if(viewName === 'cookbook') document.getElementById('nav-book').classList.add('active');
    if(viewName === 'cook') { requestWakeLock(); } else { releaseWakeLock(); }
}

function openCookbook() { setCategoryFilter('all'); renderCookbookTagsFilter(); navigate('cookbook'); }

function openAddMode() {
    editingRecipeId = null; 
    currentImageBase64 = null; // Reset image
    document.getElementById('form-title').textContent="Nouvelle Recette"; 
    resetForm(); 
    navigate('add'); 
    renderTagsInForm(); 
}

function openEditMode() {
    if(!currentRecipe) return; 
    editingRecipeId = currentRecipe.id;
    currentImageBase64 = currentRecipe.img || null; // Charger l'image existante
    document.getElementById('form-title').textContent="Modifier Recette"; 
    
    document.getElementById('add-title').value = currentRecipe.t || "";
    document.getElementById('add-emoji').value = currentRecipe.em || "🥘"; 
    document.getElementById('add-cat').value = currentRecipe.cat || 'main'; 
    document.getElementById('add-price').value = currentRecipe.price || '2'; 
    document.getElementById('add-time').value = currentRecipe.time || ""; 
    document.getElementById('add-cal').value = currentRecipe.cal || "";
    document.getElementById('add-ing').value = (currentRecipe.i || []).join('\n'); 
    document.getElementById('add-steps').value = (currentRecipe.s || []).join('\n');
    
    // Preview image dans edit
    const previewContainer = document.getElementById('add-photo-preview-container');
    if(currentImageBase64) {
        previewContainer.innerHTML = `<img src="${currentImageBase64}" class="photo-preview">`;
    } else {
        previewContainer.innerHTML = `<i class="fas fa-camera text-2xl mb-2"></i><span class="text-xs font-bold">Ajouter une photo</span>`;
    }

    renderTagsInForm(currentRecipe.tags || []); 
    navigate('add');
}

// --- GESTION IMAGES ---
function handleImageUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        compressImage(file, (base64) => {
            currentImageBase64 = base64;
            const previewContainer = document.getElementById('add-photo-preview-container');
            previewContainer.innerHTML = `<img src="${base64}" class="photo-preview">`;
        });
    }
}

function compressImage(file, callback) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 500; // Largeur max pour compression
            const scaleSize = MAX_WIDTH / img.width;
            canvas.width = MAX_WIDTH;
            canvas.height = img.height * scaleSize;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Compression JPEG 50%
            const dataUrl = canvas.toDataURL('image/jpeg', 0.5); 
            callback(dataUrl);
        }
    }
}

// --- LOGIC SAVE ---
function saveRecipe() {
    if (!currentUser) { if(!confirm("Mode hors ligne. Continuer ?")) return; }

    const title = document.getElementById('add-title').value;
    const ingText = document.getElementById('add-ing').value;
    if(!title || !ingText) { alert("Titre et ingrédients obligatoires !"); return; }
    
    let finalId = editingRecipeId ? editingRecipeId : Date.now();
    const selectedTags = [];
    document.querySelectorAll('#add-tags-container input:checked').forEach(cb => selectedTags.push(cb.value));
    
    const recipeData = {
        id: finalId, 
        t: title, 
        cat: document.getElementById('add-cat').value,
        price: document.getElementById('add-price').value,
        time: document.getElementById('add-time').value||"20", 
        cal: document.getElementById('add-cal').value||"?", 
        em: document.getElementById('add-emoji').value,
        i: ingText.split('\n').filter(l=>l.trim()!==""), 
        s: document.getElementById('add-steps').value.split('\n').filter(l=>l.trim()!==""),
        tags: selectedTags,
        img: currentImageBase64 // Sauvegarde de l'image
    };

    if(editingRecipeId) {
        const idx = allRecipes.findIndex(r => r.id === editingRecipeId);
        if(idx !== -1) allRecipes[idx] = recipeData;
    } else { 
        allRecipes.push(recipeData); 
        userStats.total++;
    }
    
    saveData(); 
    currentRecipe = recipeData;
    renderResult(currentRecipe); 
    navigate('result'); 
    editingRecipeId = null;
}

// --- RENDER FUNCTIONS (Image vs Emoji) ---

function renderResult(r) {
    currentPortion = 1; 
    document.getElementById('portion-count').textContent = currentPortion;
    
    // GESTION IMAGE/EMOJI
    const headerContainer = document.getElementById('res-header-container');
    if (r.img) {
        headerContainer.innerHTML = `<img src="${r.img}" id="res-img" class="w-full h-48 object-cover rounded-3xl shadow-md mb-4">`;
    } else {
        headerContainer.innerHTML = `<span id="res-emoji" class="text-6xl block drop-shadow-xl">${r.em}</span>`;
    }

    document.getElementById('res-title').textContent = r.t;
    document.getElementById('res-time').textContent = r.time + ' min'; document.getElementById('res-cal').textContent = r.cal + ' kcal';
    const priceEl = document.getElementById('res-price'); const p = r.price || "2"; priceEl.textContent = p === "1" ? "€" : (p === "2" ? "€€" : "€€€");
    const tagsDiv = document.getElementById('res-tags-list'); tagsDiv.innerHTML = "";
    if(r.tags && Array.isArray(r.tags)) { r.tags.forEach(t => tagsDiv.innerHTML += `<span class="text-[9px] bg-gray-100 px-2 py-0.5 rounded text-gray-500 font-bold">${t}</span>`); }
    const alertSeason = document.getElementById('season-alert');
    if(checkSeasonality(r.i)) { alertSeason.classList.remove('hidden'); } else { alertSeason.classList.add('hidden'); }
    renderIngredientsList(); updateFavIcon();
}

function openReadMode() {
    if(!currentRecipe) return;
    const content = document.getElementById('read-content');
    
    const scaledIng = getScaledIngredients(currentRecipe.i, currentPortion);
    let ingListHtml = `<ul class="list-disc pl-5 space-y-2 text-gray-700">`;
    scaledIng.forEach(i => ingListHtml += `<li>${i}</li>`);
    ingListHtml += `</ul>`;

    let stepsHtml = `<div class="space-y-4">`;
    (currentRecipe.s || []).forEach((s, i) => {
        stepsHtml += `<p class="text-gray-700"><span class="font-bold text-brand mr-2">${i+1}.</span> ${s}</p>`;
    });
    stepsHtml += `</div>`;

    // Header Image ou Emoji
    let headerHtml = '';
    if(currentRecipe.img) {
        headerHtml = `<img src="${currentRecipe.img}" class="w-full h-64 object-cover mb-6">`;
    } else {
        headerHtml = `<div class="text-center text-6xl mb-4 pt-6">${currentRecipe.em}</div>`;
    }

    content.innerHTML = `
        ${headerHtml}
        <div class="px-6 text-center mb-8">
            <h1 class="text-3xl font-black text-gray-900 mb-2">${currentRecipe.t}</h1>
            <div class="flex justify-center gap-4 text-sm text-gray-500 font-bold">
                <span><i class="far fa-clock"></i> ${currentRecipe.time} min</span>
                <span><i class="fas fa-utensils"></i> ${currentPortion} pers.</span>
            </div>
        </div>
        <div class="px-6 mb-6">
            <h3 class="font-bold text-lg mb-3">Ingrédients</h3>
            ${ingListHtml}
        </div>
        <div class="px-6">
            <h3 class="font-bold text-lg mb-3">Instructions</h3>
            ${stepsHtml}
        </div>
    `;
    navigate('read');
}

function startCooking() {
    if(!currentRecipe) return;
    document.getElementById('cook-title').textContent = currentRecipe.t; 
    document.getElementById('cook-timer-badge').textContent = currentRecipe.time+" min";
    
    // Hero Image en Cuisine
    const heroContainer = document.getElementById('cook-hero-container');
    if(currentRecipe.img) {
        heroContainer.innerHTML = `<img src="${currentRecipe.img}" class="recipe-hero-img">`;
    } else {
        heroContainer.innerHTML = "";
    }

    const iL = document.getElementById('cook-ing-list'); 
    iL.innerHTML="";
    const scaled = getScaledIngredients(currentRecipe.i, currentPortion);
    
    scaled.forEach((ing, i) => { 
        iL.innerHTML += `
        <div onclick="this.classList.toggle('checked')" class="ing-card bg-white p-4 rounded-2xl shadow-sm border border-orange-100 flex items-center justify-center text-center cursor-pointer transition-all active:scale-95 select-none">
            <span class="font-bold text-sm text-gray-700 leading-tight">${ing}</span>
        </div>`; 
    });

    const sL = document.getElementById('cook-steps-list'); 
    sL.innerHTML="";
    (currentRecipe.s||[]).forEach((s,i)=> {
        sL.innerHTML += `
        <div class="relative pl-8 pb-8 border-l-2 border-orange-100 last:border-0 last:pb-0">
            <div class="absolute -left-[17px] top-0 step-circle bg-white border-2 border-brand text-brand shadow-sm">
                ${i+1}
            </div>
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-50">
                <p class="text-gray-700 font-medium leading-relaxed">${s}</p>
            </div>
        </div>`; 
    });

    updateStatsOnClick(); 
    navigate('cook');
}

function renderCookbookList(list, targetId) {
    const container = document.getElementById(targetId); container.innerHTML = "";
    if (list.length === 0) { container.innerHTML = "<div class='text-center text-gray-400 mt-10'>Rien ici...</div>"; return; }
    list.sort((a, b) => b.id - a.id);
    list.forEach(r => {
        const isFav = favorites.includes(r.id) ? '<i class="fas fa-heart text-red-500 ml-1"></i>' : '';
        const cat = r.cat || 'main'; let catIcon = '🍗'; if(cat==='aperitif') catIcon='🥜'; if(cat==='starter') catIcon='🥗'; if(cat==='dessert') catIcon='🧁';
        
        // Miniature Image ou Emoji
        let visual = `<div class="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-2xl flex-shrink-0 relative">${r.em}<span class="absolute -bottom-1 -right-1 text-[10px] bg-white rounded-full p-0.5 border border-gray-100 shadow-sm">${catIcon}</span></div>`;
        if(r.img) {
            visual = `<div class="relative flex-shrink-0"><img src="${r.img}" class="thumb-img"><span class="absolute -bottom-1 -right-1 text-[10px] bg-white rounded-full p-0.5 border border-gray-100 shadow-sm">${catIcon}</span></div>`;
        }

        container.innerHTML += `<div onclick="currentRecipe=allRecipes.find(x=>x.id==${r.id});renderResult(currentRecipe);navigate('result')" class="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 active:scale-[0.98] transition cursor-pointer">${visual}<div class="flex-1 min-w-0"><h4 class="font-bold text-gray-800 truncate">${r.t} ${isFav}</h4><div class="flex items-center gap-2 mt-1"><span class="text-[10px] text-gray-400 font-bold"><i class="far fa-clock"></i> ${r.time} min</span></div></div><div class="text-gray-300"><i class="fas fa-chevron-right"></i></div></div>`;
    });
}

// --- RESTE DU CODE (SANS CHANGEMENT) ---
function saveData() { const localData = { recipes: allRecipes, fav: favorites, tags: userTags, stats: userStats }; localStorage.setItem('foodmood_backup', JSON.stringify(localData)); updateStatsUI(); if(currentUser) { db.ref('users/' + currentUser.uid).set(localData).then(() => console.log("✅ CLOUD OK")).catch((error) => console.error("❌ CLOUD ERR", error)); } }
function forceManualSync() { if(!currentUser) return alert("Connecte-toi !"); const btn = document.querySelector('button[onclick="forceManualSync()"]'); const txt = btn.innerHTML; btn.innerHTML = "..."; btn.disabled = true; db.ref('users/' + currentUser.uid).once('value').then((s) => { const d = s.val(); if(d) { loadDataFromObject(d); alert("OK !"); } else { alert("Vide."); } }).catch(e => alert(e.message)).finally(() => { btn.innerHTML = txt; btn.disabled = false; }); }
function resetCookingStats() { if(confirm("Reset ?")) { userStats.total = 0; saveData(); alert("Reset !"); } }
function loadDataFromObject(d) { allRecipes = d.recipes || []; favorites = d.fav || []; if(d.tags && Array.isArray(d.tags)) { userTags = d.tags; if(!userTags.includes("Création")) userTags.push("Création"); } else { userTags = ["Végétarien", "Sans Gluten", "Épicé", "Création"]; } userStats = d.stats || userStats; localStorage.setItem('foodmood_backup', JSON.stringify(d)); updateStatsUI(); }
function loadLocalData() { const b = localStorage.getItem('foodmood_backup'); if(b) { try { loadDataFromObject(JSON.parse(b)); } catch(e) {} } }
function initDataListener() { if (!currentUser) return; db.ref('users/' + currentUser.uid).on('value', (s) => { const d = s.val(); if(d) loadDataFromObject(d); }); }
function loginWithGoogle() { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(() => auth.signInWithPopup(provider)).then(() => { alert("Connecté !"); toggleSettings(); }).catch((e) => alert(e.message)); }
function logout() { auth.signOut().then(() => { alert("Déconnecté."); location.reload(); }); }
function updateAuthUI() { const i = document.getElementById('auth-indicator'), o = document.getElementById('auth-ui-logged-out'), l = document.getElementById('auth-ui-logged-in'); if (currentUser) { i.classList.remove('bg-red-500'); i.classList.add('bg-green-500'); o.classList.add('hidden'); l.classList.remove('hidden'); document.getElementById('user-email').textContent = currentUser.email; } else { i.classList.remove('bg-green-500'); i.classList.add('bg-red-500'); o.classList.remove('hidden'); l.classList.add('hidden'); } }
function addNewTag() { const i = document.getElementById('new-tag-input'), v = i.value.trim(); if(v && !userTags.includes(v)) { userTags.push(v); saveData(); i.value = ""; renderSettingsTags(); renderTagsInForm(); } }
function removeTag(t) { userTags = userTags.filter(x => x !== t); saveData(); renderSettingsTags(); }
function renderSettingsTags() { const d = document.getElementById('settings-tags-list'); d.innerHTML = ""; userTags.forEach(t => { d.innerHTML += `<div class="bg-gray-100 px-3 py-1 rounded-full text-sm flex items-center gap-2">${t} <button onclick="removeTag('${t}')" class="text-red-500"><i class="fas fa-times"></i></button></div>`; }); }
function renderTagsInForm(sel = []) { const d = document.getElementById('add-tags-container'); d.innerHTML = ""; userTags.forEach(t => { const c = sel.includes(t); d.innerHTML += `<label class="cursor-pointer select-none border border-gray-200 text-gray-500 px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1 has-[:checked]:border-brand has-[:checked]:bg-orange-50 has-[:checked]:text-brand"><input type="checkbox" value="${t}" class="hidden" ${c ? "checked" : ""}>${t}</label>`; }); }
function toggleSettings() { document.getElementById('settings-modal').classList.toggle('hidden'); renderSettingsTags(); }
function cancelEdit() { if(editingRecipeId) navigate('result'); else navigate('home'); resetForm(); editingRecipeId = null; }
function resetForm() { document.getElementById('add-title').value=""; document.getElementById('add-ing').value=""; document.getElementById('add-steps').value=""; document.getElementById('add-photo-preview-container').innerHTML = `<i class="fas fa-camera text-2xl mb-2"></i><span class="text-xs font-bold">Ajouter une photo</span>`; }
function findRecipeByCat(c) { activeCategoryTarget = c; rollDice(); navigate('result'); }
function rollDice() { let f = allRecipes; if (activeCategoryTarget && activeCategoryTarget !== 'all') { f = allRecipes.filter(r => r.cat === activeCategoryTarget); } if(f.length === 0) { alert("Vide !"); return; } currentRecipe = f[Math.floor(Math.random() * f.length)]; renderResult(currentRecipe); }
function reroll() { const c = document.getElementById('result-card'); c.classList.add('shake'); setTimeout(() => c.classList.remove('shake'), 500); rollDice(); }
function checkSeasonality(i) { if(!i) return false; const m = new Date().getMonth(), w = (m >= 10 || m <= 2); if (w) { return i.some(x => ['tomate', 'courgette', 'aubergine', 'fraise', 'melon', 'pêche', 'concombre', 'poivron'].some(b => x.toLowerCase().includes(b))); } return false; }
function changePortion(d) { if(currentPortion + d < 0.5) return; currentPortion += d; document.getElementById('portion-count').textContent = currentPortion; renderIngredientsList(); }
function getScaledIngredients(i, p) { const r = p; return i.map(l => { const m = l.match(/^(\d+(?:[\.,]\d+)?)\s*(.*)$/); if (m && p !== 1) { return `${Math.round((parseFloat(m[1].replace(',', '.')) * r) * 10) / 10} ${m[2]}`; } return l; }); }
function renderIngredientsList() { if(!currentRecipe) return; const c = document.getElementById('res-preview-ing'); c.innerHTML = ""; getScaledIngredients(currentRecipe.i, currentPortion).forEach(i => { c.innerHTML += `<span class="bg-gray-50 text-gray-600 text-[10px] px-2 py-1 rounded-md font-medium border border-gray-100">${i}</span>`; }); }
function updateFavIcon() { const b = document.getElementById('btn-fav'); if(favorites.includes(currentRecipe.id)) { b.classList.add('text-red-500'); b.classList.remove('text-gray-300'); } else { b.classList.remove('text-red-500'); b.classList.add('text-gray-300'); } }
function toggleFavorite() { if(!currentRecipe) return; const i = favorites.indexOf(currentRecipe.id); if(i === -1) { favorites.push(currentRecipe.id); } else { favorites.splice(i, 1); } saveData(); updateFavIcon(); }
function deleteCurrentRecipe() { if(!currentRecipe) return; if(confirm("Supprimer ?")) { allRecipes = allRecipes.filter(r => r.id !== currentRecipe.id); saveData(); navigate('home'); } }
function updateStatsOnClick() { if(!currentRecipe) return; const c = currentRecipe.cat || 'main'; if(userStats[c] !== undefined) userStats[c]++; userStats.total++; saveData(); }
function setCategoryFilter(c) { activeCategoryFilter = c; updateFiltersUI(); filterCookbook(); }
function updateFiltersUI() { document.querySelectorAll('.cat-filter').forEach(b => { if(b.dataset.cat === activeCategoryFilter) { b.classList.add('active', 'bg-gray-800', 'text-white', 'border-transparent'); b.classList.remove('bg-white', 'text-gray-500'); } else { b.classList.remove('active', 'bg-gray-800', 'text-white', 'border-transparent'); b.classList.add('bg-white', 'text-gray-500'); } }); }
function filterCookbook() { const t = document.getElementById('search-input').value.toLowerCase(), f = document.getElementById('btn-filter-fav').classList.contains('bg-red-500'); const r = allRecipes.filter(x => { const mt = x.t.toLowerCase().includes(t), mf = f ? favorites.includes(x.id) : true, mc = activeCategoryFilter === 'all' ? true : (x.cat || 'main') === activeCategoryFilter; let mtag = true; if(activeTagFilter) { mtag = x.tags && x.tags.includes(activeTagFilter); } return mt && mf && mc && mtag; }); renderCookbookList(r, 'cookbook-list'); }
function renderCookbookTagsFilter() { const d = document.getElementById('cookbook-tags-filter'); d.innerHTML = ""; if(userTags.length === 0) { d.style.display = 'none'; return; } d.style.display = 'flex'; userTags.forEach(t => { const a = activeTagFilter === t; d.innerHTML += `<button onclick="toggleTagFilter('${t}')" class="tag-select flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold border transition ${a ? 'active' : 'bg-white border-gray-200 text-gray-500'}">${t}</button>`; }); }
function toggleTagFilter(t) { activeTagFilter = activeTagFilter === t ? null : t; renderCookbookTagsFilter(); filterCookbook(); }
function toggleFavFilter() { const b = document.getElementById('btn-filter-fav'); b.classList.toggle('bg-red-500'); b.classList.toggle('text-white'); b.classList.toggle('bg-white'); b.classList.toggle('text-gray-300'); filterCookbook(); }
function getBadgesList() { return [ { id: 'first_cook', icon: '🐣', title: 'Premier Pas', desc: 'Cuisiner 1 recette', cond: (s) => s.total >= 1 }, { id: 'chef_5', icon: '👨‍🍳', title: 'Apprenti', desc: 'Cuisiner 5 recettes', cond: (s) => s.total >= 5 }, { id: 'chef_10', icon: '🔪', title: 'Commis', desc: 'Cuisiner 10 recettes', cond: (s) => s.total >= 10 }, { id: 'chef_20', icon: '🔥', title: 'Sous-Chef', desc: 'Cuisiner 20 recettes', cond: (s) => s.total >= 20 }, { id: 'chef_50', icon: '🎩', title: 'Chef de Partie', desc: 'Cuisiner 50 recettes', cond: (s) => s.total >= 50 }, { id: 'master', icon: '🏆', title: 'Chef Exécutif', desc: '100 recettes cuisinées', cond: (s) => s.total >= 100 }, { id: 'legend', icon: '🌟', title: 'Trois Étoiles', desc: '500 recettes cuisinées', cond: (s) => s.total >= 500 }, { id: 'healthy_10', icon: '🥗', title: 'Healthy Life', desc: '10 recettes Healthy', cond: (s) => s.healthy >= 10 }, { id: 'healthy_50', icon: '🧘', title: 'Fitness Guru', desc: '50 recettes Healthy', cond: (s) => s.healthy >= 50 }, { id: 'comfort_10', icon: '🍔', title: 'Gros Bidon', desc: '10 recettes Plaisir', cond: (s) => s.comfort >= 10 }, { id: 'comfort_50', icon: '🧸', title: 'Comfort King', desc: '50 recettes Plaisir', cond: (s) => s.comfort >= 50 }, { id: 'fast_10', icon: '⚡', title: 'Speedy', desc: '10 recettes Rapides', cond: (s) => s.fast >= 10 }, { id: 'fast_50', icon: '🏎️', title: 'L\'Éclair', desc: '50 recettes Rapides', cond: (s) => s.fast >= 50 }, { id: 'sweet_10', icon: '🧁', title: 'Bec Sucré', desc: '10 Pâtisseries', cond: (s) => s.patisserie >= 10 }, { id: 'sweet_50', icon: '🍫', title: 'Willy Wonka', desc: '50 Pâtisseries', cond: (s) => s.patisserie >= 50 }, { id: 'cheap_10', icon: '💸', title: 'Économe', desc: '10 recettes Pas Chères', cond: (s) => s.cheap >= 10 }, { id: 'cheap_50', icon: '🏦', title: 'Picsou', desc: '50 recettes Pas Chères', cond: (s) => s.cheap >= 50 }, { id: 'rich_5', icon: '💎', title: 'Luxe', desc: '5 recettes Chics', cond: (s) => s.exp >= 5 }, { id: 'rich_20', icon: '🤵', title: 'Gastronome', desc: '20 recettes Chics', cond: (s) => s.exp >= 20 }, { id: 'starter_5', icon: '🥕', title: 'Mise en bouche', desc: '5 Entrées', cond: (s) => s.starter >= 5 }, { id: 'main_50', icon: '🍗', title: 'Grand Banquet', desc: '50 Plats', cond: (s) => s.main >= 50 }, { id: 'night_owl', icon: '🦉', title: 'Oiseau de Nuit', desc: 'Cuisiner après 22h', cond: (s) => s.night >= 1 }, { id: 'morning', icon: '☀️', title: 'Lève-tôt', desc: 'Cuisiner avant 10h', cond: (s) => s.morning >= 1 }, { id: 'weekend', icon: '🎉', title: 'Dimanche', desc: 'Cuisiner le weekend', cond: (s) => s.weekend >= 5 }, { id: 'importer', icon: '🌍', title: 'Explorateur', desc: 'Importer 1 recette', cond: (s) => s.imported >= 1 }, { id: 'importer_50', icon: '🚢', title: 'Hacker', desc: 'Importer 50 recettes', cond: (s) => s.imported >= 50 }, { id: 'creator_1', icon: '✍️', title: 'Créateur', desc: '1 recette avec tag Création', cond: () => allRecipes.some(r => r.tags && r.tags.includes('Création')) }, { id: 'creator_10', icon: '🎨', title: 'Artiste', desc: '10 recettes avec tag Création', cond: () => allRecipes.filter(r => r.tags && r.tags.includes('Création')).length >= 10 }, { id: 'season', icon: '🍂', title: 'De Saison', desc: 'Cuisiner 5 fois de saison', cond: (s) => s.seasonal >= 5 }, { id: 'variety', icon: '🌈', title: 'Polyvalent', desc: 'Cuisiner 1 de chaque Mood', cond: (s) => s.healthy>0 && s.fast>0 && s.comfort>0 && s.patisserie>0 } ]; }
function openBadges() { const l = document.getElementById('badges-list'); l.innerHTML = ""; getBadgesList().forEach(b => { const u = b.cond(userStats); l.innerHTML += `<div onclick="alert('${b.title} : ${b.desc}')" class="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 border ${u ? 'border-purple-200 bg-purple-50' : 'border-gray-100'} ${u ? '' : 'badge-locked'} cursor-pointer"><div class="text-3xl mb-1">${b.icon}</div><div class="text-[10px] font-bold text-center leading-tight ${u ? 'text-purple-700' : 'text-gray-400'}">${b.title}</div></div>`; }); document.getElementById('badges-modal').classList.remove('hidden'); }
function toggleImportModal() { document.getElementById('import-modal').classList.toggle('hidden'); }
function fetchRecipeFromUrl() { const u = document.getElementById('import-url').value; const b = document.getElementById('btn-import-action'); if(!u) return; const t = b.innerHTML; b.innerHTML = '...'; b.disabled = true; const p = 'https://corsproxy.io/?' + encodeURIComponent(u); fetch(p).then(r => { if(!r.ok) throw new Error("Err"); return r.text(); }).then(h => { const parser = new DOMParser(); const doc = parser.parseFromString(h, "text/html"); let rd = null; const s = doc.querySelectorAll('script[type="application/ld+json"]'); const f = (o) => { if (!o) return null; if (o['@type'] === 'Recipe') return o; if (Array.isArray(o['@graph'])) return o['@graph'].find(x => x['@type'] === 'Recipe'); if (Array.isArray(o)) return o.find(x => x['@type'] === 'Recipe'); return null; }; for (let i of s) { try { const j = JSON.parse(i.innerText); const fd = f(j); if (fd) { rd = fd; break; } } catch(e) {} } if (rd) { document.getElementById('add-title').value = rd.name || ""; if(Array.isArray(rd.recipeIngredient)) document.getElementById('add-ing').value = rd.recipeIngredient.join('\n'); if(Array.isArray(rd.recipeInstructions)) { const st = rd.recipeInstructions.map(x => (x.text || x.name || x).replace(/&nbsp;/g, ' ').trim()).join('\n'); document.getElementById('add-steps').value = st; } else if (typeof rd.recipeInstructions === 'string') { document.getElementById('add-steps').value = rd.recipeInstructions; } let em = '🥘'; const tl = (rd.name || "").toLowerCase(); if(tl.includes('gâteau') || tl.includes('tarte') || tl.includes('sucré')) em = '🍰'; document.getElementById('add-emoji').value = em; userStats.imported++; toggleImportModal(); alert("OK !"); } else { const h1 = doc.querySelector('h1'); if(h1) { document.getElementById('add-title').value = h1.innerText.trim(); toggleImportModal(); alert("Titre seul."); } else { throw new Error("Non reconnu"); } } }).catch(e => { console.error(e); alert("Erreur."); }).finally(() => { b.innerHTML = t; b.disabled = false; }); }
function addFridgeItem() { const i = document.getElementById('fridge-input'); const v = i.value.trim(); if(v && !fridgeIngredients.includes(v)) { fridgeIngredients.push(v); i.value = ""; renderFridgeTags(); } }
function removeFridgeItem(v) { fridgeIngredients = fridgeIngredients.filter(x => x !== v); renderFridgeTags(); }
function renderFridgeTags() { const d = document.getElementById('fridge-tags'); d.innerHTML = ""; fridgeIngredients.forEach(i => { d.innerHTML += `<button onclick="removeFridgeItem('${i}')" class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">${i} <i class="fas fa-times"></i></button>`; }); }
function searchFridge() { const d = document.getElementById('fridge-results'); d.innerHTML = ""; if(fridgeIngredients.length === 0) { d.innerHTML = `<div class="text-center text-gray-400">Ajoute des ingrédients !</div>`; return; } const m = allRecipes.filter(r => r.i.some(ri => fridgeIngredients.some(fw => ri.toLowerCase().includes(fw.toLowerCase())))); if(m.length === 0) { d.innerHTML = `<div class="text-center text-gray-400">Rien trouvé...</div>`; } else { renderCookbookList(m, 'fridge-results'); } }
function shareRecipe() { if(!currentRecipe) return; const t = `👨‍🍳 Je cuisine : ${currentRecipe.t} (${currentRecipe.time}min).\n${currentRecipe.i.join(', ')}.`; if(navigator.share) { navigator.share({title: 'FoodMood', text: t}); } else { navigator.clipboard.writeText(t); alert("Copié !"); } }
async function requestWakeLock() { try { if ('wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); } } catch (err) {} }
async function releaseWakeLock() { if (wakeLock !== null) { await wakeLock.release(); wakeLock = null; } }
