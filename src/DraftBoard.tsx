import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { ordinal, teamGradientColors } from "./draftBoardUtil";
import { firstPickOdds, formatOdds } from "./draftLotteryOdds";
import {
	createDraftVideoRecorder,
	DraftVideoRecorder,
} from "./DraftVideoRecorder";

const teamRowStyle = (teamIndex: number, numTeams: number) => {
	const [from, to] = teamGradientColors(teamIndex, numTeams);

	return {
		background: `linear-gradient(180deg, ${from} 0%, ${to} 100%)`,
	};
};

const FIRST_REVEAL_DELAY = 1200;
const TOP_PICK_REVEAL_DELAY = 2500;
const NUM_SLOW_PICKS = 3;

// How long to keep recording after the last pick, so the video includes the
// final flip-in and the glow on the 1st pick
const RECORDING_TAIL_MS = 2500;

// Reveal later picks faster when there are many teams, so the whole reveal
// stays under ~30 seconds, but always slow down for the top picks
const revealDelay = (pick: number, numTeams: number) => {
	if (pick <= NUM_SLOW_PICKS) {
		return TOP_PICK_REVEAL_DELAY;
	}

	return Math.min(2000, Math.max(700, Math.round(24000 / numTeams)));
};

type DraftBoardProps = {
	chances: number[];
	numToPick: number;
	lotteryResults: number[];
	names: string[];
	onClose: () => void;
};

type DraftVideo = {
	url: string;
	filename: string;
	file: File;
	canShare: boolean;
};

export const DraftBoard = ({
	chances,
	numToPick,
	lotteryResults,
	names,
	onClose,
}: DraftBoardProps) => {
	const numTeams = lotteryResults.length;

	// Picks are revealed one at a time, from the last pick up to the 1st
	const [numRevealed, setNumRevealed] = useState(0);
	const done = numRevealed >= numTeams;

	// Each unplaced team's odds of the 1st pick, given the reveals so far
	const odds = useMemo(
		() => firstPickOdds(chances, numToPick, lotteryResults, numRevealed),
		[chances, numToPick, lotteryResults, numRevealed],
	);
	const maxOdds = Math.max(
		...odds.map((teamOdds) => teamOdds ?? 0),
		Number.MIN_VALUE,
	);

	// Where each already-revealed team landed, for the odds panel
	const revealedPicks = useMemo(() => {
		const picks = new Map<number, number>();
		for (let i = numTeams - numRevealed; i < numTeams; i++) {
			picks.set(lotteryResults[i], i + 1);
		}
		return picks;
	}, [lotteryResults, numRevealed, numTeams]);

	// undefined while there might still be a video coming, null when there
	// won't be one
	const [video, setVideo] = useState<DraftVideo | null | undefined>(undefined);

	const resultsRef = useRef<HTMLDivElement>(null);
	const recorderRef = useRef<DraftVideoRecorder | undefined>(undefined);

	useEffect(() => {
		recorderRef.current = createDraftVideoRecorder(
			lotteryResults,
			names,
			chances,
			numToPick,
		);

		return () => {
			recorderRef.current?.cancel();
		};
	}, []);

	useEffect(() => {
		recorderRef.current?.setNumRevealed(numRevealed);
	}, [numRevealed]);

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
		if (!done) {
			return;
		}

		const recorder = recorderRef.current;
		if (!recorder) {
			setVideo(null);
			return;
		}

		// Let the recording run through the final animations before finishing
		const timeout = setTimeout(async () => {
			const blob = await recorder.stop();
			if (!blob) {
				setVideo(null);
				return;
			}

			const filename = `draft-lottery.${recorder.extension}`;
			const file = new File([blob], filename, { type: blob.type });
			setVideo({
				url: URL.createObjectURL(blob),
				filename,
				file,
				canShare:
					typeof navigator.canShare === "function" &&
					navigator.canShare({ files: [file] }),
			});
		}, RECORDING_TAIL_MS);

		return () => {
			clearTimeout(timeout);
		};
	}, [done]);

	useEffect(() => {
		return () => {
			if (video) {
				URL.revokeObjectURL(video.url);
			}
		};
	}, [video]);

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
				<div className="draftboard__main">
					<div className="draftboard__odds">
						<div className="draftboard__odds-title">1st Pick Odds</div>
						{chances.map((_chance, teamIndex) => {
							const teamOdds = odds[teamIndex];
							const placed = teamOdds === undefined;
							const pick = revealedPicks.get(teamIndex);

							return (
								<div
									key={teamIndex}
									className={`draftboard__odds-row${
										placed ? " draftboard__odds-row--placed" : ""
									}`}
								>
									<span
										className="draftboard__odds-chip"
										style={teamRowStyle(teamIndex, numTeams)}
									/>
									<span className="draftboard__odds-name">
										{names[teamIndex] ?? `Team ${teamIndex + 1}`}
									</span>
									<span className="draftboard__odds-value">
										{placed
											? pick !== undefined
												? ordinal(pick)
												: ""
											: formatOdds(teamOdds)}
									</span>
									<div className="draftboard__odds-meter">
										<div
											className="draftboard__odds-meter-fill"
											style={{
												width: `${placed ? 0 : (teamOdds / maxOdds) * 100}%`,
											}}
										/>
									</div>
								</div>
							);
						})}
					</div>
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
					{video ? (
						<>
							<a
								className="draftboard__button"
								href={video.url}
								download={video.filename}
							>
								Download Video
							</a>
							{video.canShare ? (
								<button
									className="draftboard__button"
									type="button"
									onClick={() => {
										navigator
											.share({
												files: [video.file],
												title: "Draft Lottery Results",
											})
											.catch(() => {
												// The user canceled the share
											});
									}}
								>
									Share Video
								</button>
							) : null}
						</>
					) : null}
					<button
						className="draftboard__button"
						type="button"
						onClick={onClose}
					>
						Close
					</button>
				</div>
				{done && video === undefined && recorderRef.current ? (
					<div className="draftboard__status">Preparing video…</div>
				) : null}
			</div>
		</div>
	);
};
