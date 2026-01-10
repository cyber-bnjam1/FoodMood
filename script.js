// --- SCRIPT.JS ---
// Note: RECIPES_DATA chargé depuis recettes.js

// CONFIG BADGES (20+ Badges)
const BADGES_DEF = [
    { id: 'first_cook', icon: '🐣', title: 'Premier Pas', desc: 'Cuisiner 1 recette', cond: (s) => s.total >= 1 },
    { id: 'chef_5', icon: '👨‍🍳', title: 'Apprenti', desc: 'Cuisiner 5 recettes', cond: (s) => s.total >= 5 },
    { id: 'chef_20', icon: '🔥', title: 'Sous-Chef', desc: 'Cuisiner 20 recettes', cond: (s) => s.total >= 20 },
    { id: 'chef_50', icon: '👑', title: 'Chef Étoilé', desc: 'Cuisiner 50 recettes', cond: (s) => s.total >= 50 },
    { id: 'healthy_10', icon: '🥗', title: 'Healthy Life', desc: '10 recettes Healthy', cond: (s) => s.healthy >= 10 },
    { id: 'fat_10', icon: '🍔', title: 'Gros Bidon', desc: '10 recettes Plaisir', cond: (s) => s.comfort >= 10 },
    { id: 'fast_10', icon: '⚡', title: 'Speedy', desc: '10 recettes Rapides', cond: (s) => s.fast >= 10 },
    { id: 'sweet_10', icon: '🧁', title: 'Bec Sucré', desc: '10 Pâtisseries', cond: (s) => s.patisserie >= 10 },
    { id: 'cheap_10', icon: '💸', title: 'Économe', desc: '10 recettes Pas Chères', cond: (s) => s.cheap >= 10 },
    { id: 'rich_5', icon: '💎', title: 'Luxe', desc: '5 recettes Chics', cond: (s) => s.exp >= 5 },
    { id: 'starter_5', icon: '🥕', title: 'Mise en bouche', desc: '5 Entrées', cond: (s) => s.starter >= 5 },
    { id: 'dessert_10', icon: '🍰', title: 'Gourmand', desc: '10 Desserts', cond: (s) => s.dessert >= 10 },
    { id: 'night_owl', icon: '🦉', title: 'Oiseau de Nuit', desc: 'Cuisiner après 22h', cond: (s) => s.night >= 1 },
    { id: 'morning', icon: '☀️', title: 'Lève-tôt', desc: 'Cuisiner avant 10h', cond: (s) => s.morning >= 1 },
    { id: 'weekend', icon: '🎉', title: 'Dimanche', desc: 'Cuisiner le weekend', cond: (s) => s.weekend >= 5 },
    { id: 'importer', icon: '🌍', title: 'Explorateur', desc: 'Importer 1 recette Web', cond: (s) => s.imported >= 1 },
    { id: 'creator', icon: '✍️', title: 'Créateur', desc: 'Créer 5 recettes perso', cond: (s) => s.created >= 5 },
    { id: 'season', icon: '🍂', title: 'De Saison', desc: 'Cuisiner 5 fois de saison', cond: (s) => s.seasonal >= 5 },
    { id: 'variety', icon: '🌈', title: 'Polyvalent', desc: 'Cuisiner 1 de chaque Mood', cond: (s) => s.healthy>0 && s.fast>0 && s.comfort>0 && s.patisserie>0 },
    { id: 'master', icon: '🏆', title: 'Légende', desc: '100 recettes cuisinées', cond: (s) => s.total >= 100 }
];

// STATES
let allRecipes = [];
let favorites = [];
let shoppingList = [];
let fridgeIngredients = []; 
let userTags = []; // Tags perso
let userStats = {}; // Stats pour badges
let currentRecipe = null;
let activeMood = '';
let editingRecipeId = null;
let currentPortion = 2;
let activeCategoryFilter = 'all';
let activeTagFilter = null; // Filtre tag en cours
let wakeLock = null; 

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => { initApp(); });
async function initApp() { 
    loadSettings();
    await loadRecipes(); 
    loadFavorites(); 
    loadShoppingList(); 
    renderShoppingList(); 
    updateStatsUI();
}

function loadSettings() {
    userTags = JSON.parse(localStorage.getItem('foodmood_tags') || '["Végétarien", "Sans Gluten", "Épicé"]');
    userStats = JSON.parse(localStorage.getItem('foodmood_stats') || '{"total":0,"healthy":0,"fast":0,"comfort":0,"patisserie":0,"cheap":0,"exp":0,"starter":0,"dessert":0,"night":0,"morning":0,"weekend":0,"imported":0,"created":0,"seasonal":0}');
    renderSettingsTags();
}

async function loadRecipes() {
    let externalRecipes = []; let dessertRecipes = [];
    try { const r = await fetch('data/recettes.json'); if (r.ok) externalRecipes = await r.json(); } catch (e) {}
    try { const r = await fetch('data/desserts.json'); if (r.ok) { const d = await r.json(); dessertRecipes = d.map(x => ({...x, mood: 'patisserie', cat: 'dessert', price: "2"})); } } catch (e) {}
    const userLocalRecipes = JSON.parse(localStorage.getItem('foodmood_user_recipes') || '[]');
    const baseRecipes = (typeof RECIPES_DATA !== 'undefined') ? RECIPES_DATA : [];
    allRecipes = [...baseRecipes, ...externalRecipes, ...dessertRecipes, ...userLocalRecipes];
    updateStatsUI();
}

// --- GESTION DES TAGS PERSO ---
function addNewTag() {
    const input = document.getElementById('new-tag-input');
    const val = input.value.trim();
    if(val && !userTags.includes(val)) {
        userTags.push(val);
        localStorage.setItem('foodmood_tags', JSON.stringify(userTags));
        input.value = "";
        renderSettingsTags();
    }
}
function removeTag(tag) {
    userTags = userTags.filter(t => t !== tag);
    localStorage.setItem('foodmood_tags', JSON.stringify(userTags));
    renderSettingsTags();
}
function renderSettingsTags() {
    const div = document.getElementById('settings-tags-list');
    div.innerHTML = "";
    userTags.forEach(t => {
        div.innerHTML += `<div class="bg-gray-100 px-3 py-1 rounded-full text-sm flex items-center gap-2">${t} <button onclick="removeTag('${t}')" class="text-red-500"><i class="fas fa-times"></i></button></div>`;
    });
}
function renderTagsInForm(selectedTags = []) {
    const div = document.getElementById('add-tags-container');
    div.innerHTML = "";
    userTags.forEach(t => {
        const isSelected = selectedTags.includes(t);
        div.innerHTML += `<label class="cursor-pointer select-none bg-white border ${isSelected?'border-brand bg-orange-50 text-brand':'border-gray-200 text-gray-500'} px-3 py-1 rounded-full text-xs font-bold transition"><input type="checkbox" value="${t}" class="hidden tag-checkbox" ${isSelected?'checked':''} onchange="this.parentElement.classList.toggle('border-brand');this.parentElement.classList.toggle('text-brand');this.parentElement.classList.toggle('bg-orange-50')">${t}</label>`;
    });
}

// --- SAISONNALITÉ ---
function checkSeasonality(ingredients) {
    const month = new Date().getMonth(); // 0-11
    // Liste simplifiée d'ingrédients "problématiques" hors saison
    // Hiver (Nov-Mars): Pas de Tomate, Courgette, Aubergine, Fraise, Melon, Pêche
    const badWinter = ['tomate', 'courgette', 'aubergine', 'fraise', 'melon', 'pêche', 'concombre', 'poivron'];
    const isWinter = (month >= 10 || month <= 2);
    
    if (isWinter) {
        return ingredients.some(ing => badWinter.some(bad => ing.toLowerCase().includes(bad)));
    }
    return false;
}

// --- BADGES SYSTEM ---
function openBadges() {
    const list = document.getElementById('badges-list');
    list.innerHTML = "";
    let unlockedCount = 0;
    
    BADGES_DEF.forEach(b => {
        const unlocked = b.cond(userStats);
        if(unlocked) unlockedCount++;
        
        // Clic sur badge pour voir détails
        list.innerHTML += `
        <div onclick="alert('${b.title} : ${b.desc}')" class="flex flex-col items-center justify-center p-3 rounded-2xl bg-gray-50 border ${unlocked ? 'border-purple-200 bg-purple-50' : 'border-gray-100'} ${unlocked ? '' : 'badge-locked'} cursor-pointer">
            <div class="text-3xl mb-1">${b.icon}</div>
            <div class="text-[10px] font-bold text-center leading-tight ${unlocked ? 'text-purple-700' : 'text-gray-400'}">${b.title}</div>
        </div>`;
    });
    
    document.getElementById('badge-count').textContent = unlockedCount;
    document.getElementById('badges-modal').classList.remove('hidden');
}

function updateStatsOnClick() {
    if(!currentRecipe) return;
    
    // Incrémente Stats
    userStats.total++;
    if(currentRecipe.mood === 'healthy') userStats.healthy++;
    if(currentRecipe.mood === 'fast') userStats.fast++;
    if(currentRecipe.mood === 'comfort') userStats.comfort++;
    if(currentRecipe.mood === 'patisserie') userStats.patisserie++;
    if(currentRecipe.cat === 'starter') userStats.starter++;
    if(currentRecipe.cat === 'dessert') userStats.dessert++;
    if(currentRecipe.price === '1') userStats.cheap++;
    if(currentRecipe.price === '3') userStats.exp++;
    if(currentRecipe.id > 1000) userStats.created++; // ID > 1000 = perso
    
    const hour = new Date().getHours();
    if(hour < 10) userStats.morning++;
    if(hour >= 22) userStats.night++;
    const day = new Date().getDay();
    if(day === 0 || day === 6) userStats.weekend++;

    // Check saison
    if(!checkSeasonality(currentRecipe.i)) userStats.seasonal++;

    localStorage.setItem('foodmood_stats', JSON.stringify(userStats));
    
    // Check nouveaux badges débloqués (optionnel: afficher notif)
    updateStatsUI();
}

// --- FAVORIS ---
function loadFavorites() { favorites = JSON.parse(localStorage.getItem('foodmood_favorites') || '[]'); updateStatsUI(); }
function toggleFavorite() {
    if(!currentRecipe) return;
    const idx = favorites.indexOf(currentRecipe.id);
    if(idx === -1) { favorites.push(currentRecipe.id); } else { favorites.splice(idx, 1); }
    localStorage.setItem('foodmood_favorites', JSON.stringify(favorites));
    updateFavIcon(); updateStatsUI();
}
function updateFavIcon() {
    const btn = document.getElementById('btn-fav');
    if(favorites.includes(currentRecipe.id)) { btn.classList.add('text-red-500'); btn.classList.remove('text-gray-300'); } 
    else { btn.classList.remove('text-red-500'); btn.classList.add('text-gray-300'); }
}
function toggleFavFilter() {
    const btn = document.getElementById('btn-filter-fav');
    btn.classList.toggle('bg-red-500'); btn.classList.toggle('text-white');
    filterCookbook();
}
function updateStatsUI() {
    // Calcul badges unlocked
    let badgesUnlocked = 0;
    BADGES_DEF.forEach(b => { if(b.cond(userStats)) badgesUnlocked++; });

    const baseCount = (typeof RECIPES_DATA !== 'undefined') ? RECIPES_DATA.length : 0;
    document.getElementById('total-recipes').textContent = allRecipes.length;
    document.getElementById('user-recipes-count').textContent = allRecipes.length - baseCount;
    document.getElementById('fav-count').textContent = favorites.length;
    document.getElementById('badge-count').textContent = badgesUnlocked;
}

// --- FRIDGE MODE ---
function addFridgeItem() {
    const input = document.getElementById('fridge-input'); const val = input.value.trim();
    if(val && !fridgeIngredients.includes(val)) { fridgeIngredients.push(val); input.value = ""; renderFridgeTags(); }
}
function removeFridgeItem(val) { fridgeIngredients = fridgeIngredients.filter(i => i !== val); renderFridgeTags(); }
function renderFridgeTags() {
    const div = document.getElementById('fridge-tags'); div.innerHTML = "";
    fridgeIngredients.forEach(i => { div.innerHTML += `<button onclick="removeFridgeItem('${i}')" class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">${i} <i class="fas fa-times"></i></button>`; });
}
function searchFridge() {
    const resultsDiv = document.getElementById('fridge-results'); resultsDiv.innerHTML = "";
    if(fridgeIngredients.length === 0) { resultsDiv.innerHTML = `<div class="text-center text-gray-400">Ajoute des ingrédients !</div>`; return; }
    const matches = allRecipes.filter(r => r.i.some(recipeIng => fridgeIngredients.some(fridgeWord => recipeIng.toLowerCase().includes(fridgeWord.toLowerCase()))));
    if(matches.length === 0) { resultsDiv.innerHTML = `<div class="text-center text-gray-400">Aucune recette trouvée... 🍳</div>`; } 
    else { renderCookbookList(matches, 'fridge-results'); }
}

// --- WAKE LOCK ---
async function requestWakeLock() { try { if ('wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); } } catch (err) {} }
async function releaseWakeLock() { if (wakeLock !== null) { await wakeLock.release(); wakeLock = null; } }

// --- SMART SHOPPING ---
function loadShoppingList() { shoppingList = JSON.parse(localStorage.getItem('foodmood_shopping') || '[]'); }
function saveShoppingList() { localStorage.setItem('foodmood_shopping', JSON.stringify(shoppingList)); renderShoppingList(); }
function addShopItemManually() {
    const val = document.getElementById('shop-input').value;
    if(val) { shoppingList.push({t: val, done: false}); saveShoppingList(); document.getElementById('shop-input').value = ""; }
}
function addAllToShop() {
    if(!currentRecipe) return;
    const scaledIng = getScaledIngredients(currentRecipe.i, currentPortion);
    scaledIng.forEach(ing => shoppingList.push({t: ing, done: false}));
    saveShoppingList(); alert("Ajouté au panier !");
}
function toggleShopItem(idx) { shoppingList[idx].done = !shoppingList[idx].done; saveShoppingList(); }
function clearShoppingList() { shoppingList = []; saveShoppingList(); }
function getCategoryForIngredient(name) {
    const n = name.toLowerCase();
    const cats = {
        '🥬 Fruits & Légumes': ['pomme','poire','banane','citron','orange','fraise','kiwi','tomate','salade','oignon','ail','échalote','carotte','courgette','poivron','champignon','avocat','concombre','pomme de terre','haricot','épinard','légume','herbe','basilic','persil','ciboulette','menthe'],
        '🥩 Viandes & Poissons': ['poulet','boeuf','porc','jambon','lardons','saucisse','steak','haché','bacon','thon','saumon','crevette','poisson','cabillaud','surimi','dinde'],
        '🥛 Frais & Crèmerie': ['lait','beurre','crème','yaourt','fromage','oeuf','emmental','mozzarella','parmesan','cheddar','comté','raclette','chèvre'],
        '🍝 Épicerie': ['riz','pâtes','spaghetti','coquillette','tortilla','pain','burger','mie','farine','sucre','sel','poivre','huile','vinaigre','épice','curry','paprika','sauce','mayonnaise','ketchup','soja','chocolat','cacao','levure','vanille','biscuit','bouillon','maïs','thon boite']
    };
    for (const [cat, keywords] of Object.entries(cats)) {
        if (keywords.some(k => n.includes(k))) return cat;
    }
    return '🛒 Divers';
}
function renderShoppingList() {
    const container = document.getElementById('shopping-list'); container.innerHTML = "";
    if(shoppingList.length === 0) { container.innerHTML = "<div class='text-center text-gray-400 mt-10'>Panier vide 🛒</div>"; return; }
    const groups = {};
    shoppingList.forEach((item, idx) => {
        const cat = getCategoryForIngredient(item.t);
        if(!groups[cat]) groups[cat] = [];
        groups[cat].push({ ...item, originalIdx: idx });
    });
    Object.keys(groups).sort().forEach(cat => {
        container.innerHTML += `<h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mt-4 mb-2 ml-1">${cat}</h3>`;
        groups[cat].forEach(item => {
            container.innerHTML += `<div onclick="toggleShopItem(${item.originalIdx})" class="bg-white p-3 rounded-xl border border-gray-100 flex items-center gap-3 active:scale-[0.98] transition cursor-pointer mb-2"><div class="w-5 h-5 rounded border ${item.done?'bg-brand border-brand':'border-gray-300'} flex items-center justify-center">${item.done?'<i class="fas fa-check text-white text-xs"></i>':''}</div><span class="${item.done?'line-through text-gray-400':'text-gray-800'} font-medium">${item.t}</span></div>`;
        });
    });
}

// --- PORTION CALCULATOR ---
function changePortion(delta) {
    if(currentPortion + delta < 1) return;
    currentPortion += delta;
    document.getElementById('portion-count').textContent = currentPortion;
    renderIngredientsList();
}
function getScaledIngredients(ingredients, portion) {
    const ratio = portion / 2; 
    return ingredients.map(line => {
        const match = line.match(/^(\d+(?:[\.,]\d+)?)\s*(.*)$/); 
        if (match && portion !== 2) {
            let qty = parseFloat(match[1].replace(',', '.'));
            let newQty = Math.round((qty * ratio) * 10) / 10; 
            return `${newQty} ${match[2]}`;
        }
        return line;
    });
}
function renderIngredientsList() {
    if(!currentRecipe) return;
    const cont = document.getElementById('res-preview-ing');
    cont.innerHTML = "";
    const scaled = getScaledIngredients(currentRecipe.i, currentPortion);
    scaled.forEach(ing => {
        cont.innerHTML += `<span class="bg-gray-50 text-gray-600 text-[10px] px-2 py-1 rounded-md font-medium border border-gray-100">${ing}</span>`;
    });
}

// --- NAVIGATION & UI ---
function navigate(viewName) {
    document.querySelectorAll('.view-container').forEach(el => { el.classList.remove('active-view'); el.classList.add('hidden-view'); });
    document.getElementById(`view-${viewName}`).classList.remove('hidden-view');
    document.getElementById(`view-${viewName}`).classList.add('active-view');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(viewName === 'home') document.getElementById('nav-home').classList.add('active');
    if(viewName === 'cookbook') document.getElementById('nav-book').classList.add('active');
    if(viewName === 'shop') document.getElementById('nav-shop').classList.add('active');
    if(viewName === 'cook') { requestWakeLock(); } else { releaseWakeLock(); }
}
function findRecipe(mood) { activeMood = mood; rollDice(); navigate('result'); }
function rollDice() {
    let filtered = activeMood === 'all' ? allRecipes : allRecipes.filter(r => r.mood === activeMood);
    if(filtered.length === 0) filtered = allRecipes; 
    currentRecipe = filtered[Math.floor(Math.random() * filtered.length)];
    renderResult(currentRecipe);
}
function reroll() {
    const card = document.getElementById('result-card'); card.classList.add('shake');
    setTimeout(() => card.classList.remove('shake'), 500); rollDice();
}

function renderResult(r) {
    currentPortion = 2; 
    document.getElementById('portion-count').textContent = currentPortion;
    document.getElementById('res-emoji').textContent = r.em;
    document.getElementById('res-title').textContent = r.t;
    document.getElementById('res-time').textContent = r.time + ' min';
    document.getElementById('res-cal').textContent = r.cal + ' kcal';
    
    const priceEl = document.getElementById('res-price');
    const p = r.price || "2";
    priceEl.textContent = p === "1" ? "€" : (p === "2" ? "€€" : "€€€");

    // Affichage des tags sur la carte
    const tagsDiv = document.getElementById('res-tags-list');
    tagsDiv.innerHTML = "";
    if(r.tags && Array.isArray(r.tags)) {
        r.tags.forEach(t => tagsDiv.innerHTML += `<span class="text-[9px] bg-gray-100 px-2 py-0.5 rounded text-gray-500 font-bold">${t}</span>`);
    }

    // Alerte Saison
    const alertSeason = document.getElementById('season-alert');
    if(checkSeasonality(r.i)) { alertSeason.classList.remove('hidden'); } else { alertSeason.classList.add('hidden'); }
    
    renderIngredientsList();
    updateFavIcon();
    
    const btnDel = document.getElementById('btn-delete');
    const btnEdit = document.getElementById('btn-edit');
    btnEdit.classList.remove('hidden'); 
    if(r.id > 1000) btnDel.classList.remove('hidden'); else btnDel.classList.add('hidden');
}

// --- COOKBOOK & FILTERS ---
function openCookbook() { 
    setCategoryFilter('all'); 
    renderCookbookTagsFilter();
    navigate('cookbook'); 
}

function renderCookbookTagsFilter() {
    const div = document.getElementById('cookbook-tags-filter');
    div.innerHTML = "";
    if(userTags.length === 0) { div.style.display = 'none'; return; }
    div.style.display = 'flex';
    
    userTags.forEach(t => {
        const isActive = activeTagFilter === t;
        div.innerHTML += `<button onclick="toggleTagFilter('${t}')" class="tag-select flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold border transition ${isActive ? 'active' : 'bg-white border-gray-200 text-gray-500'}">${t}</button>`;
    });
}
function toggleTagFilter(tag) {
    if(activeTagFilter === tag) activeTagFilter = null; else activeTagFilter = tag;
    renderCookbookTagsFilter();
    filterCookbook();
}

function setCategoryFilter(cat) {
    activeCategoryFilter = cat;
    document.querySelectorAll('.cat-filter').forEach(btn => {
        if(btn.dataset.cat === cat) {
            btn.classList.add('active', 'bg-gray-800', 'text-white', 'border-transparent');
            btn.classList.remove('bg-white', 'text-gray-500');
        } else {
            btn.classList.remove('active', 'bg-gray-800', 'text-white', 'border-transparent');
            btn.classList.add('bg-white', 'text-gray-500');
        }
    });
    filterCookbook();
}
function filterCookbook() {
    const term = document.getElementById('search-input').value.toLowerCase();
    const onlyFav = document.getElementById('btn-filter-fav').classList.contains('bg-red-500');
    
    const filtered = allRecipes.filter(r => {
        const matchText = r.t.toLowerCase().includes(term) || r.mood.includes(term);
        const matchFav = onlyFav ? favorites.includes(r.id) : true;
        const currentCat = r.cat || 'main'; 
        const matchCat = activeCategoryFilter === 'all' ? true : currentCat === activeCategoryFilter;
        
        // Filtre Tag Perso
        let matchTag = true;
        if(activeTagFilter) {
            matchTag = r.tags && r.tags.includes(activeTagFilter);
        }

        return matchText && matchFav && matchCat && matchTag;
    });
    renderCookbookList(filtered, 'cookbook-list');
}
function renderCookbookList(list, targetId) {
    const container = document.getElementById(targetId); container.innerHTML = "";
    if (list.length === 0) { container.innerHTML = "<div class='text-center text-gray-400 mt-10'>Rien ici...</div>"; return; }
    list.sort((a, b) => b.id - a.id);
    list.forEach(r => {
        let moodIcon = '⚡️'; let moodColor = 'bg-gray-100 text-gray-700';
        if(r.mood==='fast') { moodIcon='⚡️'; moodColor='bg-yellow-100 text-yellow-700'; }
        else if(r.mood==='healthy') { moodIcon='🥗'; moodColor='bg-green-100 text-green-700'; }
        else if(r.mood==='comfort') { moodIcon='🍔'; moodColor='bg-red-100 text-red-700'; }
        else if(r.mood==='patisserie') { moodIcon='🧁'; moodColor='bg-pink-100 text-pink-700'; }

        const isFav = favorites.includes(r.id) ? '<i class="fas fa-heart text-red-500 ml-1"></i>' : '';
        const cat = r.cat || 'main';
        const catIcon = cat === 'starter' ? '🥕' : (cat === 'dessert' ? '🍰' : '🍗');

        container.innerHTML += `
        <div onclick="currentRecipe=allRecipes.find(x=>x.id==${r.id});renderResult(currentRecipe);navigate('result')" class="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 active:scale-[0.98] transition cursor-pointer">
            <div class="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-2xl flex-shrink-0 relative">
                ${r.em}
                <span class="absolute -bottom-1 -right-1 text-[10px] bg-white rounded-full p-0.5 border border-gray-100 shadow-sm">${catIcon}</span>
            </div>
            <div class="flex-1 min-w-0">
                <h4 class="font-bold text-gray-800 truncate">${r.t} ${isFav}</h4>
                <div class="flex items-center gap-2 mt-1">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${moodColor}">${moodIcon} ${r.mood.toUpperCase()}</span>
                    <span class="text-[10px] text-gray-400 font-bold"><i class="far fa-clock"></i> ${r.time} min</span>
                </div>
            </div>
            <div class="text-gray-300"><i class="fas fa-chevron-right"></i></div>
        </div>`;
    });
}

// --- ADD/EDIT ---
function openAddMode() { editingRecipeId = null; document.getElementById('form-title').textContent="Nouvelle Recette"; resetForm(); navigate('add'); renderTagsInForm(); }
function openEditMode() {
    if(!currentRecipe) return; editingRecipeId = currentRecipe.id;
    document.getElementById('form-title').textContent="Modifier Recette";
    document.getElementById('add-title').value = currentRecipe.t;
    document.getElementById('add-emoji').value = currentRecipe.em;
    document.getElementById('add-mood').value = currentRecipe.mood;
    document.getElementById('add-cat').value = currentRecipe.cat || 'main'; 
    document.getElementById('add-price').value = currentRecipe.price || '2'; 
    document.getElementById('add-time').value = currentRecipe.time;
    document.getElementById('add-cal').value = currentRecipe.cal;
    document.getElementById('add-ing').value = currentRecipe.i.join('\n');
    document.getElementById('add-steps').value = (currentRecipe.s||[]).join('\n');
    
    // Remplir tags
    renderTagsInForm(currentRecipe.tags || []);
    
    navigate('add');
}
function cancelEdit() { if(editingRecipeId) navigate('result'); else navigate('home'); resetForm(); editingRecipeId = null; }
function resetForm() { document.getElementById('add-title').value=""; document.getElementById('add-ing').value=""; document.getElementById('add-steps').value=""; }

function toggleImportModal() { document.getElementById('import-modal').classList.toggle('hidden'); }
async function fetchRecipeFromUrl() {
    const url = document.getElementById('import-url').value;
    const btn = document.getElementById('btn-import-action');
    if(!url) return;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyse...';
    btn.disabled = true;
    try {
        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Erreur réseau");
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        let recipeData = null;
        const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
        const findRecipeInObject = (obj) => {
            if (!obj) return null;
            if (obj['@type'] === 'Recipe') return obj;
            if (Array.isArray(obj['@graph'])) return obj['@graph'].find(x => x['@type'] === 'Recipe');
            if (Array.isArray(obj)) return obj.find(x => x['@type'] === 'Recipe');
            return null;
        };
        for (let s of scripts) { try { const json = JSON.parse(s.innerText); const found = findRecipeInObject(json); if (found) { recipeData = found; break; } } catch(e) {} }

        if (recipeData) {
            document.getElementById('add-title').value = recipeData.name || "";
            if(Array.isArray(recipeData.recipeIngredient)) document.getElementById('add-ing').value = recipeData.recipeIngredient.join('\n');
            if(Array.isArray(recipeData.recipeInstructions)) {
                const steps = recipeData.recipeInstructions.map(s => (s.text || s.name || s).replace(/&nbsp;/g, ' ').trim()).join('\n');
                document.getElementById('add-steps').value = steps;
            } else if (typeof recipeData.recipeInstructions === 'string') { document.getElementById('add-steps').value = recipeData.recipeInstructions; }
            const titleLower = (recipeData.name || "").toLowerCase();
            let em = '🥘';
            if(titleLower.includes('gâteau') || titleLower.includes('tarte') || titleLower.includes('sucré')) em = '🍰';
            if(titleLower.includes('salade')) em = '🥗';
            if(titleLower.includes('soupe')) em = '🥣';
            if(titleLower.includes('pizza')) em = '🍕';
            if(titleLower.includes('burger')) em = '🍔';
            document.getElementById('add-emoji').value = em;
            const timeStr = recipeData.totalTime || recipeData.cookTime;
            if(timeStr) {
                const hoursMatch = timeStr.match(/(\d+)H/);
                const minsMatch = timeStr.match(/(\d+)M/);
                let totalMin = 0;
                if(hoursMatch) totalMin += parseInt(hoursMatch[1]) * 60;
                if(minsMatch) totalMin += parseInt(minsMatch[1]);
                if(totalMin > 0) document.getElementById('add-time').value = totalMin;
            }
            // Stats : recette importée
            userStats.imported++; localStorage.setItem('foodmood_stats', JSON.stringify(userStats)); updateStatsUI();
            
            toggleImportModal(); alert("Recette importée !");
        } else {
            const h1 = doc.querySelector('h1');
            if(h1) { document.getElementById('add-title').value = h1.innerText.trim(); toggleImportModal(); alert("Import partiel (Titre uniquement)."); } 
            else { throw new Error("Format non reconnu"); }
        }
    } catch (e) { console.error(e); alert("Impossible d'importer automatiquement."); } finally { btn.innerHTML = originalText; btn.disabled = false; }
}

function saveRecipe() {
    const title = document.getElementById('add-title').value;
    const ingText = document.getElementById('add-ing').value;
    if(!title || !ingText) { alert("Champs obligatoires !"); return; }
    
    let finalId = (editingRecipeId && editingRecipeId < 1000) ? Date.now() : (editingRecipeId ? editingRecipeId : Date.now());
    
    // Récupérer Tags sélectionnés
    const selectedTags = [];
    document.querySelectorAll('.tag-checkbox:checked').forEach(cb => selectedTags.push(cb.value));
    
    const recipeData = {
        id: finalId, t: title, 
        mood: document.getElementById('add-mood').value, 
        cat: document.getElementById('add-cat').value,
        price: document.getElementById('add-price').value,
        time: document.getElementById('add-time').value||"20",
        cal: document.getElementById('add-cal').value||"?", em: document.getElementById('add-emoji').value,
        i: ingText.split('\n').filter(l=>l.trim()!==""), s: document.getElementById('add-steps').value.split('\n').filter(l=>l.trim()!==""),
        tags: selectedTags
    };

    let userRecipes = JSON.parse(localStorage.getItem('foodmood_user_recipes') || '[]');
    if(editingRecipeId && editingRecipeId > 1000) {
        const idx = userRecipes.findIndex(r => r.id === editingRecipeId);
        if(idx !== -1) userRecipes[idx] = recipeData;
    } else { userRecipes.push(recipeData); }
    
    localStorage.setItem('foodmood_user_recipes', JSON.stringify(userRecipes));
    currentRecipe = recipeData;
    loadRecipes().then(() => { renderResult(recipeData); navigate('result'); });
    editingRecipeId = null;
}

// --- UTILS ---
function shareRecipe() {
    if(!currentRecipe) return;
    const text = `👨‍🍳 Je vais cuisiner : ${currentRecipe.t} (${currentRecipe.time}min).\nIl faut : ${currentRecipe.i.join(', ')}.`;
    if(navigator.share) { navigator.share({title: 'FoodMood', text: text}); }
    else { navigator.clipboard.writeText(text); alert("Copié dans le presse-papier !"); }
}

function toggleSettings() { document.getElementById('settings-modal').classList.toggle('hidden'); }
function exportData() {
    const data = { recipes: JSON.parse(localStorage.getItem('foodmood_user_recipes') || '[]'), fav: favorites, shop: shoppingList, tags: userTags, stats: userStats };
    const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = "foodmood_backup.json"; a.click();
}
function importData(input) {
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = JSON.parse(e.target.result);
        if(data.recipes) localStorage.setItem('foodmood_user_recipes', JSON.stringify(data.recipes));
        if(data.fav) localStorage.setItem('foodmood_favorites', JSON.stringify(data.fav));
        if(data.shop) localStorage.setItem('foodmood_shopping', JSON.stringify(data.shop));
        if(data.tags) localStorage.setItem('foodmood_tags', JSON.stringify(data.tags));
        if(data.stats) localStorage.setItem('foodmood_stats', JSON.stringify(data.stats));
        alert("Données restaurées !"); location.reload();
    };
    reader.readAsText(file);
}
function deleteCurrentRecipe() {
    if(!currentRecipe || currentRecipe.id < 1000) return;
    if(confirm("Supprimer ?")) {
        let userRecipes = JSON.parse(localStorage.getItem('foodmood_user_recipes') || '[]');
        userRecipes = userRecipes.filter(r => r.id !== currentRecipe.id);
        localStorage.setItem('foodmood_user_recipes', JSON.stringify(userRecipes));
        loadRecipes(); navigate('home');
    }
}
function startCooking() {
    if(!currentRecipe) return;
    document.getElementById('cook-title').textContent = currentRecipe.t;
    document.getElementById('cook-time').textContent = currentRecipe.time+" min";
    const iL = document.getElementById('cook-ing-list'); iL.innerHTML="";
    const scaled = getScaledIngredients(currentRecipe.i, currentPortion);
    scaled.forEach(ing => iL.innerHTML += `<label class="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm cursor-pointer"><input type="checkbox" class="ing-check rounded border-gray-300"><span class="font-medium text-gray-700 select-none">${ing}</span></label>`);
    const sL = document.getElementById('cook-steps-list'); sL.innerHTML="";
    (currentRecipe.s||[]).forEach((s,i)=> sL.innerHTML += `<div class="flex gap-4"><div class="flex-shrink-0 w-8 h-8 bg-orange-100 text-brand font-bold rounded-full flex items-center justify-center text-sm">${i+1}</div><p class="text-gray-600 pt-1">${s}</p></div>`);
    
    // GAMIFICATION TRIGGER
    updateStatsOnClick();
    
    navigate('cook');
}
