# Alarme einrichten (n8n)

Das System schickt zwei Arten von Meldungen an eine Webhook-Adresse:

| `kind` | Wann | Wer muss es sehen |
|---|---|---|
| `escalation` | Ein Lead braucht einen echten Menschen — Erbschaft, Scheidung, finanzielle Notlage, Journalist, Regulierer, oder ein Grenzfall vor dem Call. Die KI antwortet dann nur noch „ich hol Robin dazu" und hört auf. | **Robin** (und Felix) |
| `compliance` | Ein Entwurf wurde zurückgehalten, weil er eine Compliance-Regel verletzt hat. | **Nur Felix** — das ist Technik |
| `system` | Etwas in der Maschinerie hängt. | **Nur Felix** |

Die Trennung ist Absicht: Robin soll die Fälle sehen, in denen ein Kunde auf ihn wartet —
nicht, dass die KI beinahe etwas Falsches gesagt hätte. Das würde nur Vertrauen kosten.

## Einrichten

1. In n8n oben rechts **⋯ → Import from File**, `n8n-alerts-workflow.json` auswählen
2. **Telegram-Zugangsdaten** hinterlegen (beide Telegram-Knoten nutzen dieselben):
   - In Telegram `@BotFather` anschreiben → `/newbot` → Token kopieren
   - In n8n: Credentials → New → Telegram API → Token einfügen
3. **Chat-IDs eintragen**, die beiden Platzhalter ersetzen:
   - `CHAT_ID_NUR_FELIX` — Bot anschreiben, dann
     `https://api.telegram.org/bot<TOKEN>/getUpdates` aufrufen, `chat.id` ablesen
   - `CHAT_ID_ROBIN_UND_FELIX` — Gruppe anlegen, Bot hinzufügen, eine Nachricht schreiben,
     dieselbe URL aufrufen. Gruppen-IDs beginnen mit `-`
4. Workflow **aktivieren**
5. Die **Production-URL** des Webhook-Knotens kopieren
6. In Vercel unter Settings → Environments → Production eintragen:
   `ALERT_WEBHOOK_URL` = diese URL, dann **Redeploy**

## Testen

```bash
curl -X POST "<deine-webhook-url>" -H 'content-type: application/json' \
  -d '{"kind":"escalation","title":"Testalarm","detail":"Nur ein Test.","text":"🚨 Testalarm\nNur ein Test."}'
```

Kommt die Nachricht in der Gruppe an, steht es.

## Was das System schickt

```json
{
  "kind": "escalation",
  "title": "Lead braucht einen Menschen (pitch_call)",
  "detail": "Er schrieb: \"...\"",
  "leadId": "uuid",
  "context": { "node": "pitch_call", "stage": "qualified" },
  "text": "🚨 fertig formatierte Zeile fürs Handy"
}
```

`text` ist bereits versandfertig — deshalb braucht n8n keine eigene Formatierung.

## Wenn Robin (noch) nicht mit rein soll

Beide Chat-IDs auf Felix setzen. Robin lässt sich später mit einer Änderung dazuholen,
ohne dass am Code etwas passiert.
