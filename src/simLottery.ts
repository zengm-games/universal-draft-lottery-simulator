export const simLottery = (chances: number[], numToPick: number) => {
	let teams = chances.map((chance, index) => ({
		chances: chance,
		index,
	}));

	const pickIndexes: number[] = [];

	for (let i = 0; i < numToPick; i++) {
		let sum = 0;
		for (const t of teams) {
			sum += t.chances;
		}
		const rand = Math.random() * sum;
		let sum2 = 0;
		for (const t of teams) {
			sum2 += t.chances;
			if (rand < sum2) {
				pickIndexes.push(t.index);
				teams = teams.filter((t2) => t2 !== t);

				break;
			}
		}
	}

	pickIndexes.push(...teams.map((team) => team.index));

	return pickIndexes;
};
