class MultiDimensionalRange {
	initial: boolean;
	start: number;
	end: number;
	dimensions: number;

	constructor(end: number, dimensions: number) {
		this.initial = true;
		this.start = 0;
		this.end = end;
		this.dimensions = dimensions;
	}

	[Symbol.iterator]() {
		const value = Array(this.dimensions).fill(this.start);

		const getNextValue = (dimension: number): boolean => {
			if (value[dimension] < this.end - 1) {
				if (this.initial) {
					this.initial = false;
				} else {
					value[dimension] += 1;
				}
				return false;
			}

			if (dimension === 0) {
				return true;
			}

			for (let i = dimension; i < this.dimensions; i++) {
				value[i] = this.start;
			}
			return getNextValue(dimension - 1);
		};

		return {
			next: () => {
				const dimension = this.dimensions - 1;
				const done = getNextValue(dimension);
				if (done) {
					return {
						done,
					};
				}

				return {
					value,
					done,
				};
			},
		};
	}
}

const draftLotteryProbsTooSlow = (numTeams: number, numToPick: number) => {
	const count = numTeams ** numToPick;

	// This will happen for baseball (18 teams, 6 picks) except for the hardcoded default
	return count >= 1e7;
};

export const getProbs = (
	chances: number[],
	numToPick: number,
	forceEvenIfTooSlow: boolean,
) => {
	const tooSlow =
		!forceEvenIfTooSlow && draftLotteryProbsTooSlow(chances.length, numToPick);

	const totalChances = chances.reduce((total, current) => total + current, 0);

	const probs: number[][] = [];
	const skipped: number[][] = [];

	// Get probabilities of top N picks for all teams
	for (let i = 0; i < chances.length; i++) {
		probs[i] = [];

		// Initialize values that we'll definitely fill in soon
		for (let j = 0; j < numToPick; j++) {
			probs[i][j] = 0;
		}

		// +1 is to handle the case of 0 skips to N skips
		skipped[i] = Array(numToPick + 1).fill(0);
	}

	const getProb = (indexes: number[]): number => {
		const currentTeamIndex = indexes[0];
		const prevLotteryWinnerIndexes = indexes.slice(1);

		let chancesLeft = totalChances;
		for (const prevTeamIndex of prevLotteryWinnerIndexes) {
			chancesLeft -= chances[prevTeamIndex];
		}

		const priorProb =
			prevLotteryWinnerIndexes.length === 0
				? 1
				: getProb(prevLotteryWinnerIndexes);

		const prob = (priorProb * chances[currentTeamIndex]) / chancesLeft;

		return prob;
	};

	for (let pickIndex = 0; pickIndex < numToPick; pickIndex += 1) {
		if (tooSlow && pickIndex > 0) {
			break;
		}

		const range = new MultiDimensionalRange(chances.length, pickIndex + 1);
		for (const indexes of range) {
			const indexesSet = new Set(indexes);
			if (indexes.length !== indexesSet.size) {
				// Skip case where this team already got an earlier pick
				continue;
			}

			const currentTeamIndex = indexes[0];

			// We're looking at every combination of lottery results. getProb will fill in the probability of this result in probs
			const prob = getProb(indexes);
			probs[currentTeamIndex][pickIndex] += prob;

			// For the later picks, account for how many times each team was "skipped" (lower lottery team won lottery and moved ahead) and keep track of those probabilities
			if (pickIndex === numToPick - 1) {
				for (let i = 0; i < skipped.length; i++) {
					if (indexesSet.has(i)) {
						continue;
					}

					let skipCount = 0;
					for (const ind of indexes) {
						if (ind > i) {
							skipCount += 1;
						}
					}

					skipped[i][skipCount] += prob;
				}
			}
		}
	}

	// Fill in picks (N+1)+
	for (let i = 0; i < chances.length; i++) {
		// Fill in table after first N picks
		for (let j = 0; j < numToPick + 1; j++) {
			if (i + j > numToPick - 1 && i + j < chances.length) {
				probs[i][i + j] = skipped[i][j];
			}
		}
	}

	return {
		tooSlow,
		probs,
	};
};
