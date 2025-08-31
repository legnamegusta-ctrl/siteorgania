# Agrônomo Offline

A página `public/agronomo-offline.html` permite registrar leads, clientes e visitas sem conexão com a internet.
Os dados são salvos no `localStorage` do navegador e podem ser exportados/importados por meio de um arquivo de texto.

## Formato do arquivo `agronomo-data.txt`

O arquivo gerado pela opção **Exportar** contém um objeto JSON com as seguintes chaves:

```json
{
  "leads": [
    { "name": "Nome do lead", "phone": "Telefone", "notes": "Observações" }
  ],
  "clients": [
    { "name": "Nome do cliente", "farm": "Fazenda", "notes": "Observações" }
  ],
  "visits": [
    { "client": "Cliente visitado", "date": "AAAA-MM-DD", "notes": "Observações" }
  ]
}
```

## Importando no app online

1. No modo online, abra o painel do agrônomo com suporte a importação ("agronomooffline/index.html").
2. Clique em **Importar** e selecione o arquivo `agronomo-data.txt` exportado anteriormente.
3. Os dados serão carregados para o `localStorage` e podem ser enviados ao servidor usando a opção **Exportar**.
