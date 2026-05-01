// Configurações do Supabase - URL corrigida sem o sufixo /rest/v1/
const SUPABASE_URL = "https://ukpbxtwxkurjyrnuoniy.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrcGJ4dHd4a3VyanlybnVvbml5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1OTcyOTQsImV4cCI6MjA5MzE3MzI5NH0.wonPrg8kUbqY0zaTsZ4UAk6K6lEROY20BPh1Fp-HSkA";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let questoesAtuais = [];

// 1. Carrega as matérias únicas para o menu suspenso
async function carregarMaterias() {
    try {
        const { data, error } = await _supabase.from('questoes').select('materia');
        if (error) throw error;

        if (data) {
            const materiasUnicas = [...new Set(data.map(item => item.materia))];
            const select = document.getElementById('select-materia');
            select.innerHTML = '<option value="">Selecione uma matéria</option>' + 
                materiasUnicas.map(m => `<option value="${m}">${m}</option>`).join('');
        }
    } catch (err) {
        console.error("Erro ao carregar matérias:", err);
        alert("Erro ao carregar dados do servidor!");
    }
}

// 2. Busca questões e alternativas relacionadas
async function iniciarSimulado() {
    const materia = document.getElementById('select-materia').value;
    if (!materia) return alert("Selecione uma matéria primeiro!");

    const { data, error } = await _supabase
        .from('questoes')
        .select('*, alternativas(*)')
        .eq('materia', materia);

    if (error) return alert("Erro ao buscar questões!");

    questoesAtuais = data;
    renderizarQuestoes();
}

// 3. Mostra as questões na tela
function renderizarQuestoes() {
    const container = document.getElementById('questoes-container');
    container.innerHTML = questoesAtuais.map((q, i) => `
        <div class="questao-card" id="q-card-${q.id}">
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
    
    document.getElementById('btn-conferir').classList.remove('hidden');
}

// 4. Lógica de Correção
document.getElementById('btn-conferir').onclick = () => {
    let acertos = 0;
    questoesAtuais.forEach(q => {
        const selecionada = document.querySelector(`input[name="q-${q.id}"]:checked`);
        const labelCorreta = document.getElementById(`label-${q.id}-${q.resposta_correta}`);
        
        if (labelCorreta) labelCorreta.classList.add('correta');

        if (selecionada) {
            if (selecionada.value === q.resposta_correta) {
                acertos++;
            } else {
                const labelErrada = document.getElementById(`label-${q.id}-${selecionada.value}`);
                if (labelErrada) labelErrada.classList.add('errada');
            }
        }
    });
    alert(`Resultado: ${acertos} de ${questoesAtuais.length} corretas!`);
};

document.getElementById('btn-iniciar').onclick = iniciarSimulado;
carregarMaterias();