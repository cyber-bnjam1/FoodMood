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
let currentPortion = 1; // MODIFIÉ : Base 1
let activeCategoryFilter = 'all';
let activeTagFilter = null;
let wakeLock = null; 

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

// --- NAVIGATION (SYSTEME CENTRAL) ---
function navigate(viewName) {
    // 1. On cache toutes les vues
    document.querySelectorAll('.view-container').forEach(el => { 
        el.classList.remove('active-view'); 
        el.classList.add('hidden-view'); 
    });
    
    // 2. On affiche la bonne
    const target = document.getElementById(`view-${viewName}`);
    if(target) {
        target.classList.remove('hidden-view');
        target.classList.add('active-view');
    }

    // 3. Mise à jour Menu
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(viewName === 'home') document.getElementById('nav-home').classList.add('active');
    if(viewName === 'cookbook') document.getElementById('nav-book').classList.add('active');
    
    // 4. WakeLock pour la cuisine
    if(viewName === 'cook') { requestWakeLock(); } else { releaseWakeLock(); }
}

// --- FONCTIONS DE NAVIGATION BOUTONS ---
function openCookbook() { 
    setCategoryFilter('all'); 
    renderCookbookTagsFilter(); 
    navigate('cookbook'); 
}

function openAddMode() {
    editingRecipeId = null; 
    document.getElementById('form-title').textContent="Nouvelle Recette"; 
    resetForm(); 
    navigate('add'); 
    renderTagsInForm(); 
}

function openEditMode() {
    if(!currentRecipe) return; 
    editingRecipeId = currentRecipe.id;
    document.getElementById('form-title').textContent="Modifier Recette"; 
    
    // Remplissage sécurisé
    document.getElementById('add-title').value = currentRecipe.t || "";
    document.getElementById('add-emoji').value = currentRecipe.em || "🥘"; 
    document.getElementById('add-cat').value = currentRecipe.cat || 'main'; 
    document.getElementById('add-price').value = currentRecipe.price || '2'; 
    document.getElementById('add-time').value = currentRecipe.time || ""; 
    document.getElementById('add-cal').value = currentRecipe.cal || "";
    document.getElementById('add-ing').value = (currentRecipe.i || []).join('\n'); 
    document.getElementById('add-steps').value = (currentRecipe.s || []).join('\n');
    
    renderTagsInForm(currentRecipe.tags || []); 
    navigate('add');
}

// --- STATS & COMPTEURS ---
function updateStatsUI() {
    document.getElementById('total-recipes').textContent = allRecipes.length;
    const createdCount = allRecipes.filter(r => r.tags && r.tags.includes('Création')).length;
    document.getElementById('created-recipes-count').textContent = createdCount;
    document.getElementById('fav-count').textContent = favorites.length;
    document.getElementById('cooked-count').textContent = userStats.total;
    
    let badgesUnlocked = 0; 
    const BADGES = getBadgesList(); 
    BADGES.forEach(b => { if(b.cond(userStats)) badgesUnlocked++; });
    document.getElementById('badge-count').textContent = badgesUnlocked;
}

// --- SAUVEGARDE & SYNCHRO ---
function saveData() {
    const localData = {
        recipes: allRecipes,
        fav: favorites,
        tags: userTags,
        stats: userStats
    };
    
    localStorage.setItem('foodmood_backup', JSON.stringify(localData));
    updateStatsUI(); 

    if(currentUser) {
        db.ref('users/' + currentUser.uid).set(localData)
          .then(() => console.log("✅ CLOUD : Sauvegarde réussie"))
          .catch((error) => console.error("❌ CLOUD ERREUR", error));
    }
}

function forceManualSync() {
    if(!currentUser) return alert("Connecte-toi d'abord !");
    const btn = document.querySelector('button[onclick="forceManualSync()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> ...";
    btn.disabled = true;

    db.ref('users/' + currentUser.uid).once('value')
      .then((snapshot) => {
          const data = snapshot.val();
          if(data) {
              loadDataFromObject(data);
              alert("✅ Synchro OK !");
          } else {
              alert("Cloud vide.");
          }
      })
      .catch(e => alert("Erreur: " + e.message))
      .finally(() => { btn.innerHTML = originalText; btn.disabled = false; });
}

function resetCookingStats() {
    if(confirm("Remettre le compteur 'Cuisinés' à zéro ?")) {
        userStats.total = 0;
        saveData();
        alert("Compteur réinitialisé !");
    }
}

function loadDataFromObject(data) {
    allRecipes = data.recipes || [];
    favorites = data.fav || [];
    if(data.tags && Array.isArray(data.tags)) {
        userTags = data.tags;
        if(!userTags.includes("Création")) userTags.push("Création");
    } else {
        userTags = ["Végétarien", "Sans Gluten", "Épicé", "Création"];
    }
    userStats = data.stats || userStats;
    localStorage.setItem('foodmood_backup', JSON.stringify(data));
    updateStatsUI();
}

function loadLocalData() {
    const backup = localStorage.getItem('foodmood_backup');
    if(backup) {
        try { loadDataFromObject(JSON.parse(backup)); } 
        catch(e) { console.error("Erreur backup local", e); }
    }
}

function initDataListener() {
    if (!currentUser) return;
    const userRef = db.ref('users/' + currentUser.uid);
    userRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if(data) {
            loadDataFromObject(data);
        }
    });
}

// --- AUTH ---
function loginWithGoogle() {
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => auth.signInWithPopup(provider))
        .then(() => { alert("Connecté !"); toggleSettings(); })
        .catch((error) => { alert("Erreur Auth : " + error.message); });
}

function logout() {
    auth.signOut().then(() => { alert("Déconnecté."); location.reload(); });
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

// --- CORE LOGIC ---

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
        tags: selectedTags
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
    navigate('result'); 
    editingRecipeId = null;
}

// --- UTILS & HELPERS ---
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

function removeTag(tag) { userTags = userTags.filter(t => t !== tag); saveData(); renderSettingsTags(); }
function renderSettingsTags() { const div = document.getElementById('settings-tags-list'); div.innerHTML = ""; userTags.forEach(t => { div.innerHTML += `<div class="bg-gray-100 px-3 py-1 rounded-full text-sm flex items-center gap-2">${t} <button onclick="removeTag('${t}')" class="text-red-500"><i class="fas fa-times"></i></button></div>`; }); }
function renderTagsInForm(selectedTags = []) { const div = document.getElementById('add-tags-container'); div.innerHTML = ""; userTags.forEach(t => { const isChecked = selectedTags.includes(t); div.innerHTML += `<label class="cursor-pointer select-none border border-gray-200 text-gray-500 px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1 has-[:checked]:border-brand has-[:checked]:bg-orange-50 has-[:checked]:text-brand"><input type="checkbox" value="${t}" class="hidden" ${isChecked ? "checked" : ""}>${t}</label>`; }); }
function toggleSettings() { document.getElementById('settings-modal').classList.toggle('hidden'); renderSettingsTags(); }
function cancelEdit() { if(editingRecipeId) navigate('result'); else navigate('home'); resetForm(); editingRecipeId = null; }
function resetForm() { document.getElementById('add-title').value=""; document.getElementById('add-ing').value=""; document.getElementById('add-steps').value=""; }

function findRecipeByCat(cat) { activeCategoryTarget = cat; rollDice(); navigate('result'); }
function rollDice() {
    let filtered = allRecipes;
    if (activeCategoryTarget && activeCategoryTarget !== 'all') { filtered = allRecipes.filter(r => r.cat === activeCategoryTarget); }
    if(filtered.length === 0) { alert("Aucune recette !"); return; }
    currentRecipe = filtered[Math.floor(Math.random() * filtered.length)];
    renderResult(currentRecipe);
}
function reroll() { const card = document.getElementById('result-card'); card.classList.add('shake'); setTimeout(() => card.classList.remove('shake'), 500); rollDice(); }

function renderResult(r) {
    currentPortion = 1; // RESET A 1
    document.getElementById('portion-count').textContent = currentPortion;
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

// LOGIQUE MODIFIÉE POUR x1 et Pas 0.5
function changePortion(delta) { 
    if(currentPortion + delta < 0.5) return; 
    currentPortion += delta; 
    document.getElementById('portion-count').textContent = currentPortion; 
    renderIngredientsList(); 
}
// LOGIQUE MODIFIÉE : RATIO = PORTION (car base x1)
function getScaledIngredients(ingredients, portion) { 
    const ratio = portion; 
    return ingredients.map(line => { 
        const match = line.match(/^(\d+(?:[\.,]\d+)?)\s*(.*)$/); 
        if (match && portion !== 1) { 
            let qty = parseFloat(match[1].replace(',', '.')); 
            let newQty = Math.round((qty * ratio) * 10) / 10; 
            return `${newQty} ${match[2]}`; 
        } 
        return line; 
    }); 
}

function renderIngredientsList() { if(!currentRecipe) return; const cont = document.getElementById('res-preview-ing'); cont.innerHTML = ""; const scaled = getScaledIngredients(currentRecipe.i, currentPortion); scaled.forEach(ing => { cont.innerHTML += `<span class="bg-gray-50 text-gray-600 text-[10px] px-2 py-1 rounded-md font-medium border border-gray-100">${ing}</span>`; }); }
function updateFavIcon() { const btn = document.getElementById('btn-fav'); if(favorites.includes(currentRecipe.id)) { btn.classList.add('text-red-500'); btn.classList.remove('text-gray-300'); } else { btn.classList.remove('text-red-500'); btn.classList.add('text-gray-300'); } }

function deleteCurrentRecipe() { if(!currentRecipe) return; if(confirm("Supprimer ?")) { allRecipes = allRecipes.filter(r => r.id !== currentRecipe.id); saveData(); navigate('home'); } }
function updateStatsOnClick() { if(!currentRecipe) return; const cat = currentRecipe.cat || 'main'; if(userStats[cat] !== undefined) userStats[cat]++; userStats.total++; saveData(); }

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

function setCategoryFilter(cat) { activeCategoryFilter = cat; updateFiltersUI(); filterCookbook(); }
function updateFiltersUI() { document.querySelectorAll('.cat-filter').forEach(btn => { if(btn.dataset.cat === activeCategoryFilter) { btn.classList.add('active', 'bg-gray-800', 'text-white', 'border-transparent'); btn.classList.remove('bg-white', 'text-gray-500'); } else { btn.classList.remove('active', 'bg-gray-800', 'text-white', 'border-transparent'); btn.classList.add('bg-white', 'text-gray-500'); } }); }
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
        const cat = r.cat || 'main'; let catIcon = '🍗'; if(cat==='aperitif') catIcon='🥜'; if(cat==='starter') catIcon='🥗'; if(cat==='dessert') catIcon='🧁';
        container.innerHTML += `<div onclick="currentRecipe=allRecipes.find(x=>x.id==${r.id});renderResult(currentRecipe);navigate('result')" class="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 active:scale-[0.98] transition cursor-pointer"><div class="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-2xl flex-shrink-0 relative">${r.em}<span class="absolute -bottom-1 -right-1 text-[10px] bg-white rounded-full p-0.5 border border-gray-100 shadow-sm">${catIcon}</span></div><div class="flex-1 min-w-0"><h4 class="font-bold text-gray-800 truncate">${r.t} ${isFav}</h4><div class="flex items-center gap-2 mt-1"><span class="text-[10px] text-gray-400 font-bold"><i class="far fa-clock"></i> ${r.time} min</span></div></div><div class="text-gray-300"><i class="fas fa-chevron-right"></i></div></div>`;
    });
}
function renderCookbookTagsFilter() {
    const div = document.getElementById('cookbook-tags-filter'); div.innerHTML = "";
    if(userTags.length === 0) { div.style.display = 'none'; return; } div.style.display = 'flex';
    userTags.forEach(t => { const isActive = activeTagFilter === t; div.innerHTML += `<button onclick="toggleTagFilter('${t}')" class="tag-select flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold border transition ${isActive ? 'active' : 'bg-white border-gray-200 text-gray-500'}">${t}</button>`; });
}
function toggleTagFilter(tag) { if(activeTagFilter === tag) activeTagFilter = null; else activeTagFilter = tag; renderCookbookTagsFilter(); filterCookbook(); }

function getBadgesList() {
    return [
        { id: 'first_cook', icon: '🐣', title: 'Premier Pas', desc: 'Cuisiner 1 recette', cond: (s) => s.total >= 1 },
        { id: 'chef_5', icon: '👨‍🍳', title: 'Apprenti', desc: 'Cuisiner 5 recettes', cond: (s) => s.total >= 5 },
        { id: 'chef_10', icon: '🔪', title: 'Commis', desc: 'Cuisiner 10 recettes', cond: (s) => s.total >= 10 },
        { id: 'chef_20', icon: '🔥', title: 'Sous-Chef', desc: 'Cuisiner 20 recettes', cond: (s) => s.total >= 20 },
        { id: 'chef_50', icon: '🎩', title: 'Chef de Partie', desc: 'Cuisiner 50 recettes', cond: (s) => s.total >= 50 },
        { id: 'master', icon: '🏆', title: 'Chef Exécutif', desc: '100 recettes cuisinées', cond: (s) => s.total >= 100 },
        { id: 'legend', icon: '🌟', title: 'Trois Étoiles', desc: '500 recettes cuisinées', cond: (s) => s.total >= 500 },
        { id: 'healthy_10', icon: '🥗', title: 'Healthy Life', desc: '10 recettes Healthy', cond: (s) => s.healthy >= 10 },
        { id: 'healthy_50', icon: '🧘', title: 'Fitness Guru', desc: '50 recettes Healthy', cond: (s) => s.healthy >= 50 },
        { id: 'comfort_10', icon: '🍔', title: 'Gros Bidon', desc: '10 recettes Plaisir', cond: (s) => s.comfort >= 10 },
        { id: 'comfort_50', icon: '🧸', title: 'Comfort King', desc: '50 recettes Plaisir', cond: (s) => s.comfort >= 50 },
        { id: 'fast_10', icon: '⚡', title: 'Speedy', desc: '10 recettes Rapides', cond: (s) => s.fast >= 10 },
        { id: 'fast_50', icon: '🏎️', title: 'L\'Éclair', desc: '50 recettes Rapides', cond: (s) => s.fast >= 50 },
        { id: 'sweet_10', icon: '🧁', title: 'Bec Sucré', desc: '10 Pâtisseries', cond: (s) => s.patisserie >= 10 },
        { id: 'sweet_50', icon: '🍫', title: 'Willy Wonka', desc: '50 Pâtisseries', cond: (s) => s.patisserie >= 50 },
        { id: 'cheap_10', icon: '💸', title: 'Économe', desc: '10 recettes Pas Chères', cond: (s) => s.cheap >= 10 },
        { id: 'cheap_50', icon: '🏦', title: 'Picsou', desc: '50 recettes Pas Chères', cond: (s) => s.cheap >= 50 },
        { id: 'rich_5', icon: '💎', title: 'Luxe', desc: '5 recettes Chics', cond: (s) => s.exp >= 5 },
        { id: 'rich_20', icon: '🤵', title: 'Gastronome', desc: '20 recettes Chics', cond: (s) => s.exp >= 20 },
        { id: 'starter_5', icon: '🥕', title: 'Mise en bouche', desc: '5 Entrées', cond: (s) => s.starter >= 5 },
        { id: 'main_50', icon: '🍗', title: 'Grand Banquet', desc: '50 Plats', cond: (s) => s.main >= 50 }, 
        { id: 'night_owl', icon: '🦉', title: 'Oiseau de Nuit', desc: 'Cuisiner après 22h', cond: (s) => s.night >= 1 },
        { id: 'morning', icon: '☀️', title: 'Lève-tôt', desc: 'Cuisiner avant 10h', cond: (s) => s.morning >= 1 },
        { id: 'weekend', icon: '🎉', title: 'Dimanche', desc: 'Cuisiner le weekend', cond: (s) => s.weekend >= 5 },
        { id: 'importer', icon: '🌍', title: 'Explorateur', desc: 'Importer 1 recette', cond: (s) => s.imported >= 1 },
        { id: 'importer_50', icon: '🚢', title: 'Hacker', desc: 'Importer 50 recettes', cond: (s) => s.imported >= 50 },
        { id: 'creator_1', icon: '✍️', title: 'Créateur', desc: '1 recette avec tag Création', cond: () => allRecipes.some(r => r.tags && r.tags.includes('Création')) },
        { id: 'creator_10', icon: '🎨', title: 'Artiste', desc: '10 recettes avec tag Création', cond: () => allRecipes.filter(r => r.tags && r.tags.includes('Création')).length >= 10 },
        { id: 'season', icon: '🍂', title: 'De Saison', desc: 'Cuisiner 5 fois de saison', cond: (s) => s.seasonal >= 5 },
        { id: 'variety', icon: '🌈', title: 'Polyvalent', desc: 'Cuisiner 1 de chaque Mood', cond: (s) => s.healthy>0 && s.fast>0 && s.comfort>0 && s.patisserie>0 }
    ];
}

function openBadges() {
    const list = document.getElementById('badges-list'); 
    list.innerHTML = ""; 
    const BADGES = getBadgesList();
    BADGES.forEach(b => { 
        const unlocked = b.cond(userStats); 
        list.innerHTML += `<div onclick="alert('${b.title} : ${b.desc}')" class="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 border ${unlocked ? 'border-purple-200 bg-purple-50' : 'border-gray-100'} ${unlocked ? '' : 'badge-locked'} cursor-pointer"><div class="text-3xl mb-1">${b.icon}</div><div class="text-[10px] font-bold text-center leading-tight ${unlocked ? 'text-purple-700' : 'text-gray-400'}">${b.title}</div></div>`; 
    });
    document.getElementById('badges-modal').classList.remove('hidden');
}

function toggleImportModal() { document.getElementById('import-modal').classList.toggle('hidden'); }
function fetchRecipeFromUrl() {
    const url = document.getElementById('import-url').value; const btn = document.getElementById('btn-import-action');
    if(!url) return;
    const originalText = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyse...'; btn.disabled = true;
    const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
    fetch(proxyUrl).then(res => { if(!res.ok) throw new Error("Err"); return res.text(); }).then(html => {
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
function addFridgeItem() { const input = document.getElementById('fridge-input'); const val = input.value.trim(); if(val && !fridgeIngredients.includes(val)) { fridgeIngredients.push(val); input.value = ""; renderFridgeTags(); } }
function removeFridgeItem(val) { fridgeIngredients = fridgeIngredients.filter(i => i !== val); renderFridgeTags(); }
function renderFridgeTags() { const div = document.getElementById('fridge-tags'); div.innerHTML = ""; fridgeIngredients.forEach(i => { div.innerHTML += `<button onclick="removeFridgeItem('${i}')" class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">${i} <i class="fas fa-times"></i></button>`; }); }
function searchFridge() {
    const resultsDiv = document.getElementById('fridge-results'); resultsDiv.innerHTML = "";
    if(fridgeIngredients.length === 0) { resultsDiv.innerHTML = `<div class="text-center text-gray-400">Ajoute des ingrédients !</div>`; return; }
    const matches = allRecipes.filter(r => r.i.some(recipeIng => fridgeIngredients.some(fridgeWord => recipeIng.toLowerCase().includes(fridgeWord.toLowerCase()))));
    if(matches.length === 0) { resultsDiv.innerHTML = `<div class="text-center text-gray-400">Aucune recette trouvée... 🍳</div>`; } else { renderCookbookList(matches, 'fridge-results'); }
}
function shareRecipe() {
    if(!currentRecipe) return;
    const text = `👨‍🍳 Je vais cuisiner : ${currentRecipe.t} (${currentRecipe.time}min).\nIl faut : ${currentRecipe.i.join(', ')}.`;
    if(navigator.share) { navigator.share({title: 'FoodMood', text: text}); } else { navigator.clipboard.writeText(text); alert("Copié dans le presse-papier !"); }
}
async function requestWakeLock() { try { if ('wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); } } catch (err) {} }
async function releaseWakeLock() { if (wakeLock !== null) { await wakeLock.release(); wakeLock = null; } }
