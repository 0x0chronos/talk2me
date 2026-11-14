# talk2me

## Aplicativo pessoal no Android e iPhone

A versão móvel usa aulas online e downloads opcionais, com progresso no aparelho
e backup JSON por conta. Funciona sem manter o computador ligado após publicar
o pacote PHP/HTML em uma hospedagem HTTPS. Veja [deploy/MOBILE.md](deploy/MOBILE.md)
para gerar o pacote, configurar os dois acessos e instalar nos celulares. A
publicação na hospedagem e a validação nos aparelhos físicos ainda estão pendentes.

## Versão local Python

Execute INICIAR.ps1 e abra http://localhost:3001.

## Contas
O administrador é shacrony@gmail.com. A senha inicial está no arquivo privado ADMIN-ACESSO.txt; altere em Minha conta e remova esse arquivo após guardar a senha com segurança.
Somente o administrador cria alunos em Alunos (no celular: Conta > Gerenciar alunos). Informe nome, e-mail e senha inicial, com no mínimo 10 caracteres. Envie as credenciais diretamente ao aluno. Não há cadastro público, Google simulado ou entrada de teste. O aluno altera a própria senha informando a atual. A troca encerra outras sessões.
O progresso legado foi migrado apenas para o administrador. Alunos têm progresso, XP e continuidade independentes.

## Offline
Na prévia da aula, use Baixar aula para estudar sem conexão. O navegador guarda o aplicativo, a aula e suas mídias no dispositivo. Após um primeiro login online, a última conta autenticada pode usar o conteúdo baixado sem conexão. Use apenas em dispositivo pessoal. Não é necessário baixar todo o acervo. Os resultados concluídos ficam pendentes no dispositivo e são sincronizados ao abrir novamente conectado, com proteção contra XP duplicado. A troca de senha, criação de contas e login inicial exigem o servidor. Não é possível revogar imediatamente conteúdo já baixado enquanto um dispositivo está offline. O navegador pode remover downloads se faltar espaço. A prática de reconhecimento de voz depende do navegador.
Downloads funcionam em localhost ou HTTPS. No celular, via IP local HTTP, é possível estudar conectado ao computador na mesma rede sem consumir internet, mas o navegador não permite a instalação offline. Para disponibilizar downloads a alunos remotos, publique com HTTPS. Configure TALK2ME_HTTPS=1 quando servido por HTTPS para cookies seguros. A publicação não foi realizada nesta tarefa.
O manifesto permite instalação como aplicativo nos navegadores compatíveis. Não foi produzido APK ou executável nativo.

## Verificação
python -B test_accounts.py usa banco temporário e verifica acesso, bloqueio de cadastro público, administração exclusiva, isolamento de progresso, troca de senha, logout e resultados idempotentes. ui_fixture.py é somente um servidor de QA local com banco temporário; nunca use como implantação.
Os JSONs pedagógicos não foram alterados. Backups ficam em backups/.

## Drive com cache
INICIAR.ps1 executa o aplicativo na porta 3001, usando o mesmo database.sqlite de sempre. Mídias vêm de talk2me-drive:talk2me. Na primeira leitura, o servidor confere tamanho e MD5 e publica o arquivo no cache somente após terminar o download. O cache em .drive-cache é separado dos originais. No PC, se o Drive falhar, o servidor também pode ler um original local verificado. O primeiro acesso a um vídeo grande pode demorar. O catálogo de mídias está em media-index.json. Alterações no código da interface podem ser testadas recarregando a página. Alterações em Python exigem reiniciar o servidor.
Para preparar uma publicação execute python deploy/package.py e siga deploy/PUBLICAR.md. Para copiar seu progresso use python deploy/export_progress.py.
