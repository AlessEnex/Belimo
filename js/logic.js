// Array per le configurazioni salvate
window.configurazioniSalvate = [];
// Opzione kit/attuatore selezionata quando ci sono multiple opzioni
window.kitSelezionato = null;
window.motoreSelezionato = null;
// Risultato mostrato a video (usato da salvataggio ed export)
window.risultatoCorrente = null;

// Dati caricati da data/accoppiamenti.json (tabella accoppiamenti valvole-motori)
let dati = { modelli: {}, kit: [], adattatori: [], attuatori: [], accoppiamenti: [] };

const VIE_TESTO = { '2': '2-VIE', '3': '3-VIE' };

function escapeHtml(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

function renderRecapPills(items, type, emptyLabel = 'N/A') {
	if (!items || items.length === 0) {
		return `<span class="recap-pill recap-pill-empty">${emptyLabel}</span>`;
	}

	return items.map(item => {
		const code = item.codice || item.code || item;
		const meta = item.meta || item.descrizione || item.description || '';
		return `
			<span class="recap-pill recap-pill-${type}" title="${escapeHtml(meta || code)}">
				<span class="recap-pill-code">${escapeHtml(code)}</span>
				${meta ? `<span class="recap-pill-meta">${escapeHtml(meta)}</span>` : ''}
			</span>
		`;
	}).join('');
}

function trovaKit(codice) {
	return dati.kit.find(k => k.codice === codice) || { codice, descrizione: '' };
}

function trovaAdattatore(codice) {
	return codice ? (dati.adattatori.find(a => a.codice === codice) || { codice, descrizione: '' }) : null;
}

function trovaAttuatore(codice) {
	return dati.attuatori.find(a => a.codice === codice) || { codice, descrizione: '' };
}

function testoArticolo(item) {
	return item ? `${item.codice} — ${item.descrizione || ''}` : '';
}

// Opzioni kit+attuatore valide per la riga e le vie scelte (con sostituzione kit navale)
function opzioniPerVie(riga, vie, navale) {
	return riga.opzioni
		.filter(o => !o.vie || o.vie === vie)
		.map(o => ({
			kit: trovaKit(navale && o.navale ? dati.kitNavale : o.kit),
			attuatore: trovaAttuatore(o.attuatore)
		}));
}

async function caricaDati() {
	const [accoppiamentiRes, puntiImpiantoRes] = await Promise.all([
		fetch('data/accoppiamenti.json'),
		fetch('data/punti_impianto.json')
	]);
	dati = await accoppiamentiRes.json();
	window.puntiImpianto = (await puntiImpiantoRes.json()).punti || [];
}

function getSelezioneCorrente() {
	const s = window.statoSelezione || {};
	return {
		puntoImpianto: document.getElementById('puntoImpiantoSelect')?.value || '',
		modello: s.modello,
		tipologia: s.tipologia,
		misura: s.misura,
		vie: s.vie,
		navale: !!s.navale
	};
}

function mostraRisultatoAutomatico() {
	const s = getSelezioneCorrente();
	// Serve tutto selezionato
	if (!s.modello || !s.tipologia || !s.misura || !s.vie) {
		document.getElementById('risultato').classList.add('hidden');
		nascondiErrore();
		window.risultatoCorrente = null;
		return;
	}
	const riga = dati.accoppiamenti.find(r => r.modello === s.modello && r.tipologia === s.tipologia && r.misura === s.misura);
	const valvola = riga?.valvole[s.vie];
	if (!valvola) {
		mostraErrore('Nessuna valvola disponibile per la combinazione selezionata.');
		return;
	}
	const opzioni = opzioniPerVie(riga, s.vie, s.navale);
	if (opzioni.length === 0) {
		mostraErrore('Nessun kit/attuatore configurato per questa combinazione.');
		return;
	}
	renderRisultato({ valvola, adattatoreObj: trovaAdattatore(riga.adattatore), opzioni });
}

function renderRisultato({ valvola, adattatoreObj, opzioni }) {
	const risultato = document.getElementById('risultato');
	const valvolaInfo = document.getElementById('valvolaInfo');
	const kitInfo = document.getElementById('kitInfo');
	const adattatoreInfo = document.getElementById('adattatoreInfo');
	const motoreInfo = document.getElementById('motoreInfo');

	// Riga della tabella risultato: etichetta | codice | descrizione
	const resRow = (label, item, vuoto = '—') => `
		<div class="res-row">
			<span class="res-label">${label}</span>
			${item
				? `<span class="code">${escapeHtml(item.codice)}</span><span class="res-desc">${escapeHtml(item.descrizione)}</span>`
				: `<span class="res-desc res-muted">${vuoto}</span>`}
		</div>`;

	valvolaInfo.innerHTML = resRow('Valvola', valvola);
	adattatoreInfo.innerHTML = resRow('Adattatore', adattatoreObj, 'Non richiesto');

	const mostraMotore = opzione => {
		const a = opzione.attuatore;
		motoreInfo.innerHTML = resRow('Attuatore', a);
		window.kitSelezionato = opzione.kit;
		window.motoreSelezionato = a;
		window.risultatoCorrente = { valvola, adattatore: adattatoreObj, kit: opzione.kit, motore: a };
	};

	if (opzioni.length > 1) {
		// Più kit disponibili: ogni kit ha il suo attuatore
		const righe = opzioni.map((o, idx) => `
			<label class="kit-option">
				<input type="radio" name="kitChoice" value="${idx}" ${idx === 0 ? 'checked' : ''}>
				<span class="code">${escapeHtml(o.kit.codice)}</span>
				<span class="res-desc">${escapeHtml(o.kit.descrizione)}</span>
				<span class="res-muted">→ ${escapeHtml(o.attuatore.codice)}</span>
			</label>
		`).join('');
		kitInfo.innerHTML = `
			<div class="res-row res-row-top">
				<span class="res-label">Kit</span>
				<div class="kit-options">${righe}</div>
			</div>`;
		kitInfo.querySelectorAll('input[name="kitChoice"]').forEach(radio => {
			radio.addEventListener('change', function() {
				mostraMotore(opzioni[Number(this.value)]);
			});
		});
	} else {
		kitInfo.innerHTML = resRow('Kit', opzioni[0].kit);
	}
	mostraMotore(opzioni[0]);

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
	window.risultatoCorrente = null;
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
	window.onSelezioneCambiata = mostraRisultatoAutomatico;
	if (window.initTagUI) window.initTagUI(dati);
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
			const r = window.risultatoCorrente;
			if (!r) return;
			window.configurazioniSalvate.push({
				...getSelezioneCorrente(),
				valvola: testoArticolo(r.valvola),
				kit: testoArticolo(r.kit),
				adattatore: r.adattatore ? testoArticolo(r.adattatore) : '',
				motore: testoArticolo(r.motore)
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

	// Collega il pulsante Mostra Recap
	const toggleRecapBtn = document.getElementById('toggleRecapBtn');
	const recapModal = document.getElementById('recapModal');
	const closeRecapBtn = document.getElementById('closeRecapBtn');
	if (toggleRecapBtn && recapModal) {
		toggleRecapBtn.addEventListener('click', () => {
			mostraRecapConfigurazione();
			recapModal.style.display = 'flex';
		});
	}
	if (closeRecapBtn && recapModal) {
		closeRecapBtn.addEventListener('click', () => {
			recapModal.style.display = 'none';
		});
	}
});

// Mostra la tabella accoppiamenti valvole-motori
function mostraRecapConfigurazione() {
	const recapContent = document.getElementById('recapContent');
	const articoliBox = document.getElementById('articoliDisponibili');
	if (!recapContent) return;

	if (!dati.accoppiamenti || dati.accoppiamenti.length === 0) {
		recapContent.innerHTML = '<p class="res-muted">Dati non ancora caricati.</p>';
		return;
	}

	// Popola la sidebar con articoli disponibili
	if (articoliBox) {
		const sezione = (titolo, items) => `
			<div class="side-group"><h4>${titolo}</h4>
				${items.map(i => `<div class="side-item"><span class="side-code">${escapeHtml(i.codice)}</span>${escapeHtml(i.descrizione)}</div>`).join('')}
			</div>`;
		articoliBox.innerHTML =
			sezione('Kit', dati.kit) +
			sezione('Attuatori', dati.attuatori) +
			sezione('Adattatori', dati.adattatori);
	}

	let html = `
		<div class="recap-toolbar">
			<div class="recap-count">${dati.accoppiamenti.length} righe — ${escapeHtml(dati.fonte || '')}</div>
		</div>
		<div class="recap-table-wrap">
			<table class="recap-rules-table">
				<thead>
					<tr>
						<th>Misura</th>
						<th>Valvola 2-vie</th>
						<th>Valvola 3-vie</th>
						<th>Adattatore</th>
						<th>Kit attuatore</th>
						<th>Attuatore</th>
					</tr>
				</thead>
				<tbody>
	`;

	let gruppoCorrente = '';
	dati.accoppiamenti.forEach(r => {
		const gruppo = `${dati.modelli?.[r.modello] || r.modello} — ${r.tipologia}`;
		if (gruppo !== gruppoCorrente) {
			gruppoCorrente = gruppo;
			html += `<tr class="recap-brand-row"><td colspan="6">${escapeHtml(gruppo)}</td></tr>`;
		}
		const adattatore = trovaAdattatore(r.adattatore);
		const kitItems = r.opzioni.map(o => {
			const k = trovaKit(o.kit);
			const note = [o.vie ? `solo ${VIE_TESTO[o.vie]}` : '', o.navale ? `navale: ${dati.kitNavale}` : ''].filter(Boolean).join(' · ');
			return { codice: k.codice, descrizione: note ? `${k.descrizione} (${note})` : k.descrizione };
		});
		const attuatoriHtml = r.opzioni.map(o => {
			const a = trovaAttuatore(o.attuatore);
			return `
				<div class="recap-pair">
					<span class="recap-pill ${a.brand === 'WATERGATE' ? 'recap-pill-watergate' : 'recap-pill-brand'}" title="${escapeHtml(a.descrizione)}">
						<span class="recap-pill-code">${escapeHtml(a.codice)}</span>
						<span class="recap-pill-meta">${escapeHtml(a.descrizione)}</span>
					</span>
					<span class="recap-pill ${a.tipo === 'MODULANTE' ? 'recap-pill-modulating' : 'recap-pill-onoff'}" title="${escapeHtml(a.tipo || 'N/A')}">
						<span class="recap-pill-code">${a.tipo === 'MODULANTE' ? 'MOD' : escapeHtml(a.tipo || 'N/A')}</span>
					</span>
				</div>`;
		}).join('');

		html += `
			<tr>
				<td class="recap-valve-cell"><div class="recap-valve-title">${escapeHtml(r.misura)}</div></td>
				<td><div class="recap-pill-stack">${renderRecapPills(r.valvole['2'] ? [r.valvole['2']] : [], 'geometry', 'NA')}</div></td>
				<td><div class="recap-pill-stack">${renderRecapPills(r.valvole['3'] ? [r.valvole['3']] : [], 'vport', 'NA')}</div></td>
				<td><div class="recap-pill-stack">${renderRecapPills(adattatore ? [adattatore] : [], 'adapter', 'Non richiesto')}</div></td>
				<td><div class="recap-pill-stack">${renderRecapPills(kitItems, 'kit')}</div></td>
				<td><div class="recap-pill-stack">${attuatoriHtml}</div></td>
			</tr>
		`;
	});

	html += `
				</tbody>
			</table>
		</div>
		<p class="recap-footnote">(*) Se macchina navale usare kit INOX-NAVI codice ${escapeHtml(dati.kitNavale || '')} al posto di 25C162A.</p>
	`;
	recapContent.innerHTML = html;
}

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
	table.innerHTML = `<thead><tr><th>#</th><th>Punto impianto</th><th>Valvola</th><th>Adattatore</th><th>Kit</th><th>Attuatore</th></tr></thead>`;
	// Righe
	const cella = testo => {
		const [codice, ...resto] = String(testo || '').split(' — ');
		return codice ? `<span class="code">${escapeHtml(codice)}</span> ${escapeHtml(resto.join(' — '))}` : '<span class="res-muted">Non richiesto</span>';
	};
	table.innerHTML += '<tbody>' + window.configurazioniSalvate.map((cfg, i) => `<tr>
		<td class="num">${i + 1}</td>
		<td>${escapeHtml(cfg.puntoImpianto) || '<span class="res-muted">—</span>'}</td>
		<td>${cella(cfg.valvola)}</td>
		<td>${cella(cfg.adattatore)}</td>
		<td>${cella(cfg.kit)}</td>
		<td>${cella(cfg.motore)}</td>
	</tr>`).join('') + '</tbody>';
}

// Esporta tutte le configurazioni salvate in un unico CSV
function esportaTutteConfigurazioniCSV() {
	if (configurazioniSalvate.length === 0) return;
	// Raggruppa articoli (valvola, kit, adattatore, motore) e somma le quantità
	const articoli = {};
	const aggiungi = (tipo, descrizione) => {
		if (!descrizione) return;
		if (!articoli[descrizione]) articoli[descrizione] = { tipo, descrizione, quantita: 1 };
		else articoli[descrizione].quantita++;
	};
	configurazioniSalvate.forEach(cfg => {
		aggiungi('Valvola', cfg.valvola);
		aggiungi('Kit', cfg.kit);
		aggiungi('Adattatore', cfg.adattatore);
		aggiungi('Motore', cfg.motore);
	});
	mostraCsvArticoliPreviewModal(articoli);
}

// Mostra il modal di preview con lista articoli e quantità
function mostraCsvArticoliPreviewModal(articoli) {
	const modal = document.getElementById('csvPreviewModal');
	const tableBox = document.getElementById('csvPreviewTableBox');
	if (!modal || !tableBox) return;
	// Costruisci la lista HTML
	let html = '<table class="data-table">';
	html += '<thead><tr><th>Articolo</th><th class="num">Q.tà</th></tr></thead>';
	Object.values(articoli).forEach(a => {
		html += `<tr><td>${escapeHtml(a.descrizione)}</td><td class="num">${a.quantita}</td></tr>`;
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
