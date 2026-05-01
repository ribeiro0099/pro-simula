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