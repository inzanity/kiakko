onmessage = (e) => {
	const { base, upcoming, iterations, id } = e.data;

	let result = Object.keys(base).reduce((acc, team) => ({...acc, [team]: { points: 0, games: 0, positions: Object.keys(base).map(_ => 0) } }), {});

	for (let i = 0; i < iterations; i++) {
		let teams = Object.entries(base).reduce((acc, [team, data]) => ({ ...acc, [team]: {...data} }), {});

		for (const { home, away, odds } of upcoming) {
			let r = Math.random();
			let hp;

			if (r < odds[0]) {
				hp = 3;
			} else if (r < odds[1]) {
				hp = 2;
			} else if (r < odds[2]) {
				hp = 1
			} else {
				hp = 0;
			}

			let ht = teams[home];
			ht.games++;
			ht.points += hp;
			ht.wins += hp == 3;

			let ha = teams[away];
			ha.games++;
			ha.points += 3 - hp;
			ha.wins += hp == 0;
		}

		let std = Object.entries(teams).map(([name, data]) => ({ name, ...data }));
		std.sort((a, b) => {
			 let d = (b.points * a.games) - (a.points * b.games);
			 if (d)
				 return d;
			 d = b.wins - a.wins;
			 if (d)
			 	return d;
			 return Math.random() - 0.5;
		});

		for (const i in std) {
			let t = result[std[i].name];
			t.positions[i]++;
			t.points += std[i].points;
			t.games += std[i].games;
		}
	}

	postMessage({ id, result, iterations });
}
