// --- CONFIG FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyAi1MFx5KuzPcpKKMtursIxMUV4MqQs7Nc",
    authDomain: "foodmood-5c124.firebaseapp.com",
    // AJOUT IMPORTANT : L'adresse de la base de données
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
let fridgeIngredients = []; 
let userTags = ["Végétarien", "Sans Gluten", "Épicé"]; 
let userStats = { total:0, healthy:0, fast:0, comfort:0, patisserie:0, cheap:0, exp:0, starter:0, dessert:0, aperitif:0, night:0, morning:0, weekend:0, imported:0, created:0, seasonal:0 }; 
let currentRecipe = null;
let activeCategoryTarget = null;
let editingRecipeId = null;
let currentPortion = 2;
let activeCategoryFilter = 'all';
let activeTagFilter = null;
let wakeLock = null; 

// --- INIT APP ---
document.addEventListener('DOMContentLoaded', () => { 
    // 1. Charger le local pour l'instantanéité
    loadLocalData();
    // 2. Naviguer
    navigate('home');
    // 3. Connecter le Cloud
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        updateAuthUI();
        if(user) {
            initDataListener(); // Récupérer les données du cloud
        }
    });
});

// --- GESTION DES DONNÉES (HYBRIDE) ---

function saveData() {
    // 1. Sauvegarde Local (Phone)
    const localData = {
        recipes: allRecipes,
        fav: favorites,
        tags: userTags,
        stats: userStats
    };
    localStorage.setItem('foodmood_backup', JSON.stringify(localData));
    
    // 2. Refresh UI
    updateStatsUI();

    // 3. Sauvegarde Cloud (Si connecté)
    if(currentUser) {
        db.ref('users/' + currentUser.uid).set(localData)
          .then(() => {
              console.log("Sauvegarde Cloud réussie ✅");
          })
          .catch((error) => {
              console.error("Erreur Cloud ❌", error);
              alert("Erreur sauvegarde Cloud: " + error.message);
          });
    }
}

function loadLocalData() {
    const backup = localStorage.getItem('foodmood_backup');
    if(backup) {
        try {
            const data = JSON.parse(backup);
            allRecipes = data.recipes || [];
            favorites = data.fav || [];
            userTags = data.tags || ["Végétarien", "Sans Gluten", "Épicé"];
            userStats = data.stats || userStats;
            updateStatsUI();
        } catch(e) { console.error("Backup error", e); }
    }
}

function initDataListener() {
    if (!currentUser) return;

    const userRef = db.ref('users/' + currentUser.uid);

    userRef.on('value', (snapshot) => {
        const data = snapshot.val();
        
        // Si des données existent sur le cloud
        if(data) {
            console.log("Données reçues du Cloud 📥");
            
            // Si le cloud a plus de recettes que le local (ex: changement de téléphone), on prend le cloud
            if((data.recipes && data.recipes.length > allRecipes.length) || allRecipes.length === 0) {
                allRecipes = data.recipes || [];
                favorites = data.fav || [];
                if(data.tags) userTags = data.tags;
                if(data.stats) userStats = data.stats;
                
                // On met à jour le backup local avec les données fraîches du cloud
                localStorage.setItem('foodmood_backup', JSON.stringify(data));
                updateStatsUI();
                
                // Si on est dans le livre, on rafraichit
                if(document.getElementById('view-cookbook').classList.contains('active-view')) {
                    filterCookbook();
                }
            }
        }
    });
}

// --- AUTHENTIFICATION ---
function loginWithGoogle() {
    auth.signInWithPopup(provider)
        .then(() => { 
            alert("Connecté ! Les données vont se synchroniser."); 
            toggleSettings(); 
        })
        .catch((error) => { console.error(error); alert("Erreur connexion : " + error.message); });
}

function logout() {
    auth.signOut().then(() => { 
        alert("Déconnecté."); 
        location.reload(); 
    });
}

function updateAuthUI() {
    const indicator = document.getElementById('auth-indicator');
    const loggedOutDiv = document.getElementById('auth-ui-logged-out');
    const loggedInDiv = document.getElementById('auth-ui-logged-in');
    
    if (currentUser) {
        indicator.classList.remove('bg-red-500'); indicator.classList.add('bg-green-500');
        loggedOutDiv.classList.add('hidden');
        loggedInDiv.classList.remove('hidden');
        document.getElementById('user-email').textContent = currentUser.email;
    } else {
        indicator.classList.remove('bg-green-500'); indicator.classList.add('bg-red-500');
        loggedOutDiv.classList.remove('hidden');
        loggedInDiv.classList.add('hidden');
    }
}

// --- LOGIQUE MÉTIER ---

function addNewTag() {
    const input = document.getElementById('new-tag-input');
    const val = input.value.trim();
    if(val && !userTags.includes(val)) { 
        userTags.push(val); 
        saveData(); 
        input.value = "";
        renderSettingsTags();
        renderTagsInForm(); 
    }
}
function removeTag(tag) { 
    userTags = userTags.filter(t => t !== tag); 
    saveData(); 
    renderSettingsTags(); 
}

function renderTagsInForm(selectedTags = []) {
    const div = document.getElementById('add-tags-container'); 
    div.innerHTML = "";
    userTags.forEach(t => { 
        const isChecked = selectedTags.includes(t);
        div.innerHTML += `
        <label class="cursor-pointer select-none border border-gray-200 text-gray-500 px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1 has-[:checked]:border-brand has-[:checked]:bg-orange-50 has-[:checked]:text-brand">
            <input type="checkbox" value="${t}" class="hidden" ${isChecked ? "checked" : ""}>
            ${t}
        </label>`; 
    });
}

function toggleFavorite() {
    if(!currentRecipe) return;
    const idx = favorites.indexOf(currentRecipe.id);
    if(idx === -1) { favorites.push(currentRecipe.id); } else { favorites.splice(idx, 1); }
    saveData(); 
    updateFavIcon();
}

// --- SAUVEGARDE RECETTE ---
function saveRecipe() {
    const title = document.getElementById('add-title').value;
    const ingText = document.getElementById('add-ing').value;
    if(!title || !ingText) { alert("Champs obligatoires !"); return; }
    
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
        tags: selectedTags
    };

    if(editingRecipeId) {
        const idx = allRecipes.findIndex(r => r.id === editingRecipeId);
        if(idx !== -1) allRecipes[idx] = recipeData;
    } else { 
        allRecipes.push(recipeData); 
        userStats.total++;
        userStats.created++;
    }
    
    saveData();
    currentRecipe = recipeData;
    navigate('result'); 
    editingRecipeId = null;
}

function deleteCurrentRecipe() {
    if(!currentRecipe) return;
    if(confirm("Supprimer ?")) {
        allRecipes = allRecipes.filter(r => r.id !== currentRecipe.id);
        saveData();
        navigate('home');
    }
}

function updateStatsOnClick() {
    if(!currentRecipe) return;
    const cat = currentRecipe.cat || 'main';
    if(userStats[cat] !== undefined) userStats[cat]++;
    
    saveData();
}

function fetchRecipeFromUrl() {
    const url = document.getElementById('import-url').value; const btn = document.getElementById('btn-import-action');
    if(!url) return;
    const originalText = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyse...'; btn.disabled = true;
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
    
    fetch(proxyUrl).then(res => {
        if(!res.ok) throw new Error("Err"); return res.text();
    }).then(html => {
        const parser = new DOMParser(); const doc = parser.parseFromString(html, "text/html");
        let recipeData = null; const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
        const findRecipeInObject = (obj) => { if (!obj) return null; if (obj['@type'] === 'Recipe') return obj; if (Array.isArray(obj['@graph'])) return obj['@graph'].find(x => x['@type'] === 'Recipe'); if (Array.isArray(obj)) return obj.find(x => x['@type'] === 'Recipe'); return null; };
        for (let s of scripts) { try { const json = JSON.parse(s.innerText); const found = findRecipeInObject(json); if (found) { recipeData = found; break; } } catch(e) {} }
        
        if (recipeData) {
            document.getElementById('add-title').value = recipeData.name || "";
            if(Array.isArray(recipeData.recipeIngredient)) document.getElementById('add-ing').value = recipeData.recipeIngredient.join('\n');
            if(Array.isArray(recipeData.recipeInstructions)) { const steps = recipeData.recipeInstructions.map(s => (s.text || s.name || s).replace(/&nbsp;/g, ' ').trim()).join('\n'); document.getElementById('add-steps').value = steps; } else if (typeof recipeData.recipeInstructions === 'string') { document.getElementById('add-steps').value = recipeData.recipeInstructions; }
            let em = '🥘'; const titleLower = (recipeData.name || "").toLowerCase(); if(titleLower.includes('gâteau') || titleLower.includes('tarte') || titleLower.includes('sucré')) em = '🍰'; document.getElementById('add-emoji').value = em;
            userStats.imported++; toggleImportModal(); alert("Recette importée !");
        } else {
            const h1 = doc.querySelector('h1'); if(h1) { document.getElementById('add-title').value = h1.innerText.trim(); toggleImportModal(); alert("Import partiel (Titre uniquement)."); } else { throw new Error("Format non reconnu"); }
        }
    }).catch(e => { console.error(e); alert("Erreur import ou site protégé."); }).finally(() => { btn.innerHTML = originalText; btn.disabled = false; });
}

// --- NAVIGATION ---
function navigate(viewName) {
    document.querySelectorAll('.view-container').forEach(el => { el.classList.remove('active-view'); el.classList.add('hidden-view'); });
    document.getElementById(`view-${viewName}`).classList.remove('hidden-view');
    document.getElementById(`view-${viewName}`).classList.add('active-view');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    if(viewName === 'home') document.getElementById('nav-home').classList.add('active');
    if(viewName === 'cookbook') document.getElementById('nav-book').classList.add('active');
    
    if(viewName === 'cook') { requestWakeLock(); } else { releaseWakeLock(); }
}
function findRecipeByCat(cat) { activeCategoryTarget = cat; rollDice(); navigate('result'); }
function rollDice() {
    let filtered = allRecipes;
    if (activeCategoryTarget && activeCategoryTarget !== 'all') {
        filtered = allRecipes.filter(r => r.cat === activeCategoryTarget);
    }
    if(filtered.length === 0) { 
        alert("Aucune recette ici ! Ajoute-en une avec le bouton +"); 
        return; 
    }
    currentRecipe = filtered[Math.floor(Math.random() * filtered.length)];
    renderResult(currentRecipe);
}
function reroll() { const card = document.getElementById('result-card'); card.classList.add('shake'); setTimeout(() => card.classList.remove('shake'), 500); rollDice(); }
function renderResult(r) {
    currentPortion = 2; document.getElementById('portion-count').textContent = currentPortion;
    document.getElementById('res-emoji').textContent = r.em; document.getElementById('res-title').textContent = r.t;
    document.getElementById('res-time').textContent = r.time + ' min'; document.getElementById('res-cal').textContent = r.cal + ' kcal';
    const priceEl = document.getElementById('res-price'); const p = r.price || "2"; priceEl.textContent = p === "1" ? "€" : (p === "2" ? "€€" : "€€€");
    const tagsDiv = document.getElementById('res-tags-list'); tagsDiv.innerHTML = "";
    if(r.tags && Array.isArray(r.tags)) { r.tags.forEach(t => tagsDiv.innerHTML += `<span class="text-[9px] bg-gray-100 px-2 py-0.5 rounded text-gray-500 font-bold">${t}</span>`); }
    const alertSeason = document.getElementById('season-alert');
    if(checkSeasonality(r.i)) { alertSeason.classList.remove('hidden'); } else { alertSeason.classList.add('hidden'); }
    renderIngredientsList(); updateFavIcon();
    document.getElementById('btn-edit').classList.remove('hidden');
    document.getElementById('btn-delete').classList.remove('hidden');
}
function checkSeasonality(ingredients) {
    if(!ingredients) return false;
    const month = new Date().getMonth(); const badWinter = ['tomate', 'courgette', 'aubergine', 'fraise', 'melon', 'pêche', 'concombre', 'poivron'];
    const isWinter = (month >= 10 || month <= 2);
    if (isWinter) { return ingredients.some(ing => badWinter.some(bad => ing.toLowerCase().includes(bad))); }
    return false;
}
function changePortion(delta) {
    if(currentPortion + delta < 1) return; currentPortion += delta; document.getElementById('portion-count').textContent = currentPortion; renderIngredientsList();
}
function getScaledIngredients(ingredients, portion) {
    const ratio = portion / 2; return ingredients.map(line => {
        const match = line.match(/^(\d+(?:[\.,]\d+)?)\s*(.*)$/); if (match && portion !== 2) { let qty = parseFloat(match[1].replace(',', '.')); let newQty = Math.round((qty * ratio) * 10) / 10; return `${newQty} ${match[2]}`; } return line;
    });
}
function renderIngredientsList() {
    if(!currentRecipe) return;
    const cont = document.getElementById('res-preview-ing'); cont.innerHTML = "";
    const scaled = getScaledIngredients(currentRecipe.i, currentPortion);
    scaled.forEach(ing => { cont.innerHTML += `<span class="bg-gray-50 text-gray-600 text-[10px] px-2 py-1 rounded-md font-medium border border-gray-100">${ing}</span>`; });
}
function updateFavIcon() {
    const btn = document.getElementById('btn-fav');
    if(favorites.includes(currentRecipe.id)) { btn.classList.add('text-red-500'); btn.classList.remove('text-gray-300'); } else { btn.classList.remove('text-red-500'); btn.classList.add('text-gray-300'); }
}
function openEditMode() {
    if(!currentRecipe) return; editingRecipeId = currentRecipe.id;
    document.getElementById('form-title').textContent="Modifier Recette"; document.getElementById('add-title').value = currentRecipe.t;
    document.getElementById('add-emoji').value = currentRecipe.em; 
    document.getElementById('add-cat').value = currentRecipe.cat || 'main'; document.getElementById('add-price').value = currentRecipe.price || '2'; 
    document.getElementById('add-time').value = currentRecipe.time; document.getElementById('add-cal').value = currentRecipe.cal;
    document.getElementById('add-ing').value = currentRecipe.i.join('\n'); document.getElementById('add-steps').value = (currentRecipe.s||[]).join('\n');
    renderTagsInForm(currentRecipe.tags || []); navigate('add');
}
function startCooking() {
    if(!currentRecipe) return;
    document.getElementById('cook-title').textContent = currentRecipe.t; document.getElementById('cook-time').textContent = currentRecipe.time+" min";
    const iL = document.getElementById('cook-ing-list'); iL.innerHTML="";
    const scaled = getScaledIngredients(currentRecipe.i, currentPortion);
    scaled.forEach(ing => iL.innerHTML += `<label class="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm cursor-pointer"><input type="checkbox" class="ing-check rounded border-gray-300"><span class="font-medium text-gray-700 select-none">${ing}</span></label>`);
    const sL = document.getElementById('cook-steps-list'); sL.innerHTML="";
    (currentRecipe.s||[]).forEach((s,i)=> sL.innerHTML += `<div class="flex gap-4"><div class="flex-shrink-0 w-8 h-8 bg-orange-100 text-brand font-bold rounded-full flex items-center justify-center text-sm">${i+1}</div><p class="text-gray-600 pt-1">${s}</p></div>`);
    updateStatsOnClick(); navigate('cook');
}
async function requestWakeLock() { try { if ('wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); } } catch (err) {} }
async function releaseWakeLock() { if (wakeLock !== null) { await wakeLock.release(); wakeLock = null; } }
function openCookbook() { setCategoryFilter('all'); renderCookbookTagsFilter(); navigate('cookbook'); }
function setCategoryFilter(cat) { activeCategoryFilter = cat; updateFiltersUI(); filterCookbook(); }
function updateFiltersUI() {
    document.querySelectorAll('.cat-filter').forEach(btn => {
        if(btn.dataset.cat === activeCategoryFilter) { btn.classList.add('active', 'bg-gray-800', 'text-white', 'border-transparent'); btn.classList.remove('bg-white', 'text-gray-500'); }
        else { btn.classList.remove('active', 'bg-gray-800', 'text-white', 'border-transparent'); btn.classList.add('bg-white', 'text-gray-500'); }
    });
}
function filterCookbook() {
    const term = document.getElementById('search-input').value.toLowerCase();
    const onlyFav = document.getElementById('btn-filter-fav').classList.contains('bg-red-500');
    const filtered = allRecipes.filter(r => {
        const matchText = r.t.toLowerCase().includes(term);
        const matchFav = onlyFav ? favorites.includes(r.id) : true;
        const currentCat = r.cat || 'main'; const matchCat = activeCategoryFilter === 'all' ? true : currentCat === activeCategoryFilter;
        let matchTag = true; if(activeTagFilter) { matchTag = r.tags && r.tags.includes(activeTagFilter); }
        return matchText && matchFav && matchCat && matchTag;
    });
    renderCookbookList(filtered, 'cookbook-list');
}
function renderCookbookList(list, targetId) {
    const container = document.getElementById(targetId); container.innerHTML = "";
    if (list.length === 0) { container.innerHTML = "<div class='text-center text-gray-400 mt-10'>Rien ici...</div>"; return; }
    list.sort((a, b) => b.id - a.id);
    list.forEach(r => {
        const isFav = favorites.includes(r.id) ? '<i class="fas fa-heart text-red-500 ml-1"></i>' : '';
        const cat = r.cat || 'main'; 
        let catIcon = '🍗';
        if(cat==='aperitif') catIcon='🥜';
        if(cat==='starter') catIcon='🥗';
        if(cat==='dessert') catIcon='🧁';
        
        container.innerHTML += `<div onclick="currentRecipe=allRecipes.find(x=>x.id==${r.id});renderResult(currentRecipe);navigate('result')" class="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 active:scale-[0.98] transition cursor-pointer"><div class="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-2xl flex-shrink-0 relative">${r.em}<span class="absolute -bottom-1 -right-1 text-[10px] bg-white rounded-full p-0.5 border border-gray-100 shadow-sm">${catIcon}</span></div><div class="flex-1 min-w-0"><h4 class="font-bold text-gray-800 truncate">${r.t} ${isFav}</h4><div class="flex items-center gap-2 mt-1"><span class="text-[10px] text-gray-400 font-bold"><i class="far fa-clock"></i> ${r.time} min</span></div></div><div class="text-gray-300"><i class="fas fa-chevron-right"></i></div></div>`;
    });
}
function renderCookbookTagsFilter() {
    const div = document.getElementById('cookbook-tags-filter'); div.innerHTML = "";
    if(userTags.length === 0) { div.style.display = 'none'; return; } div.style.display = 'flex';
    userTags.forEach(t => { const isActive = activeTagFilter === t; div.innerHTML += `<button onclick="toggleTagFilter('${t}')" class="tag-select flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold border transition ${isActive ? 'active' : 'bg-white border-gray-200 text-gray-500'}">${t}</button>`; });
}
function renderSettingsTags() {
    const div = document.getElementById('settings-tags-list'); div.innerHTML = "";
    userTags.forEach(t => { div.innerHTML += `<div class="bg-gray-100 px-3 py-1 rounded-full text-sm flex items-center gap-2">${t} <button onclick="removeTag('${t}')" class="text-red-500"><i class="fas fa-times"></i></button></div>`; });
}
function openAddMode() { editingRecipeId = null; document.getElementById('form-title').textContent="Nouvelle Recette"; resetForm(); navigate('add'); renderTagsInForm(); }
function toggleImportModal() { document.getElementById('import-modal').classList.toggle('hidden'); }
function addFridgeItem() { const input = document.getElementById('fridge-input'); const val = input.value.trim(); if(val && !fridgeIngredients.includes(val)) { fridgeIngredients.push(val); input.value = ""; renderFridgeTags(); } }
function removeFridgeItem(val) { fridgeIngredients = fridgeIngredients.filter(i => i !== val); renderFridgeTags(); }
function renderFridgeTags() { const div = document.getElementById('fridge-tags'); div.innerHTML = ""; fridgeIngredients.forEach(i => { div.innerHTML += `<button onclick="removeFridgeItem('${i}')" class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">${i} <i class="fas fa-times"></i></button>`; }); }
function searchFridge() {
    const resultsDiv = document.getElementById('fridge-results'); resultsDiv.innerHTML = "";
    if(fridgeIngredients.length === 0) { resultsDiv.innerHTML = `<div class="text-center text-gray-400">Ajoute des ingrédients !</div>`; return; }
    const matches = allRecipes.filter(r => r.i.some(recipeIng => fridgeIngredients.some(fridgeWord => recipeIng.toLowerCase().includes(fridgeWord.toLowerCase()))));
    if(matches.length === 0) { resultsDiv.innerHTML = `<div class="text-center text-gray-400">Aucune recette trouvée... 🍳</div>`; } else { renderCookbookList(matches, 'fridge-results'); }
}
function openBadges() {
    const list = document.getElementById('badges-list'); list.innerHTML = ""; let unlockedCount = 0;
    const BADGES = [
        { id: 'first_cook', icon: '🐣', title: 'Premier Pas', desc: 'Cuisiner 1 recette', cond: (s) => s.total >= 1 },
        { id: 'chef_5', icon: '👨‍🍳', title: 'Apprenti', desc: 'Cuisiner 5 recettes', cond: (s) => s.total >= 5 },
        { id: 'chef_20', icon: '🔥', title: 'Sous-Chef', desc: 'Cuisiner 20 recettes', cond: (s) => s.total >= 20 },
        { id: 'importer', icon: '🌍', title: 'Explorateur', desc: 'Importer 1 recette', cond: (s) => s.imported >= 1 },
        { id: 'master', icon: '🏆', title: 'Légende', desc: '100 recettes cuisinées', cond: (s) => s.total >= 100 }
    ];
    BADGES.forEach(b => { const unlocked = b.cond(userStats); if(unlocked) unlockedCount++; list.innerHTML += `<div onclick="alert('${b.title} : ${b.desc}')" class="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 border ${unlocked ? 'border-purple-200 bg-purple-50' : 'border-gray-100'} ${unlocked ? '' : 'badge-locked'} cursor-pointer"><div class="text-3xl mb-1">${b.icon}</div><div class="text-[10px] font-bold text-center leading-tight ${unlocked ? 'text-purple-700' : 'text-gray-400'}">${b.title}</div></div>`; });
    document.getElementById('badge-count').textContent = unlockedCount; document.getElementById('badges-modal').classList.remove('hidden');
}
function shareRecipe() {
    if(!currentRecipe) return;
    const text = `👨‍🍳 Je vais cuisiner : ${currentRecipe.t} (${currentRecipe.time}min).\nIl faut : ${currentRecipe.i.join(', ')}.`;
    if(navigator.share) { navigator.share({title: 'FoodMood', text: text}); } else { navigator.clipboard.writeText(text); alert("Copié dans le presse-papier !"); }
}
function toggleSettings() { document.getElementById('settings-modal').classList.toggle('hidden'); }
function cancelEdit() { if(editingRecipeId) navigate('result'); else navigate('home'); resetForm(); editingRecipeId = null; }
function resetForm() { document.getElementById('add-title').value=""; document.getElementById('add-ing').value=""; document.getElementById('add-steps').value=""; }
function toggleTagFilter(tag) { if(activeTagFilter === tag) activeTagFilter = null; else activeTagFilter = tag; renderCookbookTagsFilter(); filterCookbook(); }
function updateStatsUI() {
    document.getElementById('total-recipes').textContent = allRecipes.length;
    document.getElementById('user-recipes-count').textContent = allRecipes.length;
    
    let badgesUnlocked = 0; 
    const BADGES = [
        { id: 'first_cook', icon: '🐣', title: 'Premier Pas', desc: 'Cuisiner 1 recette', cond: (s) => s.total >= 1 },
        { id: 'chef_5', icon: '👨‍🍳', title: 'Apprenti', desc: 'Cuisiner 5 recettes', cond: (s) => s.total >= 5 },
        { id: 'chef_20', icon: '🔥', title: 'Sous-Chef', desc: 'Cuisiner 20 recettes', cond: (s) => s.total >= 20 },
        { id: 'importer', icon: '🌍', title: 'Explorateur', desc: 'Importer 1 recette', cond: (s) => s.imported >= 1 },
        { id: 'master', icon: '🏆', title: 'Légende', desc: '100 recettes cuisinées', cond: (s) => s.total >= 100 }
    ];
    BADGES.forEach(b => { if(b.cond(userStats)) badgesUnlocked++; });
    document.getElementById('badge-count').textContent = badgesUnlocked;
}
