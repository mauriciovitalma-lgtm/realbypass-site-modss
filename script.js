// BANCO DE DADOS (Carrega do data.json + localStorage)
const DB = {
    // Dados do localStorage (setados pelo admin)
    getMods: () => {
        const local = JSON.parse(localStorage.getItem('rb_mods'));
        return local || [];
    },
    setMods: (data) => localStorage.setItem('rb_mods', JSON.stringify(data)),
    
    getCats: () => {
        const local = JSON.parse(localStorage.getItem('rb_cats'));
        return local || [{id: 1, name: 'Geral', icon: 'fas fa-folder'}];
    },
    setCats: (data) => localStorage.setItem('rb_cats', JSON.stringify(data)),
    
    getConfig: () => {
        const local = JSON.parse(localStorage.getItem('rb_config'));
        return local || {
            siteName: 'Real bypass',
            siteLogoUrl: '',
            carouselEnabled: true,
            warningMessage: ''
        };
    },
    setConfig: (data) => localStorage.setItem('rb_config', JSON.stringify(data))
};

// Carregar dados iniciais do data.json
async function carregarDataJson() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('Falha ao carregar data.json');
        
        const data = await response.json();
        console.log('data.json carregado:', data);
        
        // Se localStorage está vazio, carregar do JSON
        if(!localStorage.getItem('rb_mods') && data.mods && data.mods.length > 0) {
            console.log('Carregando mods do data.json');
            localStorage.setItem('rb_mods', JSON.stringify(data.mods));
        }
        if(!localStorage.getItem('rb_cats') && data.categories && data.categories.length > 0) {
            console.log('Carregando categorias do data.json');
            localStorage.setItem('rb_cats', JSON.stringify(data.categories));
        }
        if(!localStorage.getItem('rb_config') && data.config) {
            console.log('Carregando config do data.json');
            localStorage.setItem('rb_config', JSON.stringify(data.config));
        }
    } catch(e) {
        console.error('Erro ao carregar data.json:', e);
        console.log('Usando dados padrão do localStorage');
    }
}

// Configuração do Carrossel
let currentSlide = 0;
let carouselInterval;
let totalSlides = 0;
const MAX_FEATURED = 5;
// Segurança: controlar última construção do carrossel para evitar rebuilds rápidos
let lastFeaturedBuild = 0;

// Armazenar filtros atuais
let currentCategoryFilter = '';
let currentSearchTerm = '';
let currentFeaturedFilter = '';

// Função para mostrar/esconder seções
window.mostrarSecao = function(secaoId) {
    console.log('Alternando para seção:', secaoId);
    
    // Parar todas as rotações de carousel
    clearInterval(carouselInterval);
    
    // Remove classe active de todas as seções
    const homeSection = document.getElementById('home-section');
    const modsSection = document.getElementById('mods-section');
    
    homeSection.classList.remove('active');
    modsSection.classList.remove('active');
    
    // Adiciona classe active à seção selecionada
    if(secaoId === 'home') {
        console.log('Ativando HOME');
        homeSection.classList.add('active');
        setTimeout(() => verificarAvisoDo(), 100);
    } else if(secaoId === 'mods') {
        console.log('Ativando MODS');
        modsSection.classList.add('active');
        setTimeout(() => {
            console.log('Carregando dados de MODS');
            carregarCategorias();
            carregarDestaques();
            atualizarEstatisticas();
            // Garantir que a primeira categoria tenha seus mods renderizados
            const catsNow = DB.getCats();
            if(catsNow && catsNow.length > 0) {
                console.log('[mostrarSecao] aplicando filtro primeira categoria:', catsNow[0].id);
                filtrarMods(catsNow[0].id);
            } else {
                aplicarFiltros();
            }
        }, 150);
    }
    
    // Atualiza estado dos botões de navegação
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Marca o botão correto como ativo
    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(btn => {
        const textContent = btn.textContent.toLowerCase().trim();
        if((secaoId === 'home' && textContent.includes('home')) || 
           (secaoId === 'mods' && textContent.includes('mods'))) {
            btn.classList.add('active');
        }
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('=== INICIANDO SITE ===');
    
    // Carregar dados do data.json na primeira vez
    console.log('Carregando data.json...');
    await carregarDataJson();
    console.log('localStorage após carregar data.json:');
    console.log('rb_mods:', localStorage.getItem('rb_mods'));
    console.log('rb_cats:', localStorage.getItem('rb_cats'));
    
    // Restaurar tema salvo
    const savedTheme = localStorage.getItem('rb_theme') || 'dark';
    if(savedTheme === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('theme-icon').classList.replace('fa-moon', 'fa-sun');
    }

    // Garantir que Home está visível inicialmente
    const homeSection = document.getElementById('home-section');
    const modsSection = document.getElementById('mods-section');
    
    homeSection.classList.add('active');
    modsSection.classList.remove('active');
    console.log('Home ativada no carregamento');
    
    // Marcar Home como ativo
    const homeBtn = document.querySelector('.nav-btn[onclick*="home"]');
    if(homeBtn) homeBtn.classList.add('active');

    // Adiciona listeners aos botões de navegação
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            const buttons = document.querySelectorAll('.nav-btn');
            buttons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            e.preventDefault();
        });
    });

    // Carregar dados da seção Mods em background
    console.log('Carregando dados iniciais...');
    carregarCategorias();
    carregarDestaques();
    atualizarEstatisticas();
    
    // Carrega mods da primeira categoria por padrão
    const cats = DB.getCats();
    console.log('Categorias carregadas:', cats.length);
    if(cats.length > 0) filtrarMods(cats[0].id);

    // Event listeners para busca e filtros
    document.getElementById('search-input').addEventListener('input', aplicarFiltros);
    document.getElementById('filter-category').addEventListener('change', aplicarFiltros);
    document.getElementById('filter-featured').addEventListener('change', aplicarFiltros);

    // Popular dropdown de categorias no filtro
    const filterCat = document.getElementById('filter-category');
    cats.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.name;
        filterCat.appendChild(option);
    });

    // RECARREGAR DADOS PERIODICAMENTE (sincronizar com admin sem recriar carrossel a todo momento)
    setInterval(() => {
        carregarCategorias();
        // Recriar carrossel apenas se não foi rebuilding recentemente (throttle 5s)
        carregarDestaques();
        atualizarEstatisticas();
        
        // Reaplica filtros se estiver na seção mods
        if(document.getElementById('mods-section').classList.contains('active')) {
            aplicarFiltros();
        }
        
        // Verifica aviso se estiver na seção home
        if(document.getElementById('home-section').classList.contains('active')) {
            verificarAvisoDo();
        }
    }, 5000); // 5 segundos (menos agressivo)
    
    console.log('=== SITE INICIADO ===');
});

// TOGGLE TEMA
window.toggleTheme = function() {
    const isDark = !document.body.classList.contains('light-mode');
    if(isDark) {
        document.body.classList.add('light-mode');
        localStorage.setItem('rb_theme', 'light');
        document.getElementById('theme-icon').classList.replace('fa-moon', 'fa-sun');
    } else {
        document.body.classList.remove('light-mode');
        localStorage.setItem('rb_theme', 'dark');
        document.getElementById('theme-icon').classList.replace('fa-sun', 'fa-moon');
    }
}

// --- SISTEMA DE CARROSSEL ---
function carregarDestaques() {
    try {
        const mods = DB.getMods();
        // Filtra apenas os marcados como destaque (máximo 5)
        const destaques = mods.filter(m => m.destaque && m.destaque === true).slice(0, MAX_FEATURED);
        const track = document.getElementById('featured-track');
        const section = document.getElementById('featured');
        const indicatorsContainer = document.getElementById('carousel-indicators');

        console.log('Destaques encontrados:', destaques.length); // Debug
        console.log('Mods no banco:', mods.length); // Debug

        if (destaques.length === 0) {
            section.style.display = 'none'; // Esconde se não tiver destaques
            track.innerHTML = '';
            indicatorsContainer.innerHTML = '';
            totalSlides = 0;
            return;
        }

        section.style.display = 'block';

        const now = Date.now();
        // Segurança: evitar rebuilds muito frequentes que quebram animação
        if(now - lastFeaturedBuild < 5000) {
            console.log('[carregarDestaques] Ignorando rebuild rápido (segurança)');
            totalSlides = destaques.length;
            document.getElementById('prev-btn').style.display = totalSlides > 1 ? 'flex' : 'none';
            document.getElementById('next-btn').style.display = totalSlides > 1 ? 'flex' : 'none';
            return;
        }

        // Evitar reconstruir slides se não houver alterações — checar título dos slides já renderizados
        const existingSlides = Array.from(document.querySelectorAll('.featured-slide'));
        if(existingSlides.length === destaques.length) {
            let identical = true;
            for(let i=0;i<destaques.length;i++) {
                const title = existingSlides[i].querySelector('.feat-info h2')?.textContent || '';
                if(title !== (destaques[i].titulo || '')) { identical = false; break; }
            }
            if(identical) {
                // apenas ajustar contadores, atualizar visual e sair
                totalSlides = destaques.length;
                document.getElementById('prev-btn').style.display = totalSlides > 1 ? 'flex' : 'none';
                document.getElementById('next-btn').style.display = totalSlides > 1 ? 'flex' : 'none';
                // Garantir que o slide atual esteja marcado e animação aplicada
                atualizarSlide();
                lastFeaturedBuild = now;
                return;
            }
        }

        // Reconstruir slides
        track.innerHTML = '';
        indicatorsContainer.innerHTML = '';
        currentSlide = 0;
        totalSlides = destaques.length;

        destaques.forEach((mod, index) => {
            const slide = document.createElement('div');
            slide.className = `featured-slide ${index === 0 ? 'active' : ''}`;
            
            // Define imagem (usar <img> para evitar corte) ou cor sólida se não tiver imagem
            slide.innerHTML = `
                <div class="feat-info">
                    <span class="feat-badge">Em Destaque</span>
                    <h2>${mod.titulo}</h2>
                    <p style="color: #ddd; margin: 10px 0; font-size: 0.95rem;">${mod.descricao || 'Confira este incrível mod!'}</p>
                    <a href="${mod.link}" target="_blank" class="discord-link" style="background: white; color: black; margin-top:10px;">
                        <i class="fas fa-download"></i> Baixar Agora
                    </a>
                </div>
            `;

            if(mod.imagem) {
                const img = document.createElement('img');
                img.className = 'feat-img';
                img.src = mod.imagem;
                img.alt = mod.titulo;
                slide.prepend(img);
            } else {
                slide.style.backgroundImage = 'linear-gradient(45deg, #2b1055, #7597de)';
            }
            track.appendChild(slide);

            // Cria indicador (bolinha)
            const indicator = document.createElement('div');
            indicator.className = `indicator ${index === 0 ? 'active' : ''}`;
            indicator.onclick = () => irParaSlide(index);
            indicatorsContainer.appendChild(indicator);
        });

        // Mostra/esconde botões de navegação
        document.getElementById('prev-btn').style.display = totalSlides > 1 ? 'flex' : 'none';
        document.getElementById('next-btn').style.display = totalSlides > 1 ? 'flex' : 'none';

        // Inicia rotação automática
        if(totalSlides > 1) {
            iniciarRotacao();
        }

        // Marca que já inicializamos o carrossel
        try { localStorage.setItem('rb_featured_initialized', '1'); } catch(e) {}
        lastFeaturedBuild = Date.now();
    } catch(err) {
        console.error('Erro em carregarDestaques:', err);
    }
}

// Função para mudar slide
window.mudarSlide = function(direcao) {
    clearInterval(carouselInterval); // Para a rotação automática
    currentSlide = (currentSlide + direcao + totalSlides) % totalSlides;
    atualizarSlide();
    iniciarRotacao(); // Reinicia a rotação automática
}

// Função para ir para um slide específico
window.irParaSlide = function(index) {
    clearInterval(carouselInterval);
    currentSlide = index;
    atualizarSlide();
    iniciarRotacao();
}

// Atualiza o slide visível
function atualizarSlide() {
    const slides = document.querySelectorAll('.featured-slide');
    const indicators = document.querySelectorAll('.indicator');
    
    slides.forEach((slide, index) => {
        slide.classList.toggle('active', index === currentSlide);
    });
    
    indicators.forEach((indicator, index) => {
        indicator.classList.toggle('active', index === currentSlide);
    });
}

// Inicia a rotação automática
function iniciarRotacao() {
    // limpar intervalos anteriores para evitar múltiplos timers
    if(carouselInterval) clearInterval(carouselInterval);
    carouselInterval = setInterval(() => {
        if(totalSlides <= 1) return;
        currentSlide = (currentSlide + 1) % totalSlides;
        atualizarSlide();
    }, 4000); // Troca a cada 4 segundos
}

// --- SISTEMA DE CATEGORIAS E MODS ---
function carregarCategorias() {
    console.log('[carregarCategorias] Iniciando...');
    const container = document.getElementById('categories-container');
    const cats = DB.getCats();
    console.log('[carregarCategorias] Categorias:', cats.length);
    
    if(!container) {
        console.error('Container categories-container não encontrado!');
        return;
    }
    
    container.innerHTML = cats.map(c => `
        <div class="category-card" onclick="filtrarMods(${c.id}, this)">
            <i class="${c.icon}"></i> ${c.name}
        </div>
    `).join('');
    console.log('[carregarCategorias] Categorias renderizadas');
    
    // Ativa o primeiro visualmente
    const firstCard = container.querySelector('.category-card');
    if(firstCard) firstCard.classList.add('active');
}

window.filtrarMods = function(catId, element) { // Global para onclick funcionar
    console.log('[filtrarMods] catId:', catId);
    if(element) {
        document.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));
        element.classList.add('active');
    }

    const container = document.getElementById('mods-container');
    if(!container) {
        console.error('Container mods-container não encontrado!');
        return;
    }
    
    const mods = DB.getMods().filter(m => m.categoria == catId);
    const cats = DB.getCats();
    console.log('[filtrarMods] mods encontrados:', mods.length);

    if(mods.length === 0) {
        container.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#777;">Nenhum mod nesta categoria.</p>';
        return;
    }

    container.innerHTML = mods.map(mod => {
        const catNome = cats.find(c => c.id == mod.categoria)?.name || 'Geral';
        const imgHtml = mod.imagem 
            ? `<img src="${mod.imagem}" alt="${mod.titulo}">` 
            : `<i class="fas fa-gamepad" style="font-size:3rem; color:#555;"></i>`;

        return `
            <div class="mod-card">
                <div class="mod-img">${imgHtml}</div>
                <div class="mod-content">
                    <h3>${mod.titulo}</h3>
                    <div class="mod-meta">
                        <span><i class="fas fa-folder"></i> ${catNome}</span>
                        <span><i class="fas fa-download"></i> ${mod.downloads || 0}</span>
                    </div>
                    <div class="mod-actions">
                        <a href="${mod.link}" target="_blank" class="btn-dl" onclick="contarDownload(${mod.id})">Download</a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.contarDownload = function(id) {
    const mods = DB.getMods();
    const index = mods.findIndex(m => m.id === id);
    if(index !== -1) {
        mods[index].downloads = (mods[index].downloads || 0) + 1;
        localStorage.setItem('rb_mods', JSON.stringify(mods));
        atualizarEstatisticas();
    }
}

// ATUALIZAR ESTATÍSTICAS
function atualizarEstatisticas() {
    console.log('[atualizarEstatisticas] Iniciando...');
    const mods = DB.getMods();
    const cats = DB.getCats();
    const featured = mods.filter(m => m.destaque).length;
    
    console.log('[atualizarEstatisticas] Mods:', mods.length, 'Cats:', cats.length, 'Featured:', featured);
    
    document.getElementById('stat-mods').textContent = mods.length;
    document.getElementById('stat-featured').textContent = featured;
    document.getElementById('stat-cats').textContent = cats.length;
    
    // Mod mais baixado
    if(mods.length > 0) {
        const topMod = mods.reduce((max, m) => (m.downloads || 0) > (max.downloads || 0) ? m : max);
        document.getElementById('stat-topdownload').textContent = topMod.titulo.substring(0, 20) + (topMod.titulo.length > 20 ? '...' : '');
    }
}

// APLICAR FILTROS E BUSCA
window.aplicarFiltros = function() {
    currentSearchTerm = document.getElementById('search-input').value.toLowerCase();
    currentCategoryFilter = document.getElementById('filter-category').value;
    currentFeaturedFilter = document.getElementById('filter-featured').value;
    
    const container = document.getElementById('mods-container');
    if(!container) return;
    
    const mods = DB.getMods();
    let filtered = mods;
    
    // Filtro de categoria
    if(currentCategoryFilter) {
        filtered = filtered.filter(m => m.categoria == currentCategoryFilter);
    }
    
    // Filtro de destaque
    if(currentFeaturedFilter === 'featured') {
        filtered = filtered.filter(m => m.destaque === true);
    }
    
    // Busca por nome
    if(currentSearchTerm) {
        filtered = filtered.filter(m => m.titulo.toLowerCase().includes(currentSearchTerm));
    }
    
    // Renderizar resultados
    const cats = DB.getCats();
    if(filtered.length === 0) {
        container.innerHTML = '<p style="grid-column:1/-1; text-align:center; color:#777;">Nenhum mod encontrado.</p>';
        return;
    }
    
    container.innerHTML = filtered.map(mod => {
        const catNome = cats.find(c => c.id == mod.categoria)?.name || 'Geral';
        const imgHtml = mod.imagem 
            ? `<img src="${mod.imagem}" alt="${mod.titulo}">` 
            : `<i class="fas fa-gamepad" style="font-size:3rem; color:#555;"></i>`;

        return `
            <div class="mod-card">
                <div class="mod-img">${imgHtml}</div>
                <div class="mod-content">
                    <h3>${mod.titulo}</h3>
                    <div class="mod-meta">
                        <span><i class="fas fa-folder"></i> ${catNome}</span>
                        <span><i class="fas fa-download"></i> ${mod.downloads || 0}</span>
                    </div>
                    <div class="mod-actions">
                        <a href="${mod.link}" target="_blank" class="btn-dl" onclick="contarDownload(${mod.id})">Download</a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Verificar e exibir aviso do site
window.verificarAvisoDo = function() {
    console.log('verificarAvisoDo chamado');
    const config = DB.getConfig();
    console.log('Config:', config);
    
    const warningDiv = document.getElementById('site-warning');
    console.log('warningDiv encontrada:', !!warningDiv);
    
    if(warningDiv) {
        if(config.warningMessage && config.warningMessage.trim()) {
            console.log('Exibindo aviso:', config.warningMessage);
            warningDiv.innerHTML = `<div class="warning-message"><i class="fas fa-exclamation-triangle"></i> ${config.warningMessage}</div>`;
            warningDiv.style.display = 'block';
        } else {
            console.log('Nenhum aviso configurado');
            warningDiv.style.display = 'none';
        }
    } else {
        console.log('warningDiv NÃO encontrada!');
    }
};
