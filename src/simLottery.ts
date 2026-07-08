import type { Nba2027Restrictions } from "./getProbs.ts";

const RESTRICTED_1_PICK = 1;
const RESTRICTED_5_PICK = 5;

// This is needed to handle restricted1/restricted5 for nba2027 easily, otherwise could just be an array
class PickIndexes {
	indexes: number[] = [];
	private nba2027:
		| {
				restrictions: Nba2027Restrictions;
				pending1: number[];
				pending5: number[];
		  }
		| undefined;

	constructor(nba2027Restrictions: Nba2027Restrictions | undefined) {
		if (nba2027Restrictions) {
			this.nba2027 = {
				pending1: [],
				pending5: [],
				restrictions: nba2027Restrictions,
			};
		}
	}

	// Use ignoreRestrictions for riggedLottery stuff
	add(index: number, ignoreRestrictions: boolean) {
		if (this.nba2027 && !ignoreRestrictions) {
			// If we are already past pick 5, then we don't need to worry about giving this pick special treatment
			if (this.indexes.length < RESTRICTED_5_PICK) {
				// restricted5 takes precedence over restricted1
				if (this.nba2027.restrictions.restricted5.includes(index)) {
					this.nba2027.pending5.push(index);
					return;
				} else if (
					this.indexes.length < RESTRICTED_1_PICK &&
					this.nba2027.restrictions.restricted1.includes(index)
				) {
					this.nba2027.pending1.push(index);
					return;
				}
			}
		}

		this.indexes.push(index);

		if (this.nba2027) {
			// If we just added pick 1 or pick 5, then handle pending picks
			if (this.indexes.length >= RESTRICTED_1_PICK && this.nba2027.pending1.length > 0) {
				this.indexes.push(...this.nba2027.pending1);
				this.nba2027.pending1 = [];
			}

			// Not elseif in case somehow the above push triggered this limit too (would need to have customizable limits or somehow 4+ #1 picks)
			if (this.indexes.length >= RESTRICTED_5_PICK && this.nba2027.pending5.length > 0) {
				this.indexes.push(...this.nba2027.pending5);
				this.nba2027.pending5 = [];
			}
		}
	}

	// In some cases, like with very few teams, we can't fully apply the constraints and we just should do it at the end as best possible
	finalizeNba2027() {
		if (this.nba2027) {
			const { pending1, pending5 } = this.nba2027;
			if (pending1.length > 0) {
				this.indexes.push(...pending1);
			}
			if (pending5.length > 0) {
				this.indexes.push(...pending5);
			}
		}
	}
}

export const simLottery = (
	chances: number[],
	numToPick: number,
	nba2027Restrictions: Nba2027Restrictions | undefined,
): number[] => {
	let teams = chances.map((chance, index) => ({
		chances: chance,
		index,
	}));

	const pickIndexes = new PickIndexes(nba2027Restrictions);

	const top12GuaranteedLimit = 12;
	const top12Guaranteed = nba2027Restrictions ? new Set(teams.slice(0, 3)) : undefined;

	const selectLotteryWinner = (t: (typeof teams)[number], ignoreRestrictions: boolean) => {
		pickIndexes.add(t.index, ignoreRestrictions);
		teams = teams.filter((t2) => t2 !== t);
		if (top12Guaranteed) {
			top12Guaranteed.delete(t);
		}
	};

	for (let i = 0; i < numToPick; i++) {
		// For example, if there are still 3 teams left to put in the top 12, then forceTop12 needs to become true when i=9 (10th pick)
		const numTop12GuaranteedLeft = top12Guaranteed?.size;
		const forceTop12 =
			numTop12GuaranteedLeft !== undefined && numTop12GuaranteedLeft > 0
				? i + numTop12GuaranteedLeft >= top12GuaranteedLimit
				: false;

		let sum = 0;
		for (const t of teams) {
			if (forceTop12 && !top12Guaranteed!.has(t)) {
				// No chances for this team, we need to pick one of the worst 3
			} else {
				sum += t.chances;
			}
		}

		const rand = Math.random() * sum;
		let sum2 = 0;
		for (const t of teams) {
			if (forceTop12 && !top12Guaranteed!.has(t)) {
				// No chances for this team, we need to pick one of the worst 3
			} else {
				sum2 += t.chances;
			}
			if (rand < sum2) {
				selectLotteryWinner(t, false);
				break;
			}
		}
	}

	for (const t of teams) {
		pickIndexes.add(t.index, false);
	}

	pickIndexes.finalizeNba2027();

	return pickIndexes.indexes;
};
