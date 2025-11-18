// Array per le configurazioni salvate
window.configurazioniSalvate = [];
// Caricamento dati valvole e motori e inizializzazione UI a tag
let valvole = [];
let motori = [];
let kit = [];
let adattatori = [];
let mappaKit = {};
let mappaMotore = {};
let mappaAdattatore = {};

async function caricaDati() {
	const [valvoleRes, motoriRes, kitRes, adattatoriRes, mappaKitRes, mappaMotoreRes, mappaAdattatoreRes, puntiImpiantoRes] = await Promise.all([
		fetch('data/valvole.json'),
		fetch('data/motori.json'),
		fetch('data/kit.json'),
		fetch('data/adattatori.json'),
		fetch('data/mappa_valvola_kit.json'),
		fetch('data/mappa_valvola_motore.json'),
		fetch('data/mappa_valvola_adattatore.json'),
		fetch('data/punti_impianto.json')
	]);
	valvole = (await valvoleRes.json()).valvole;
	motori = (await motoriRes.json()).motori;
	kit = (await kitRes.json()).kit;
	adattatori = (await adattatoriRes.json()).adattatori;
	mappaKit = (await mappaKitRes.json()).mappa;
	mappaMotore = (await mappaMotoreRes.json()).mappa;
	mappaAdattatore = (await mappaAdattatoreRes.json()).mappa;
	window.puntiImpianto = (await puntiImpiantoRes.json()).punti || [];
}

function getSelezioneCorrente() {
	return {
		puntoImpianto: document.getElementById('puntoImpiantoSelect')?.value || '',
		brandValvola: window.statoSelezione?.brandValvola,
		materialeValvola: window.statoSelezione?.materialeValvola,
		diametroValvola: window.statoSelezione?.diametroValvola,
		brandMotore: window.statoSelezione?.brandMotore,
		tipoMotore: window.statoSelezione?.tipoMotore
	};
}

function mostraRisultatoAutomatico() {
	const s = getSelezioneCorrente();
	// Serve tutto selezionato
	if (!s.brandValvola || !s.materialeValvola || !s.diametroValvola || !s.brandMotore || !s.tipoMotore) {
		document.getElementById('risultato').classList.add('hidden');
		return;
	}
	// Trova la valvola
	const valvola = valvole.find(v => v.brand === s.brandValvola && v.materiale === s.materialeValvola && String(v.diametro) === String(s.diametroValvola));
	if (!valvola) {
		mostraErrore('Nessuna valvola trovata per la combinazione selezionata.');
		return;
	}
	// Key per le mappe
	const baseKey = `${s.brandValvola}_${s.materialeValvola}_${s.diametroValvola}`;
	const key = s.brandMotore === 'WATERGATE' ? `${baseKey}_WATERGATE` : baseKey;
	// Kit
	const kitCodes = mappaKit[key] || [];
	const kitObjects = kitCodes.map(kc => kit.find(k => k.codice === kc)).filter(Boolean);
	// Motori
	const motoriCodes = mappaMotore[key] || [];
	const motoriCompatibili = motoriCodes.map(mc => motori.find(m => m.codice === mc)).filter(Boolean);
	const motoreScelto = motoriCompatibili.find(m => m.brand === s.brandMotore && m.tipo === s.tipoMotore);
	// Adattatore
	let adattatoreCodice = null;
	if (s.brandMotore !== 'WATERGATE') adattatoreCodice = mappaAdattatore[baseKey] || null;
	const adattatoreObj = adattatoreCodice ? adattatori.find(a => a.codice === adattatoreCodice) : null;
	if (!motoreScelto) {
		mostraErrore('Nessun motore trovato per questa combinazione di brand/tipo.');
		return;
	}
	renderRisultato({ valvola, adattatoreObj, kitObjects, motoreScelto });
}

function renderRisultato({ valvola, adattatoreObj, kitObjects, motoreScelto }) {
	const risultato = document.getElementById('risultato');
	const valvolaInfo = document.getElementById('valvolaInfo');
	const kitInfo = document.getElementById('kitInfo');
	const adattatoreInfo = document.getElementById('adattatoreInfo');
	const motoreInfo = document.getElementById('motoreInfo');

	valvolaInfo.innerHTML = '';

	if (kitObjects.length > 0) {
		const righe = kitObjects.map(k => `<p><span class="code">${k.codice}</span> — ${k.descrizione || ''}</p>`).join('');
		kitInfo.innerHTML = righe;
	} else {
		kitInfo.innerHTML = `<p>Nessun kit configurato per questa combinazione.</p>`;
	}

	if (adattatoreObj) {
		adattatoreInfo.innerHTML = `<p><span class="code">${adattatoreObj.codice}</span> — ${adattatoreObj.descrizione || ''}</p>`;
	} else {
		adattatoreInfo.innerHTML = `<p>Non richiesto.</p>`;
	}

	motoreInfo.innerHTML = `<p><span class="code">${motoreScelto.codice}</span> — ${motoreScelto.descrizione || motoreScelto.tipo + ' ' + (motoreScelto.Nm ? motoreScelto.Nm + 'Nm' : '')}</p>`;

	risultato.classList.remove('hidden');
	nascondiErrore();
	// Mostra il pulsante esporta CSV
	const exportBtn = document.getElementById('exportCsvBtn');
	if (exportBtn) exportBtn.style.display = '';

	// Mostra il pulsante salva configurazione
	const saveBtn = document.getElementById('saveConfigBtn');
	if (saveBtn) saveBtn.style.display = '';
}

function mostraErrore(msg) {
	const el = document.getElementById('errore');
	el.textContent = msg;
	el.classList.remove('hidden');
	document.getElementById('risultato').classList.add('hidden');
	// Nascondi il pulsante esporta CSV
	const exportBtn = document.getElementById('exportCsvBtn');
	if (exportBtn) exportBtn.style.display = 'none';

	// Nascondi il pulsante salva configurazione
	const saveBtn = document.getElementById('saveConfigBtn');
	if (saveBtn) saveBtn.style.display = 'none';
}

function nascondiErrore() {
	const el = document.getElementById('errore');
	el.textContent = '';
	el.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', async () => {
	await caricaDati();
	if (window.initTagUI) window.initTagUI(valvole, motori);
	// Popola la select punto di impianto
	const select = document.getElementById('puntoImpiantoSelect');
	const infoIcon = document.getElementById('puntoImpiantoInfoIcon');
	const infoMsg = document.getElementById('puntoImpiantoInfoMsg');
	if (select && window.puntiImpianto) {
		select.innerHTML = '<option value="">Seleziona punto di impianto...</option>' + window.puntiImpianto.map(p => `<option value="${p}">${p}</option>`).join('');
		select.addEventListener('change', function() {
			if (select.value === 'Collettore AUX-PDC') {
				infoIcon.style.display = '';
				infoMsg.style.display = '';
				infoMsg.textContent = 'Questa configurazione si riferisce a quando ci sono circuiti con pompa di calore o aria condizionata che richiedono un motore sul collettore di aspirazione che divide due bancate di compressori';
			} else {
				infoIcon.style.display = 'none';
				infoMsg.style.display = 'none';
				infoMsg.textContent = '';
			}
		});
		// Mostra info se già selezionato
		select.dispatchEvent(new Event('change'));
		// Tooltip su icona
		if (infoIcon) {
			infoIcon.onclick = function() {
				alert(infoMsg.textContent);
			};
		}
	}
	// Aggancia la funzione di autocalcolo ai cambiamenti dei tag
	document.body.addEventListener('click', e => {
		if (e.target.classList.contains('tag-btn') && !e.target.classList.contains('disabled')) {
			setTimeout(mostraRisultatoAutomatico, 0);
		}
	});

	// Collega il pulsante esporta CSV
	const exportBtn = document.getElementById('exportCsvBtn');
	if (exportBtn) {
		exportBtn.addEventListener('click', () => {
			if (typeof esportaRisultatoCSV === 'function') esportaRisultatoCSV();
		});
	}

	// Collega il pulsante Salva riepilogo PDF
	const exportSummaryPdfBtn = document.getElementById('exportSummaryPdfBtn');
	if (exportSummaryPdfBtn) {
		exportSummaryPdfBtn.addEventListener('click', () => {
			if (typeof esportaRiepilogoPDF === 'function') esportaRiepilogoPDF();
		});
	}

	// Collega il pulsante salva configurazione
	const saveBtn = document.getElementById('saveConfigBtn');
	if (saveBtn) {
		saveBtn.addEventListener('click', () => {
			const kit = document.getElementById('kitInfo').innerText.trim();
			const adattatore = document.getElementById('adattatoreInfo').innerText.trim();
			const motore = document.getElementById('motoreInfo').innerText.trim();
			const selezione = getSelezioneCorrente();
			window.configurazioniSalvate.push({
				...selezione,
				kit,
				adattatore,
				motore
			});
			aggiornaTabellaConfigurazioni();
		});
	}

	// Collega il pulsante esporta tutte in CSV
	const exportAllBtn = document.getElementById('exportAllCsvBtn');
	if (exportAllBtn) {
		exportAllBtn.addEventListener('click', () => {
			esportaTutteConfigurazioniCSV();
		});
	}
});
// Aggiorna la tabella delle configurazioni salvate
function aggiornaTabellaConfigurazioni() {
	const box = document.getElementById('configListBox');
	const table = document.getElementById('configListTable');
	if (!box || !table) return;
	if (window.configurazioniSalvate.length === 0) {
		box.style.display = 'none';
		table.innerHTML = '';
		return;
	}
	box.style.display = '';
	// Header
	table.innerHTML = `<tr><th>Punto impianto</th><th>Valvola</th><th>Motore</th><th>Perno/Kit</th><th>Adattatore</th></tr>`;
	// Righe
	window.configurazioniSalvate.forEach(cfg => {
		table.innerHTML += `<tr>
			<td>${cfg.puntoImpianto || ''}</td>
			<td>${cfg.brandValvola || ''} ${cfg.materialeValvola || ''} ${cfg.diametroValvola || ''}</td>
			<td>${cfg.motore || ''}</td>
			<td>${cfg.kit || ''}</td>
			<td>${cfg.adattatore || ''}</td>
		</tr>`;
	});
}

// Esporta tutte le configurazioni salvate in un unico CSV
function esportaTutteConfigurazioniCSV() {
	if (configurazioniSalvate.length === 0) return;
	// Raggruppa articoli (kit, adattatore, motore) e somma le quantità
	const articoli = {};
	configurazioniSalvate.forEach(cfg => {
		// Kit
		if (cfg.kit && cfg.kit !== 'Nessun kit configurato per questa combinazione.') {
			const k = cfg.kit;
			if (!articoli[k]) articoli[k] = { tipo: 'Kit', descrizione: k, quantita: 1 };
			else articoli[k].quantita++;
		}
		// Adattatore
		if (cfg.adattatore && cfg.adattatore !== 'Non richiesto.') {
			const a = cfg.adattatore;
			if (!articoli[a]) articoli[a] = { tipo: 'Adattatore', descrizione: a, quantita: 1 };
			else articoli[a].quantita++;
		}
		// Motore
		if (cfg.motore) {
			const m = cfg.motore;
			if (!articoli[m]) articoli[m] = { tipo: 'Motore', descrizione: m, quantita: 1 };
			else articoli[m].quantita++;
		}
	});
	mostraCsvArticoliPreviewModal(articoli);
// Mostra il modal di preview con lista articoli e quantità
function mostraCsvArticoliPreviewModal(articoli) {
	const modal = document.getElementById('csvPreviewModal');
	const tableBox = document.getElementById('csvPreviewTableBox');
	if (!modal || !tableBox) return;
	// Costruisci la lista HTML
	let html = '<table style="width:100%;text-align:left;font-size:1.05em;">';
	html += '<tr><th>Articolo</th><th>Quantità</th></tr>';
	Object.values(articoli).forEach(a => {
		html += `<tr><td>${a.descrizione}</td><td style="text-align:center;">${a.quantita}</td></tr>`;
	});
	html += '</table>';
	tableBox.innerHTML = html;
	modal.style.display = 'flex';

	// Gestione pulsanti
	const btnConferma = document.getElementById('csvPreviewConfirmBtn');
	const btnAnnulla = document.getElementById('csvPreviewCancelBtn');
	if (btnConferma) {
		btnConferma.onclick = function() {
			esportaCsvArticoli(articoli);
			modal.style.display = 'none';
		};
	}
	if (btnAnnulla) {
		btnAnnulla.onclick = function() {
			modal.style.display = 'none';
		};
	}
}

// Esporta i dati articoli (descrizione + quantità)
function esportaCsvArticoli(articoli) {
	const header = ['Articolo','Quantità'];
	const rows = Object.values(articoli).map(a => [a.descrizione, a.quantita]);
	let csv = [header, ...rows].map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
	const blob = new Blob([csv], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'articoli.csv';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
}

// Mostra il modal di preview CSV
function mostraCsvPreviewModal(header, rows) {
	const modal = document.getElementById('csvPreviewModal');
	const tableBox = document.getElementById('csvPreviewTableBox');
	if (!modal || !tableBox) return;
	// Costruisci la tabella HTML
	let html = '<table style="width:100%;text-align:left;font-size:0.98em;">';
	html += '<tr>' + header.map(h => `<th>${h}</th>`).join('') + '</tr>';
	rows.forEach(r => {
		html += '<tr>' + r.map(v => `<td>${v}</td>`).join('') + '</tr>';
	});
	html += '</table>';
	tableBox.innerHTML = html;
	modal.style.display = 'flex';

	// Gestione pulsanti
	const btnConferma = document.getElementById('csvPreviewConfirmBtn');
	const btnAnnulla = document.getElementById('csvPreviewCancelBtn');
	if (btnConferma) {
		btnConferma.onclick = function() {
			esportaCsvDati(header, rows);
			modal.style.display = 'none';
		};
	}
	if (btnAnnulla) {
		btnAnnulla.onclick = function() {
			modal.style.display = 'none';
		};
	}
}

// Esporta i dati CSV (header + rows)
function esportaCsvDati(header, rows) {
	let csv = [header, ...rows].map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
	const blob = new Blob([csv], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'configurazioni.csv';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
