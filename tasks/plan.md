# Implementação: app pessoal nos celulares

Autorização: SPEC-MOBILE.md e mensagem do usuário de 14/11/2026.
Executar o preparo local completo; publicação depende do destino da hospedagem.

## Decisões

- PWA única para Android/iPhone. Aulas online por padrão, download opcional.
- Reaproveitar renderização existente e centralizar acesso aos dados num cliente,
  preservando o modo Python. Não interceptar fetch globalmente.
- Gerar catálogo/aulas normalizados no build usando as funções existentes, sem
  iniciar servidor nem abrir o banco de produção.
- PHP sem banco para autenticação privada e entrega de conteúdo/mídias no host.
  Contas e conteúdo ficam fora da raiz pública; no máximo dois acessos pessoais.
- Progresso por identidade no IndexedDB, transações para atualização e deduplicação.
  Backup com validação e restauração explícita, sem credenciais ou mídias.
- Downloads por aula em caches separados, com marcador de conclusão apenas ao
  final. Streaming online não deve gravar vídeos automaticamente no cache offline.
- Caches de mídia e conteúdo separados por usuário; saída da conta remove os
  downloads/identidade offline, preservando o progresso local no IndexedDB.

## Ordem e verificações

1. Progresso local e contrato de backup: testes Node de validação, XP, isolamento.
2. Pacote independente e acesso PHP: testes Python de conteúdo e HTTP PHP.
3. Integração do cliente e controles de backup/download: teste de contas legado.
4. Service worker e downloads: teste no Chromium real, dois contextos, vídeo
   Range, online sem download, modo avião após reabrir, backup e restauração.
5. Documentação e release com auditoria de arquivos, sem publicar nem copiar
   credenciais automaticamente.

## Riscos

- Espaço do plano desconhecido: publicar pode exigir selecionar só algumas aulas;
  o gerador deve suportar essa seleção e medir as mídias referenciadas.
- Armazenamento móvel pode ser limpo pelo sistema: oferecer backup e indicar isso.
- Não há aparelhos conectados: teste real em Android/iPhone permanece pendente.
- Não há Git neste diretório: preservar arquivos existentes e não inventar commits.
- PHP/Chrome DevTools não estão no PATH/servidores MCP: usar runtime PHP de teste
  separado e Playwright com perfil isolado, sem alterar configuração do usuário.
