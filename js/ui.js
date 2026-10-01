// UI dinamica a tag per i filtri
window.statoSelezione = {
	modello: null,
	tipologia: null,
	misura: null,
	vie: null,
	navale: false
};

const VIE_LABEL = { '2': '2-VIE', '3': '3-VIE' };

function creaTag(container, values, selected, disabledSet, onClick, labelFn = v => v) {
	container.innerHTML = '';
	values.forEach(val => {
		const btn = document.createElement('button');
		btn.className = 'tag-btn';
		btn.textContent = labelFn(val);
		if (selected === val) btn.classList.add('selected');
		if (disabledSet && disabledSet.has(val)) {
			btn.classList.add('disabled');
			btn.disabled = true;
		}
		btn.addEventListener('click', () => onClick(val));
		container.appendChild(btn);
	});
}

function unici(arr) {
	return [...new Set(arr)];
}

function aggiornaTagUI(dati) {
	const s = statoSelezione;
	const righe = dati.accoppiamenti;
	const aggiorna = () => {
		aggiornaTagUI(dati);
		if (window.onSelezioneCambiata) window.onSelezioneCambiata();
	};

	// Modello valvola
	const modelli = unici(righe.map(r => r.modello));
	creaTag(document.getElementById('modelloValvolaTags'), modelli, s.modello, null, val => {
		s.modello = s.modello === val ? null : val;
		s.tipologia = null;
		s.misura = null;
		s.vie = null;
		aggiorna();
	}, val => dati.modelli?.[val] || val);

	// Tipologia attuatore
	const righeModello = righe.filter(r => !s.modello || r.modello === s.modello);
	const tipologie = unici(righeModello.map(r => r.tipologia));
	creaTag(document.getElementById('tipologiaTags'), tipologie, s.tipologia, null, val => {
		s.tipologia = s.tipologia === val ? null : val;
		s.misura = null;
		s.vie = null;
		aggiorna();
	});

	// Misura
	const righeTipologia = righeModello.filter(r => !s.tipologia || r.tipologia === s.tipologia);
	const misure = unici(righeTipologia.map(r => r.misura));
	creaTag(document.getElementById('misuraTags'), misure, s.misura, null, val => {
		s.misura = s.misura === val ? null : val;
		aggiorna();
	});

	// Vie: disabilita quelle non disponibili (NA in tabella)
	const righeMisura = righeTipologia.filter(r => !s.misura || r.misura === s.misura);
	const vieDisponibili = new Set(['2', '3'].filter(v => righeMisura.some(r => r.valvole[v])));
	const vieDis = new Set(['2', '3'].filter(v => !vieDisponibili.has(v)));
	if (s.vie && vieDis.has(s.vie)) s.vie = null;
	creaTag(document.getElementById('vieTags'), ['2', '3'], s.vie, vieDis, val => {
		s.vie = s.vie === val ? null : val;
		aggiorna();
	}, val => VIE_LABEL[val]);

	// Opzione navale: visibile solo se la riga prevede il kit INOX-NAVI (*)
	const navaleBox = document.getElementById('navaleBox');
	const navaleCheck = document.getElementById('navaleCheck');
	const rigaUnica = s.modello && s.tipologia && s.misura ? righeMisura[0] : null;
	const prevedeNavale = !!rigaUnica?.opzioni.some(o => o.navale);
	if (navaleBox) navaleBox.style.display = prevedeNavale ? '' : 'none';
	if (!prevedeNavale) s.navale = false;
	if (navaleCheck) {
		navaleCheck.checked = s.navale;
		navaleCheck.onchange = () => {
			s.navale = navaleCheck.checked;
			if (window.onSelezioneCambiata) window.onSelezioneCambiata();
		};
	}
}

// Inizializzazione: attende che logic.js abbia caricato i dati
window.initTagUI = function(dati) {
	aggiornaTagUI(dati);
};
