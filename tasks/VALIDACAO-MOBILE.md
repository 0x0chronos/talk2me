# Validação local da adaptação móvel

Data: 14/11/2026.

## Resultado

Adaptação implementada, com estudo online por padrão e download opcional. Progresso
por conta no IndexedDB e backup JSON validado. O modo Python continua disponível.

## Verificações executadas

- Node: 6 testes aprovados (progresso, idempotência, isolamento, backup e Range).
- Python: 5 testes aprovados (empacotamento sem abrir banco de produção,
  exportação somente de leitura e servidor PHP real).
- Regressão Python: test_accounts.py aprovado (login, administração, isolamento,
  senha, logout e deduplicação).
- Chromium: 4 cenários de navegador aprovados, incluindo duas contas, aula online
  sem download, mídia MP4, download concluído, backup/restauração, fechamento e
  reabertura offline, interrupção de download, isolamento de nomes de cache e
  transações concorrentes no IndexedDB sem XP duplicado.
- WebKit: os mesmos 4 cenários aprovados para fluxo, dados e transporte da mídia.
  O backend de vídeo do WebKit no Windows retornou MEDIA_ERR_SRC_NOT_SUPPORTED
  para o MP4 da fixture. A decodificação não é considerada validada nessa engine;
  em Chromium a leitura do vídeo foi verificada. A instalação e reprodução
  definitivas ainda precisam de teste físico no iPhone.
- Na fase offline dos testes, o servidor PHP foi efetivamente desligado. O app
  foi fechado e reaberto, o conteúdo baixado continuou acessível e o progresso
  continuou gravando e restaurando backups.
- Um resultado enviado 5 vezes concorrentemente foi contabilizado uma vez; outro
  resultado concorrente foi preservado. Outra conta continuou com 0 XP.
- Capturas de tela inspecionadas; largura de página móvel sem estouro horizontal.
- Sintaxe de PHP e JavaScript verificada.

Os três cenários originais de navegador foram executados após as últimas mudanças
do app. O quarto cenário, de transações concorrentes, foi acrescentado em seguida
e passou nas duas engines sem outras mudanças no aplicativo.

## Artefatos

- release/talk2me-celular/: diretório preparado para publicar.
- release/talk2me-celular.zip: pacote do aplicativo, 3.661.480 bytes, 664 arquivos.
- Identificador do build: 2a6c19037551baa4.
- Curso: 633 atividades (547 aulas e 86 checkpoints).
- Mídias referenciadas: 4.482 arquivos, 16.208.171.169 bytes. Não foram duplicadas
  nem incluídas no ZIP. Para publicar, enviar media_all para private/media ou
  gerar um piloto com --limit/--lesson e --copy-media.
- A auditoria do ZIP não encontrou database.sqlite, ADMIN-ACESSO.txt,
  accounts.json, rclone.conf, pastas de backup nem runtimes de teste.
- Os arquivos do pacote foram comparados com as fontes finais da aplicação.
- Backup privado do progresso anterior gerado em backups/ e validado pelo mesmo
  importador JavaScript usado no app. Contém 7 atividades concluídas e 276 XP;
  não contém senhas nem sessões. A exportação abriu o SQLite somente para leitura.
- Guia de publicação: deploy/MOBILE.md, também incluído como LEIA-ME.md no ZIP.

## Pendências reais

Não foi feito deploy, não houve alterações de DNS e nenhum site foi sobrescrito.
O plano da Hostinger e sua capacidade não foram identificados pelo conector
disponível. É necessário confirmar PHP/HTML, HTTPS e espaço, configurar os dois
acessos e transferir as mídias para a hospedagem.

Sem acesso físico aos celulares, não foi possível comprovar a instalação na tela
inicial, o armazenamento sob pressão e os codecs do Android/iPhone reais. Esses
testes estão documentados no guia, sem serem apresentados como concluídos.
