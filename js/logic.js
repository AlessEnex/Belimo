// Caricamento dati valvole e motori e inizializzazione UI a tag
let valvole = [];
let motori = [];
let kit = [];
let adattatori = [];
let mappaKit = {};
let mappaMotore = {};
let mappaAdattatore = {};

async function caricaDati() {
	const [valvoleRes, motoriRes, kitRes, adattatoriRes, mappaKitRes, mappaMotoreRes, mappaAdattatoreRes] = await Promise.all([
		fetch('data/valvole.json'),
		fetch('data/motori.json'),
		fetch('data/kit.json'),
		fetch('data/adattatori.json'),
		fetch('data/mappa_valvola_kit.json'),
		fetch('data/mappa_valvola_motore.json'),
		fetch('data/mappa_valvola_adattatore.json')
	]);
	valvole = (await valvoleRes.json()).valvole;
	motori = (await motoriRes.json()).motori;
	kit = (await kitRes.json()).kit;
	adattatori = (await adattatoriRes.json()).adattatori;
	mappaKit = (await mappaKitRes.json()).mappa;
	mappaMotore = (await mappaMotoreRes.json()).mappa;
	mappaAdattatore = (await mappaAdattatoreRes.json()).mappa;
}

function getSelezioneCorrente() {
	return {
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
}

function mostraErrore(msg) {
	const el = document.getElementById('errore');
	el.textContent = msg;
	el.classList.remove('hidden');
	document.getElementById('risultato').classList.add('hidden');
}

function nascondiErrore() {
	const el = document.getElementById('errore');
	el.textContent = '';
	el.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', async () => {
	await caricaDati();
	if (window.initTagUI) window.initTagUI(valvole, motori);
	// Aggancia la funzione di autocalcolo ai cambiamenti dei tag
	document.body.addEventListener('click', e => {
		if (e.target.classList.contains('tag-btn') && !e.target.classList.contains('disabled')) {
			setTimeout(mostraRisultatoAutomatico, 0);
		}
	});
});
