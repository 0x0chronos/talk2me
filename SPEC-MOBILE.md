# talk2me pessoal no Android e no iPhone

Status: aprovado pelo usuário em 14/11/2026; implementado e validado localmente.
Publicação e validação nos aparelhos físicos permanecem pendentes.

## Objetivo

Permitir que o casal estude no Android e no iPhone sem manter um computador
ligado. Uma única versão instalável pelo navegador (PWA) deve reaproveitar a
interface, os conteúdos e os exercícios existentes.

## Premissas

- Uso pessoal de duas pessoas, cada uma no próprio celular.
- Internet disponível para instalar e baixar novas aulas; aulas baixadas devem
  funcionar sem internet e sem servidor acessível.
- O progresso de cada pessoa fica no próprio aparelho. Sincronização automática
  entre aparelhos não faz parte desta versão.
- A publicação pode aproveitar a assinatura existente da Hostinger se ela
  permitir PHP/HTML, HTTPS e espaço suficiente. O plano exato ainda não foi
  identificado. Preparar o pacote local não depende de acesso à hospedagem.
- O Tailscale não será uma dependência. Ele conecta dispositivos, mas não
  substitui o computador que hoje executa o servidor Python.
- Não haverá publicação na App Store ou Google Play nesta versão.

## Estado atual verificado

- Backend Python, contas e progresso em SQLite; sem dependências pip externas.
- Interface HTML/CSS/JavaScript, manifesto e service worker já existentes.
- Curso indexado: 547 aulas e 86 checkpoints de espanhol.
- O acervo referenciado pelos JSONs de espanhol contém 4.482 mídias, cerca de
  16,2 GB em unidades decimais. Não deve ser instalado integralmente no celular.
- Os JSONs originais de espanhol ocupam cerca de 21,8 MB.
- O teste existente de contas passou em 14/11/2026. Esse resultado não verifica
  a instalação nem o funcionamento offline em aparelhos reais.
- A versão atual consulta APIs Python para iniciar, atualizar o progresso e
  consultar o catálogo; somente adicionar um ícone na tela inicial não resolve.

## Comportamento proposto

1. Abrir um endereço HTTPS e autenticar o acesso privado do casal.
2. Instalar pelo navegador, no Android, e por Adicionar à Tela de Início, no
   Safari do iPhone. O app abre em janela própria.
3. Exibir o curso completo e permitir assistir normalmente pela internet, sem
   precisar baixar a aula. O download é opcional, somente para uso offline.
4. Baixar somente os conteúdos e mídias das aulas escolhidas, mostrando o tamanho
   estimado e identificando falhas. Uma aula só aparece como disponível offline
   depois que todos os arquivos necessários estiverem salvos.
5. Abrir o app, retomar a aula e concluir atividades em modo avião após o download.
6. Salvar estrelas, XP, histórico, preferências e posição no aparelho imediatamente,
   inclusive quando não houver conexão. Reabrir o app deve preservar esses dados.
7. Permitir exportar e restaurar um backup de progresso validado. Backups de
   progresso não devem conter senhas, sessões nem vídeos.
8. Permitir remover downloads para liberar espaço sem apagar o progresso.

## Arquitetura

- Gerar, durante o empacotamento no computador, o catálogo e as aulas já
  normalizados pelo formato atual. Os JSONs pedagógicos originais são somente
  entrada e não serão alterados.
- Usar IndexedDB como armazenamento principal do progresso no celular.
- Ajustar o service worker para inicialização offline, atualizações consistentes,
  downloads explícitos e reprodução dos vídeos baixados com suporte a Range.
- Hospedar a interface e as mídias na hospedagem existente, com uma camada PHP
  pequena para autenticar apenas os dois acessos e proteger os conteúdos online.
  Python e rclone não serão requisitos da hospedagem.
- Manter conteúdo protegido fora da raiz pública ou usar bloqueio equivalente
  testado. Um endereço difícil de adivinhar não será considerado proteção.
- A identidade do último usuário autenticado poderá ser usada offline no seu
  próprio aparelho. Uma sessão revogada remotamente não pode retirar dados de
  um aparelho enquanto ele está sem conexão.
- Transferir as mídias do acervo local para a hospedagem, em vez de depender do
  computador ou de um token rclone do PC. Confirmar espaço disponível antes de
  enviar o acervo. Permitir publicar inicialmente um subconjunto de aulas.
- Manter o aplicativo Python atual utilizável e o banco original preservado.
  Importação do progresso existente deve usar cópia somente de leitura e gerar
  um arquivo de progresso privado, separado do pacote publicável.

## Estrutura prevista

- public/: interface atual e integrações compartilhadas, preservando o modo Python.
- mobile/: armazenamento no aparelho e integração da versão pessoal.
- deploy/: gerador do pacote móvel e camada PHP da publicação.
- release/: saída gerada, sem banco de produção, senhas ou tokens do Drive.
- tests/: verificações do modo móvel e do pacote publicável.

Os nomes exatos dos novos arquivos serão definidos no plano após a revisão.

## Comandos e estilo

- Regressão existente: `python -B test_accounts.py`.
- Geração atual para VPS: `python deploy/package.py` (não é o pacote móvel).
- Os comandos de geração, teste e prévia da versão móvel serão documentados
  junto com os scripts correspondentes; esses scripts ainda não existem.
- Seguir o JavaScript sem framework e o Python da biblioteca padrão já usados.
- Separar o armazenamento local da renderização dos exercícios e centralizar a
  seleção do modo de execução, evitando interceptar globalmente `fetch`.
- Não adicionar uma dependência nativa apenas para criar o ícone de instalação.

## Verificação e critérios de conclusão

- O fluxo de estudo não faz chamadas obrigatórias à API Python no modo móvel.
- Dois contextos de navegador independentes mantêm progressos independentes.
- Concluir a mesma atividade com o mesmo identificador não duplica XP.
- Download interrompido não produz uma aula falsamente marcada como completa.
- O progresso sobrevive ao fechamento e reabertura do app e à remoção de downloads.
- Backup e restauração conservam resultados e rejeitam dados inválidos sem
  sobrescrever silenciosamente o progresso existente.
- Acesso não autenticado não recebe aulas, mídias privadas nem credenciais.
- O pacote não inclui database.sqlite, ADMIN-ACESSO.txt, rclone.conf ou backups.
- O teste de contas da versão Python continua passando.
- Verificar a interface num navegador real em formato móvel.
- Validar nos aparelhos do casal: instalação, vídeo, áudio, modo avião,
  persistência após fechar e reabrir e retorno da conexão. Sem acesso aos aparelhos,
  registrar esses testes como pendentes, sem afirmar compatibilidade comprovada.

## Limites que devem aparecer no app e na documentação

- Instalação e downloads iniciais precisam de conexão.
- O navegador e o sistema podem remover arquivos locais por falta de espaço;
  solicitar armazenamento persistente quando suportado e oferecer backup.
- Reconhecimento de voz depende do navegador e pode precisar de internet.
- Remover o app ou limpar os dados do navegador pode apagar progresso e downloads.
- Publicação e alterações na hospedagem serão uma etapa separada do preparo local,
  no destino correto, sem sobrescrever outro site.

## Decisão do usuário

O usuário aprovou a PWA para os dois sistemas, progresso separado e backup,
e autorizou seguir com a adaptação. Esclareceu que estudar online deve funcionar
sem fazer download; baixar aulas é uma escolha do estudante.
