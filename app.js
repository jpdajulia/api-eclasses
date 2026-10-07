require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_KEY no arquivo .env (veja .env.example)');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
class ErroValidacao extends Error {}

const texto = (v, campo) => {
    if (typeof v !== 'string' || !v.trim()) throw new ErroValidacao(`Campo "${campo}" é obrigatório`);
    return v.trim();
};
const inteiroPositivo = (v, campo) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw new ErroValidacao(`Campo "${campo}" inválido`);
    return n;
};
const placar = (v, campo) => {
    const n = Number(v ?? 0);
    if (!Number.isInteger(n) || n < 0) throw new ErroValidacao(`Campo "${campo}" deve ser um inteiro >= 0`);
    return n;
};
const cor = (v) => {
    const c = v ?? '#6366f1';
    if (!/^#[0-9a-f]{6}$/i.test(c)) throw new ErroValidacao('Campo "color" deve ser uma cor hexadecimal (#RRGGBB)');
    return c;
};
const idDaRota = (req) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ErroValidacao('ID inválido');
    return id;
};

// ---------------------------------------------------------------
// Recursos: cada um converte entre o formato da API (camelCase,
// igual ao data.json original) e o formato do banco (snake_case)
// ---------------------------------------------------------------
const recursos = {
    jogos: {
        tabela: 'games',
        nome: 'Jogo',
        paraApi: (r) => ({ id: r.id, name: r.name, genre: r.genre }),
        paraBanco: (b) => ({ name: texto(b.name, 'name'), genre: texto(b.genre, 'genre') }),
    },
    times: {
        tabela: 'teams',
        nome: 'Time',
        paraApi: (r) => ({ id: r.id, name: r.name, color: r.color }),
        paraBanco: (b) => ({ name: texto(b.name, 'name'), color: cor(b.color) }),
    },
    competidores: {
        tabela: 'competitors',
        nome: 'Competidor',
        paraApi: (r) => ({ id: r.id, name: r.name, nickname: r.nickname, teamId: r.team_id }),
        paraBanco: (b) => ({
            name: texto(b.name, 'name'),
            nickname: texto(b.nickname, 'nickname'),
            team_id: inteiroPositivo(b.teamId, 'teamId'),
        }),
    },
    confrontos: {
        tabela: 'matches',
        nome: 'Confronto',
        paraApi: (r) => ({
            id: r.id,
            gameId: r.game_id,
            team1Id: r.team1_id,
            team2Id: r.team2_id,
            score1: r.score1,
            score2: r.score2,
            status: r.status,
            date: String(r.date).slice(0, 16), // "2026-03-24T14:00"
        }),
        paraBanco: (b) => {
            const team1 = inteiroPositivo(b.team1Id, 'team1Id');
            const team2 = inteiroPositivo(b.team2Id, 'team2Id');
            if (team1 === team2) throw new ErroValidacao('Um time não pode jogar contra ele mesmo');
            const status = b.status ?? 'scheduled';
            if (!['scheduled', 'finished'].includes(status)) {
                throw new ErroValidacao('Campo "status" deve ser "scheduled" ou "finished"');
            }
            if (!b.date || Number.isNaN(new Date(b.date).getTime())) {
                throw new ErroValidacao('Campo "date" inválido');
            }
            return {
                game_id: inteiroPositivo(b.gameId, 'gameId'),
                team1_id: team1,
                team2_id: team2,
                score1: placar(b.score1, 'score1'),
                score2: placar(b.score2, 'score2'),
                status,
                date: b.date,
            };
        },
    },
};

// Converte erros do Postgres/Supabase em respostas HTTP
function responderErro(res, erro) {
    if (erro instanceof ErroValidacao) return res.status(400).json({ erro: erro.message });
    if (erro.code === '23503') return res.status(400).json({ erro: 'Referência inválida: jogo ou time não existe' });
    if (erro.code === '23505') return res.status(409).json({ erro: 'Já existe um registro com esse valor' });
    if (erro.code === '23514') return res.status(400).json({ erro: 'Dados inválidos para este registro' });
    console.error(erro);
    return res.status(500).json({ erro: 'Erro interno do servidor' });
}

const rota = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (erro) {
        responderErro(res, erro);
    }
};

// ---------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------
app.get('/', (req, res) => {
    res.status(200).json({
        mensagem: 'Bem vindo à API GamerClass',
        status: 'sucesso',
        rotas: Object.keys(recursos).map((r) => `/api/${r}`),
        metodos: ['GET', 'POST', 'PUT', 'DELETE'],
    });
});

for (const [caminho, rec] of Object.entries(recursos)) {
    const base = `/api/${caminho}`;

    // GET (lista)
    app.get(base, rota(async (req, res) => {
        const { data, error } = await supabase.from(rec.tabela).select('*').order('id');
        if (error) throw error;
        res.status(200).json(data.map(rec.paraApi));
    }));

    // GET (um)
    app.get(`${base}/:id`, rota(async (req, res) => {
        const id = idDaRota(req);
        const { data, error } = await supabase.from(rec.tabela).select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ erro: `${rec.nome} não encontrado` });
        res.status(200).json(rec.paraApi(data));
    }));

    // POST (criar)
    app.post(base, rota(async (req, res) => {
        const dados = rec.paraBanco(req.body || {});
        const { data, error } = await supabase.from(rec.tabela).insert(dados).select().single();
        if (error) throw error;
        res.status(201).json(rec.paraApi(data));
    }));

    // PUT (atualizar)
    app.put(`${base}/:id`, rota(async (req, res) => {
        const id = idDaRota(req);
        const dados = rec.paraBanco(req.body || {});
        const { data, error } = await supabase.from(rec.tabela).update(dados).eq('id', id).select().maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ erro: `${rec.nome} não encontrado` });
        res.status(200).json(rec.paraApi(data));
    }));

    // DELETE (remover)
    app.delete(`${base}/:id`, rota(async (req, res) => {
        const id = idDaRota(req);
        const { data, error } = await supabase.from(rec.tabela).delete().eq('id', id).select('id');
        if (error) throw error;
        if (!data.length) return res.status(404).json({ erro: `${rec.nome} não encontrado` });
        res.status(200).json({ mensagem: `${rec.nome} removido com sucesso`, id });
    }));
}

// Rota não encontrada
app.use((req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
});
