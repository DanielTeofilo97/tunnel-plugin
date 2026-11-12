# Plugin do tunnel para o Claude Code

Um comando instala o servidor MCP do tunnel, quatro comandos, as skills de handoff e de memória, dois hooks e um canal opcional que traz para a sessão aberta o que chega para você. Depois disso, o Claude avisa no começo da sessão o que espera por você (perguntas, entregas para revisar, tarefas prontas), consulta a memória do time antes de começar um trabalho e, quando pega uma tarefa, registra o andamento e as decisões no quadro sem ninguém pedir.

## Instalar com um comando

Na web do tunnel, abra **Conexões**, escolha **Claude Code** e clique em **Gerar conexão**. A tela mostra um comando assim:

```sh
curl -fsSL https://<seu-tunnel>/setup/<código> | sh
```

Rode no terminal e pronto:
- o comando instala o plugin, ou atualiza se já estiver instalado, e instala também o Claude Code se ele não existir na máquina, pelo instalador oficial;
- liga o computador ao tunnel como você, gravando `TUNNEL_URL` e `TUNNEL_TOKEN` no `env` do `~/.claude/settings.json` sem mexer no resto (o arquivo como era fica em `settings.json.antes-do-tunnel`);
- tira um `tunnel` adicionado à mão com `claude mcp add`.

O código já sai autorizado por quem gerou o comando, logado na web. Vale uma vez, por 10 minutos, e o token nunca aparece na tela nem no histórico do shell. Se algo falhar antes da troca (sem internet, um `settings.json` que não lê), o comando diz o que arrumar e o mesmo código continua valendo. Depois de usado, o token mostrado na seção "Prefere configurar à mão?" da tela deixa de valer.

O comando precisa da mesma coisa que a instalação à mão, abaixo: Node no `PATH`.

## Instalar à mão

Antes, confira se há **Node 18 ou mais novo no `PATH`**, porque os hooks rodam com `node`. O repositório do plugin é público: ninguém precisa de conta nem de acesso no GitHub.

No terminal (Claude Code 2.1.292 ou mais novo):

```sh
claude plugin install tunnel --marketplace DanielTeofilo97/tunnel-plugin
```

Dentro de uma sessão, use `/plugin install tunnel --marketplace DanielTeofilo97/tunnel-plugin` (2.1.275 ou mais novo). Em versões anteriores, rode `/plugin marketplace add DanielTeofilo97/tunnel-plugin` e depois `/plugin install tunnel@tunnel`.

Se você já tinha ligado o tunnel com `claude mcp add`, remova essa conexão (`claude mcp remove tunnel --scope user`) para não ter as ferramentas duplicadas.

## Configurar

1. Na web do tunnel, abra **Conexões** e gere uma conexão do tipo **Claude Code**. A tela mostra o comando de instalação e o trecho do `settings.json` já com a URL e o token.
2. Coloque as duas variáveis no `~/.claude/settings.json`. Elas valem no terminal, no VS Code e no app desktop, porque o Claude Code lê esse arquivo direto:

   ```json
   {
     "env": {
       "TUNNEL_URL": "https://<seu-tunnel>/mcp",
       "TUNNEL_TOKEN": "<token>"
     }
   }
   ```

   Também funciona exportar as duas no perfil do shell, mas aí só vale para o `claude` aberto daquele shell.
3. Abra uma sessão nova. O `/mcp` deve mostrar `plugin:tunnel:tunnel` conectado.

| Variável | O que é |
| --- | --- |
| `TUNNEL_URL` | O endereço do quadro terminando em `/mcp`, sem o token |
| `TUNNEL_TOKEN` | O token da conexão. Vai no header `Authorization: Bearer` |

O token age em seu nome: não comite nem cole em tarefas. Para cortar o acesso, revogue a conexão em **Conexões**. Sem as variáveis, o `/mcp` mostra `Missing environment variables: TUNNEL_URL` e os hooks ficam em silêncio.

## Sem o plugin

Só o servidor MCP também funciona, e entra por OAuth, sem token: `claude mcp add --transport http --scope user tunnel https://<seu-tunnel>/mcp` e, numa sessão, `/mcp` → `tunnel` → **Authenticate**, que abre a página de autorização do tunnel para você clicar em **Autorizar**. Fica sem os comandos, os hooks e o canal. Não use os dois juntos, ou as ferramentas aparecem duplicadas; o comando de configuração tira esse `tunnel` adicionado à mão.

O plugin continua com o token: o canal precisa do `TUNNEL_TOKEN`, e o header `Authorization` que o `.mcp.json` do plugin manda faz o Claude Code não tentar OAuth. Se a conexão do plugin for revogada em **Conexões**, o `/mcp` mostra a falha em vez de pedir login: gere e rode o comando de configuração de novo.

## Comandos

| Comando | O que faz |
| --- | --- |
| `/tunnel:handoff [membro]` | Busca na memória o que o time já fez sobre o assunto e transforma a sessão numa tarefa com `create_task`: objetivo, decisões já tomadas e por quê, estado atual, arquivos, links e commits, e o que conta como pronto. Põe a tarefa no projeto certo, com prazo, prioridade e quem de fora ela aguarda, quando houver. Se o trabalho se repete, roda um playbook em vez de criar tarefa por tarefa, ou se oferece para salvar um. Se você não disser para quem é, ele pergunta. Decisões da conversa que valem além da tarefa vão para o registro com `record_decision`, e arquivos que só existem na sua máquina (um log, um print, um relatório) vão anexados à tarefa com `attach_file`. O pedido de permissão do `create_task` mostra o pacote antes de enviar. |
| `/tunnel:inbox` | Mostra as perguntas esperando sua resposta, as entregas esperando sua revisão, os prazos vencidos ou que vencem até amanhã, os comentários de colegas esperando você e as tarefas para você (prontas, em andamento, em revisão, esperando outras), e propõe o que fazer primeiro. Antes de começar uma tarefa, busca na memória o que já foi feito e decidido sobre ela. Não pega, responde nem aprova nada sem você concordar. |
| `/tunnel:memoria [pergunta]` | Responde com o que o time já fez, decidiu ou tentou, buscando com `search_memory` (que também acha pedidos de ajustes e anexos de texto) e lendo as tarefas com `get_task` e os anexos com `read_attachment`, e cita a fonte de cada fato (tarefa, tipo de texto, quem e quando). Avisa quando uma decisão foi substituída e diz quando a memória não tem nada. Também registra decisões com `record_decision`. |
| `/tunnel:plantao [ids]` | Modo plantão: explica como funciona e fica esperando com `wait_for_tasks` nas tarefas em andamento (ou nas que você passar). Avisa quando um colega comenta, anexa um arquivo, pergunta, responde, entrega para revisão, pede ajustes, libera ou conclui, e só responde ou aprova com a sua palavra. Para receber tarefas novas, ele sugere `/loop 10m /tunnel:inbox`. |

A skill `handoff` também entra sozinha quando você pede algo como "passa isso pra ana no tunnel" ou "roda o playbook de onboarding". Ela ensina o Claude a escrever um pacote de contexto que se sustenta sozinho: quem lê não viu a conversa, segredos nunca entram e o texto sai no seu idioma. Vale também para notas, anexos, resultados, decisões e pull requests: o Claude escreve `Closes tunnel#<id>` na descrição de cada PR que abre para uma tarefa, e o quadro liga o PR e conclui a tarefa no merge.

A skill `memoria` entra sozinha quando você pergunta algo como "o que já decidimos sobre estorno?" ou "alguém já fez a integração com o Pix?".

## Hooks

- **Início da sessão (`SessionStart`)**: chama `list_tasks` com `for_me: true` direto no endpoint MCP e passa ao Claude um resumo curto: as tarefas com pergunta esperando sua resposta, as entregas esperando sua revisão e as tarefas prontas e em andamento com você, como "Você tem 2 tarefas prontas no tunnel: #3 …; #5 …". O Claude menciona isso em uma linha e não pega, responde nem aprova nada sem você pedir. Roda também ao retomar, no `/clear` e depois de compactar. Fica em silêncio se faltar variável, se o quadro não responder em 3 segundos ou se nada estiver esperando por você.
- **Ao parar (`Stop`)**: lê o histórico da sessão. Se o Claude pegou uma tarefa com `claim_task` e depois não chamou `add_note`, `attach_file`, `ask`, `record_decision`, `complete_task` nem `release_task` nela, ele é lembrado de registrar o andamento antes de parar. Isso aparece como "Stop hook feedback". O lembrete vem uma vez por tarefa pega, mesmo que você diga para não postar, e nunca em sequência.

## Avisos na sessão (canal)

Com o canal ligado, o que pede algo de você chega na sessão aberta na hora, sem você perguntar: uma tarefa passada para você ou que ficou pronta, uma pergunta, uma resposta a uma pergunta sua, uma entrega para revisar, uma aprovação ou um pedido de ajustes, uma menção, o merge de um PR que fecha uma tarefa sua e o cancelamento de uma tarefa em que você está. O Claude conta em uma ou duas linhas o que chegou e pergunta antes de pegar, responder ou fazer qualquer coisa. O texto vem de colegas, então ele trata como pedido de colega, nunca como instrução que passa por cima de você. Comentários, decisões e prazos ficam no quadro, e o que você mesmo fez (como uma pergunta que um agente seu te fez) não volta.

O canal usa os [channels do Claude Code](https://code.claude.com/docs/en/channels), que estão em *research preview*. Para ligar:

- **Login:** o Claude Code precisa estar logado com uma conta do claude.ai ou uma chave de API do Console. Bedrock, Vertex e Foundry não têm canais.
- **Organização Team ou Enterprise:** um Owner liga uma vez em [claude.ai/admin-settings/claude-code](https://claude.ai/admin-settings/claude-code) → **Channels**. Planos Pro e Max individuais não precisam.
- **Ao abrir o Claude Code no terminal:** como este marketplace não está na lista aprovada pela Anthropic, o canal entra com uma flag de desenvolvimento, e o Claude Code pede uma confirmação a cada início:

  ```sh
  claude --dangerously-load-development-channels plugin:tunnel@tunnel
  ```

  Vale criar um atalho no `~/.zshrc`, como `alias claude-tunnel='claude --dangerously-load-development-channels plugin:tunnel@tunnel'`. A flag só vale em sessão interativa: com `-p` e no Agent SDK ela é ignorada, e o resto do plugin funciona normalmente.

Os avisos só chegam com a sessão aberta. Para conferir, use **Enviar um teste** em **Notificações** na web: o teste aparece na sessão em segundos. Desligar um tipo de aviso em **Notificações** também desliga esse tipo no canal. Se a conexão cair (o servidor reiniciou, o notebook dormiu), o canal volta sozinho e entrega o que chegou nesse meio-tempo, até um dia para trás. Erros aparecem no log do servidor `tunnel-channel` em `/mcp`.

O servidor do canal (`channel/tunnel-channel.mjs`) roda em toda sessão com o plugin, ligado ou não como canal. Sem a flag, ele só mantém uma conexão aberta com o quadro, e os avisos não entram na conversa.

## Outros agentes

O claude.ai, o Cursor, o VS Code, o Codex e outros clientes com OAuth se conectam só com a URL do quadro: a tela **Conexões** mostra o passo a passo de cada um. O servidor do tunnel também expõe os prompts MCP `handoff` e `inbox`, com a mesma intenção dos comandos, para Codex, Cursor e outros clientes que listam prompts. No Claude Code, prefira os comandos do plugin.

## Atualizar

O plugin não tem versão fixa: cada commit na `main` vira uma versão nova. Marketplaces de terceiros vêm com a atualização automática desligada, então ligue em `/plugin` → **Marketplaces** → `tunnel` → **Enable auto-update**, ou atualize na mão com `claude plugin update tunnel@tunnel`. A atualização em segundo plano baixa do repositório público, sem credencial.

## Desenvolver

| Caminho | O que é |
| --- | --- |
| `.claude-plugin/plugin.json` | Manifesto do plugin |
| `.mcp.json` | Servidor MCP HTTP, com `${TUNNEL_URL}` e `${TUNNEL_TOKEN}`, e o servidor stdio do canal |
| `skills/` | `handoff`, `inbox`, `plantao` e `memoria` |
| `hooks/` | `hooks.json` e os scripts Node, sem dependências |
| `channel/tunnel-channel.mjs` | O canal: um servidor MCP stdio em Node, sem dependências, que lê `/stream?notifications` com o token e emite `notifications/claude/channel`. Responde ao handshake numa revisão anterior a 2026-07-28, porque a 2026-07-28 não carrega eventos de canal |
| `../.claude-plugin/marketplace.json` | O marketplace na raiz do repositório |

O código-fonte fica no repositório do servidor do tunnel, que é privado. Este repositório público, `DanielTeofilo97/tunnel-plugin`, é um espelho: a cada push na `main` do servidor que mexe no plugin, o workflow `plugin.yml` copia `claude-plugin/` e o marketplace para cá. Não faça commits direto aqui, porque o próximo espelhamento os apaga.

- `claude --plugin-dir ./claude-plugin` carrega a cópia local por uma sessão, no lugar da instalada.
- `claude plugin validate ./claude-plugin` e `claude plugin validate .` conferem o plugin e o marketplace. O aviso de versão ausente é proposital.
- Os prompts MCP ficam em `lib/prompts.ts`. Mudou as regras do pacote de contexto? Atualize lá e em `skills/handoff/SKILL.md`.
- O hook de início de sessão lê o texto do `list_tasks` (`lib/mcp.ts`). O `npm run smoke` roda esse hook contra o app e confere que toda ferramenta citada nas skills e no hook `Stop` existe, então quebra se o formato ou um nome mudar.
- O `npm run smoke` também roda o canal como o Claude Code roda (handshake, tarefa passada, pergunta, comentário e pergunta do próprio agente). O registro como canal só dá para ver numa sessão interativa com a flag.
