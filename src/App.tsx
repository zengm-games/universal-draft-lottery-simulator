import { useEffect, useState } from "preact/hooks";
import { simLottery } from "./simLottery";
import { Button } from "./Button";
// @ts-expect-error
import MyWorker from "./worker?worker&inline";
import { Table } from "./Table";

const presets = [
	{
		key: "nba2019",
		title: "NBA 2019-present",
		description:
			"Weighted lottery for the top 4 picks, like the NBA since 2019",
		numToPick: 4,
		chances: [140, 140, 140, 125, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5],
	},
	{
		key: "nba1994",
		title: "NBA 1994-2018",
		description:
			"Weighted lottery for the top 3 picks, like the NBA from 1994-2018",
		numToPick: 3,
		chances: [250, 199, 156, 119, 88, 63, 43, 28, 17, 11, 8, 7, 6, 5],
	},
	{
		key: "nba1990",
		title: "NBA 1990-1993",
		description:
			"Weighted lottery for the top 3 picks, like the NBA from 1990-1993",
		numToPick: 3,
		chances: [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
	},
	{
		key: "nba1987",
		title: "NBA 1987-1989",
		description:
			"Random lottery for the top 3 picks, like the NBA from 1987-1989",
		numToPick: 3,
		chances: [1, 1, 1, 1, 1, 1, 1],
	},
	{
		key: "nba1985",
		title: "NBA 1985-1986",
		description:
			"Non-playoff teams draft in random order, like the NBA from 1985-1986",
		numToPick: 7,
		chances: [1, 1, 1, 1, 1, 1, 1],
	},
	{
		key: "nba1966",
		title: "NBA 1966-1984",
		description:
			"Coin flip to determine the top 2 picks, like the NBA from 1966-1984",
		numToPick: 2,
		chances: [1, 1, 0, 0, 0, 0, 0],
	},
	{
		key: "nhl2021",
		title: "NHL 2021-present",
		description:
			"Weighted lottery for the top 2 picks, like the NHL since 2021. This does not include the NHL's constraint on the number of spots a team can move up.",
		numToPick: 2,
		chances: [185, 135, 115, 95, 85, 75, 65, 60, 50, 35, 30, 25, 20, 15, 5, 5],
	},
	{
		key: "nhl2017",
		title: "NHL 2017-2020",
		description:
			"Weighted lottery for the top 3 picks, like the NHL from 2017-2020",
		numToPick: 3,
		chances: [185, 135, 115, 95, 85, 75, 65, 60, 50, 35, 30, 25, 20, 15, 10],
	},
	{
		key: "mlb2022",
		title: "MLB 2022-present",
		description:
			"Weighted lottery for the top 6 picks, like the MLB since 2022",
		numToPick: 6,
		chances: [
			1650, 1650, 1650, 1325, 1000, 750, 550, 390, 270, 180, 140, 110, 90, 76,
			62, 48, 36, 23,
		],
	},
];

export const getDefaultNames = (numTeams: number) => {
	const names = [];
	for (let i = 0; i < numTeams; i++) {
		names.push(`Team ${i + 1}`);
	}
	return names;
};

export const checkNamesAreAllDefault = (names: string[]) => {
	const defaultNames = getDefaultNames(names.length);
	for (let i = 0; i < names.length; i++) {
		if (names[i] !== defaultNames[i]) {
			return false;
		}
	}

	return true;
};

const worker: Worker = new MyWorker();
let requestCount = 0;

const useLocalStorageState = (key: string, defaultValue: any) => {
	const [state, setState] = useState(() => {
		try {
			const stored = localStorage.getItem(key);
			if (stored !== null) {
				return JSON.parse(stored);
			}
		} catch (error) {
			console.warn("useLocalStorageState read error", key, error);
		}

		return typeof defaultValue === "function" ? defaultValue() : defaultValue;
	});

	useEffect(() => {
		try {
			localStorage.setItem(key, JSON.stringify(state));
		} catch (error) {
			console.warn("useLocalStorageState write error", key, error);
		}
	}, [key, state]);

	return [state, setState];
};

export const App = () => {
	const [presetKey, setPresetKey] = useLocalStorageState(
		"presetKey",
		"nba2019",
	);
	const preset = presets.find((preset) => preset.key === presetKey);

	const [chances, setChances] = useLocalStorageState(
		"chances",
		preset?.chances ?? [],
	);
	const [numToPick, setNumToPick] = useLocalStorageState(
		"numToPick",
		preset?.numToPick ?? 0,
	);
	const [lotteryResults, setLotteryResults] = useState<number[] | undefined>();
	const [names, setNames] = useLocalStorageState("names", () =>
		getDefaultNames(chances.length),
	);
	const [loadingProbs, setLoadingProbs] = useState(true);
	const [probs, setProbs] = useState<number[][] | undefined>(); // undefined on initial load only
	const [tooSlow, setTooSlow] = useState(false);

	useEffect(() => {
		setLoadingProbs(true);
		requestCount += 1;
		worker.postMessage({ chances, numToPick, requestCount });
	}, [chances, numToPick]);

	useEffect(() => {
		const listener = (event: any) => {
			// Make sure this data is not already stale
			if (event.data.requestCount !== requestCount) {
				return;
			}

			setTooSlow(event.data.tooSlow);
			setProbs(event.data.probs);
			setLoadingProbs(false);
		};

		worker.addEventListener("message", listener);

		return () => {
			worker.removeEventListener("message", listener);
		};
	}, []);

	const onAddTeam = (direction: "top" | "bottom") => () => {
		setLotteryResults(undefined);

		if (direction === "bottom") {
			setChances([...chances, chances[chances.length - 1] ?? 1]);
		} else {
			setChances([chances[0] ?? 1, ...chances]);
		}

		const namesAreAllDefault = checkNamesAreAllDefault(names);
		if (namesAreAllDefault) {
			setNames(getDefaultNames(chances.length + 1));
		} else {
			if (direction === "bottom") {
				setNames([...names, `Team ${names.length + 1}`]);
			} else {
				setNames([`Team ${names.length + 1}`, ...names]);
			}
		}

		setPresetKey("custom");
	};

	const onClearTeams = () => {
		setLotteryResults(undefined);
		setChances([]);
		setNames([]);
		setPresetKey("custom");
	};

	const addClearButtons = (direction: "top" | "bottom") => (
		<>
			<Button
				variant="primary"
				outline
				className="mr-2"
				onClick={onAddTeam(direction)}
			>
				Add Team
			</Button>

			<Button
				variant="danger"
				outline
				className="mr-2"
				onClick={onClearTeams}
				disabled={chances.length === 0}
			>
				Clear Teams
			</Button>
		</>
	);

	return (
		<>
			<div
				className="columns-2"
				style={{
					maxWidth: 500,
				}}
			>
				<div>
					<label htmlFor="presetKey">Preset Lottery Type</label>
					<select
						className="form-control mt-1 h-[42px]"
						id="presetKey"
						onChange={(event) => {
							const preset = presets.find(
								(preset) => preset.key === (event.target as any).value,
							);

							if (preset) {
								setLotteryResults(undefined);
								setPresetKey(preset.key);
								setChances(preset.chances);
								setNumToPick(preset.numToPick);

								const namesAreAllDefault = checkNamesAreAllDefault(names);
								const numNamesNeeded = preset.chances.length;
								if (namesAreAllDefault) {
									setNames(getDefaultNames(numNamesNeeded));
								} else {
									const newNames = names.slice(0, numNamesNeeded);
									while (newNames.length < numNamesNeeded) {
										newNames.push(`Team ${newNames.length + 1}`);
									}
									setNames(newNames);
								}
							} else {
								setPresetKey("custom");
							}
						}}
						value={preset?.key ?? "custom"}
					>
						{presets.map((preset) => (
							<option key={preset.key} value={preset.key}>
								{preset.title}
							</option>
						))}
						<option value="custom">Custom</option>
					</select>
				</div>

				<div>
					<label htmlFor="numToPick">
						<span className="sm:hidden"># Lottery Selections</span>
						<span className="hidden sm:inline">
							Number of Lottery Selections
						</span>
					</label>
					<input
						className="form-control mt-1 h-[42px]"
						id="numToPick"
						type="number"
						value={numToPick}
						min={0}
						onChange={(event) => {
							setLotteryResults(undefined);
							setPresetKey("custom");
							const number = (event.target as any).valueAsNumber;
							if (number < 0) {
								setNumToPick(0);
							} else {
								setNumToPick(Math.round(number));
							}
						}}
					></input>
				</div>
			</div>
			{preset ? (
				<div className="text-gray-500 mt-1">{preset.description}</div>
			) : null}

			{tooSlow ? (
				<>
					<div className="text-red-600 mt-1">
						Computing exact odds for so many teams and picks is too slow, so
						estimates are shown.
					</div>
				</>
			) : null}

			<div className="mt-3 sm:flex">
				<div>{addClearButtons("top")}</div>

				<div className="mt-2 sm:mt-0">
					<Button
						variant="success"
						onClick={() => {
							const results = simLottery(chances, numToPick);
							setLotteryResults(results);
						}}
						disabled={chances.length === 0}
					>
						Sim Lottery
					</Button>

					{lotteryResults ? (
						<Button
							variant="danger"
							className="ml-2"
							onClick={() => {
								setLotteryResults(undefined);
							}}
							outline
							disabled={chances.length === 0}
						>
							Clear Sim
						</Button>
					) : null}
				</div>
			</div>

			{!probs ? (
				<div className="my-3">Loading...</div>
			) : (
				<>
					{chances.length > 0 ? (
						<div className="mt-2 overflow-x-auto">
							<Table
								chances={chances}
								loadingProbs={loadingProbs}
								lotteryResults={lotteryResults}
								names={names}
								probs={probs}
								setChances={setChances}
								setLotteryResults={setLotteryResults}
								setNames={setNames}
								setPresetKey={setPresetKey}
							/>
						</div>
					) : (
						<div className="my-3">You should add some teams...</div>
					)}

					{chances.length > 0 ? (
						<div className="my-3">{addClearButtons("bottom")}</div>
					) : null}
				</>
			)}
			<div className="alert">
				If you like simulating hypothetical draft lotteries, maybe you'd like
				simulating a whole league? <a href="https://zengm.com/">ZenGM</a> has
				you covered! Play{" "}
				<a href="https://play.basketball-gm.com/">basketball</a>,{" "}
				<a href="https://play.football-gm.com/">football</a>,{" "}
				<a href="https://baseball.zengm.com/">baseball</a>, or{" "}
				<a href="https://hockey.zengm.com/">hockey</a>. You can customize the
				draft lottery and tons of other things, and play as many seasons as you
				want. All for free!
			</div>
			<p>
				<a href="https://github.com/zengm-games/universal-draft-lottery-simulator">
					Source code on GitHub
				</a>
			</p>
		</>
	);
};
