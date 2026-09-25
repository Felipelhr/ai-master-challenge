# Inventário técnico de fontes

Os caminhos abaixo são relativos a `submissions/felipe-magalhaes/`, exceto o projeto irmão.

- `solution/README.md`: README técnico da aplicação.
- `solution/src/domain/scoring/model-artifact.json`: artefato de scoring em uso.
- `solution/src/domain/tiering/reference.json`: referências fixas do Lead Tier.
- `solution/scripts/scoring/fixtures/legacy-snapshot.json`: fixture de paridade histórica.
- `solution/scripts/scoring/`: construção, exportação e verificação do scoring; inclui `requirements.txt`.
- `solution/scripts/tiering/build-reference.ts`: geração das referências do Lead Tier.
- `solution/scripts/verify-*.ts` e `solution/scripts/verify-data.mjs`: verificações existentes.
- `solution/.env.example`: nomes de variáveis de ambiente, sem credenciais.
- `process-log/raw/PROCESS_LOG_BLOCO_3.md`, `PROCESS_LOG_BLOCO_4.md`, `PROCESS_LOG_BLOCO_5.md` e `PROCESS_LOG_BLOCO_5_5.md`: registros originais copiados.
- `process-log/COMMIT_HISTORY_RAW.md`: hashes, timestamps e mensagens dos commits até `7f3d349`.
- Projeto irmão `G4-003/submissions/felipe-magalhaes/`: protótipo anterior localizado no diretório pai de `G4-IAMaster`. Possui 35 arquivos rastreados (778.453 bytes, aproximadamente 0,78 MB): `solution/` com código Python, `data/`, `models/`, `scoring/`, `tests/` e `requirements.txt`; `docs/` com `METHODOLOGY.md` e `HANDOFF_LOGICA_V1.md`; `process-log/` e README. O diretório de trabalho também contém um SQLite local de 851.968 bytes, caches e temporários não incluídos nessa medida. Os 33 arquivos relevantes e rastreados estão copiados em `process-log/prototype/source/`, sem o SQLite, caches ou temporários.
