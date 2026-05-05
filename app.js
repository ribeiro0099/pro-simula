
// Configuração direta com os dados do seu projeto
const SUPABASE_URL = "https://ukpbxtwxkurjyrnuoniy.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrcGJ4dHd4a3VyanlybnVvbml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1OTcyOTQsImV4cCI6MjA5MzE3MzI5NH0.wonPrg8kUbqY0zaTsZ4UAk6K6lEROY20BPh1Fp-HSkA";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let questoesAtuais = [];

// 1. Carrega APENAS as matérias que você inseriu na tabela 'questoes'
async function carregarMaterias() {
    try {
        const { data, error } = await _supabase.from('questoes').select('materia');
        if (error) throw error;

        if (data) {
            // Filtra duplicados e remove qualquer valor 'null' que venha do banco
            const materiasReais = [...new Set(data.map(item => item.materia).filter(m => m !== null))];
            
            const select = document.getElementById('select-materia');
            // Limpa o "Carregando..." e coloca as matérias reais
            select.innerHTML = '<option value="">Selecione uma matéria</option>' + 
                materiasReais.map(m => `<option value="${m}">${m}</option>`).join('');
        }
    } catch (err) {
        console.error("Erro ao carregar matérias:", err);
    }
}

// 2. Busca questões filtradas pela matéria selecionada
async function iniciarSimulado() {
    const materia = document.getElementById('select-materia').value;
    if (!materia) return alert("Selecione uma matéria!");

    // Busca questão e suas alternativas relacionadas (relação que você criou no banco)
    const { data, error } = await _supabase
        .from('questoes')
        .select('*, alternativas(*)')
        .eq('materia', materia);

    if (error) return alert("Erro ao buscar questões!");

    questoesAtuais = data;
    renderizarQuestoes();
}

// 3. Mostra as questões no container principal[cite: 9]
function renderizarQuestoes() {
    const container = document.getElementById('questoes-container');
    container.innerHTML = questoesAtuais.map((q, i) => `
        <div class="questao-card">
            <strong>Questão ${i + 1}</strong>
            <p>${q.enunciado}</p>
            <div class="alternativas">
                ${q.alternativas.map(alt => `
                    <label id="label-${q.id}-${alt.letra}">
                        <input type="radio" name="q-${q.id}" value="${alt.letra}">
                        ${alt.letra}) ${alt.texto_alternativa}
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    // Mostra o botão de conferir que estava escondido[cite: 9]
    document.getElementById('btn-conferir').classList.remove('hidden');
}

// 4. Lógica de Correção (Pinta de verde a certa e vermelho a errada)
document.getElementById('btn-conferir').onclick = () => {
    questoesAtuais.forEach(q => {
        const selecionada = document.querySelector(`input[name="q-${q.id}"]:checked`);
        const labelCorreta = document.getElementById(`label-${q.id}-${q.resposta_correta}`);
        
        // Sempre destaca a correta
        if (labelCorreta) labelCorreta.classList.add('correta');

        // Se o usuário errou, destaca a errada em vermelho
        if (selecionada && selecionada.value !== q.resposta_correta) {
            const labelErrada = document.getElementById(`label-${q.id}-${selecionada.value}`);
            if (labelErrada) labelErrada.classList.add('errada');
        }
    });
};

// Vincula o botão de iniciar à função[cite: 9]
document.getElementById('btn-iniciar').onclick = iniciarSimulado;

// Chama a função ao carregar a página
carregarMaterias();

// Inicializa o Supabase usando as credenciais do config.js
const _supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

let questoesAtuais = [];
let jaConferiu = false;
let materiaAtual = '';

// 1. CARREGA AS MATÉRIAS
document.getElementById('select-categoria').addEventListener('change', async (e) => {
    const selectMateria = document.getElementById('select-materia');
    selectMateria.innerHTML = '<option value="">Carregando matérias...</option>';
    selectMateria.disabled = true;

    const { data, error } = await _supabase.from('questoes_simulado').select('materia');

    if (error) {
        selectMateria.innerHTML = `<option value="">❌ Erro ao buscar</option>`;
        selectMateria.disabled = false;
        return;
    }

    if (data && data.length > 0) {
        const materiasUnicas = [...new Set(data.map(q => q.materia))].sort();
        selectMateria.innerHTML = '<option value="">Selecione a Matéria</option>' +
            materiasUnicas.map(m => `<option value="${m}">${m}</option>`).join('');
    }
    selectMateria.disabled = false;
});

// 2. BUSCA AS QUESTÕES POR MATÉRIA
async function iniciarSimulado() {
    const materia = document.getElementById('select-materia').value;
    const container = document.getElementById('questoes-container');
    const placar = document.getElementById('placar');

    if (!materia) {
        alert('Selecione uma matéria para começar!');
        return;
    }

    materiaAtual = materia;
    jaConferiu = false;
    placar.classList.add('hidden');
    document.getElementById('btn-conferir').classList.add('hidden');
    document.getElementById('btn-reiniciar').classList.add('hidden');
    container.innerHTML = '<div class="placeholder loading">⏳ Carregando questões...</div>';

    const { data, error } = await _supabase.from('questoes_simulado').select('*').eq('materia', materia).limit(10);

    if (error || !data || data.length === 0) {
        container.innerHTML = '<div class="placeholder">⚠️ Nenhuma questão encontrada.</div>';
        return;
    }

    questoesAtuais = data.sort(() => Math.random() - 0.5);
    renderizar();
    document.getElementById('btn-conferir').classList.remove('hidden');
}

// 3. MONTA AS QUESTÕES NA TELA
function renderizar() {
    const container = document.getElementById('questoes-container');
    container.innerHTML = questoesAtuais.map((q, i) => {
        const alternativas = ['a', 'b', 'c', 'd', 'e'].map(l => `
            <label class="alternativa-label" id="label-${q.id}-${l.toUpperCase()}">
                <input type="radio" name="q-${q.id}" value="${l.toUpperCase()}">
                <span class="letra-circle">${l.toUpperCase()}</span>
                <span class="alternativa-texto">${q['opcao_' + l] || q['alternativa_' + l]}</span>
            </label>
        `).join('');

        return `
            <div class="questao-card" id="q-container-${q.id}">
                <div class="questao-numero">Questão ${i + 1} de ${questoesAtuais.length}</div>
                <p class="questao-enunciado">${q.enunciado}</p>
                <div class="alternativas">${alternativas}</div>
            </div>
        `;
    }).join('');
}

// 4. CONFERE RESPOSTAS
async function conferir() {
    if (jaConferiu) return;

    const naoRespondidas = questoesAtuais.filter(q => !document.querySelector(`input[name="q-${q.id}"]:checked`));
    if (naoRespondidas.length > 0) {
        alert(`Por favor, responda todas. Faltam: ${naoRespondidas.length}`);
        return;
    }

    jaConferiu = true;
    let acertos = 0;
    let pontuacaoTotal = 0;

    questoesAtuais.forEach(q => {
        const selecionadaInput = document.querySelector(`input[name="q-${q.id}"]:checked`);
        const selecionada = selecionadaInput.value;
        const correta = q.resposta_correta.toUpperCase();
        const container = document.getElementById(`q-container-${q.id}`);

        // Pinta a correta de verde
        document.getElementById(`label-${q.id}-${correta}`)?.classList.add('correta');

        if (selecionada === correta) {
            acertos++;
            const peso = (q.materia === 'Língua Portuguesa') ? 1.0 : 1.5;
            pontuacaoTotal += peso;
            container.classList.add('correta-card');
        } else {
            document.getElementById(`label-${q.id}-${selecionada}`)?.classList.add('errada');
            container.classList.add('errada-card');
        }
    });

    const percentual = Math.round((acertos / questoesAtuais.length) * 100);
    document.getElementById('placar-texto').innerHTML = `✅ <strong>${acertos} acertos</strong> | 🏆 <strong>${pontuacaoTotal.toFixed(1)} pontos</strong> | 📊 <strong>${percentual}%</strong>`;
    
    // Atualiza barra de progresso
    const barra = document.getElementById('progresso-fill');
    if (barra) barra.style.width = Math.min(pontuacaoTotal, 100) + "%";
    const pontosTexto = document.getElementById('pontos');
    if (pontosTexto) pontosTexto.innerText = pontuacaoTotal.toFixed(1);

    document.getElementById('placar').classList.remove('hidden');
    document.getElementById('btn-conferir').classList.add('hidden');
    document.getElementById('btn-reiniciar').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 5. EVENTOS
document.getElementById('btn-iniciar').addEventListener('click', iniciarSimulado);
document.getElementById('btn-conferir').addEventListener('click', conferir);
document.getElementById('btn-reiniciar').addEventListener('click', () => iniciarSimulado());

