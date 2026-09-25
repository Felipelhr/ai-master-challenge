# Lead Priority Engine

## Execução local

Abra dois terminais na pasta `solution`:

```powershell
python -m streamlit run app.py
```

```powershell
python email_scheduler.py
```

Configure `RESEND_API_KEY` e `RESEND_FROM_EMAIL` no ambiente dos dois processos para habilitar envios. O fuso dos agendamentos é sempre `America/Sao_Paulo` (Horário de Brasília).

Na execução local, o worker precisa estar ativo para os envios automáticos ocorrerem. Em produção, o mesmo worker pode ser executado por cron/job scheduler usando `python email_scheduler.py --once`.
