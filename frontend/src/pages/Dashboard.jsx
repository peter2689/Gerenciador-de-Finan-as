import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [transacoes, setTransacoes] = useState([]);
  
  const [categoria, setCategoria] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState('saida');
  const [data, setData] = useState('');
  
  // NOVO: Estado para saber se estamos editando alguma transação
  const [idEmEdicao, setIdEmEdicao] = useState(null);
  
  const navigate = useNavigate();

  const buscarTransacoes = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/'); return;
    }
    try {
      const resposta = await fetch('http://localhost:3000/transacoes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resposta.ok) {
        const dados = await resposta.json();
        setTransacoes(dados);
      } else {
        localStorage.removeItem('token'); navigate('/');
      }
    } catch (error) { console.error('Erro:', error); }
  };

  useEffect(() => { buscarTransacoes(); }, [navigate]);

  // Modificado: Agora essa função serve para Criar e Atualizar!
  const salvarTransacao = async (evento) => {
    evento.preventDefault();
    const token = localStorage.getItem('token');

    // Se tiver um ID em edição, a URL muda para a de Atualizar. Se não, é a de Criar.
    const url = idEmEdicao 
      ? `http://localhost:3000/transacoes/${idEmEdicao}` 
      : 'http://localhost:3000/transacoes';
    
    const metodo = idEmEdicao ? 'PUT' : 'POST';

    try {
      const resposta = await fetch(url, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ categoria, valor: parseFloat(valor), tipo, data })
      });

      if (resposta.ok) {
        cancelarEdicao(); // Limpa o formulário e sai do modo de edição
        buscarTransacoes(); // Recarrega a lista
      } else {
        alert('Erro ao salvar transação.');
      }
    } catch (error) { alert('Erro de conexão.'); }
  };

  // NOVO: Função para deletar
  const deletarTransacao = async (id) => {
    const confirmar = window.confirm('Tem certeza que deseja excluir esta transação?');
    if (!confirmar) return; // Se o usuário cancelar, não faz nada

    const token = localStorage.getItem('token');
    try {
      const resposta = await fetch(`http://localhost:3000/transacoes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (resposta.ok) {
        buscarTransacoes();
      } else {
        alert('Erro ao deletar transação.');
      }
    } catch (error) { alert('Erro de conexão.'); }
  };

  // NOVO: Função para preencher o formulário quando clicar em "Editar"
  const prepararEdicao = (transacao) => {
    setIdEmEdicao(transacao.id);
    setCategoria(transacao.categoria);
    setValor(transacao.valor);
    setTipo(transacao.tipo);
    // Cortamos o texto da data para o input do calendário entender (pega só o YYYY-MM-DD)
    setData(transacao.data.split('T')[0]); 
  };

  // NOVO: Função para cancelar a edição e limpar os campos
  const cancelarEdicao = () => {
    setIdEmEdicao(null);
    setCategoria('');
    setValor('');
    setTipo('saida');
    setData('');
  };

  const fazerLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const saldoTotal = transacoes.reduce((acumulador, transacao) => {
    const valorNumerico = parseFloat(transacao.valor);
    return transacao.tipo === 'entrada' ? acumulador + valorNumerico : acumulador - valorNumerico;
  }, 0);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Meu Painel Financeiro 📊</h2>
        <button onClick={fazerLogout} style={{ padding: '8px 15px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Sair</button>
      </div>

      <div style={{ background: saldoTotal >= 0 ? '#d4edda' : '#f8d7da', padding: '20px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, color: '#333' }}>Saldo Atual</h3>
        <h1 style={{ margin: '10px 0 0 0', color: saldoTotal >= 0 ? '#155724' : '#721c24' }}>R$ {saldoTotal.toFixed(2)}</h1>
      </div>
      
      <form onSubmit={salvarTransacao} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
        <input type="text" placeholder="Categoria (ex: Mercado)" value={categoria} onChange={(e) => setCategoria(e.target.value)} required style={{ flex: 1, minWidth: '150px', padding: '8px' }} />
        <input type="number" step="0.01" placeholder="Valor (R$)" value={valor} onChange={(e) => setValor(e.target.value)} required style={{ width: '100px', padding: '8px' }} />
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} required style={{ padding: '8px' }} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ padding: '8px' }}>
          <option value="saida">Despesa</option>
          <option value="entrada">Entrada</option>
        </select>
        
        {/* Muda o botão dependendo se está editando ou criando */}
        <button type="submit" style={{ padding: '8px 15px', background: idEmEdicao ? '#ffc107' : '#28a745', color: idEmEdicao ? '#000' : 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
          {idEmEdicao ? 'Atualizar' : 'Adicionar'}
        </button>

        {/* Botão de cancelar só aparece se estiver editando */}
        {idEmEdicao && (
          <button type="button" onClick={cancelarEdicao} style={{ padding: '8px 15px', background: '#6c757d', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
            Cancelar
          </button>
        )}
      </form>

      <h3>Minhas Transações</h3>
      {transacoes.length === 0 ? (
        <p>Nenhuma transação encontrada.</p>
      ) : (
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {transacoes.map((item) => (
            <li key={item.id} style={{ padding: '10px', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <strong>{item.categoria}</strong> 
                <small style={{ color: '#666', marginLeft: '10px' }}>({new Date(item.data).toLocaleDateString('pt-BR')})</small>
              </span>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ color: item.tipo === 'entrada' ? 'green' : 'red', fontWeight: 'bold' }}>
                  {item.tipo === 'entrada' ? '+' : '-'} R$ {parseFloat(item.valor).toFixed(2)}
                </span>
                
                {/* Botões de Ação */}
                <button onClick={() => prepararEdicao(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }} title="Editar">✏️</button>
                <button onClick={() => deletarTransacao(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }} title="Excluir">🗑️</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}