# API E-Classes (GamerClass)

API REST em Express conectada ao banco PostgreSQL do **Supabase**.

## Como rodar

1. **Banco:** no Supabase, abra *SQL Editor → New query*, cole o conteúdo de `schema.sql` e clique em **Run**.
2. **Variáveis:** copie `.env.example` para `.env` e preencha com os dados de *Project Settings → API*:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY` (chave `service_role` / `secret` — nunca suba o `.env` no GitHub)
3. Instale e inicie:
   ```bash
   npm install
   npm start
   ```
   A API sobe em `http://localhost:3000`.

## Rotas

Recursos: `jogos`, `times`, `competidores`, `confrontos`

| Método | Rota | Ação |
|--------|------|------|
| GET | `/api/<recurso>` | lista todos |
| GET | `/api/<recurso>/:id` | busca um |
| POST | `/api/<recurso>` | cria (retorna 201) |
| PUT | `/api/<recurso>/:id` | atualiza (envie o objeto completo) |
| DELETE | `/api/<recurso>/:id` | remove |

### Corpos esperados (POST/PUT)

```jsonc
// jogos
{ "name": "VALORANT", "genre": "FPS" }
// times
{ "name": "Neon Knights", "color": "#00BCD4" }
// competidores
{ "name": "Ana Oliveira", "nickname": "AnaPvP", "teamId": 2 }
// confrontos (status: "scheduled" | "finished")
{ "gameId": 1, "team1Id": 1, "team2Id": 2, "score1": 1, "score2": 0,
  "status": "finished", "date": "2026-03-24T14:00" }
```

### Códigos de resposta
`200` ok · `201` criado · `400` dados inválidos · `404` não encontrado · `409` valor duplicado · `500` erro interno

### Regras de exclusão
- Apagar um **time** remove os confrontos dele e deixa os competidores sem time.
- Apagar um **jogo** remove os confrontos dele.
