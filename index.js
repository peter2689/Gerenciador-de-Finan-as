require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true },
});

app.use(cors());
app.use(express.json());

// ==========================================
// MIDDLEWARE: O "Segurança" das rotas
// ==========================================
function verificarToken(req, res, next) {
  // Pega o token que vem no cabeçalho da requisição
  const tokenCompleto = req.headers['authorization'];
  if (!tokenCompleto) return res.status(401).json({ erro: 'Acesso negado. Token não fornecido.' });

  try {
    // O token vem no formato "Bearer [codigo]". Aqui nós separamos só o código.
    const tokenReal = tokenCompleto.split(' ')[1]; 
    const decodificado = jwt.verify(tokenReal, process.env.JWT_SECRET);
    
    // Salva os dados do usuário (como o ID) para usarmos na rota
    req.usuario = decodificado; 
    next(); // Crachá válido! Deixa passar para a rota.
  } catch (error) {
    res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

// ==========================================
// ROTAS PÚBLICAS (Não precisam de crachá)
// ==========================================
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.send(`Sucesso! 🚀 Conectado ao Neon. Data: ${result.rows[0].now}`);
  } catch (error) {
    res.status(500).send('Erro ao conectar no banco.');
  }
});

app.post('/usuarios', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    const senhaHash = await bcrypt.hash(senha, 10);
    const result = await pool.query('INSERT INTO usuarios (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id, nome, email', [nome, email, senhaHash]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ erro: 'Erro interno ao criar usuário.' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    
    if (result.rows.length === 0) return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
    
    const usuario = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });

    const token = jwt.sign({ id: usuario.id, nome: usuario.nome }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ mensagem: 'Login realizado com sucesso!', token });
  } catch (error) {
    res.status(500).json({ erro: 'Erro interno ao fazer login.' });
  }
});

// ==========================================
// ROTAS PROTEGIDAS (Precisam de crachá)
// ==========================================

// NOVA ROTA: Criar uma transação (Entrada/Saída)
app.post('/transacoes', verificarToken, async (req, res) => {
  try {
    const { tipo, valor, categoria, data } = req.body;
    
    // Pegamos o ID do dono da transação direto do crachá verificado!
    const usuario_id = req.usuario.id; 

    const query = 'INSERT INTO transacoes (usuario_id, tipo, valor, categoria, data) VALUES ($1, $2, $3, $4, $5) RETURNING *';
    const values = [usuario_id, tipo, valor, categoria, data];
    
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar transação:', error);
    res.status(500).json({ erro: 'Erro interno ao salvar transação.' });
  }
});

// NOVA ROTA: Listar todas as transações do usuário logado
app.get('/transacoes', verificarToken, async (req, res) => {
  try {
    const usuario_id = req.usuario.id;
    // Busca só as transações desse usuário, ordenadas da mais recente para a mais antiga
    const result = await pool.query('SELECT * FROM transacoes WHERE usuario_id = $1 ORDER BY data DESC', [usuario_id]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar transações:', error);
    res.status(500).json({ erro: 'Erro ao buscar transações.' });
  }
});

// NOVA ROTA: Apagar uma transação
app.delete('/transacoes/:id', verificarToken, async (req, res) => {
  try {
    const usuario_id = req.usuario.id;
    const transacao_id = req.params.id; // Pega o ID que vem na URL

    // O "AND usuario_id = $2" garante que o usuário só pode apagar as próprias transações!
    const query = 'DELETE FROM transacoes WHERE id = $1 AND usuario_id = $2 RETURNING *';
    const result = await pool.query(query, [transacao_id, usuario_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Transação não encontrada ou não pertence a você.' });
    }

    res.status(200).json({ mensagem: 'Transação apagada com sucesso!', apagada: result.rows[0] });
  } catch (error) {
    console.error('Erro ao apagar transação:', error);
    res.status(500).json({ erro: 'Erro ao apagar transação.' });
  }
});

// ==========================================
// ROTA PARA DELETAR UMA TRANSAÇÃO
// ==========================================
app.delete('/transacoes/:id', async (req, res) => {
  try {
    // 1. Verifica quem é o usuário pelo Token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ erro: 'Acesso negado' });
    
    const decodificado = jwt.verify(token, process.env.JWT_SECRET);
    const idDaTransacao = req.params.id;

    // 2. Deleta do banco (garantindo que a transação pertence a este usuário)
    await pool.query(
      'DELETE FROM transacoes WHERE id = $1 AND usuario_id = $2', 
      [idDaTransacao, decodificado.id]
    );
    
    res.json({ mensagem: 'Transação deletada com sucesso!' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao deletar transação.' });
  }
});

// ==========================================
// ROTA PARA EDITAR (ATUALIZAR) UMA TRANSAÇÃO
// ==========================================
app.put('/transacoes/:id', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ erro: 'Acesso negado' });
    
    const decodificado = jwt.verify(token, process.env.JWT_SECRET);
    const idDaTransacao = req.params.id;
    const { categoria, valor, tipo, data } = req.body;

    // Atualiza os dados no banco
    await pool.query(
      'UPDATE transacoes SET categoria = $1, valor = $2, tipo = $3, data = $4 WHERE id = $5 AND usuario_id = $6',
      [categoria, valor, tipo, data, idDaTransacao, decodificado.id]
    );
    
    res.json({ mensagem: 'Transação atualizada com sucesso!' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar transação.' });
  }
});

app.listen(port, () => console.log(`Servidor rodando em http://localhost:${port}`));