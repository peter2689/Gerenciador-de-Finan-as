import { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // <-- Ferramenta para mudar de página

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const navigate = useNavigate(); // <-- Iniciando o "motorista"

  const fazerLogin = async (evento) => {
    evento.preventDefault();

    try {
      const resposta = await fetch('[https://gerenciador-de-finan-as.onrender.com](https://gerenciador-de-finan-as.onrender.com)', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        // 1. Guarda o token no "bolso" do navegador
        localStorage.setItem('token', dados.token);
        
        // 2. Redireciona para o Dashboard
        navigate('/dashboard'); 
      } else {
        alert('Deu erro: ' + dados.erro);
      }
    } catch (error) {
      alert('Erro ao tentar conectar com o servidor.');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Entrar no Sistema</h2>
      <form onSubmit={fazerLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px' }}>
        <input type="email" placeholder="Seu e-mail" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '8px' }} required />
        <input type="password" placeholder="Sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} style={{ padding: '8px' }} required />
        <button type="submit" style={{ padding: '10px', background: '#007BFF', color: 'white', border: 'none', cursor: 'pointer' }}>Entrar</button>
      </form>
    </div>
  );
}