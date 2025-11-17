// Esporta i dati mostrati nel box risultato in CSV
function esportaRisultatoCSV() {
  const kit = document.getElementById('kitInfo').innerText.trim();
  const adattatore = document.getElementById('adattatoreInfo').innerText.trim();
  const motore = document.getElementById('motoreInfo').innerText.trim();
  const rows = [
    ['Kit', kit],
    ['Adattatore', adattatore],
    ['Motore', motore]
  ];
  let csv = rows.map(r => r.map(v => '"' + v.replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'risultato.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}