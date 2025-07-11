// ======================================================
// ETAPA DE CONFIGURAÇÃO DO SUPABASE
// ======================================================
const SUPABASE_URL = 'https://uhksrqpdtqtvdswylzre.supabase.co'; // Cole sua URL aqui
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVoa3NycXBkdHF0dmRzd3lsenJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MjY4MjgsImV4cCI6MjA2NzUwMjgyOH0.CY98MEm799kSQNdnDRPf09HcMfnWzowtEFGEDA7hkuo'; // Cole sua chave anon aqui

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ======================================================
// ESTADO GLOBAL DA APLICAÇÃO
// ======================================================
let appState = {
    currentUser: null,
    isAdminLoggedIn: false,
    currentPhase: 'none', // 'upload', 'voting', 'none'
    winners: []
};

// ======================================================
// INICIALIZAÇÃO E EVENTOS
// ======================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, inicializando aplicação com Supabase...');
    initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    console.log('Buscando estado da aplicação no Supabase...');
    
    const savedUser = sessionStorage.getItem('currentUserCode');
    if (savedUser) {
        appState.currentUser = savedUser;
        console.log('Usuário restaurado da sessão:', savedUser);
    }

    await loadCurrentPhase();
    await loadLastWinners(); 
    showSection('home');
    updateWinnersDisplay();
}

function setupEventListeners() {
    console.log('Configurando event listeners...');
    
    document.getElementById('homeBtn').addEventListener('click', () => showSection('home'));
    document.getElementById('userAreaBtn').addEventListener('click', () => showSection('userArea'));
    document.getElementById('adminAreaBtn').addEventListener('click', () => showSection('adminArea'));

    document.getElementById('userLoginBtn').addEventListener('click', userLogin);
    document.getElementById('userCodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') userLogin();
    });

    document.getElementById('adminLoginBtn').addEventListener('click', adminLogin);
    document.getElementById('adminPasswordInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') adminLogin();
    });

    document.getElementById('startUploadPhaseBtn').addEventListener('click', startUploadPhase);
    document.getElementById('startVotingPhaseBtn').addEventListener('click', startVotingPhase);
    document.getElementById('showWinnersBtn').addEventListener('click', showWinners);
    document.getElementById('registerUserBtn').addEventListener('click', registerNewUser);
    document.getElementById('uploadImagesBtn').addEventListener('click', uploadImages);

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            appState.currentUser = null;
            sessionStorage.removeItem('currentUserCode');
            alert('Você saiu.');
            setupUserArea();
        });
    }
}


// ======================================================
// LÓGICA DE NAVEGAÇÃO E VISUALIZAÇÃO
// ======================================================
function showSection(sectionName) {
    console.log('Mostrando seção:', sectionName);
    document.querySelectorAll('main > section').forEach(section => {
        section.classList.remove('active-section');
        section.classList.add('hidden');
    });

    const targetSection = document.getElementById(`${sectionName}Section`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        targetSection.classList.add('active-section');
    }

    if (sectionName === 'userArea') setupUserArea();
    if (sectionName === 'adminArea') setupAdminArea();
}

function setupUserArea() {
    const userLogin = document.getElementById('userLogin');
    const userContent = document.getElementById('userContent');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!appState.currentUser) {
        userLogin.classList.remove('hidden');
        userContent.classList.add('hidden');
        logoutBtn.classList.add('hidden');
    } else {
        userLogin.classList.add('hidden');
        userContent.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
        updateUserContent();
    }
}

function setupAdminArea() {
    const adminLogin = document.getElementById('adminLogin');
    const adminContent = document.getElementById('adminContent');

    if (!appState.isAdminLoggedIn) {
        adminLogin.classList.remove('hidden');
        adminContent.classList.add('hidden');
    } else {
        adminLogin.classList.add('hidden');
        adminContent.classList.remove('hidden');
        updateManageParticipants();
    }
}

// ======================================================
// FUNÇÕES PRINCIPAIS (COM SUPABASE)
// ======================================================

async function loadCurrentPhase() {
    const { data, error } = await sb.from('app_status')
                                   .select('value')
                                   .eq('key', 'current_phase')
                                   .single();
    if (error) {
        console.error('Erro ao carregar fase atual:', error);
    } else if (data) {
        appState.currentPhase = data.value;
        console.log('Fase atual carregada:', appState.currentPhase);
    }
}

async function loadLastWinners() {
    const { data, error } = await sb.from('app_status')
                                   .select('value')
                                   .eq('key', 'last_winners')
                                   .single();
    if (error || !data || !data.value) {
        console.log('Nenhum vencedor anterior encontrado ou erro ao buscar.', error ? error.message : '');
        appState.winners = [];
    } else {
        try {
            const parsedWinners = JSON.parse(data.value);
            appState.winners = Array.isArray(parsedWinners) ? parsedWinners : [];
            console.log('Vencedores da última rodada carregados:', appState.winners);
        } catch (e) {
            console.error('Erro ao parsear dados dos vencedores:', e);
            appState.winners = [];
        }
    }
}

async function userLogin() {
    const code = document.getElementById('userCodeInput').value;
    if (code.length !== 4) {
        alert('O código deve ter 4 dígitos.');
        return;
    }
    const { data, error } = await sb.from('users').select('user_code').eq('user_code', code).single();
    if (error || !data) {
        alert('Código inválido! Verifique se você está registrado.');
    } else {
        appState.currentUser = code;
        sessionStorage.setItem('currentUserCode', code);
        setupUserArea();
    }
}

function adminLogin() {
    const password = document.getElementById('adminPasswordInput').value;
    if (password !== '00001') {
        alert('Senha incorreta!');
        return;
    }
    appState.isAdminLoggedIn = true;
    setupAdminArea();
}

async function updateUserContent() {
    const statusMessage = document.getElementById('userStatusMessage');
    const uploadForm = document.getElementById('uploadForm');
    const votingArea = document.getElementById('votingArea');

    uploadForm.classList.add('hidden');
    votingArea.classList.add('hidden');

    if (appState.currentPhase === 'upload') {
        const { data: userImages } = await sb.from('images').select('id').eq('user_code', appState.currentUser);
        if (userImages && userImages.length < 4) {
            statusMessage.textContent = 'Fase de envio ativa. Você pode enviar até 4 imagens.';
            uploadForm.classList.remove('hidden');
        } else {
            statusMessage.textContent = 'Você já enviou o máximo de 4 imagens para esta rodada.';
        }
    } else if (appState.currentPhase === 'voting') {
        const { data: userVote } = await sb.from('votes').select('id').eq('user_code', appState.currentUser).maybeSingle();
        if (!userVote) {
            statusMessage.textContent = 'Fase de votação ativa. Vote na sua imagem favorita!';
            votingArea.classList.remove('hidden');
            displayImagesForVoting();
        } else {
            statusMessage.textContent = 'Você já votou nesta rodada. Obrigado!';
        }
    } else {
        statusMessage.textContent = 'Nenhuma ação disponível no momento. Aguarde o início de uma nova rodada.';
    }
}

async function startUploadPhase() {
    if (!confirm('Tem certeza? Isso irá apagar TODAS as imagens e votos da rodada anterior!')) return;

    await sb.from('votes').delete().neq('id', 0);
    await sb.from('images').delete().neq('id', 0);

    const { data: files } = await sb.storage.from('screenshots').list();
    if (files && files.length > 0) {
        const fileNames = files.map(file => file.name);
        if (fileNames.length > 0) await sb.storage.from('screenshots').remove(fileNames);
    }
    
    await sb.from('app_status').upsert({ key: 'last_winners', value: '[]' });
    appState.winners = [];
    updateWinnersDisplay();

    const { error: phaseError } = await sb.from('app_status').update({ value: 'upload' }).eq('key', 'current_phase');
    if (phaseError) {
        alert('Erro ao iniciar a fase de envios.');
    } else {
        appState.currentPhase = 'upload';
        alert('Fase de envio iniciada! Todas as imagens, votos e vencedores anteriores foram removidos.');
        updateManageParticipants();
    }
}

async function startVotingPhase() {
    const { data: images } = await sb.from('images').select('id', { count: 'exact' });
    if (!images || images.length === 0) {
        alert('Não há imagens para votar!');
        return;
    }

    const { error } = await sb.from('app_status').update({ value: 'voting' }).eq('key', 'current_phase');
    if (error) {
        alert('Erro ao iniciar a fase de votação.');
    } else {
        appState.currentPhase = 'voting';
        alert('Fase de votação iniciada!');
    }
}

async function showWinners() {
    console.log("A função showWinners() foi chamada!"); // Linha de depuração
    const { data: votes, error: votesError } = await sb.from('votes').select('image_id');
    console.log(`Buscando votos... Encontrados: ${votes ? votes.length : 0} votos.`); // Linha de depuração

    if (votesError || votes.length === 0) {
        alert('Não há votos para calcular os vencedores!');
        return; 
    }

    const voteCounts = {};
    votes.forEach(vote => {
        voteCounts[vote.image_id] = (voteCounts[vote.image_id] || 0) + 1;
    });

    const { data: images, error: imagesError } = await sb.from('images').select('id, image_url');
    if (imagesError) {
        alert('Erro ao buscar as imagens.');
        return;
    }

    const sortedImages = images
        .map(img => ({
            ...img,
            votes: voteCounts[img.id] || 0,
            percentage: votes.length > 0 ? Math.round(((voteCounts[img.id] || 0) / votes.length) * 100) : 0
        }))
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 3);

    appState.winners = sortedImages;
    
    console.log("TENTANDO SALVAR OS VENCEDORES NO BANCO DE DADOS..."); // Linha de depuração
    const { error: saveWinnersError } = await sb.from('app_status')
                                                 .upsert({ key: 'last_winners', value: JSON.stringify(appState.winners) });
    
    if (saveWinnersError) {
        alert('Ocorreu um erro ao salvar os vencedores no banco de dados.');
        console.error('Erro ao salvar vencedores:', saveWinnersError);
        return;
    }
    console.log("VENCEDORES SALVOS COM SUCESSO!"); // Linha de depuração

    updateWinnersDisplay();

    await sb.from('app_status').update({ value: 'none' }).eq('key', 'current_phase');
    appState.currentPhase = 'none';

    alert('Vencedores calculados e exibidos na página inicial! A rodada foi finalizada.');
}

async function registerNewUser() {
    const codeInput = document.getElementById('newUserCodeInput');
    const code = codeInput.value;
    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
        alert('O código deve ter exatamente 4 dígitos numéricos!');
        return;
    }

    const { error } = await sb.from('users').insert({ user_code: code });
    if (error) {
        alert(error.code === '23505' ? 'Este código já está registrado!' : 'Ocorreu um erro ao registrar o usuário.');
        console.error(error);
    } else {
        alert('Usuário registrado com sucesso!');
        codeInput.value = '';
        updateManageParticipants();
    }
}

async function uploadImages() {
    const file1 = document.getElementById('imageUpload1').files[0];
    const file2 = document.getElementById('imageUpload2').files[0];
    const file3 = document.getElementById('imageUpload3').files[0];
    const file4 = document.getElementById('imageUpload4').files[0];
    const filesToUpload = [file1, file2, file3, file4].filter(f => f);

    if (filesToUpload.length === 0) {
        alert('Selecione pelo menos uma imagem!');
        return;
    }

    alert('Enviando imagens... Por favor, aguarde.');
    
    for (const file of filesToUpload) {
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const filePath = `${appState.currentUser}/${Date.now()}_${cleanFileName}`;
        
        const { error: uploadError } = await sb.storage.from('screenshots').upload(filePath, file);
        if (uploadError) {
            alert(`Erro ao enviar a imagem ${file.name}.`);
            console.error(uploadError);
            continue;
        }

        const { data: urlData } = sb.storage.from('screenshots').getPublicUrl(filePath);
        await sb.from('images').insert({ user_code: appState.currentUser, image_url: urlData.publicUrl });
    }

    alert('Envio concluído!');
    document.getElementById('imageUpload1').value = '';
    document.getElementById('imageUpload2').value = '';
    document.getElementById('imageUpload3').value = '';
    document.getElementById('imageUpload4').value = '';
    updateUserContent();
    updateManageParticipants();
}

async function displayImagesForVoting() {
    const container = document.getElementById('imagesToVote');
    container.innerHTML = 'Carregando imagens...';

    const { data: images, error } = await sb.from('images').select('id, image_url, user_code');
    if (error || images.length === 0) {
        container.innerHTML = '<p>Nenhuma imagem para votar no momento.</p>';
        return;
    }

    container.innerHTML = '';
    images.forEach(image => {
        const imageCard = document.createElement('div');
        imageCard.className = 'image-card';
        let buttonHtml = (image.user_code === appState.currentUser)
            ? `<button onclick="alert('Não é possível votar na sua própria imagem.')">Votar nesta Imagem</button>`
            : `<button onclick="voteForImage('${image.id}')">Votar nesta Imagem</button>`;
        imageCard.innerHTML = `<img src="${image.image_url}" alt="Imagem para votação">${buttonHtml}`;
        container.appendChild(imageCard);
    });
}

async function voteForImage(imageId) {
    if (!confirm('Confirma seu voto nesta imagem? Você não poderá trocá-lo.')) return;
    
    const { error } = await sb.from('votes').insert({ user_code: appState.currentUser, image_id: parseInt(imageId) });
    if (error) {
        alert('Erro ao registrar o voto. Você já pode ter votado.');
        console.error(error);
    } else {
        alert('Voto registrado com sucesso! Obrigado por participar.');
        updateUserContent();
    }
}

async function updateManageParticipants() {
    const container = document.getElementById('manageParticipantsArea');
    container.innerHTML = 'Carregando participantes...';

    const { data: images, error } = await sb.from('images').select('*');
    if (error || images.length === 0) {
        container.innerHTML = '<p>Nenhuma imagem enviada nesta rodada.</p>';
        return;
    }

    container.innerHTML = '';
    images.forEach(image => {
        const imageCard = document.createElement('div');
        imageCard.className = 'image-card';
        imageCard.innerHTML = `<img src="${image.image_url}" alt="Imagem enviada"><p>Código: ${image.user_code}</p><button onclick="deleteImage('${image.id}', '${image.image_url}')">Excluir</button>`;
        container.appendChild(imageCard);
    });
}

async function deleteImage(imageId, imageUrl) {
    if (!confirm('Tem certeza que deseja excluir esta imagem? A ação não pode ser desfeita.')) return;

    await sb.from('images').delete().eq('id', imageId);
    try {
        const path = new URL(imageUrl).pathname.split('/screenshots/')[1];
        await sb.storage.from('screenshots').remove([path]);
    } catch(e) {
        console.error("Não foi possível remover o arquivo do storage:", e);
    }
    alert('Imagem excluída com sucesso!');
    updateManageParticipants();
}

function updateWinnersDisplay() {
    const winnersDisplay = document.getElementById('winnersDisplay');
    const topWinners = document.getElementById('topWinners');

    if (!appState.winners || appState.winners.length === 0) {
        winnersDisplay.classList.add('hidden');
        return;
    }

    winnersDisplay.classList.remove('hidden');
    topWinners.innerHTML = '';
    appState.winners.forEach((winner, index) => {
        const winnerCard = document.createElement('div');
        winnerCard.className = 'image-card winner-item';
        winnerCard.innerHTML = `<h4>${index + 1}º Lugar</h4><img src="${winner.image_url}" alt="Imagem vencedora"><p>${winner.votes} votos (${winner.percentage}%)</p>`;
        topWinners.appendChild(winnerCard);
    });
}

window.voteForImage = voteForImage;
window.deleteImage = deleteImage;