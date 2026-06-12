import { useEffect, useRef, useState } from "preact/hooks";

const ordinal = (x: number) => {
	let suffix;

	if (x % 100 >= 11 && x % 100 <= 13) {
		suffix = "th";
	} else if (x % 10 === 1) {
		suffix = "st";
	} else if (x % 10 === 2) {
		suffix = "nd";
	} else if (x % 10 === 3) {
		suffix = "rd";
	} else {
		suffix = "th";
	}

	return x.toString() + suffix;
};

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

// Evenly-spaced hues guarantee every pair of teams is at least 360/numTeams
// degrees apart, and visiting them with a stride near numTeams/φ (kept
// coprime with numTeams so every hue is used once) makes consecutive team
// indexes very different colors
const teamRowStyle = (teamIndex: number, numTeams: number) => {
	let stride = Math.max(1, Math.round(numTeams / 1.618));
	while (gcd(stride, numTeams) !== 1) {
		stride += 1;
	}

	const hue = Math.round(((teamIndex * stride) % numTeams) * (360 / numTeams));

	return {
		background: `linear-gradient(180deg, hsl(${hue}, 65%, 45%) 0%, hsl(${hue}, 70%, 27%) 100%)`,
	};
};

const FIRST_REVEAL_DELAY = 1200;
const TOP_PICK_REVEAL_DELAY = 2500;
const NUM_SLOW_PICKS = 3;

// Reveal later picks faster when there are many teams, so the whole reveal
// stays under ~30 seconds, but always slow down for the top picks
const revealDelay = (pick: number, numTeams: number) => {
	if (pick <= NUM_SLOW_PICKS) {
		return TOP_PICK_REVEAL_DELAY;
	}

	return Math.min(2000, Math.max(700, Math.round(24000 / numTeams)));
};

type DraftBoardProps = {
	lotteryResults: number[];
	names: string[];
	onClose: () => void;
};

export const DraftBoard = ({
	lotteryResults,
	names,
	onClose,
}: DraftBoardProps) => {
	const numTeams = lotteryResults.length;

	// Picks are revealed one at a time, from the last pick up to the 1st
	const [numRevealed, setNumRevealed] = useState(0);
	const done = numRevealed >= numTeams;

	const resultsRef = useRef<HTMLDivElement>(null);
	const fanfarePlayed = useRef(false);

	useEffect(() => {
		if (done) {
			return;
		}

		const nextPick = numTeams - numRevealed;
		const delay =
			numRevealed === 0 ? FIRST_REVEAL_DELAY : revealDelay(nextPick, numTeams);

		const timeout = setTimeout(() => {
			setNumRevealed(numRevealed + 1);
		}, delay);

		return () => {
			clearTimeout(timeout);
		};
	}, [done, numRevealed, numTeams]);

	useEffect(() => {
		if (done && !fanfarePlayed.current) {
			fanfarePlayed.current = true;
			const audio = new Audio("success-fanfare-trumpets-6185.mp3");
			audio.volume = 0.6;

			// Ignore autoplay restrictions
			audio.play().catch(() => {});
		}
	}, [done]);

	// If there are too many teams to fit on screen, keep the newly revealed
	// pick in view. Picks reveal bottom-up, so the first revealed row in
	// document order is the most recent one.
	useEffect(() => {
		if (numRevealed > 0) {
			const row = resultsRef.current?.querySelector(
				".draftboard__row--revealed",
			);
			row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
		}
	}, [numRevealed]);

	useEffect(() => {
		const listener = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};

		window.addEventListener("keydown", listener);

		return () => {
			window.removeEventListener("keydown", listener);
		};
	}, [onClose]);

	return (
		<div className="overlay">
			<div className="draftboard" style={{ "--num-teams": numTeams } as any}>
				<div className="draftboard__title">Draft Lottery Results</div>
				<div className="draftboard__results" ref={resultsRef}>
					{lotteryResults.map((teamIndex, i) => {
						const pick = i + 1;
						const revealed = i >= numTeams - numRevealed;

						const rowClasses = ["draftboard__row"];
						if (revealed) {
							rowClasses.push("draftboard__row--revealed");
						}
						if (revealed && pick === 1) {
							rowClasses.push("draftboard__row--first");
						}

						return (
							<div key={teamIndex} className={rowClasses.join(" ")}>
								<div
									className={`draftboard__pick${
										pick <= 3 ? ` draftboard__pick--${pick}` : ""
									}`}
								>
									{ordinal(pick)}
								</div>
								<div className="draftboard__slot">
									{revealed ? (
										<div
											className="draftboard__team"
											style={teamRowStyle(teamIndex, numTeams)}
										>
											{names[teamIndex] ?? `Team ${teamIndex + 1}`}
										</div>
									) : null}
								</div>
							</div>
						);
					})}
				</div>
				<div className="draftboard__buttons">
					{!done ? (
						<button
							className="draftboard__button"
							type="button"
							onClick={() => {
								setNumRevealed(numTeams);
							}}
						>
							Skip
						</button>
					) : null}
					<button
						className="draftboard__button"
						type="button"
						onClick={onClose}
					>
						Close
					</button>
				</div>
			</div>
		</div>
	);
};
