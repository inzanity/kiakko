let games = [];
let basestd = {};
let upcoming = [];
let work = undefined;
let splitschanged = true;
let iterations = 0;
let result = undefined;
let otprob;
let curr = 0;

let worker = new Worker('isimuworker.js?v2');

function elem(type, attrs, ev) {
	let elem = document.createElement(type);
	for (const [name, value] of Object.entries(attrs || {}))
		elem[name] = value;
	for (const [name, value] of Object.entries(ev || {}))
		elem.addEventListener(name, value);
	return elem;
}

function format(count, iterations, split) {
	let prefix = "";
	if (split)
		prefix = "split ";
	if (count == iterations)
		return { innerText: '+', className: prefix + 'certain' };
	if (count == 0)
		return { innerText: '-', className: prefix + 'never' };

	let prob = count * 100 / iterations;
	if (prob >= 90)
		return { innerText: prob.toFixed(0), className: prefix + 'likely' };
	if (prob >= 30)
		return { innerText: prob.toFixed(0), className: prefix + 'probable' };
	if (prob >= 10)
		return { innerText: prob.toFixed(0), className: prefix + 'possible' };
	if (prob >= 1)
		return { innerText: prob.toFixed(1), className: prefix + 'unlikely' };
	return { innerText: prob.toFixed(1), className: prefix + 'bluemoon' };
}

worker.onmessage = (e) => {
	let splits = document.getElementById('splits').value.split(/[^\d]+/).map(Number);
	if (splitschanged) {
		let row = document.getElementById('res-hdr');
		row.replaceChildren(
			elem('th', { innerText: 'Joukkue' }),
			elem('th', { innerText: 'O' }),
			elem('th', { innerText: 'P' }));
		for (let i = 1; i <= Object.keys(basestd).length; i++) {
			row.appendChild(elem('th', { innerText: i }));
			if (splits.indexOf(i) != -1)
				row.appendChild(elem('th', { innerText: '<=' + i }));
		}
		splitschanged = false;
	}

	if (iterations == 0) {
		result = e.data.result;
	} else {
		for (const [name, data] of Object.entries(e.data.result || {})) {
			result[name].points += data.points;
			result[name].games += data.games;
			for (const i in data.positions)
				result[name].positions[i] += data.positions[i];
		}
	}
	iterations += e.data.iterations;

	let t = document.getElementById('res-data');
	t.replaceChildren();
	let j = 1;
	for (const [name, data] of Object.entries(result).toSorted(([_a, a], [_b, b]) => (b.points * a.games) - (a.points * b.games))) {
		let row;
		if (splits.indexOf(j++) != -1) {
			row = elem('tr', { className: 'split' });
			t.appendChild(row);
		} else {
			row = t.insertRow();
		}
		let sum = 0;
		row.insertCell().innerText = name;
		row.insertCell().innerText = data.games / iterations;
		row.insertCell().innerText = Math.round(10 * data.points / iterations) / 10;

		for (let i = 0; i < data.positions.length; i++) {
			const pc = data.positions[i];
			sum += pc;
			row.appendChild(elem('td', format(pc, iterations)));

			if (splits.indexOf(i + 1) != -1)
				row.appendChild(elem('td', format(sum, iterations, true)));
		}
	}

	if (iterations < document.getElementById('iters').value)
		worker.postMessage({ id: curr, base: basestd, upcoming: work, otprob, iterations: 1000 });
};

document.addEventListener('DOMContentLoaded', () => {
	for (const id of ['k', 'hadv'])
		document.getElementById(id).addEventListener('change', () => update(true));
	document.getElementById('otp').addEventListener('change', () => update(false));

	document.getElementById('iters').addEventListener('change', () => {
		if (iterations < document.getElementById('iters').value)
			worker.postMessage({ id: curr, base: basestd, upcoming: work, otprob, iterations: 1000 });
	});

	document.getElementById('splits').addEventListener('change', () => {
		splitschanged = true;
		if (iterations !== 0)
			worker.onmessage({ data: { curr, iterations: 0 } });
	});
});

fetch('games.json').then(r => r.json()).then(gms => {
	for (const g of gms) {
		if (g.homeScore !== undefined)
			games.push(g);
		else
			upcoming.push(g);
	}
	update(true);
});

function update(kchanged) {
	let k = document.getElementById('k').value;
	let hadv = document.getElementById('hadv').value;
	otprob = document.getElementById('otp').value / 100.0;
	curr++;

	if (kchanged) {
		let elo = games.flatMap(g => [g.home, g.away]).concat(upcoming.flatMap(g => [g.home, g.away])).reduce((acc, team) => ({ ...acc, [team]: 2000 }), {});
		basestd = Object.keys(elo).reduce((acc, team) => ({ ...acc, [team]: { games: 0, points: 0, wins: 0, gf: 0, ga: 0 } }), {});

		for (const { home, away, det, homeScore, awayScore } of games) {
			let ot = det !== "";
			let ex =
			    1.0 / (1.0 + Math.pow(10.0, (elo[away] - elo[home] - hadv) / 400.0));
			let p = homeScore > awayScore ? !ot ? 3 : 2 : ot ? 1 : 0;
			let w = p / 3.0;
	
			basestd[home].games += 1;
			basestd[home].points += p;
			basestd[home].wins += p == 3;
			basestd[home].gf += homeScore;
			basestd[home].ga += awayScore;
	
			basestd[away].games += 1;
			basestd[away].points += 3 - p;
			basestd[away].wins += p == 0;
			basestd[away].gf += awayScore;
			basestd[away].ga += homeScore;
	
			elo[home] += k * (w - ex);
			elo[away] += k * (ex - w);
		}
	
		let std = document.getElementById('standings');
		std.replaceChildren();
		for (const [name, data] of Object.entries(basestd).toSorted(
			 ([ _a, a ], [ _b, b ]) => {
				 let d = (b.points * a.games) - (a.points * b.games);
				 if (d)
					 return d;
				 d = b.wins - a.wins;
				 if (d)
				 	return d;
				 d = (b.gf - b.ga) - (a.gf - a.ga);
				 if (d)
				 	return d;
				 return b.gf - a.gf;
			})) {
			let row = std.insertRow();
			row.insertCell().innerText = name;
			row.insertCell().innerText = data.games;
			row.insertCell().innerText = data.wins;
			row.insertCell().innerText = data.points;
			row.insertCell().appendChild(elem("input", {
				id: "elo" + name,
				size: 5,
				value: Math.round(elo[name])
			}, { 'change': () => update(false) }));
		}
	}

	let elos = Object.keys(basestd).reduce((acc, name) => ({ ...acc, [name]: document.getElementById('elo' + name).value}), {});
	work = upcoming.map(({ home, away }) => {
		let ex =
		    1.0 / (1.0 + Math.pow(10.0, (elos[away] - elos[home] - hadv) / 400.0));
		let odds = [ ex * (1 - otprob), ex, ex * (1 + otprob) ];
		return { home, away, odds }
	});

	iterations = 0;
	worker.postMessage({ id: curr, base: basestd, upcoming: work, iterations: 1000 });
}
