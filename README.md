# Tech Empire – Technologie-Konzern-Simulator

Wirtschaftssimulation im Browser: Du gründest ein Hardware-Start-up in der Garage und baust es
zu einem globalen Technologiekonzern aus – mit Desktop- und Gaming-PCs, Notebooks, Smartphones,
Tablets, Monitoren, Grafikkarten, Prozessoren, Mainboards, Servern und Smartwatches.

Alle Systeme greifen ineinander: Nachfrage erzeugt Bestellungen, Bestellungen erzeugen
Komponentenbedarf, Knappheit treibt Preise und Lieferzeiten, Lieferverzug führt zu Stornos,
Beschwerden und Reputationsverlust – und umgekehrt führen gute Produkte über Testberichte,
Kundenbewertungen und Markenwerte zu mehr Absatz, Marktanteil und Unternehmenswert.

## Schnellstart

Voraussetzung: Node.js 20.19+ oder 22.12+ (getestet mit Node 22).

```bash
npm install        # Abhängigkeiten installieren
npm run dev        # Entwicklungsserver starten (http://localhost:5173)
```

Weitere Befehle:

| Befehl              | Zweck                                                   |
| ------------------- | ------------------------------------------------------- |
| `npm run build`     | Typprüfung und Produktions-Build nach `dist/`           |
| `npm run preview`   | Produktions-Build lokal ausliefern                      |
| `npm test`          | Tests (Vitest) einmalig ausführen                       |
| `npm run lint`      | ESLint                                                  |
| `npm run typecheck` | TypeScript-Prüfung ohne Build                           |

Der Build ist statisch (relative Pfade, Hash-Routing) und läuft auf jedem Webserver oder direkt
aus einem Unterordner.

## So spielst du

1. **Unternehmen gründen** – Name, CEO, Logo, Farbe, Hauptsitz (beeinflusst Löhne, Miete, Steuern)
   und Schwierigkeitsgrad wählen. Startkapital auf „Normal“: 50.000 €.
2. **Werkstatt ausstatten** (Produktion) und **Personal einstellen** (Mitarbeiter): mindestens
   eine Engineering-Kraft für die Entwicklung und Produktionspersonal für die Montage.
3. **Produkt entwerfen** (Produkte → Neues Produkt) – z. B. aus der Vorlage „NovaStation Basic“.
   Jede Komponente verändert Leistung, Temperatur, Lautstärke, Qualität, Kosten und Fehlerquote.
4. **Entwicklung** durchläuft Idee → Konzept → Prototyp → Engineering Sample → Tests →
   Zertifizierung → Massenproduktion → Verkaufsstart.
5. **Komponenten einkaufen** (Stückliste im Produkt oder Lieferanten), **Produktionslinie**
   belegen (Auto-Einkauf ist standardmäßig aktiv) und **Markteinführung** starten.
6. Danach: Preise anpassen, Marketing, Forschung, Büro-Umzug, Fabriken, Vertriebskanäle,
   internationale Expansion, Investoren, Kredite und schließlich der Börsengang.

Die Checkliste „Erste Schritte“ auf dem Dashboard führt durch den Einstieg.

**Tastenkürzel:** Leertaste = Pause/Weiter, `1`–`5` = Geschwindigkeit 1×/2×/5×/10×/20×.

**Unternehmensstufen:** Garage → Start-up → Unternehmen → Konzern → Globaler Technologiekonzern.
Die Voraussetzungen jeder Stufe stehen auf der Seite „Unternehmen“.

**Schwierigkeitsgrade:** Einfach (150.000 € Startkapital, keine Insolvenz), Normal (50.000 €),
Schwer (30.000 €, teurere Produktion, aggressivere Konkurrenz, mehr Ereignisse) und Hardcore
(20.000 €, häufige Krisen, keine Notkredite, nur 30 Tage Restrukturierung). Rutscht das Konto ins Minus, folgen Warnung → Restrukturierung → Insolvenz
(Game-Over-Bildschirm mit Statistik).

## Umfang

| Bereich            | Inhalt                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| Produkte           | 12 Kategorien, 19 Beispielprodukte (NovaStation, NovaBook, NovaPhone, NovaGPU u. a.), Nachfolgemodelle   |
| Komponenten        | ~50 Produktfamilien von 34 fiktiven Herstellern, neue Generationen, Auslaufmodelle, Preisverläufe         |
| Forschung          | 65 Technologien in 8 Bereichen, 3 Laborstufen (500 Tsd. / 5 Mio. / 50 Mio. €), Softwareprojekte & Abos    |
| Produktion         | Werkstatt (3 Ausbaustufen), Fabriken Stufe 1–10 (1.000 – 100.000 Einheiten/Monat), Automatisierung 0–100 %, 5 QS-Stufen, Auftragsfertigung |
| Personal           | 11 Abteilungen, Bewerbungen, Agentur, Gehälter, Boni, Schulungen, Beförderungen, Kündigungen, Motivation |
| Markt              | 6 Regionen, 6 Kundensegmente, Multinomial-Logit-Nachfragemodell, Testberichte, Kundenbewertungen          |
| Konkurrenz         | 5 KI-Konzerne mit eigenen Strategien, die auf Preise und Erfolge des Spielers reagieren                  |
| Finanzen           | GuV, Cashflow, Bilanz, EBITDA, Bewertung, Kredite (Annuitäten), Investoren, Börsengang, Dividenden       |
| Wirtschaft         | Inflation, Leitzins, Energie, Rohstoff- und Chipindex, Wechselkurse (EUR, USD, GBP, JPY, CNY)             |
| Ereignisse         | ~20 Ereignisse (Chipmangel, Hafenstreik, Rezession, Krypto-Boom …), Rückrufe mit 4 Optionen              |
| Logistik           | Großhandel, LKW, Schiff, Luftfracht, Lager, Verteilzentren, Restpostenverkauf                            |
| Sonstiges          | Marketingkanäle, Markenwerte, Vertriebskanäle, Kundenservice, Erfolge, Nachrichten, Speicherstände       |

## Architektur

```
src/
├── types/        Datenmodell (GameState und alle Teilzustände)
├── data/         Statische Spieldaten: Kategorien, Komponenten, Hersteller, Technologien, Standorte …
├── simulation/   Kern: Tick (GameSimulation), Commands, Zufallszahlen, Kalender, Modifikatoren, Neuspiel
├── systems/      Spielsysteme (reine Funktionen auf dem GameState), je Bereich ein Ordner
├── services/     Spielschleife, Speichern (StorageProvider), Markenlizenz
├── store/        Zustand-Store (Brücke zwischen Simulation und UI)
├── hooks/        Selektoren und abgeleitete Warnungen
├── components/   UI-Bausteine, Layout, Diagramme
├── pages/        Seiten (lazy geladen)
├── utils/        Formatierung und Mathematik
└── tests/        Vitest-Tests inkl. skriptgesteuertem Balancing-Spieler
```

### Zentraler Spielzustand

Der gesamte Spielstand ist ein einziges, serialisierbares Objekt (`GameState`). Es enthält auch
den Zustand des Zufallsgenerators (`rng`) und einen ID-Zähler. Dadurch ist die Simulation
**deterministisch**: Derselbe Spielstand liefert nach Speichern und Laden exakt denselben
Verlauf (durch Tests abgesichert).

### Spieleraktionen (Commands)

Jede Aktion ist eine Funktion `(state) => Meldung`, die über `runCommand` mit Immer auf einem
Entwurf ausgeführt wird. Fachliche Fehler werden als `CommandError` mit konkreter Meldung
geworfen („Nicht genügend Kapital. Benötigt: 12.345 €.“) – der Zustand bleibt dann unverändert,
die UI zeigt die Meldung als Hinweis.

### Simulations-Tick

`simulateDays(state, n)` erzeugt eine Arbeitskopie und führt pro Tag `runDay` aus:

1. Monatswechsel: Monatsabschluss (GuV, Steuern, Bewertung), Konkurrenz-Finanzen, Marktstatistik, Verträge, Kreditraten
2. Ereignis-Modifikatoren, Markttrends, Weltwirtschaft, Komponentenmarkt (Preise, Knappheit, neue Generationen)
3. Wareneingänge, Auftragsfertigung, Produktentwicklung
4. Fabriken, Produktion (inkl. Auto-Einkauf), Lagerkosten
5. Nachfrage und Verkäufe aller Märkte, Testberichte und Bewertungen, Vertriebskanäle, Regionen, Marketing und Marke
6. Gehälter, Miete, wöchentliche Personalentwicklung (Motivation, Erfahrung, Kündigungen, Bewerbungen)
7. Forschung, Software, Dispozinsen, Konkurrenz-KI
8. Entscheidungsfristen, wöchentliche Ereignisprüfung, Support und Reputation, Börse, Investorenangebote
9. Wöchentlich: Verlaufsdaten, Marktnachrichten, Erfolge, Unternehmensstufe
10. Insolvenzprüfung

**Performance:** Große, selten geänderte Teile (Personal, Komponentenkatalog, Verläufe) werden
nicht pro Tick kopiert, sondern per Copy-on-Write ersetzt; die Nachfragesimulation arbeitet mit
typisierten Arrays. Ein simulierter Tag dauert typischerweise 1–3 ms. Die Spielschleife läuft
unabhängig von React; Seiten werden lazy geladen und lesen den Zustand über Selektoren.

### Speichern

`SaveService` arbeitet gegen die Schnittstelle `StorageProvider`
(`services/storage/types.ts`). Standard ist IndexedDB mit Rückfall auf LocalStorage bzw.
Arbeitsspeicher. Es gibt fünf Spielstände plus automatische Sicherung, JSON-Export/-Import und
Schema-Migrationen. Ein Cloud-Speicher lässt sich ergänzen, indem man einen weiteren
`StorageProvider` implementiert.

### Marken und Lizenzen

Das Spiel verwendet ausschließlich **fiktive Hersteller**. Reale Marken werden nicht als Partner
dargestellt. Liegt eine Lizenz vor, können Anzeigenamen (und Logo-URLs) einzelner Hersteller über
eine JSON-Datei (Einstellungen → Markenlizenz) überschrieben werden – die Spielmechanik bleibt
unverändert:

```json
{
  "licensed": true,
  "licensee": "Beispiel Verlag GmbH",
  "validUntil": "2030-12-31",
  "manufacturers": {
    "novasilicon": { "displayName": "Lizenzierter Markenname" }
  }
}
```

Die Datei wird validiert (unbekannte Hersteller-IDs, fehlende Felder, abgelaufene Lizenzen werden
abgelehnt).

### Erweitern

- **Komponenten:** Familien und Modelle in `data/componentCatalog.ts` (Generationen entstehen
  automatisch über `cadenceDays`).
- **Produktvorlagen:** `data/templates.ts` (Komponenten als „Familie.Modell“).
- **Technologien:** `data/technologies.ts` – Wirkungen sind deklarativ (`TechEffect`).
- **Ereignisse:** `systems/events/events.ts` – Ereignisse nutzen zeitlich begrenzte Modifikatoren.
- **Konkurrenten:** `data/competitors.ts`.

## Tests

`npm test` prüft u. a. Stabilität über zwei Spieljahre, Determinismus nach Speichern/Laden,
Unveränderlichkeit geteilter Zustandsteile, den kompletten MVP-Ablauf (gründen → einstellen →
entwickeln → produzieren → verkaufen → Gewinn), Forschung, Designprüfung, Produktionsstillstände,
Kredite, Restposten, Nachfolgemodelle und einen skriptgesteuerten Spieler, der auf „Normal“ in
drei Jahren profitabel bis zur Stufe „Unternehmen“ wachsen muss.

Für automatisierte Browsertests ist der Store unter `window.__techEmpire` erreichbar.
