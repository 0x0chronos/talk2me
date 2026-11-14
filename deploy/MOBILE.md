# talk2me pessoal: Android e iPhone

Esta versão funciona sem manter o computador ligado depois da publicação. É uma
PWA instalada pelo navegador. As aulas abrem normalmente pela internet; baixar
é opcional e serve para estudar sem conexão. O progresso é salvo imediatamente
no próprio celular, separado por conta. Não há sincronização automática entre
aparelhos.

## O que é necessário

- Hospedagem PHP 8.2 ou posterior, atualizada, com HTTPS, sessões e regras de
  reescrita Apache/LiteSpeed. Não precisa de Python, Docker, Node ou rclone no host.
- Um subdomínio dedicado, por exemplo talk2me.seudominio.com, apontado para uma
  pasta nova. O app espera estar na raiz desse endereço, não numa subpasta.
- Espaço para o app e as mídias publicadas. O curso completo tem cerca de 16,2 GB
  de mídias; o gerador permite publicar poucas aulas para começar. Confira o
  espaço do plano antes de transferir.
- A compatibilidade exata e o espaço do plano Hostinger ainda precisam ser
  confirmados. Um plano limitado ao construtor de sites pode não permitir PHP.

## Preparar o pacote no computador

Na pasta do projeto, execute:

```powershell
python -B deploy/package_mobile.py --out release/mobile-pessoal --zip
```

O destino precisa estar vazio. O gerador não sobrescreve um pacote existente.
O ZIP contém o aplicativo e o conteúdo das aulas, sem contas, banco ou mídias.
Os vídeos não são colocados num ZIP enorme automaticamente.

Para um piloto menor, com as mídias correspondentes já copiadas e verificadas:

```powershell
python -B deploy/package_mobile.py --out release/mobile-piloto --limit 5 --copy-media
```

Pode usar `--lesson ID` repetidamente para escolher aulas específicas. O relatório
package-info.json mostra a quantidade e o tamanho das mídias necessárias. Na
versão completa, os arquivos de media_all devem ser enviados para private/media.
Na versão piloto, envie apenas os arquivos selecionados pelo gerador. O índice
private/media.json lista os nomes, tamanhos e MD5 esperados.

## Os dois acessos privados

As contas não vêm dentro do ZIP. Para reutilizar os acessos locais existentes,
preservando os identificadores e as senhas, sem modificar o banco:

```powershell
python -B deploy/configure_mobile.py release/mobile-pessoal/private --from-local
```

O comando recusa importar mais de duas contas. Para criar um acesso novo, use o
comando sem `--from-local`: ele pede nome, e-mail e senha sem exibir a senha.
Se já houver um acesso e faltar o segundo:

```powershell
python -B deploy/configure_mobile.py release/mobile-pessoal/private --add
```

Transfira accounts.json por SFTP para a pasta privada. Ele contém hashes de senha
e não deve ser colocado na raiz pública, enviado por chat ou incluído num ZIP
público. Não há cadastro aberto. A troca de senha fica em Conta e exige conexão.

## Publicar na Hostinger

No subdomínio novo, organize assim:

```text
pasta-do-subdominio/
  public_html/            <- conteúdo de site/ do pacote, incluindo .htaccess
    index.html
    index.php
    sw.js
    ...
  private/                <- pasta private/ do pacote, fora de public_html
    accounts.json
    course.json
    media.json
    lessons/
    media/                <- mídias selecionadas ou todo media_all
```

Não envie a pasta do projeto inteiro. O banco database.sqlite, ADMIN-ACESSO.txt,
backups e tokens do Drive não fazem parte desta publicação.

A pasta private precisa permitir escrita pelo PHP para sessões e alterações de
senha. Use diretórios privados com permissão 700 e accounts.json com 600 quando
o PHP executar com o mesmo dono dos arquivos; não use permissão 777. A pasta deve
permanecer fora da raiz pública, mesmo tendo um .htaccess adicional de proteção.

Ative HTTPS e confira no domínio definitivo:

1. A tela de login abre; o curso e uma mídia não abrem sem autenticação.
2. Cada uma das duas contas entra e estuda online sem baixar a aula.
3. Vídeo e áudio funcionam; avançar o vídeo não reinicia a reprodução.
4. Instalação, download opcional e reabertura em modo avião funcionam.
5. Progresso e backup funcionam em cada celular.

O gerador deixa as contas de fora e este trabalho não publicou nem sobrescreveu
nenhum site. Não altere os registros DNS de outros sites ou do e-mail para instalar
este app.

## Instalar e estudar

Android: abra o endereço HTTPS no Chrome, entre e escolha Instalar aplicativo no
menu. iPhone: abra no Safari, entre, toque em Compartilhar e em Adicionar à Tela
de Início. Depois abra pelo ícone e confirme o acesso nesse modo.

Com internet, toque em Começar aula e estude normalmente. Para offline, toque em
Baixar aula na prévia e espere a confirmação. É possível cancelar o download.
Aulas só aparecem como baixadas depois de todos os arquivos terminarem. Em
Conta > Gerenciar downloads, remova aulas para liberar espaço; isso mantém XP,
estrelas e posição. Remover o aplicativo ou limpar dados do navegador pode apagar
também o progresso.

Não baixe os 16 GB sem necessidade. O sistema pode remover arquivos do navegador
por falta de espaço, mesmo após o aplicativo pedir armazenamento persistente.
Reconhecimento de voz depende do navegador e pode precisar de internet.

## Backup e progresso anterior

Em Conta, use Exportar progresso e guarde o JSON em Arquivos, Drive ou outro local
seguro. O arquivo não inclui senhas, sessões ou vídeos. Para restaurar, entre na
mesma conta, escolha Restaurar backup e confirme a substituição depois de revisar
o total de atividades/XP. Há um botão para salvar o progresso atual antes disso.
Backups de outra conta ou incompatíveis são recusados sem substituir os dados.

Para levar o progresso do computador para o celular, primeiro reutilize as contas
locais com `--from-local`. Depois exporte o progresso de cada pessoa:

```powershell
python -B deploy/export_mobile_progress.py --list
python -B deploy/export_mobile_progress.py --user-id ID_DA_CONTA
```

Transfira apenas o JSON privado gerado em backups/ ao aparelho e restaure na conta
correta. O SQLite original é aberto somente para leitura e permanece preservado.
O formato antigo de backup .sqlite continua disponível para a versão Python;
ele não é importado diretamente no celular.

## Verificação de desenvolvimento

```powershell
node --test tests/progress.test.cjs tests/range.test.cjs
python -B -m unittest discover -s tests -p 'test_mobile_*.py'
python -B test_accounts.py
python -B tests/mobile_browser.py
```

Os testes HTTP precisam de PHP 8.2+ em PHP_BIN ou no PATH. Os testes de navegador
usam Playwright instalado no ambiente de desenvolvimento; não é uma dependência
do app publicado. Use `BROWSER_ENGINE=webkit` no ambiente para testar também essa
engine. Vídeos MP4 no WebKit do Windows não reproduzem exatamente o comportamento
do Safari: a verificação desse ambiente cobre transporte de mídia, armazenamento
e fluxo offline; a decodificação nativa e a instalação precisam de teste físico
no iPhone. Consulte https://playwright.dev/docs/browsers#webkit.
