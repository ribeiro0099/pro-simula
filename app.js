// Inicializa o Supabase usando as credenciais do config.js
const _supabase = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

let questoesAtuais = [];
let jaConferiu = false;
let materiaAtual = '';

// 1. CARREGA AS MATÉRIAS AO SELECIONAR UM EXAME
document.getElementById('select-categoria').addEventListener('change', async (e) => {
    const selectMateria = document.getElementById('select-materia');
    selectMateria.innerHTML = '<option value="">Carregando matérias...</option>';
    selectMateria.disabled = true;

    // Busca as matérias únicas na tabela correta
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
    
    // Reseta visual
    placar.classList.add('hidden');
    document.getElementById('btn-conferir').classList.add('hidden');
    document.getElementById('btn-reiniciar').classList.add('hidden');
    container.innerHTML = '<div class="placeholder loading">⏳ Carregando questões...</div>';

    // Busca as questões (limite de 10 por vez)
    const { data, error } = await _supabase.from('questoes_simulado').select('*').eq('materia', materia).limit(10);

    if (error || !data || data.length === 0) {
        container.innerHTML = '<div class="placeholder">⚠️ Nenhuma questão encontrada.</div>';
        return;
    }

    // Embaralha as questões
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

// 4. LÓGICA DE CORREÇÃO E PONTUAÇÃO (PESO 1.5)
async function conferir() {
    if (jaConferiu) return;

    const respondidas = document.querySelectorAll('input[type="radio"]:checked');
    if (respondidas.length < questoesAtuais.length) {
        alert(`Por favor, responda todas as questões antes de conferir!`);
        return;
    }

    jaConferiu = true;
    let acertos = 0;
    let pontuacaoTotal = 0;

    questoesAtuais.forEach(q => {
        const selecionadaInput = document.querySelector(`input[name="q-${q.id}"]:checked`);
        const selecionada = selecionadaInput.value;
        const correta = q.resposta_correta.toUpperCase();

        // Destaca a correta
        document.getElementById(`label-${q.id}-${correta}`)?.classList.add('correta');

        if (selecionada === correta) {
            acertos++;
            // Lógica de peso: 1.5 para matérias bancárias, 1.0 para Português
            const peso = (materiaAtual === 'Língua Portuguesa') ? 1.0 : 1.5;
            pontuacaoTotal += peso;
        } else {
            // Destaca a errada do usuário
            document.getElementById(`label-${q.id}-${selecionada}`)?.classList.add('errada');
        }
    });

    // Cálculos de percentual
    const percentual = Math.round((acertos / questoesAtuais.length) * 100);
    
    // Atualiza o placar e a barra verde
    document.getElementById('placar-texto').innerHTML = `✅ <strong>${acertos} acertos</strong> | 🏆 <strong>${pontuacaoTotal.toFixed(1)} pontos</strong> | 📊 <strong>${percentual}%</strong>`;
    
    const barra = document.getElementById('progresso-fill');
    if (barra) barra.style.width = Math.min((pontuacaoTotal * 5), 100) + "%"; // Ajuste visual da barra
    
    const pontosTexto = document.getElementById('pontos');
    if (pontosTexto) pontosTexto.innerText = pontuacaoTotal.toFixed(1);

    document.getElementById('placar').classList.remove('hidden');
    document.getElementById('btn-conferir').classList.add('hidden');
    document.getElementById('btn-reiniciar').classList.remove('hidden');
    
    // Volta ao topo para ver o resultado
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 5. VINCULAÇÃO DE EVENTOS
document.getElementById('btn-iniciar').addEventListener('click', iniciarSimulado);
document.getElementById('btn-conferir').addEventListener('click', conferir);
document.getElementById('btn-reiniciar').addEventListener('click', () => iniciarSimulado());