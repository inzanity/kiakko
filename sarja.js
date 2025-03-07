let ggames = [];
let gteams = {};
let ugames = [];
let actgames = [];
let timer = undefined;

function elem(tag, cb) {
	let e = document.createElement(tag);
	if (cb)
		cb(e);
	return e;
}

function delayedupdate() {
	if (timer !== undefined)
		clearTimeout(timer);
	timer = setTimeout(() => { timer = undefined; updatestand(); }, 1000);
}

function newcheck(id) {
	return elem('input', c => {
		c.setAttribute('type', 'checkbox');
		c.setAttribute('checked', 'checked');
		c.id = id;
		c.addEventListener('click', delayedupdate);
	});
}

function buildstand(teams, expected) {
	return Object.entries(teams).map(([name, { games }]) => ({
		name,
		games: Object.keys(games).length,
		gf: Object.values(games).reduce((acc, { gFor }) => acc + gFor, 0, 0),
		ga: Object.values(games).reduce((acc, { gAgainst }) => acc + gAgainst, 0, 0),
		xgf: Object.values(games).reduce((acc, { xgFor }) => acc + xgFor, 0, 0).toFixed(1),
		xga: Object.values(games).reduce((acc, { xgAgainst }) => acc + xgAgainst, 0, 0).toFixed(1),
		wins: Object.values(games).reduce((acc, { gFor, gAgainst, xgFor, xgAgainst, ot }) => {
			if (!expected) {
				return acc + (gFor > gAgainst && !ot);
			} else {
				return acc + (xgFor >= xgAgainst + 0.5);
			}
		}, 0),
		points: Object.values(games).reduce((acc, { gFor, gAgainst, xgFor, xgAgainst, ot }) => {
			if (!expected) {
				return acc + (3 * (gFor > gAgainst) ^ ot);
			} else if (xgFor >= xgAgainst + 0.5) {
				return acc + 3;
			} else if (xgFor > xgAgainst) {
				return acc + 2;
			} else if (xgFor == xgAgainst) {
				return acc + 1.5;
			} else if (xgFor > xgAgainst - 0.5) {
				return acc + 1;
			} else {
				return acc;
			}
		}, 0),
	})).toSorted((a, b) => {
		let d = (b.points * a.games) - (a.points * b.games);
		if (d)
			return d;
		d = b.wins - a.wins;
		if (d)
			return d;
		if (expected) {
			d = (b.xgf - b.xga) - (a.xgf - a.xga);
			if (d)
				return d;
		}
		d = (b.gf - b.ga) - (a.gf - a.ga);
		if (d)
			return d;
		return b.gf - a.gf;
	});
}

function filterupcoming() {
	let filter = new RegExp(document.getElementById('upcomingfilter').value, "i");
	for (const upcoming of document.getElementById('upcoming').children)
		upcoming.style.display = filter.test(upcoming.dataset.game) ? "table-row" : "none";
}

function updatestand() {
	let reverse = document.getElementById('reverse').checked;
	let start = document.getElementById('start').value;
	let end = document.getElementById('end').value;
	let homet = document.getElementById('home').checked;
	let awayt = document.getElementById('away').checked;
	let last = document.getElementById('last').value;
	
	if (last > 0) {
	    last = -last;
	} else {
	    last = 0;
	}

	for (const upcoming of document.getElementsByClassName('upcoming')) {
		if (!upcoming.checked)
			continue;
		let id = upcoming.dataset.id;
		let home = upcoming.dataset.home;
		let away = upcoming.dataset.away;
		let played = upcoming.dataset.played;
		let score;

		switch (upcoming.value) {
		case '1':
			score = [3, 0, false];
			break;
		case '1x':
			score = [1, 0, true];
			break;
		case '2x':
			score = [0, 1, true];
			break;
		case '2':
			score = [0, 3, false];
			break;
		}

		if (score === undefined) {
			delete gteams[home].games[id];
			delete gteams[away].games[id];
		} else {
			gteams[home].games[id] = { opponent: away, gFor: score[0], xgFor: score[0] / 3, gAgainst: score[1], xgAgainst: score[1] / 3, ot: score[2], home: true, played: played };
			gteams[away].games[id] = { opponent: home, gFor: score[1], xgFor: score[1] / 3, gAgainst: score[0], xgAgainst: score[0] / 3, ot: score[2], home: false, played: played };
		}
	}

	let teams = buildstand(Object.entries(gteams).filter(([name, _]) => document.getElementById(name).checked).map(([name, { games }]) => [name, Object.values(games).filter(({ opponent, played, home }) =>
		(reverse != document.getElementById(opponent).checked &&
		played >= start &&
		played <= end &&
		(homet || !home) &&
		(awayt || home)
		)).slice(last)]).reduce((acc, [name, games]) => ({ ...acc, [name]: { games } }), {}), !!document.getElementById('expected').checked);
			
	let fs = document.getElementById('standings')
	fs.replaceChildren();

	for (const team of teams) {
		let row = fs.insertRow();
		for (const c of ['name', 'games', 'wins', 'points', 'gf', 'ga', 'xgf', 'xga'])
			row.insertCell().innerText = team[c];
	}
}

function radio(played, home, away, id, val, sel) {
	return elem('input', rad => {
		rad.name = 'u' + id;
		rad.value = val;
		rad.type = 'radio';
		rad.dataset.played = played;
		rad.dataset.home = home;
		rad.dataset.away = away;
		rad.dataset.id = id;
		rad.className = 'upcoming';
		if (sel)
		    rad.checked = true;
		rad.addEventListener('change', delayedupdate);
	});
}

fetch('games.json').then(r => r.json()).then(games => {
	let up = document.getElementById('upcoming');
	for (const i in games) {
		const g = games[i];
		if (g.homeScore !== undefined) {
			(gteams[g.home] || (gteams[g.home] = { games: {} })).games[i] = { opponent: g.away, gFor: g.homeScore, gAgainst: g.awayScore, xgFor: g.homeExp, xgAgainst: g.awayExp, ot: g.det != '', played: g.played, home: true };
			(gteams[g.away] || (gteams[g.away] = { games: {} })).games[i] = { opponent: g.home, gFor: g.awayScore, gAgainst: g.homeScore, xgFor: g.awayExp, xgAgainst: g.homeExp, ot: g.det != '', played: g.played, home: false };
		} else {
			let row = up.insertRow();
			row.dataset.game = g.home + ' - ' + g.away;
			row.insertCell().innerText = g.home;
			row.insertCell().innerText = '-';
			row.insertCell().innerText = g.away;
			row.insertCell().appendChild(radio(g.played, g.home, g.away, i, '1'));
			row.insertCell().appendChild(radio(g.played, g.home, g.away, i, '1x'));
			row.insertCell().appendChild(radio(g.played, g.home, g.away, i, '0', 1));
			row.insertCell().appendChild(radio(g.played, g.home, g.away, i, '2x'));
			row.insertCell().appendChild(radio(g.played, g.home, g.away, i, '2'));
		}
	}
	let teams = buildstand(gteams, false);
	let start = document.getElementById('start');
	let end = document.getElementById('end');
	for (const day of [...new Set(games.map(g => g.played)).keys()].toSorted()) {
		start.add(new Option(day));
		end.add(new Option(day));
	}
	start.selectedIndex = 0;
	end.selectedIndex = end.options.length - 1;

	start.addEventListener('change', delayedupdate);
	end.addEventListener('change', delayedupdate);
	document.getElementById('last').addEventListener('change', delayedupdate);
	document.getElementById('home').addEventListener('click', delayedupdate);
	document.getElementById('away').addEventListener('click', delayedupdate);
	document.getElementById('reverse').addEventListener('click', delayedupdate);
	document.getElementById('expected').addEventListener('click', delayedupdate);
	document.getElementById('upcomingfilter').addEventListener('change', filterupcoming);
	document.getElementById('rand').addEventListener('click', () => {
		let decided = {};
		for (const up of document.getElementsByClassName('upcoming')) {
			let r = Math.random();
			if (decided[up.dataset.id] === undefined)
				decided[up.dataset.id] = Math.floor(Math.random() * 4);
			let d = decided[up.dataset.id];
			if (up.value == '1' && d == 0)
				up.checked = true;
			else if (up.value == '1x' && d == 1)
				up.checked = true;
			else if (up.value == '2x' && d == 2)
				up.checked = true;
			else if (up.value == '2' && d == 3)
				up.checked = true;
		}
		delayedupdate();
	});
	document.getElementById('randundecided').addEventListener('click', () => {
		let decided = {};
		for (const up of document.getElementsByClassName('upcoming')) {
			if (gteams[up.dataset.home].games[up.dataset.id] !== undefined)
				continue;
			if (decided[up.dataset.id] === undefined)
				decided[up.dataset.id] = Math.floor(Math.random() * 4);
			let d = decided[up.dataset.id];
			if (up.value == '1' && d == 0)
				up.checked = true;
			else if (up.value == '1x' && d == 1)
				up.checked = true;
			else if (up.value == '2x' && d == 2)
				up.checked = true;
			else if (up.value == '2' && d == 3)
				up.checked = true;
		}
		delayedupdate();
	});

	let fs = document.getElementById('fullstandings');
	for (const team of teams) {
		let row = fs.insertRow();
		row.insertCell().appendChild(newcheck(team.name));
		for (const c of ['name', 'games', 'wins', 'points', 'gf', 'ga', 'xgf', 'xga'])
			row.insertCell().innerText = team[c];

		let name = team.name;

		row.insertCell().appendChild(elem('button', win => {
			win.innerText = 'voita';
			win.addEventListener('click', () => {
				for (const up of document.getElementsByClassName('upcoming')) {
					if (up.dataset.home == name && up.value == '1')
						up.checked = true;
					else if (up.dataset.away == name && up.value == '2')
						up.checked = true;
				}
				delayedupdate();
			});
		}));

		row.insertCell().appendChild(elem('button', lose => {
			lose.innerText = 'häviä';
			lose.addEventListener('click', () => {
				for (const up of document.getElementsByClassName('upcoming')) {
					if (up.dataset.home == name && up.value == '3')
						up.checked = true;
					else if (up.dataset.away == name && up.value == '1')
						up.checked = true;
				}
				delayedupdate();
			});
		}));
	}

	ggames = games;

	updatestand();
});
