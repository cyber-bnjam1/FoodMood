// --- DONNÉES PAR DÉFAUT ---
// Note: price (1=Cheap, 2=Mid, 3=Exp)
const DEFAULT_RECIPES = [
    { id: 1, t: "Pâtes Cacio e Pepe", mood: "fast", cat: "main", price: "1", time: "12", cal: "450", em: "🍝", i: ["200g Spaghetti", "100g Pecorino", "Poivre noir", "Eau de cuisson"], s: ["Cuire les pâtes al dente.", "Mélanger fromage et eau de cuisson.", "Poivrer généreusement."] },
    { id: 2, t: "Omelette Complète", mood: "fast", cat: "main", price: "1", time: "8", cal: "320", em: "🍳", i: ["3 Oeufs", "50g Fromage râpé", "Ciboulette", "2 Champignons"], s: ["Battre les oeufs.", "Cuire à feu moyen.", "Ajouter la garniture.", "Plier en deux."] },
    { id: 3, t: "Wrap Thon Mayo", mood: "fast", cat: "main", price: "1", time: "5", cal: "380", em: "🌯", i: ["1 Tortilla", "1 petite boite Thon", "1cs Mayonnaise", "1cs Maïs", "Salade"], s: ["Mélanger thon et mayo.", "Etaler sur la tortilla.", "Ajouter les légumes.", "Rouler serré."] },
    { id: 4, t: "Salade César", mood: "healthy", cat: "main", price: "2", time: "15", cal: "350", em: "🥗", i: ["100g Poulet grillé", "Salade Romaine", "20g Parmesan", "Croutons", "Sauce César"], s: ["Couper le poulet.", "Laver la salade.", "Tout mélanger.", "Ajouter la sauce."] },
    { id: 5, t: "Poké Bowl Saumon", mood: "healthy", cat: "main", price: "3", time: "20", cal: "450", em: "🍣", i: ["150g Riz vinaigré", "100g Saumon cru", "1/2 Avocat", "Concombre", "Sésame"], s: ["Cuire le riz.", "Couper le poisson en dés.", "Disposer joliment dans un bol."] },
    { id: 6, t: "Burger Maison", mood: "comfort", cat: "main", price: "2", time: "20", cal: "650", em: "🍔", i: ["1 Pain Bun", "1 Steak haché", "1 tr Cheddar", "1/2 Oignon", "Sauce Burger"], s: ["Toaster le pain.", "Cuire le steak.", "Fondre le cheddar.", "Monter le burger."] },
    { id: 7, t: "Pizza Tortilla", mood: "comfort", cat: "main", price: "1", time: "10", cal: "400", em: "🍕", i: ["1 Tortilla", "3cs Coulis tomate", "50g Mozzarella", "Origan"], s: ["Mettre la sauce sur la tortilla.", "Ajouter fromage.", "Cuire 10min au four."] },
    { id: 8, t: "Velouté Potimarron", mood: "healthy", cat: "starter", price: "1", time: "25", cal: "150", em: "🥣", i: ["1/2 Potimarron", "1 Oignon", "Bouillon", "Crème"], s: ["Cuire légumes.", "Mixer.", "Assaisonner."] },
    { id: 9, t: "Fondant Chocolat", mood: "comfort", cat: "dessert", price: "1", time: "15", cal: "400", em: "🍰", i: ["100g Chocolat", "80g Beurre", "2 Oeufs", "40g Sucre", "30g Farine"], s: ["Fondre choco/beurre.", "Mélanger tout.", "Cuire 10min 200°C."] },
    { id: 10, t: "Salade de Fruits", mood: "healthy", cat: "dessert", price: "2", time: "10", cal: "100", em: "🥝", i: ["Pomme", "Banane", "Kiwi", "Jus orange"], s: ["Couper.", "Mélanger."] }
];

// STATES
let allRecipes = [];
let favorites = [];
let shoppingList = [];
let fridgeIngredients = []; 
let currentRecipe = null;
let activeMood = '';
let editingRecipeId = null;
let currentPortion = 2;
let activeCategoryFilter = 'all';
let wakeLock = null; 

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => { initApp(); });
async function initApp() { await loadRecipes(); loadFavorites(); loadShoppingList(); renderShoppingList(); }

async function loadRecipes() {
    let externalRecipes = []; let dessertRecipes = [];
    // Chargement Recettes Générales
    try { const r = await fetch('data/recettes.json'); if (r.ok) externalRecipes = await r.json(); } catch (e) {}
    // Chargement Desserts
    try { 
        const r = await fetch('data/desserts.json'); 
        if (r.ok) { 
            const d = await r.json(); 
            // On force le mood et la catégorie pour les desserts
            dessertRecipes = d.map(x => ({...x, mood: 'patisserie', cat: 'dessert', price: "2"})); 
        } 
    } catch (e) {}
    
    const userLocalRecipes = JSON.parse(localStorage.getItem('foodmood_user_recipes') || '[]');
    allRecipes = [...DEFAULT_RECIPES, ...externalRecipes, ...dessertRecipes, ...userLocalRecipes];
    updateStats();
}

// --- FAVORIS ---
function loadFavorites() { favorites = JSON.parse(localStorage.getItem('foodmood_favorites') || '[]'); updateStats(); }
function toggleFavorite() {
    if(!currentRecipe) return;
    const idx = favorites.indexOf(currentRecipe.id);
    if(idx === -1) { favorites.push(currentRecipe.id); } else { favorites.splice(idx, 1); }
    localStorage.setItem('foodmood_favorites', JSON.stringify(favorites));
    updateFavIcon(); updateStats();
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
function updateStats() {
    document.getElementById('total-recipes').textContent = allRecipes.length;
    document.getElementById('user-recipes-count').textContent = allRecipes.length - DEFAULT_RECIPES.length;
    document.getElementById('fav-count').textContent = favorites.length;
}

// --- FRIDGE MODE (Recherche par ingrédients) ---
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
    // Recherche si AU MOINS UN ingrédient correspond
    const matches = allRecipes.filter(r => r.i.some(recipeIng => fridgeIngredients.some(fridgeWord => recipeIng.toLowerCase().includes(fridgeWord.toLowerCase()))));
    if(matches.length === 0) { resultsDiv.innerHTML = `<div class="text-center text-gray-400">Aucune recette trouvée... 🍳</div>`; } 
    else { renderCookbookList(matches, 'fridge-results'); }
}

// --- WAKE LOCK (No-Sleep en cuisine) ---
async function requestWakeLock() { try { if ('wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); } } catch (err) {} }
async function releaseWakeLock() { if (wakeLock !== null) { await wakeLock.release(); wakeLock = null; } }

// --- SMART SHOPPING (Tri par rayon) ---
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

// Logique de détection de rayon
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
    
    // Groupement par catégories
    const groups = {};
    shoppingList.forEach((item, idx) => {
        const cat = getCategoryForIngredient(item.t);
        if(!groups[cat]) groups[cat] = [];
        groups[cat].push({ ...item, originalIdx: idx });
    });

    const sortedCats = Object.keys(groups).sort();
    sortedCats.forEach(cat => {
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
    // Gestion écran allumé
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
    
    // Affichage Prix
    const priceEl = document.getElementById('res-price');
    const p = r.price || "2";
    priceEl.textContent = p === "1" ? "€" : (p === "2" ? "€€" : "€€€");
    
    renderIngredientsList();
    updateFavIcon();
    
    const btnDel = document.getElementById('btn-delete');
    const btnEdit = document.getElementById('btn-edit');
    btnEdit.classList.remove('hidden'); 
    if(r.id > 1000) btnDel.classList.remove('hidden'); else btnDel.classList.add('hidden');
}

// --- COOKBOOK & FILTERS ---
function openCookbook() { setCategoryFilter('all'); navigate('cookbook'); }
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
        return matchText && matchFav && matchCat;
    });
    renderCookbookList(filtered, 'cookbook-list');
}
function renderCookbookList(list, targetId) {
    const container = document.getElementById(targetId); container.innerHTML = "";
    if (list.length === 0) { return; }
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
function openAddMode() { editingRecipeId = null; document.getElementById('form-title').textContent="Nouvelle Recette"; resetForm(); navigate('add'); }
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
    navigate('add');
}
function cancelEdit() { if(editingRecipeId) navigate('result'); else navigate('home'); resetForm(); editingRecipeId = null; }
function resetForm() { document.getElementById('add-title').value=""; document.getElementById('add-ing').value=""; document.getElementById('add-steps').value=""; }

function saveRecipe() {
    const title = document.getElementById('add-title').value;
    const ingText = document.getElementById('add-ing').value;
    if(!title || !ingText) { alert("Champs obligatoires !"); return; }
    
    let finalId = (editingRecipeId && editingRecipeId < 1000) ? Date.now() : (editingRecipeId ? editingRecipeId : Date.now());
    
    const recipeData = {
        id: finalId, t: title, 
        mood: document.getElementById('add-mood').value, 
        cat: document.getElementById('add-cat').value,
        price: document.getElementById('add-price').value,
        time: document.getElementById('add-time').value||"20",
        cal: document.getElementById('add-cal').value||"?", em: document.getElementById('add-emoji').value,
        i: ingText.split('\n').filter(l=>l.trim()!==""), s: document.getElementById('add-steps').value.split('\n').filter(l=>l.trim()!=="")
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

// --- IMPORT WEB (CORRIGÉ & ROBUSTE) ---
function toggleImportModal() { document.getElementById('import-modal').classList.toggle('hidden'); }

async function fetchRecipeFromUrl() {
    const url = document.getElementById('import-url').value;
    const btn = document.getElementById('btn-import-action');
    if(!url) return;

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyse...';
    btn.disabled = true;
    
    try {
        // Utilisation de corsproxy.io pour contourner les protections
        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(url);
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Erreur réseau");
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        
        // Recherche du JSON-LD
        let recipeData = null;
        const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
        
        const findRecipeInObject = (obj) => {
            if (!obj) return null;
            if (obj['@type'] === 'Recipe') return obj;
            if (Array.isArray(obj['@graph'])) return obj['@graph'].find(x => x['@type'] === 'Recipe');
            if (Array.isArray(obj)) return obj.find(x => x['@type'] === 'Recipe');
            return null;
        };

        for (let s of scripts) {
            try {
                const json = JSON.parse(s.innerText);
                const found = findRecipeInObject(json);
                if (found) { recipeData = found; break; }
            } catch(e) {}
        }

        if (recipeData) {
            document.getElementById('add-title').value = recipeData.name || "";
            
            // Ingrédients
            if(Array.isArray(recipeData.recipeIngredient)) {
                document.getElementById('add-ing').value = recipeData.recipeIngredient.join('\n');
            }

            // Étapes
            if(Array.isArray(recipeData.recipeInstructions)) {
                const steps = recipeData.recipeInstructions.map(s => (s.text || s.name || s).replace(/&nbsp;/g, ' ').trim()).join('\n');
                document.getElementById('add-steps').value = steps;
            } else if (typeof recipeData.recipeInstructions === 'string') {
                document.getElementById('add-steps').value = recipeData.recipeInstructions;
            }

            // Emoji
            const titleLower = (recipeData.name || "").toLowerCase();
            let em = '🥘';
            if(titleLower.includes('gâteau') || titleLower.includes('tarte') || titleLower.includes('sucré')) em = '🍰';
            if(titleLower.includes('salade')) em = '🥗';
            if(titleLower.includes('soupe')) em = '🥣';
            if(titleLower.includes('pizza')) em = '🍕';
            if(titleLower.includes('burger')) em = '🍔';
            document.getElementById('add-emoji').value = em;

            // Temps (ISO format PT20M)
            const timeStr = recipeData.totalTime || recipeData.cookTime;
            if(timeStr) {
                const hoursMatch = timeStr.match(/(\d+)H/);
                const minsMatch = timeStr.match(/(\d+)M/);
                let totalMin = 0;
                if(hoursMatch) totalMin += parseInt(hoursMatch[1]) * 60;
                if(minsMatch) totalMin += parseInt(minsMatch[1]);
                if(totalMin > 0) document.getElementById('add-time').value = totalMin;
            }

            toggleImportModal();
            alert("Recette importée !");
        } else {
            // Fallback Titre uniquement
            const h1 = doc.querySelector('h1');
            if(h1) {
                document.getElementById('add-title').value = h1.innerText.trim();
                toggleImportModal();
                alert("Import partiel (Titre uniquement). Le site protège ses données.");
            } else {
                throw new Error("Format non reconnu");
            }
        }
    } catch (e) {
        console.error(e);
        alert("Impossible d'importer cette recette automatiquement.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
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
    const data = { recipes: JSON.parse(localStorage.getItem('foodmood_user_recipes') || '[]'), fav: favorites, shop: shoppingList };
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
    navigate('cook');
}
